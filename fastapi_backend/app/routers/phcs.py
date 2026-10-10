from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.phc import PHC
from app.schemas.phc import PHCOut, PHCCreate
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/phcs", tags=["Primary Health Centres"])


@router.get("", response_model=List[PHCOut])
def list_phcs(
    block: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(PHC)
    if block:
        query = query.filter(PHC.block == block)
    if district:
        query = query.filter(PHC.district == district)
    return [PHCOut.model_validate(p) for p in query.order_by(PHC.name.asc()).all()]


@router.get("/{phc_id}", response_model=PHCOut)
def get_phc(phc_id: str, db: Session = Depends(get_db)):
    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")
    return PHCOut.model_validate(phc)


@router.post("", response_model=PHCOut, status_code=status.HTTP_201_CREATED)
def create_phc(
    phc_in: PHCCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["district_admin"]))
):
    existing = db.query(PHC).filter(PHC.id == phc_in.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="PHC with this ID already exists")

    phc = PHC(**phc_in.model_dump())
    db.add(phc)
    db.commit()
    db.refresh(phc)
    return PHCOut.model_validate(phc)
