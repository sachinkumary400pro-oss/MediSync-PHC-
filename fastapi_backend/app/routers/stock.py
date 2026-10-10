from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import StockEntry, CurrentStock, Batch
from app.schemas.stock import StockEntryCreate, StockEntryOut, CurrentStockOut, DaysLeftResponse, BatchOut
from app.services.stock_service import record_stock_entry, calculate_days_of_stock
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/stock", tags=["Stock Management"])


@router.post("", response_model=StockEntryOut, status_code=status.HTTP_201_CREATED)
def create_stock_entry(
    entry_in: StockEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["pharmacist", "medical_officer", "district_admin"]))
):
    # Enforce PHC permission: pharmacists can only log for their own PHC
    if current_user.role == "pharmacist" and current_user.phc_id != entry_in.phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pharmacists can only log stock entries for their own PHC"
        )

    entry = record_stock_entry(db, entry_in, current_user.name)
    return StockEntryOut.model_validate(entry)


@router.get("/phc/{phc_id}", response_model=List[CurrentStockOut])
def get_phc_stock(
    phc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions: pharmacist can only see own PHC data
    if current_user.role == "pharmacist" and current_user.phc_id != phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pharmacists are restricted to viewing their assigned PHC inventory"
        )

    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")

    medicines = db.query(Medicine).all()
    results = []

    for med in medicines:
        metrics = calculate_days_of_stock(db, phc_id, med.id)
        results.append(
            CurrentStockOut(
                id=f"cs_{phc_id}_{med.id}",
                phc_id=phc_id,
                phc_name=phc.name,
                medicine_id=med.id,
                medicine_name=med.name,
                code=med.code,
                category=med.category,
                form=med.form,
                strength=med.strength,
                unit=med.unit,
                is_critical=med.is_critical,
                is_cold_chain=med.is_cold_chain,
                quantity=metrics["quantity"],
                avg_daily_use_7d=metrics["avg_daily_use_7d"],
                avg_daily_use_30d=metrics["avg_daily_use_30d"],
                effective_daily_rate=metrics["effective_daily_rate"],
                days_left=metrics["days_left"],
                status=metrics["status"],
                trend=metrics["trend"],
                runout_date=metrics["runout_date"],
                spareable_surplus=metrics["spareable_surplus"],
            )
        )

    return results


@router.get("/days-left", response_model=DaysLeftResponse)
def get_days_left(
    phc_id: str = Query(..., description="ID of the PHC"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "pharmacist" and current_user.phc_id != phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pharmacists are restricted to viewing their assigned PHC inventory"
        )

    items = get_phc_stock(phc_id, db, current_user)
    
    # Sort by urgency: out of stock (0) first, then lowest days left
    items.sort(key=lambda x: (x.quantity != 0, x.days_left))

    critical_count = sum(1 for i in items if i.status in ["Critical Shortage", "Out of Stock"])
    low_count = sum(1 for i in items if i.status == "Low Stock")
    adequate_count = sum(1 for i in items if i.status in ["Adequate", "Surplus"])

    return DaysLeftResponse(
        phc_id=phc_id,
        critical_count=critical_count,
        low_count=low_count,
        adequate_count=adequate_count,
        items=items
    )


@router.get("/history", response_model=List[StockEntryOut])
def get_stock_history(
    phc_id: str = Query(...),
    medicine_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    entries = db.query(StockEntry).filter(
        StockEntry.phc_id == phc_id,
        StockEntry.medicine_id == medicine_id
    ).order_by(desc(StockEntry.date)).limit(days).all()

    # Return chronological order (oldest to newest)
    return [StockEntryOut.model_validate(e) for e in reversed(entries)]


@router.get("/batches", response_model=List[BatchOut])
def get_batches(
    phc_id: str = Query(...),
    medicine_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Batch).filter(Batch.phc_id == phc_id)
    if medicine_id:
        query = query.filter(Batch.medicine_id == medicine_id)
    batches = query.order_by(Batch.expiry_date.asc()).all()
    return [BatchOut.model_validate(b) for b in batches]
