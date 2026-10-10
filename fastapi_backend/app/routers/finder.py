import csv
import io
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_optional, require_role
from app.database import get_db
from app.models.audit import AuditLog
from app.models.medicine import Medicine
from app.models.stock_source import SourceStock, SourceUser, StockSource
from app.models.user import User
from app.schemas.stock_source import (
    FinderMultiResponse,
    FinderSearchResponse,
    FinderSearchResult,
    MapMarkerOut,
    MultiCoverageSource,
    SourceStockBulkUpdate,
    SourceStockItemUpdate,
    SourceStockListResponse,
    SourceStockOut,
    StockSourceCreate,
    StockSourceOut,
    StockSourceUpdate,
)
from app.services.distance import haversine_distance
from app.services.multi_finder_service import compute_minimal_set_cover
from app.services.ranking_service import (
    compute_staleness,
    is_near_expiry,
    parse_is_open,
    score_source_result,
)

router = APIRouter(tags=["Multi-Source Finder & Map"])

# In-memory map cache for public map tiles/queries (TTL: 30 seconds)
MAP_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
MAP_CACHE_TTL = 30.0  # seconds


def get_quantity_status(qty: int) -> str:
    if qty <= 0:
        return "out_of_stock"
    elif qty < 20:
        return "low_stock"
    return "available"


def check_source_manager_permission(user: User, source_id: str, db: Session):
    """Ensure user is a district_admin or an assigned source_manager for this source."""
    if user.role in ["district_admin", "admin"]:
        return True

    # Check source_users mapping
    assigned = (
        db.query(SourceUser)
        .filter(SourceUser.user_id == user.id, SourceUser.source_id == source_id)
        .first()
    )
    if assigned:
        return True

    # Check PHC pharmacist/doctor for corresponding PHC source
    if user.phc_id and user.phc_id == source_id:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage stock for this facility.",
    )


