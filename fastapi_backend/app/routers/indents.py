from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.indent import EmergencyIndent, EmergencyIndentItem
from app.models.audit import AuditLog
from app.schemas.indent import EmergencyIndentCreate, EmergencyIndentOut, IndentStatusUpdate, EmergencyIndentItemOut
from app.services.stock_service import calculate_days_of_stock
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/indents", tags=["Emergency Indents"])


@router.post("", response_model=EmergencyIndentOut, status_code=status.HTTP_201_CREATED)
def create_emergency_indent(
    indent_in: EmergencyIndentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["medical_officer", "pharmacist", "district_admin"]))
):
    phc = db.query(PHC).filter(PHC.id == indent_in.phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")

    count = db.query(EmergencyIndent).count() + 1
    indent_number = f"EI-2026-TNMSC-{str(count).zfill(3)}"

    indent = EmergencyIndent(
        id=f"ind_{int(datetime.utcnow().timestamp()*1000)}",
        indent_number=indent_number,
        phc_id=indent_in.phc_id,
        status="submitted",
        reason=indent_in.reason,
        auto_drafted=False,
        created_by=current_user.name
    )
    db.add(indent)
    db.flush()

    for idx, item in enumerate(indent_in.items):
        db.add(EmergencyIndentItem(
            id=f"eii_{indent.id}_{idx}",
            indent_id=indent.id,
            medicine_id=item.medicine_id,
            requested_qty=item.requested_qty,
            justification=item.justification or "Urgent stock-out prevention"
        ))

    db.add(AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=current_user.name,
        action="CREATE_INDENT",
        entity="emergency_indents",
        entity_id=indent.id,
        details=f"Submitted emergency indent {indent_number} for {len(indent_in.items)} items"
    ))
    db.commit()
    db.refresh(indent)
    return format_indent_out(indent)


@router.post("/auto-draft", response_model=EmergencyIndentOut)
def auto_draft_emergency_indent(
    phc_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["medical_officer", "pharmacist", "district_admin"]))
):
    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")

    # Find medicines with critical shortages (<15 days or out of stock)
    medicines = db.query(Medicine).all()
    shortage_items = []

    for med in medicines:
        metrics = calculate_days_of_stock(db, phc_id, med.id)
        if metrics["days_left"] < metrics["threshold_days"] or metrics["quantity"] == 0:
            # Smart indent formula: 45 days consumption buffer scaled by population served
            pop_factor = max(1.0, phc.population_served / 30000.0)
            suggested_qty = max(50, int(metrics["effective_daily_rate"] * 45 * pop_factor))

            shortage_items.append({
                "medicine_id": med.id,
                "medicine_name": med.name,
                "requested_qty": suggested_qty,
                "justification": f"Auto-drafted by AI: Current stock {metrics['quantity']} {med.unit} ({metrics['days_left']} days left) below threshold."
            })

    if not shortage_items:
        raise HTTPException(status_code=400, detail="No critical stock shortages detected at this PHC to auto-draft indent")

    count = db.query(EmergencyIndent).count() + 1
    indent_number = f"EI-2026-TNMSC-{str(count).zfill(3)}"

    indent = EmergencyIndent(
        id=f"ind_auto_{int(datetime.utcnow().timestamp()*1000)}",
        indent_number=indent_number,
        phc_id=phc_id,
        status="draft",
        reason="Auto-drafted by MediSync AI Engine based on real-time consumption velocity and population served.",
        auto_drafted=True,
        created_by="MediSync AI Recommendation Engine"
    )
    db.add(indent)
    db.flush()

    for idx, item in enumerate(shortage_items):
        db.add(EmergencyIndentItem(
            id=f"eii_{indent.id}_{idx}",
            indent_id=indent.id,
            medicine_id=item["medicine_id"],
            requested_qty=item["requested_qty"],
            justification=item["justification"]
        ))

    db.commit()
    db.refresh(indent)
    return format_indent_out(indent)


@router.get("", response_model=List[EmergencyIndentOut])
def list_indents(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(EmergencyIndent)
    if current_user.role == "pharmacist":
        query = query.filter(EmergencyIndent.phc_id == current_user.phc_id)
    elif phc_id:
        query = query.filter(EmergencyIndent.phc_id == phc_id)

    if status:
        query = query.filter(EmergencyIndent.status == status)

    indents = query.order_by(EmergencyIndent.created_at.desc()).all()
    return [format_indent_out(i) for i in indents]


@router.patch("/{indent_id}/status", response_model=EmergencyIndentOut)
def update_indent_status(
    indent_id: str,
    status_update: IndentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    indent = db.query(EmergencyIndent).filter(EmergencyIndent.id == indent_id).first()
    if not indent:
        raise HTTPException(status_code=404, detail="Indent not found")

    old_status = indent.status
    indent.status = status_update.status
    if status_update.status == "approved":
        if current_user.role not in ["medical_officer", "block_officer", "district_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Medical Officers, Block Officers, or District Admins can approve indents."
            )
        indent.approved_by = current_user.name

    db.add(AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=current_user.name,
        action="UPDATE_INDENT_STATUS",
        entity="emergency_indents",
        entity_id=indent.id,
        old_value=old_status,
        new_value=status_update.status,
        details=f"Indent {indent.indent_number} status changed to {status_update.status}"
    ))
    db.commit()
    db.refresh(indent)
    return format_indent_out(indent)


def format_indent_out(i: EmergencyIndent) -> EmergencyIndentOut:
    items_out = []
    for itm in i.items:
        items_out.append(EmergencyIndentItemOut(
            id=itm.id,
            medicine_id=itm.medicine_id,
            medicine_name=itm.medicine.name if itm.medicine else itm.medicine_id,
            unit=itm.medicine.unit if itm.medicine else "units",
            requested_qty=itm.requested_qty,
            approved_qty=itm.approved_qty,
            justification=itm.justification
        ))

    return EmergencyIndentOut(
        id=i.id,
        indent_number=i.indent_number,
        phc_id=i.phc_id,
        phc_name=i.phc.name if i.phc else i.phc_id,
        status=i.status,
        reason=i.reason,
        auto_drafted=i.auto_drafted,
        created_by=i.created_by,
        approved_by=i.approved_by,
        created_at=i.created_at,
        updated_at=i.updated_at,
        items=items_out
    )
