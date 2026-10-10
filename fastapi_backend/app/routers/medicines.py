from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.medicine import Medicine
from app.schemas.medicine import MedicineCreate, MedicineUpdate, MedicineOut
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/medicines", tags=["Medicines Formulary"])


@router.get("", response_model=List[MedicineOut])
def list_medicines(
    category: Optional[str] = Query(None),
    is_critical: Optional[bool] = Query(None),
    is_cold_chain: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Medicine)
    if category:
        query = query.filter(Medicine.category == category)
    if is_critical is not None:
        query = query.filter(Medicine.is_critical == is_critical)
    if is_cold_chain is not None:
        query = query.filter(Medicine.is_cold_chain == is_cold_chain)
    if search:
        query = query.filter(
            (Medicine.name.ilike(f"%{search}%")) |
            (Medicine.generic_name.ilike(f"%{search}%")) |
            (Medicine.code.ilike(f"%{search}%"))
        )
    return [MedicineOut.model_validate(m) for m in query.order_by(Medicine.name.asc()).all()]


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(medicine_id: str, db: Session = Depends(get_db)):
    m = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return MedicineOut.model_validate(m)


@router.post("", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(
    med_in: MedicineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin"]))
):
    existing = db.query(Medicine).filter(Medicine.code == med_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Medicine code {med_in.code} already exists")

    med = Medicine(
        id=f"med_{int(datetime.utcnow().timestamp()*1000)}",
        **med_in.model_dump()
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return MedicineOut.model_validate(med)


@router.put("/{medicine_id}", response_model=MedicineOut)
def update_medicine(
    medicine_id: str,
    med_update: MedicineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin"]))
):
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    for k, v in med_update.model_dump(exclude_unset=True).items():
        setattr(med, k, v)

    db.commit()
    db.refresh(med)
    return MedicineOut.model_validate(med)
