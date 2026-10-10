from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.alert import Alert
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.schemas.alert import AlertOut, AlertStatusUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])


@router.get("", response_model=List[AlertOut])
def list_alerts(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Alert)

    # If pharmacist, restrict to their PHC
    if current_user.role == "pharmacist":
        query = query.filter(Alert.phc_id == current_user.phc_id)
    elif phc_id:
        query = query.filter(Alert.phc_id == phc_id)

    if status:
        query = query.filter(Alert.status == status)

    alerts = query.order_by(
        Alert.created_at.desc()
    ).limit(limit).all()

    results = []
    for a in alerts:
        phc = db.query(PHC).filter(PHC.id == a.phc_id).first()
        med = db.query(Medicine).filter(Medicine.id == a.medicine_id).first()
        out = AlertOut.model_validate(a)
        out.phc_name = phc.name if phc else a.phc_id
        out.medicine_name = med.name if med else a.medicine_id
        results.append(out)

    return results


@router.patch("/{alert_id}", response_model=AlertOut)
def update_alert_status(
    alert_id: str,
    update_data: AlertStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if update_data.status not in ["acknowledged", "resolved", "new"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    alert.status = update_data.status
    if update_data.status == "acknowledged":
        alert.acknowledged_by = current_user.name
    elif update_data.status == "resolved":
        alert.resolved_by = current_user.name
        alert.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)
