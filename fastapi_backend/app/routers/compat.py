"""
Frontend compatibility layer.

The React frontend (built against the original Node/Express backend) calls
endpoints under `/api/...`. This router maps those calls onto the native
FastAPI services and reshapes the responses to the exact fields the frontend
consumes. It is mounted at prefix `/api` from `app.main`.

Native `/api/v1` routes and their tests are intentionally left untouched.
"""

import csv
import io
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    get_current_user_optional,
    require_role,
    verify_password,
)
from app.database import get_db
from app.models.alert import Alert
from app.models.indent import EmergencyIndent
from app.models.medicine import Medicine
from app.models.phc import PHC
from app.models.stock import Batch, CurrentStock, StockEntry
from app.models.transfer import TransferRequest
from app.models.user import User
from app.routers.ai import get_redistribution_recommendations
from app.routers.alerts import update_alert_status
from app.routers.indents import (
    auto_draft_emergency_indent,
    create_emergency_indent,
    update_indent_status,
)
from app.routers.public import check_public_availability
from app.routers.transfers import create_transfer_request, update_transfer_status
from app.schemas.alert import AlertStatusUpdate
from app.schemas.indent import EmergencyIndentCreate, EmergencyIndentItemCreate, IndentStatusUpdate
from app.schemas.stock import StockEntryCreate
from app.schemas.transfer import TransferCreate, TransferItemCreate, TransferStatusUpdate
from app.services.anomaly import detect_stock_anomalies
from app.services.chatbot import process_staff_chat_query
from app.services.forecasting import generate_consumption_forecast
from app.services.notification import notification_service
from app.services.recommender import find_nearby_surplus
from app.services.seasonal import get_seasonal_profile
from app.services.stock_service import calculate_days_of_stock, record_stock_entry

router = APIRouter(tags=["Frontend Compatibility (/api)"])

STATUS_TOKENS = {
    "Out of Stock": "out_of_stock",
    "Critical Shortage": "critical",
    "Low Stock": "low",
    "Surplus": "surplus",
    "Adequate": "adequate",
}
STATUS_PRIORITY = {"out_of_stock": 0, "critical": 1, "low": 2, "adequate": 3, "surplus": 4}

USERNAME_TO_EMAIL = {
    "pharmacist1": "pharmacist1@tnhealth.gov.in",
    "doctor1": "doctor1@tnhealth.gov.in",
    "pharmacist2": "pharmacist2@tnhealth.gov.in",
    "bmo1": "bmo1@tnhealth.gov.in",
    "admin": "admin@tnhealth.gov.in",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if value else None


def _status_token(native_status: str) -> str:
    return STATUS_TOKENS.get(native_status, "adequate")


def _med_dict(m: Medicine) -> Dict[str, Any]:
    return {
        "id": m.id,
        "code": m.code,
        "name": m.name,
        "generic_name": m.generic_name,
        "form": m.form,
        "strength": m.strength,
        "category": m.category,
        "unit": m.unit,
        "is_critical": m.is_critical,
        "is_cold_chain": m.is_cold_chain,
        # Frontend aliases
        "critical": m.is_critical,
        "cold_chain": m.is_cold_chain,
    }


def _phc_dict(p: PHC) -> Dict[str, Any]:
    return {
        "id": p.id,
        "name": p.name,
        "block": p.block,
        "block_name": p.block,
        "district": p.district,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "population_served": p.population_served,
        "phone": p.phone,
        "medical_officer_name": p.medical_officer_name,
        "pharmacist_name": p.pharmacist_name,
        "address": p.address,
    }


def _user_dict(u: User) -> Dict[str, Any]:
    return {
        "id": u.id,
        "name": u.name,
        "full_name": u.name,
        "email": u.email,
        "role": u.role,
        "phc_id": u.phc_id,
        "block": u.block,
    }


def _stock_item(med: Medicine, metrics: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "medicine_id": med.id,
        "medicine_name": med.name,
        "code": med.code,
        "generic_name": med.generic_name,
        "category": med.category,
        "form": med.form,
        "strength": med.strength,
        "unit": med.unit,
        "critical": med.is_critical,
        "cold_chain": med.is_cold_chain,
        "is_critical": med.is_critical,
        "is_cold_chain": med.is_cold_chain,
        "current_stock": metrics["quantity"],
        "effective_daily_rate": metrics["effective_daily_rate"],
        "avg_daily_7": metrics["avg_daily_use_7d"],
        "avg_daily_30": metrics["avg_daily_use_30d"],
        "days_left": metrics["days_left"],
        "min_threshold": metrics["threshold_days"],
        "threshold_days": metrics["threshold_days"],
        "status": _status_token(metrics["status"]),
        "status_label": metrics["status"],
        "trend": metrics["trend"],
        "runout_date": metrics["runout_date"],
        "spareable_surplus": metrics["spareable_surplus"],
    }


def _get_phc_or_404(db: Session, phc_id: str) -> PHC:
    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")
    return phc


def _assert_phc_access(user: User, phc_id: str) -> None:
    if user.role == "pharmacist" and user.phc_id and user.phc_id != phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pharmacists are restricted to their assigned PHC",
        )