# ==============================================================================
# 1. Unified Search Endpoint
# ==============================================================================
@router.get("/finder/search", response_model=FinderSearchResponse)
def search_sources_stock(
    medicine_ids: Optional[str] = Query(None, description="Comma-separated medicine IDs"),
    lat: Optional[float] = Query(None, description="Anchor latitude"),
    lng: Optional[float] = Query(None, description="Anchor longitude"),
    from_source_id: Optional[str] = Query(None, description="Anchor facility ID"),
    radius_km: float = Query(25.0, ge=1.0, le=100.0),
    source_types: Optional[str] = Query(None, description="Comma-separated types"),
    ownership: Optional[str] = Query(None, description="Comma-separated ownerships"),
    free_only: bool = Query(False),
    open_now: bool = Query(False),
    in_stock_only: bool = Query(False),
    sort: str = Query("best_match", description="best_match, distance, price, freshness"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    is_staff = bool(current_user and current_user.role in [
        "pharmacist", "medical_officer", "block_medical_officer", "district_admin", "admin", "source_manager"
    ])

    # 1. Resolve anchor coordinates
    anchor_lat = lat
    anchor_lon = lng
    if from_source_id and (anchor_lat is None or anchor_lon is None):
        anchor_src = db.query(StockSource).filter(StockSource.id == from_source_id).first()
        if anchor_src:
            anchor_lat, anchor_lon = anchor_src.latitude, anchor_src.longitude

    if anchor_lat is None or anchor_lon is None:
        # Default to Chengalpattu District HQ / PHC Alapakkam coordinates
        anchor_lat, anchor_lon = 12.6841, 79.9830

    # 2. Parse medicine IDs
    med_id_list = [m.strip() for m in medicine_ids.split(",") if m.strip()] if medicine_ids else []
    primary_med_id = med_id_list[0] if med_id_list else "med_01"

    # Query primary medicine for metadata
    target_med = db.query(Medicine).filter(Medicine.id == primary_med_id).first()
    med_name = target_med.name if target_med else "General Medicine"
    med_form = target_med.form if target_med else "Unit"
    is_cold_chain = target_med.is_cold_chain if target_med else False
    is_critical = target_med.is_critical if target_med else False

    # 3. Base query for sources
    query = db.query(StockSource).filter(StockSource.is_active == True, StockSource.is_verified == True)

    # Hide staff_only from public
    if not is_staff:
        query = query.filter(StockSource.visibility == "public")

    if source_types:
        st_list = [t.strip() for t in source_types.split(",") if t.strip()]
        query = query.filter(StockSource.source_type.in_(st_list))

    if ownership:
        own_list = [o.strip() for o in ownership.split(",") if o.strip()]
        query = query.filter(StockSource.ownership.in_(own_list))

    if free_only:
        query = query.filter(StockSource.ownership == "government")

    all_sources = query.all()

    # 4. Fetch stock items for the primary medicine across all sources
    stock_records = (
        db.query(SourceStock)
        .filter(SourceStock.medicine_id == primary_med_id)
        .all()
    )
    stock_map = {s.source_id: s for s in stock_records}

    # 5. Filter by radius, open_now, in_stock_only, and score
    scored_results: List[FinderSearchResult] = []

    for src in all_sources:
        dist = haversine_distance(anchor_lat, anchor_lon, src.latitude, src.longitude)
        if dist > radius_km:
            continue

        stock_item = stock_map.get(src.id)
        qty = stock_item.quantity if stock_item else 0
        price = stock_item.price_per_unit if stock_item else (0.0 if src.ownership == "government" else 0.0)
        is_free = (src.ownership == "government") or (price is None or price <= 0.0)

        if in_stock_only and qty <= 0:
            continue

        is_open = parse_is_open(src.opening_hours, src.is_24x7)
        if open_now and not is_open:
            continue

        last_up = stock_item.last_updated if stock_item else src.created_at
        is_stale, stale_sev, _ = compute_staleness(last_up)

        score, reasons = score_source_result(src, stock_item, dist)

        # Quantity privacy rule: public sees quantity_status; staff sees exact quantity
        qty_status = get_quantity_status(qty)
        exposed_qty = qty if is_staff else None

        scored_results.append(
            FinderSearchResult(
                source_id=src.id,
                name=src.name,
                source_type=src.source_type,
                ownership=src.ownership,
                distance_km=round(dist, 2),
                quantity=exposed_qty,
                quantity_status=qty_status,
                price_per_unit=price,
                is_free=is_free,
                last_updated=last_up,
                is_stale=is_stale,
                stale_severity=stale_sev,
                is_open=is_open,
                opening_hours=src.opening_hours,
                phone=src.phone,
                latitude=src.latitude,
                longitude=src.longitude,
                score=score,
                score_reasons=reasons,
                medicine_id=primary_med_id,
                medicine_name=med_name,
                medicine_form=med_form,
                is_cold_chain=is_cold_chain,
                is_critical=is_critical,
            )
        )

    # 6. Sorting
    if sort == "distance":
        scored_results.sort(key=lambda r: (r.distance_km, -r.score))
    elif sort == "price":
        scored_results.sort(key=lambda r: (r.price_per_unit or 0.0, r.distance_km))
    elif sort == "freshness":
        scored_results.sort(key=lambda r: (1 if r.is_stale else 0, r.distance_km))
    else:  # best_match (default)
        scored_results.sort(key=lambda r: (-r.score, r.distance_km))

    total = len(scored_results)
    start_idx = (page - 1) * page_size
    paged = scored_results[start_idx : start_idx + page_size]

    return FinderSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=paged,
    )


# ==============================================================================
# 2. Multi-Medicine Search & Minimal Set Suggestion
# ==============================================================================
@router.get("/finder/multi", response_model=FinderMultiResponse)
def search_multi_medicines(
    medicine_ids: str = Query(..., description="Comma-separated medicine IDs"),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    from_source_id: Optional[str] = Query(None),
    radius_km: float = Query(35.0, ge=1.0, le=100.0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    med_list = [m.strip() for m in medicine_ids.split(",") if m.strip()]
    if not med_list:
        raise HTTPException(status_code=400, detail="medicine_ids cannot be empty")

    anchor_lat = lat
    anchor_lon = lng
    if from_source_id and (anchor_lat is None or anchor_lon is None):
        anchor_src = db.query(StockSource).filter(StockSource.id == from_source_id).first()
        if anchor_src:
            anchor_lat, anchor_lon = anchor_src.latitude, anchor_src.longitude

    if anchor_lat is None or anchor_lon is None:
        anchor_lat, anchor_lon = 12.6841, 79.9830

    is_staff = bool(current_user and current_user.role in [
        "pharmacist", "medical_officer", "block_medical_officer", "district_admin", "admin"
    ])

    # Fetch medicines info
    meds = db.query(Medicine).filter(Medicine.id.in_(med_list)).all()
    med_info = [{"id": m.id, "name": m.name, "form": m.form} for m in meds]

    # Query active sources
    query = db.query(StockSource).filter(StockSource.is_active == True, StockSource.is_verified == True)
    if not is_staff:
        query = query.filter(StockSource.visibility == "public")
    sources = query.all()

    # Query stock for all requested medicines
    stock_rows = (
        db.query(SourceStock)
        .filter(SourceStock.medicine_id.in_(med_list), SourceStock.quantity > 0)
        .all()
    )

    # Group by source_id
    source_stock_map: Dict[str, Dict[str, SourceStock]] = {}
    for row in stock_rows:
        if row.source_id not in source_stock_map:
            source_stock_map[row.source_id] = {}
        source_stock_map[row.source_id][row.medicine_id] = row

    sources_with_coverage: List[MultiCoverageSource] = []
    candidates_for_set_cover: List[Dict[str, Any]] = []

    for src in sources:
        dist = haversine_distance(anchor_lat, anchor_lon, src.latitude, src.longitude)
        if dist > radius_km:
            continue

        available_meds = source_stock_map.get(src.id, {})
        in_stock_ids = list(available_meds.keys())
        missing_ids = [m for m in med_list if m not in in_stock_ids]

        est_cost = 0.0
        prices_map: Dict[str, float] = {}
        for m_id, item in available_meds.items():
            cost = item.price_per_unit if (src.ownership != "government" and item.price_per_unit) else 0.0
            prices_map[m_id] = cost
            est_cost += cost

        cov_count = len(in_stock_ids)
        cov_ratio = round(cov_count / len(med_list), 2)

        cov_obj = MultiCoverageSource(
            source_id=src.id,
            name=src.name,
            source_type=src.source_type,
            ownership=src.ownership,
            distance_km=round(dist, 2),
            covers_count=cov_count,
            total_requested=len(med_list),
            coverage_ratio=cov_ratio,
            in_stock_medicines=in_stock_ids,
            missing_medicines=missing_ids,
            estimated_total_cost=round(est_cost, 2),
            phone=src.phone,
            latitude=src.latitude,
            longitude=src.longitude,
        )
        sources_with_coverage.append(cov_obj)

        candidates_for_set_cover.append({
            "source_id": src.id,
            "name": src.name,
            "source_type": src.source_type,
            "ownership": src.ownership,
            "distance_km": dist,
            "phone": src.phone,
            "latitude": src.latitude,
            "longitude": src.longitude,
            "in_stock_medicines": in_stock_ids,
            "medicine_prices": prices_map,
            "estimated_cost": est_cost,
        })

    # Sort sources by coverage ratio descending, then distance ascending
    sources_with_coverage.sort(key=lambda s: (-s.coverage_ratio, s.distance_km))

    # Calculate optimal minimal set itinerary
    best_combo = compute_minimal_set_cover(candidates_for_set_cover, med_list)

    return FinderMultiResponse(
        requested_medicines=med_info,
        total_sources_evaluated=len(sources_with_coverage),
        sources_with_coverage=sources_with_coverage[:25],
        best_combination=best_combo,
    )


# ==============================================================================
# 3. Map Bounding-Box Markers Endpoint
# ==============================================================================
@router.get("/map/sources", response_model=List[MapMarkerOut])
def get_map_sources(
    bbox: Optional[str] = Query(None, description="min_lat,min_lng,max_lat,max_lng"),
    types: Optional[str] = Query(None, description="Comma-separated source types"),
    medicine_id: Optional[str] = Query(None),
    radius_km: Optional[float] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    is_staff = bool(current_user and current_user.role in [
        "pharmacist", "medical_officer", "block_medical_officer", "district_admin", "admin"
    ])

    # Check cache for unauthenticated requests without custom medicine search
    cache_key = f"{bbox}:{types}:{medicine_id}:{radius_km}:{lat}:{lng}:{is_staff}"
    now_ts = time.time()
    if cache_key in MAP_CACHE:
        cached_ts, cached_data = MAP_CACHE[cache_key]
        if now_ts - cached_ts < MAP_CACHE_TTL:
            return cached_data

    query = db.query(StockSource).filter(StockSource.is_active == True, StockSource.is_verified == True)
    if not is_staff:
        query = query.filter(StockSource.visibility == "public")

    if types:
        t_list = [t.strip() for t in types.split(",") if t.strip()]
        query = query.filter(StockSource.source_type.in_(t_list))

    # Bounding-box filter
    if bbox:
        try:
            parts = [float(x.strip()) for x in bbox.split(",")]
            if len(parts) == 4:
                min_lat, min_lng, max_lat, max_lng = parts
                query = query.filter(
                    StockSource.latitude >= min_lat,
                    StockSource.latitude <= max_lat,
                    StockSource.longitude >= min_lng,
                    StockSource.longitude <= max_lng,
                )
        except Exception:
            pass

    sources = query.all()

    # Pre-fetch stock if medicine_id is queried
    stock_map = {}
    if medicine_id:
        st_rows = db.query(SourceStock).filter(SourceStock.medicine_id == medicine_id).all()
        stock_map = {s.source_id: s for s in st_rows}

    markers: List[MapMarkerOut] = []
    for s in sources:
        dist = None
        if lat is not None and lng is not None:
            dist = round(haversine_distance(lat, lng, s.latitude, s.longitude), 2)
            if radius_km and dist > radius_km:
                continue

        is_open = parse_is_open(s.opening_hours, s.is_24x7)
        stock_item = stock_map.get(s.id) if medicine_id else None

        avail_status = None
        qty = None
        price = None
        is_free = None
        is_stale = False

        if medicine_id:
            raw_qty = stock_item.quantity if stock_item else 0
            avail_status = get_quantity_status(raw_qty)
            qty = raw_qty if is_staff else None
            price = stock_item.price_per_unit if stock_item else 0.0
            is_free = (s.ownership == "government") or (price is None or price <= 0.0)
            is_stale, _, _ = compute_staleness(stock_item.last_updated if stock_item else s.created_at)

        markers.append(
            MapMarkerOut(
                id=s.id,
                name=s.name,
                source_type=s.source_type,
                ownership=s.ownership,
                latitude=s.latitude,
                longitude=s.longitude,
                phone=s.phone,
                opening_hours=s.opening_hours,
                is_24x7=s.is_24x7,
                is_open=is_open,
                distance_km=dist,
                availability_status=avail_status,
                quantity=qty,
                price_per_unit=price,
                is_free=is_free,
                is_stale=is_stale,
            )
        )

    # Save in memory cache
    MAP_CACHE[cache_key] = (now_ts, markers)
    return markers


# ==============================================================================
# 4. Marker Detail & Full Stock List
# ==============================================================================
@router.get("/map/sources/{source_id}/stock", response_model=SourceStockListResponse)
def get_source_stock_list(
    source_id: str,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    in_stock_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    source = db.query(StockSource).filter(StockSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Stock source not found")

    is_staff = bool(current_user and current_user.role in [
        "pharmacist", "medical_officer", "block_medical_officer", "district_admin", "admin", "source_manager"
    ])

    if source.visibility == "staff_only" and not is_staff:
        raise HTTPException(status_code=403, detail="Facility details are restricted to authorized medical staff.")

    query = (
        db.query(SourceStock, Medicine)
        .join(Medicine, SourceStock.medicine_id == Medicine.id)
        .filter(SourceStock.source_id == source_id)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Medicine.name.ilike(search_fmt),
                Medicine.generic_name.ilike(search_fmt),
                Medicine.code.ilike(search_fmt),
            )
        )

    if category:
        query = query.filter(Medicine.category == category)

    if in_stock_only:
        query = query.filter(SourceStock.quantity > 0)

    total_items = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    items: List[SourceStockOut] = []
    for stock_row, med in rows:
        is_stale, stale_sev, _ = compute_staleness(stock_row.last_updated)
        near_exp = is_near_expiry(stock_row.expiry_date, 30)
        is_free = (source.ownership == "government") or (stock_row.price_per_unit is None or stock_row.price_per_unit <= 0.0)

        items.append(
            SourceStockOut(
                id=stock_row.id,
                source_id=stock_row.source_id,
                medicine_id=med.id,
                medicine_name=med.name,
                generic_name=med.generic_name,
                category=med.category,
                form=med.form,
                strength=med.strength,
                quantity=stock_row.quantity if is_staff else None,
                quantity_status=get_quantity_status(stock_row.quantity),
                price_per_unit=stock_row.price_per_unit,
                is_free=is_free,
                batch_no=stock_row.batch_no,
                expiry_date=stock_row.expiry_date,
                is_near_expiry=near_exp,
                is_cold_chain=med.is_cold_chain,
                is_critical=med.is_critical,
                last_updated=stock_row.last_updated,
                is_stale=is_stale,
                stale_severity=stale_sev,
            )
        )

    return SourceStockListResponse(
        source=StockSourceOut.model_validate(source),
        items=items,
        total_items=total_items,
        page=page,
        page_size=page_size,
    )


# ==============================================================================
# 5. Suggest Alternatives for Low-Stock PHC
# ==============================================================================
@router.get("/finder/suggest")
def suggest_alternatives(
    from_source_id: str = Query(...),
    medicine_id: str = Query(...),
    radius_km: float = Query(30.0, ge=1.0, le=100.0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    anchor = db.query(StockSource).filter(StockSource.id == from_source_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="Anchor source not found")

    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    is_staff = bool(current_user and current_user.role in [
        "pharmacist", "medical_officer", "block_medical_officer", "district_admin", "admin"
    ])

    query = db.query(StockSource).filter(
        StockSource.id != from_source_id,
        StockSource.is_active == True,
        StockSource.is_verified == True,
    )
    if not is_staff:
        query = query.filter(StockSource.visibility == "public")

    other_sources = query.all()

    stock_rows = (
        db.query(SourceStock)
        .filter(SourceStock.medicine_id == medicine_id, SourceStock.quantity > 0)
        .all()
    )
    stock_dict = {s.source_id: s for s in stock_rows}

    suggestions = []
    for src in other_sources:
        dist = haversine_distance(anchor.latitude, anchor.longitude, src.latitude, src.longitude)
        if dist > radius_km:
            continue

        item = stock_dict.get(src.id)
        if not item:
            continue

        score, reasons = score_source_result(src, item, dist)
        price_tag = "FREE" if (src.ownership == "government" or not item.price_per_unit) else f"₹{item.price_per_unit:.2f}"
        qty_tag = f"{item.quantity} in stock" if is_staff else get_quantity_status(item.quantity).replace("_", " ").title()

        suggestions.append({
            "source_id": src.id,
            "name": src.name,
            "source_type": src.source_type,
            "ownership": src.ownership,
            "distance_km": round(dist, 1),
            "quantity": item.quantity if is_staff else None,
            "quantity_status": get_quantity_status(item.quantity),
            "price_tag": price_tag,
            "phone": src.phone,
            "score": score,
            "tagline": f"{src.ownership.title()} ({price_tag}), {dist:.1f} km away, {qty_tag}",
            "reasons": reasons,
        })

    suggestions.sort(key=lambda s: -s["score"])
    return {
        "anchor_source": {"id": anchor.id, "name": anchor.name},
        "medicine": {"id": med.id, "name": med.name, "form": med.form},
        "total_alternatives": len(suggestions),
        "suggestions": suggestions[:15],
    }


# ==============================================================================
# 6. Source Stock Management (Single, Bulk, CSV)
# ==============================================================================
@router.post("/finder/sources/{source_id}/stock", status_code=status.HTTP_201_CREATED)
def update_single_source_stock(
    source_id: str,
    payload: SourceStockItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_source_manager_permission(current_user, source_id, db)

    existing = (
        db.query(SourceStock)
        .filter(SourceStock.source_id == source_id, SourceStock.medicine_id == payload.medicine_id)
        .first()
    )

    if existing:
        existing.quantity = payload.quantity
        if payload.price_per_unit is not None:
            existing.price_per_unit = payload.price_per_unit
        if payload.batch_no:
            existing.batch_no = payload.batch_no
        if payload.expiry_date:
            existing.expiry_date = payload.expiry_date
        existing.last_updated = datetime.now(timezone.utc)
        existing.updated_by = current_user.name
        existing.data_origin = "manual"
    else:
        new_item = SourceStock(
            id=payload.client_entry_id or f"ss_{source_id}_{payload.medicine_id}_{int(time.time()*1000)}",
            source_id=source_id,
            medicine_id=payload.medicine_id,
            quantity=payload.quantity,
            price_per_unit=payload.price_per_unit or 0.0,
            batch_no=payload.batch_no,
            expiry_date=payload.expiry_date,
            last_updated=datetime.now(timezone.utc),
            updated_by=current_user.name,
            data_origin="manual",
        )
        db.add(new_item)

    # Audit log
    audit = AuditLog(
        id=f"aud_{int(time.time()*1000)}",
        user_id=current_user.id,
        action="UPDATE_SOURCE_STOCK",
        entity="SOURCE_STOCK",
        entity_id=f"{source_id}:{payload.medicine_id}",
        details=f"Updated quantity to {payload.quantity} for {payload.medicine_id}",
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "source_id": source_id, "medicine_id": payload.medicine_id, "quantity": payload.quantity}


@router.post("/finder/sources/{source_id}/stock/bulk")
def update_bulk_source_stock(
    source_id: str,
    payload: SourceStockBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_source_manager_permission(current_user, source_id, db)

    count = 0
    now = datetime.now(timezone.utc)
    for item in payload.items:
        existing = (
            db.query(SourceStock)
            .filter(SourceStock.source_id == source_id, SourceStock.medicine_id == item.medicine_id)
            .first()
        )
        if existing:
            existing.quantity = item.quantity
            if item.price_per_unit is not None:
                existing.price_per_unit = item.price_per_unit
            if item.batch_no:
                existing.batch_no = item.batch_no
            if item.expiry_date:
                existing.expiry_date = item.expiry_date
            existing.last_updated = now
            existing.updated_by = current_user.name
        else:
            new_item = SourceStock(
                id=f"ss_{source_id}_{item.medicine_id}_{int(time.time()*1000)}_{count}",
                source_id=source_id,
                medicine_id=item.medicine_id,
                quantity=item.quantity,
                price_per_unit=item.price_per_unit or 0.0,
                batch_no=item.batch_no,
                expiry_date=item.expiry_date,
                last_updated=now,
                updated_by=current_user.name,
                data_origin="manual",
            )
            db.add(new_item)
        count += 1

    # Audit log
    audit = AuditLog(
        id=f"aud_{int(time.time()*1000)}",
        user_id=current_user.id,
        action="BULK_UPDATE_SOURCE_STOCK",
        entity="STOCK_SOURCE",
        entity_id=source_id,
        details=f"Bulk updated {count} medicines via payload {payload.client_entry_id or 'direct'}",
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "source_id": source_id, "items_updated": count}


@router.post("/finder/sources/{source_id}/stock/csv")
async def upload_csv_source_stock(
    source_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_source_manager_permission(current_user, source_id, db)

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    updated_count = 0
    now = datetime.now(timezone.utc)

    # Pre-fetch all medicines mapping by code and ID
    meds = db.query(Medicine).all()
    med_lookup = {m.id.lower(): m.id for m in meds}
    med_lookup.update({m.code.lower(): m.id for m in meds})
    med_lookup.update({m.name.lower(): m.id for m in meds})

    for row in reader:
        # Expected column variations: medicine_id, medicine_code, code, name
        m_ident = row.get("medicine_id") or row.get("medicine_code") or row.get("code") or row.get("name")
        if not m_ident:
            continue

        resolved_med_id = med_lookup.get(m_ident.strip().lower())
        if not resolved_med_id:
            continue

        try:
            qty = int(row.get("quantity") or row.get("qty") or 0)
        except ValueError:
            qty = 0

        try:
            price = float(row.get("price") or row.get("price_per_unit") or 0.0)
        except ValueError:
            price = 0.0

        batch = row.get("batch_no") or row.get("batch") or None
        expiry = row.get("expiry_date") or row.get("expiry") or None

        existing = (
            db.query(SourceStock)
            .filter(SourceStock.source_id == source_id, SourceStock.medicine_id == resolved_med_id)
            .first()
        )
        if existing:
            existing.quantity = qty
            existing.price_per_unit = price
            if batch:
                existing.batch_no = batch
            if expiry:
                existing.expiry_date = expiry
            existing.last_updated = now
            existing.updated_by = current_user.name
            existing.data_origin = "csv"
        else:
            new_item = SourceStock(
                id=f"ss_csv_{source_id}_{resolved_med_id}_{int(time.time()*1000)}",
                source_id=source_id,
                medicine_id=resolved_med_id,
                quantity=qty,
                price_per_unit=price,
                batch_no=batch,
                expiry_date=expiry,
                last_updated=now,
                updated_by=current_user.name,
                data_origin="csv",
            )
            db.add(new_item)
        updated_count += 1

    audit = AuditLog(
        id=f"aud_{int(time.time()*1000)}",
        user_id=current_user.id,
        action="CSV_UPLOAD_SOURCE_STOCK",
        entity="STOCK_SOURCE",
        entity_id=source_id,
        details=f"CSV upload processed {updated_count} items from {file.filename}",
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "filename": file.filename, "rows_processed": updated_count}


# ==============================================================================
# 7. Admin Source Operations
# ==============================================================================
@router.get("/finder/admin/sources", response_model=List[StockSourceOut])
def list_admin_sources(
    source_type: Optional[str] = Query(None),
    is_verified: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin", "admin", "block_medical_officer"])),
):
    query = db.query(StockSource)
    if source_type:
        query = query.filter(StockSource.source_type == source_type)
    if is_verified is not None:
        query = query.filter(StockSource.is_verified == is_verified)
    if is_active is not None:
        query = query.filter(StockSource.is_active == is_active)
    return query.order_by(StockSource.name.asc()).all()


@router.post("/finder/admin/sources", response_model=StockSourceOut, status_code=status.HTTP_201_CREATED)
def create_admin_source(
    payload: StockSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin", "admin"])),
):
    src_id = payload.id or f"src_{payload.source_type}_{int(time.time()*1000)}"
    new_src = StockSource(
        id=src_id,
        source_type=payload.source_type,
        name=payload.name,
        address=payload.address,
        block=payload.block,
        district=payload.district,
        latitude=payload.latitude,
        longitude=payload.longitude,
        phone=payload.phone,
        opening_hours=payload.opening_hours,
        is_24x7=payload.is_24x7,
        ownership=payload.ownership,
        is_verified=payload.is_verified,
        is_active=payload.is_active,
        visibility=payload.visibility,
        parent_source_id=payload.parent_source_id,
    )
    db.add(new_src)
    db.commit()
    db.refresh(new_src)
    return new_src


@router.patch("/finder/admin/sources/{source_id}", response_model=StockSourceOut)
def patch_admin_source(
    source_id: str,
    payload: StockSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin", "admin"])),
):
    src = db.query(StockSource).filter(StockSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Stock source not found")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(src, field, val)

    db.commit()
    db.refresh(src)
    return src
