from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.services.recommender import find_nearby_surplus
from app.auth import get_current_user

router = APIRouter(prefix="/nearby-stock", tags=["Nearby Stock Finder"])


@router.get("")
def get_nearby_stock(
    phc_id: str = Query(..., description="ID of the requesting PHC"),
    medicine_ids: str = Query(..., description="Comma-separated IDs of medicines to find"),
    radius_km: float = Query(45.0, ge=5.0, le=100.0, description="Max search radius in km"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    med_id_list = [m.strip() for m in medicine_ids.split(",") if m.strip()]
    if not med_id_list:
        raise HTTPException(status_code=400, detail="At least one medicine ID must be provided")

    try:
        results = find_nearby_surplus(db, phc_id, med_id_list, radius_km)
        return results
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