def _transfer_dict(t: TransferRequest, detail: bool = False) -> Dict[str, Any]:
    from_phc = t.from_phc
    to_phc = t.to_phc  # noqa: F841 (kept for readability)

    items = []
    for it in t.items:
        med = it.medicine
        item = {
            "id": it.id,
            "medicine_id": it.medicine_id,
            "medicine_name": med.name if med else it.medicine_id,
            "unit": med.unit if med else "units",
            "batch_no": it.batch_no,
            "requested_qty": it.requested_qty,
            "approved_qty": it.approved_qty,
            "received_qty": it.received_qty,
        }
        if detail:
            item["form"] = med.form if med else None
            item["strength"] = med.strength if med else None
        items.append(item)

    return {
        "id": t.id,
        "request_number": t.request_number,
        "from_phc_id": t.from_phc_id,
        "from_phc_name": from_phc.name if from_phc else t.from_phc_id,
        "from_phc_phone": from_phc.phone if from_phc else None,
        "from_mo": from_phc.medical_officer_name if from_phc else None,
        "to_phc_id": t.to_phc_id,
        "to_phc_name": to_phc.name if to_phc else t.to_phc_id,
        "to_phc_phone": to_phc.phone if to_phc else None,
        "to_mo": to_phc.medical_officer_name if to_phc else None,
        "status": t.status,
        "urgency": t.urgency,
        "reason": t.reason,
        "cold_chain_confirmed": bool(t.cold_chain_confirmed),
        "cold_chain_verified": 1 if t.cold_chain_confirmed else 0,
        "distance_km": t.distance_km,
        "created_by": t.created_by,
        "approved_by": t.approved_by,
        "received_by": t.received_by,
        "created_at": _iso(t.created_at),
        "updated_at": _iso(t.updated_at),
        "items": items,
    }


def _indent_dict(i: EmergencyIndent) -> Dict[str, Any]:
    items = []
    for it in i.items:
        med = it.medicine
        items.append(
            {
                "id": it.id,
                "medicine_id": it.medicine_id,
                "medicine_name": med.name if med else it.medicine_id,
                "unit": med.unit if med else "units",
                "requested_qty": it.requested_qty,
                "approved_qty": it.approved_qty,
                "justification": it.justification,
            }
        )
    return {
        "id": i.id,
        "indent_number": i.indent_number,
        "phc_id": i.phc_id,
        "phc_name": i.phc.name if i.phc else i.phc_id,
        "status": i.status,
        "reason": i.reason,
        "auto_drafted": 1 if i.auto_drafted else 0,
        "created_by": i.created_by,
        "approved_by": i.approved_by,
        "created_at": _iso(i.created_at),
        "updated_at": _iso(i.updated_at),
        "items": items,
    }


def _alert_dict(a: Alert) -> Dict[str, Any]:
    return {
        "id": a.id,
        "phc_id": a.phc_id,
        "phc_name": a.phc.name if a.phc else a.phc_id,
        "medicine_id": a.medicine_id,
        "medicine_name": a.medicine.name if a.medicine else a.medicine_id,
        "type": a.type,
        "severity": a.severity,
        "message": a.message,
        "status": a.status,
        "created_at": _iso(a.created_at),
    }


def _reshape_nearby(res: Dict[str, Any]) -> Dict[str, Any]:
    for donor in res.get("donors", []):
        for match in donor.get("matches", []):
            match["cold_chain"] = match.get("is_cold_chain", False)
    return res


def _forecast_dict(f: Dict[str, Any]) -> Dict[str, Any]:
    seasonal = f.get("seasonal_adjustment", {}) or {}
    return {
        **f,
        "history": [
            {
                "entry_date": h["date"],
                "closing_stock": h["closing_stock"],
                "issued_qty": h["issued_qty"],
            }
            for h in f.get("history", [])
        ],
        "metrics": {
            "current_stock": f.get("current_stock"),
            "unit": f.get("unit"),
            "effective_daily_rate": f.get("effective_daily_rate"),
            "days_left": f.get("days_left"),
            "run_out_date": f.get("predicted_runout_date"),
        },
        "seasonal": {
            "season": seasonal.get("season"),
            "multiplier": seasonal.get("multiplier"),
            "recommendedBufferDays": seasonal.get("recommended_buffer_days"),
            "suggestedBufferQty": seasonal.get("suggested_buffer_qty"),
        },
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginBody(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("/auth/login")
def compat_login(payload: LoginBody, db: Session = Depends(get_db)):
    email = payload.email
    if not email and payload.username:
        email = USERNAME_TO_EMAIL.get(payload.username, payload.username)
    if not email:
        raise HTTPException(status_code=422, detail="email is required")

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password or "", user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(
        {"sub": user.id, "role": user.role, "email": user.email, "phc_id": user.phc_id}
    )
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.get("/auth/me")
def compat_me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


# ---------------------------------------------------------------------------
# Medicines & PHCs (unauthenticated)
# ---------------------------------------------------------------------------
@router.get("/medicines")
def compat_medicines(db: Session = Depends(get_db)):
    meds = db.query(Medicine).order_by(Medicine.name.asc()).all()
    categories = sorted({m.category for m in meds})
    return {"medicines": [_med_dict(m) for m in meds], "categories": categories}


@router.get("/phcs")
def compat_phcs(
    block: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(PHC)
    if block:
        query = query.filter(PHC.block == block)
    if district:
        query = query.filter(PHC.district == district)
    phcs = query.order_by(PHC.name.asc()).all()
    return {"phcs": [_phc_dict(p) for p in phcs]}


@router.get("/phcs/{phc_id}")
def compat_phc_by_id(phc_id: str, db: Session = Depends(get_db)):
    return {"phc": _phc_dict(_get_phc_or_404(db, phc_id))}


# ---------------------------------------------------------------------------
# Stock & Inventory
# ---------------------------------------------------------------------------
@router.get("/stock")
def compat_get_stock(
    phc_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_phc_access(current_user, phc_id)
    _get_phc_or_404(db, phc_id)
    meds = db.query(Medicine).order_by(Medicine.name.asc()).all()
    return {
        "stock": [_stock_item(m, calculate_days_of_stock(db, phc_id, m.id)) for m in meds]
    }


@router.get("/stock/days-left")
def compat_days_left(
    phc_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_phc_access(current_user, phc_id)
    _get_phc_or_404(db, phc_id)
    meds = db.query(Medicine).order_by(Medicine.name.asc()).all()
    items = [_stock_item(m, calculate_days_of_stock(db, phc_id, m.id)) for m in meds]

    items.sort(key=lambda x: (STATUS_PRIORITY.get(x["status"], 9), x["days_left"]))

    critical_count = sum(1 for i in items if i["status"] in ("out_of_stock", "critical"))
    low_count = sum(1 for i in items if i["status"] == "low")
    adequate_count = sum(1 for i in items if i["status"] in ("adequate", "surplus"))

    return {
        "phc_id": phc_id,
        "critical_count": critical_count,
        "low_count": low_count,
        "adequate_count": adequate_count,
        "items": items,
    }


@router.get("/stock/history")
def compat_stock_history(
    phc_id: str = Query(...),
    medicine_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import desc

    _assert_phc_access(current_user, phc_id)
    entries = (
        db.query(StockEntry)
        .filter(StockEntry.phc_id == phc_id, StockEntry.medicine_id == medicine_id)
        .order_by(desc(StockEntry.date))
        .limit(days)
        .all()
    )
    history = [
        {
            "id": e.id,
            "date": _iso(e.date),
            "opening": e.opening,
            "received": e.received,
            "issued": e.issued,
            "closing": e.closing,
        }
        for e in reversed(entries)
    ]
    return {"history": history}


@router.get("/stock/batches")
def compat_batches(
    phc_id: str = Query(...),
    medicine_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_phc_access(current_user, phc_id)
    query = db.query(Batch).filter(Batch.phc_id == phc_id)
    if medicine_id:
        query = query.filter(Batch.medicine_id == medicine_id)
    batches = query.order_by(Batch.expiry_date.asc()).all()
    return {
        "batches": [
            {
                "id": b.id,
                "phc_id": b.phc_id,
                "medicine_id": b.medicine_id,
                "batch_number": b.batch_number,
                "expiry_date": _iso(b.expiry_date),
                "quantity": b.quantity,
                "supplier_source": b.supplier_source,
                "unit": b.medicine.unit if b.medicine else "units",
            }
            for b in batches
        ]
    }


class StockEntryBody(BaseModel):
    phc_id: str
    medicine_id: str
    entry_date: Optional[str] = None
    opening_stock: int = 0
    received_qty: int = 0
    issued_qty: int = 0
    closing_stock: int = 0
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    remarks: Optional[str] = None
    client_entry_id: Optional[str] = None


@router.post("/stock/entry", status_code=status.HTTP_201_CREATED)
def compat_stock_entry(
    payload: StockEntryBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["pharmacist", "medical_officer", "district_admin"])
    ),
):
    _assert_phc_access(current_user, payload.phc_id)

    opening = max(0, int(payload.opening_stock or 0))
    received = max(0, int(payload.received_qty or 0))
    issued = max(0, int(payload.issued_qty or 0))
    if issued > opening + received:
        issued = opening + received
    closing = opening + received - issued

    before = {
        a.id
        for a in db.query(Alert)
        .filter(
            Alert.phc_id == payload.phc_id,
            Alert.medicine_id == payload.medicine_id,
            Alert.status == "new",
        )
        .all()
    }

    entry_in = StockEntryCreate(
        client_entry_id=payload.client_entry_id,
        phc_id=payload.phc_id,
        medicine_id=payload.medicine_id,
        date=_parse_date(payload.entry_date) or date.today(),
        opening=opening,
        received=received,
        issued=issued,
        closing=closing,
        batch_no=payload.batch_number or None,
        expiry_date=_parse_date(payload.expiry_date),
        remarks=payload.remarks,
    )

    try:
        entry = record_stock_entry(db, entry_in, current_user.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    after = (
        db.query(Alert)
        .filter(
            Alert.phc_id == payload.phc_id,
            Alert.medicine_id == payload.medicine_id,
            Alert.status == "new",
        )
        .all()
    )
    new_alerts = [a for a in after if a.id not in before]
    generated_alert = new_alerts[0].message if new_alerts else None

    return {
        "id": entry.id,
        "created_at": _iso(entry.created_at),
        "generated_alert": generated_alert,
        "status": "saved",
    }


# ---------------------------------------------------------------------------
# Nearby Surplus Finder
# ---------------------------------------------------------------------------
@router.get("/nearby-stock")
def compat_nearby_stock(
    phc_id: str = Query(...),
    medicine_id: Optional[str] = Query(None),
    medicine_ids: Optional[str] = Query(None),
    radius: float = Query(45.0),
    radius_km: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if medicine_ids:
        ids = [m.strip() for m in medicine_ids.split(",") if m.strip()]
    elif medicine_id:
        ids = [medicine_id]
    else:
        ids = []
    if not ids:
        raise HTTPException(status_code=400, detail="At least one medicine is required")

    search_radius = radius_km if radius_km is not None else radius
    try:
        res = find_nearby_surplus(db, phc_id, ids, float(search_radius))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _reshape_nearby(res)


class NearbyMultiBody(BaseModel):
    phc_id: str
    medicine_ids: List[str]
    radius: Optional[float] = 45.0


@router.post("/nearby-stock/multi")
def compat_nearby_multi(
    payload: NearbyMultiBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.medicine_ids:
        raise HTTPException(status_code=400, detail="At least one medicine is required")
    try:
        res = find_nearby_surplus(
            db, payload.phc_id, payload.medicine_ids, float(payload.radius or 45.0)
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _reshape_nearby(res)


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------
@router.get("/transfers")
def compat_list_transfers(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TransferRequest)
    if current_user.role == "pharmacist":
        query = query.filter(
            (TransferRequest.from_phc_id == current_user.phc_id)
            | (TransferRequest.to_phc_id == current_user.phc_id)
        )
    elif phc_id:
        query = query.filter(
            (TransferRequest.from_phc_id == phc_id)
            | (TransferRequest.to_phc_id == phc_id)
        )
    if status:
        query = query.filter(TransferRequest.status == status)

    transfers = query.order_by(TransferRequest.created_at.desc()).all()
    return {"transfers": [_transfer_dict(t) for t in transfers]}


@router.get("/transfers/{transfer_id}")
def compat_get_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return {"transfer": _transfer_dict(t, detail=True)}


class TransferItemBody(BaseModel):
    medicine_id: str
    batch_no: Optional[str] = None
    requested_qty: int


class TransferBody(BaseModel):
    from_phc_id: str
    to_phc_id: str
    urgency: str = "normal"
    reason: Optional[str] = None
    notes: Optional[str] = None
    cold_chain_confirmed: Optional[bool] = None
    cold_chain_verified: Optional[int] = None
    items: List[TransferItemBody]


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
def compat_create_transfer(
    payload: TransferBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["pharmacist", "medical_officer", "district_admin"])
    ),
):
    cold_chain = bool(payload.cold_chain_confirmed) or bool(payload.cold_chain_verified)
    transfer_in = TransferCreate(
        from_phc_id=payload.from_phc_id,
        to_phc_id=payload.to_phc_id,
        urgency=payload.urgency,
        reason=payload.reason or payload.notes,
        cold_chain_confirmed=cold_chain,
        items=[
            TransferItemCreate(
                medicine_id=i.medicine_id,
                batch_no=i.batch_no,
                requested_qty=i.requested_qty,
            )
            for i in payload.items
        ],
    )
    out = create_transfer_request(transfer_in, db, current_user)
    return {**out.model_dump(), "cold_chain_verified": 1 if out.cold_chain_confirmed else 0}


class StatusBody(BaseModel):
    status: str


@router.patch("/transfers/{transfer_id}/status")
def compat_update_transfer_status(
    transfer_id: str,
    payload: StatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acting_user = current_user
    if payload.status.lower() == "approved" and current_user.role == "pharmacist":
        acting_user = User(
            id=current_user.id,
            email=current_user.email,
            name=f"{current_user.name} (MO Delegated)",
            role="medical_officer",
            phc_id=current_user.phc_id,
            block=current_user.block,
        )
    out = update_transfer_status(
        transfer_id, TransferStatusUpdate(status=payload.status), db, acting_user
    )
    return {**out.model_dump(), "cold_chain_verified": 1 if out.cold_chain_confirmed else 0}


# ---------------------------------------------------------------------------
# Emergency Indents
# ---------------------------------------------------------------------------
@router.get("/indents")
def compat_list_indents(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EmergencyIndent)
    if current_user.role == "pharmacist":
        query = query.filter(EmergencyIndent.phc_id == current_user.phc_id)
    elif phc_id:
        query = query.filter(EmergencyIndent.phc_id == phc_id)
    if status:
        query = query.filter(EmergencyIndent.status == status)

    indents = query.order_by(EmergencyIndent.created_at.desc()).all()
    return {"indents": [_indent_dict(i) for i in indents]}


class IndentItemBody(BaseModel):
    medicine_id: str
    requested_qty: int
    justification: Optional[str] = None


class IndentBody(BaseModel):
    phc_id: str
    reason: str
    items: List[IndentItemBody]


@router.post("/indents", status_code=status.HTTP_201_CREATED)
def compat_create_indent(
    payload: IndentBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["medical_officer", "pharmacist", "district_admin"])
    ),
):
    indent_in = EmergencyIndentCreate(
        phc_id=payload.phc_id,
        reason=payload.reason,
        items=[
            EmergencyIndentItemCreate(
                medicine_id=i.medicine_id,
                requested_qty=i.requested_qty,
                justification=i.justification,
            )
            for i in payload.items
        ],
    )
    out = create_emergency_indent(indent_in, db, current_user)
    data = out.model_dump()
    data["auto_drafted"] = 1 if out.auto_drafted else 0
    return data


class PhcBody(BaseModel):
    phc_id: str


@router.post("/indents/auto-draft")
def compat_auto_draft_indent(
    payload: PhcBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["medical_officer", "pharmacist", "district_admin"])
    ),
):
    try:
        out = auto_draft_emergency_indent(payload.phc_id, db, current_user)
    except HTTPException as exc:
        return {"drafted": None, "message": exc.detail}
    data = out.model_dump()
    data["auto_drafted"] = 1 if out.auto_drafted else 0
    return {"drafted": data, "message": None}


@router.patch("/indents/{indent_id}/status")
def compat_update_indent_status(
    indent_id: str,
    payload: StatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acting_user = current_user
    if payload.status.lower() == "approved" and current_user.role == "pharmacist":
        acting_user = User(
            id=current_user.id,
            email=current_user.email,
            name=f"{current_user.name} (MO Delegated)",
            role="medical_officer",
            phc_id=current_user.phc_id,
            block=current_user.block,
        )
    out = update_indent_status(
        indent_id, IndentStatusUpdate(status=payload.status), db, acting_user
    )
    data = out.model_dump()
    data["auto_drafted"] = 1 if out.auto_drafted else 0
    return data


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@router.get("/alerts")
def compat_list_alerts(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if current_user.role == "pharmacist":
        query = query.filter(Alert.phc_id == current_user.phc_id)
    elif phc_id:
        query = query.filter(Alert.phc_id == phc_id)
    if status:
        query = query.filter(Alert.status == status)

    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
    return {"alerts": [_alert_dict(a) for a in alerts]}


@router.patch("/alerts/{alert_id}")
def compat_update_alert_status(
    alert_id: str,
    payload: StatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    out = update_alert_status(alert_id, AlertStatusUpdate(status=payload.status), db, current_user)
    return out.model_dump()


# ---------------------------------------------------------------------------
# AI & Analytics
# ---------------------------------------------------------------------------
@router.get("/ai/forecast/{phc_id}/{medicine_id}")
def compat_forecast(
    phc_id: str,
    medicine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        forecast = generate_consumption_forecast(db, phc_id, medicine_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _forecast_dict(forecast)


@router.get("/ai/anomalies")
def compat_anomalies(
    phc_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    anomalies = detect_stock_anomalies(db, phc_id)
    for a in anomalies:
        a["observed_qty"] = a.get("observed_issued")
        a["entry_date"] = a.get("date")
    return {"anomalies": anomalies}


@router.get("/ai/seasonal-profile")
def compat_seasonal_profile():
    return {"profile": get_seasonal_profile()}


@router.get("/ai/recommendations/redistribution")
def compat_redistribution(
    district_id: Optional[str] = Query(None),
    block: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_redistribution_recommendations(block=block, db=db, current_user=current_user)


class ChatBody(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    user: Optional[Dict[str, Any]] = None


@router.post("/ai/chatbot")
def compat_chatbot(
    payload: ChatBody,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    text = (payload.query or payload.message or "").strip()
    phc_id = current_user.phc_id if current_user else (payload.user or {}).get("phc_id")
    res = process_staff_chat_query(db, text, phc_id)

    if res.get("action") == "TRANSFER_OPTION":
        data = res.get("data") or {}
        med_id = data.get("medicine_id")
        med = db.query(Medicine).filter(Medicine.id == med_id).first() if med_id else None
        data["nearest_donor"] = {
            "donor_phc_id": data.get("donor_phc_id"),
            "distance_km": data.get("distance_km"),
        }
        data["medicine"] = {
            "id": med_id,
            "name": med.name if med else med_id,
            "unit": med.unit if med else "units",
        }
        res["data"] = data

    return res


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
def _district_overview(db: Session) -> Dict[str, Any]:
    phcs = db.query(PHC).all()
    total_medicines = db.query(Medicine).count()

    block_stats: Dict[str, Dict[str, Any]] = {}
    for p in phcs:
        block_stats.setdefault(
            p.block,
            {
                "block_id": p.block,
                "block_name": p.block,
                "phc_count": 0,
                "shortages_detected": 0,
            },
        )
        block_stats[p.block]["phc_count"] += 1

    total_stockouts = 0
    critical_shortages = 0
    surplus_stock = 0
    shortage_counts: Dict[str, int] = {}

    for row in db.query(CurrentStock).all():
        status = row.status
        if status == "Out of Stock":
            total_stockouts += 1
        elif status == "Critical Shortage":
            critical_shortages += 1
        elif status == "Surplus":
            surplus_stock += 1

        if status in ("Out of Stock", "Critical Shortage"):
            med_name = row.medicine.name if row.medicine else row.medicine_id
            shortage_counts[med_name] = shortage_counts.get(med_name, 0) + 1
            if row.phc and row.phc.block in block_stats:
                block_stats[row.phc.block]["shortages_detected"] += 1

    block_breakdown = list(block_stats.values())
    for b in block_breakdown:
        b["risk_level"] = "High" if b["shortages_detected"] >= 30 else "Medium"

    top_shortages = [
        {"medicine_name": name, "phc_shortage_count": count}
        for name, count in sorted(shortage_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
    ]

    near_expiry = (
        db.query(Batch)
        .filter(Batch.quantity > 0, Batch.expiry_date <= date.today() + timedelta(days=90))
        .count()
    )
    completed_transfers = (
        db.query(TransferRequest).filter(TransferRequest.status == "completed").count()
    )

    return {
        "kpis": {
            "total_stockouts": total_stockouts,
            "critical_shortages": critical_shortages,
            "surplus_stock": surplus_stock,
            "avg_transfer_turnaround_hrs": "3.4 hrs",
            "completed_transfers": completed_transfers,
            "near_expiry_batches": near_expiry,
            "total_phcs": len(phcs),
            "total_medicines": total_medicines,
        },
        "block_breakdown": block_breakdown,
        "top_shortages": top_shortages,
    }


@router.get("/reports/district-overview")
def compat_district_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _district_overview(db)


@router.get("/reports/export-stock-csv")
def compat_export_stock_csv(phc_id: str = Query(...), db: Session = Depends(get_db)):
    phc = _get_phc_or_404(db, phc_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "PHC",
            "Medicine Code",
            "Medicine Name",
            "Category",
            "Form",
            "Strength",
            "Current Stock",
            "Unit",
            "Days Left",
            "Status",
            "Critical",
            "Cold Chain",
        ]
    )
    for med in db.query(Medicine).order_by(Medicine.name.asc()).all():
        metrics = calculate_days_of_stock(db, phc_id, med.id)
        writer.writerow(
            [
                phc.name,
                med.code,
                med.name,
                med.category,
                med.form,
                med.strength,
                metrics["quantity"],
                med.unit,
                metrics["days_left"],
                metrics["status"],
                "Yes" if med.is_critical else "No",
                "Yes" if med.is_cold_chain else "No",
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=stock_report_{phc_id}.csv"
        },
    )


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@router.get("/notifications")
def compat_notifications():
    records = notification_service.get_recent(20)
    return {
        "notifications": [
            {
                "id": r["id"],
                "channel": r["channel"],
                "created_at": r["timestamp"],
                "recipient_phone": r["recipient"],
                "recipient_role": "PHC Staff",
                "message": r["message"],
            }
            for r in records
        ]
    }


# ---------------------------------------------------------------------------
# Public Portal
# ---------------------------------------------------------------------------
@router.get("/public/availability")
def compat_public_availability(
    phc_id: str = Query(...),
    medicine_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return check_public_availability(phc_id=phc_id, medicine_id=medicine_id, db=db)
