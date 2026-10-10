from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models.user import User
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch, StockEntry, CurrentStock
from app.models.transfer import TransferRequest, TransferItem
from app.models.alert import Alert
from app.models.audit import AuditLog
from app.schemas.transfer import TransferCreate, TransferOut, TransferStatusUpdate, TransferItemOut
from app.services.distance import haversine_distance
from app.services.pdf_service import generate_transfer_slip_pdf
from app.services.notification import notification_service
from app.services.stock_service import calculate_days_of_stock
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/transfers", tags=["Inter-PHC Transfers"])


@router.post("", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer_request(
    transfer_in: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["pharmacist", "medical_officer", "district_admin"]))
):
    from_phc = db.query(PHC).filter(PHC.id == transfer_in.from_phc_id).first()
    to_phc = db.query(PHC).filter(PHC.id == transfer_in.to_phc_id).first()

    if not from_phc or not to_phc:
        raise HTTPException(status_code=404, detail="Source or Destination PHC not found")

    # Validate items and cold chain requirements
    has_cold_chain = False
    for item in transfer_in.items:
        med = db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
        if not med:
            raise HTTPException(status_code=404, detail=f"Medicine {item.medicine_id} not found")
        if med.is_cold_chain:
            has_cold_chain = True

        # Check that donor has enough stock
        batches = db.query(Batch).filter(
            Batch.phc_id == transfer_in.from_phc_id,
            Batch.medicine_id == item.medicine_id,
            Batch.quantity > 0
        ).all()
        total_donor_stock = sum(b.quantity for b in batches)
        if total_donor_stock < item.requested_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Donor PHC only has {total_donor_stock} {med.unit} of {med.name}, cannot fulfill {item.requested_qty}"
            )

    if has_cold_chain and not transfer_in.cold_chain_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Cold-chain protocol confirmation is required for temperature-sensitive items (vaccines, insulin, ASV)"
        )

    distance_km = haversine_distance(from_phc.latitude, from_phc.longitude, to_phc.latitude, to_phc.longitude)
    count = db.query(TransferRequest).count() + 1
    req_number = f"TR-2026-CPT-{str(count).zfill(4)}"

    transfer = TransferRequest(
        id=f"tr_{int(datetime.utcnow().timestamp()*1000)}",
        request_number=req_number,
        from_phc_id=transfer_in.from_phc_id,
        to_phc_id=transfer_in.to_phc_id,
        status="requested",
        urgency=transfer_in.urgency,
        reason=transfer_in.reason,
        cold_chain_confirmed=transfer_in.cold_chain_confirmed,
        distance_km=distance_km,
        created_by=current_user.name
    )
    db.add(transfer)
    db.flush()

    for idx, item in enumerate(transfer_in.items):
        t_item = TransferItem(
            id=f"tri_{transfer.id}_{idx}",
            transfer_id=transfer.id,
            medicine_id=item.medicine_id,
            batch_no=item.batch_no,
            requested_qty=item.requested_qty,
            approved_qty=item.requested_qty
        )
        db.add(t_item)

    # Audit log
    audit = AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=current_user.name,
        action="CREATE_TRANSFER",
        entity="transfer_requests",
        entity_id=transfer.id,
        details=f"Created transfer {req_number} from {from_phc.name} to {to_phc.name} ({distance_km} km)"
    )
    db.add(audit)
    db.commit()

    # Dispatch notification to donor PHC
    notification_service.send(
        recipient=from_phc.phone,
        message=f"New Inter-PHC Stock Request {req_number}: {to_phc.name} requested stock transfer ({distance_km} km away). Please review and approve.",
        channel="WHATSAPP"
    )

    db.refresh(transfer)
    return format_transfer_out(transfer)


@router.get("", response_model=List[TransferOut])
def list_transfers(
    phc_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TransferRequest)

    if current_user.role == "pharmacist":
        query = query.filter(
            (TransferRequest.from_phc_id == current_user.phc_id) |
            (TransferRequest.to_phc_id == current_user.phc_id)
        )
    elif phc_id:
        query = query.filter(
            (TransferRequest.from_phc_id == phc_id) |
            (TransferRequest.to_phc_id == phc_id)
        )

    if status:
        query = query.filter(TransferRequest.status == status)

    transfers = query.order_by(TransferRequest.created_at.desc()).all()
    return [format_transfer_out(t) for t in transfers]


@router.get("/{transfer_id}", response_model=TransferOut)
def get_transfer(transfer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return format_transfer_out(t)


@router.patch("/{transfer_id}/status", response_model=TransferOut)
def update_transfer_status(
    transfer_id: str,
    status_update: TransferStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    valid_statuses = ["approved", "in_transit", "received", "completed", "rejected", "cancelled"]
    next_status = status_update.status.lower()
    if next_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{next_status}'. Allowed: {valid_statuses}")

    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    old_status = transfer.status

    if next_status == "approved":
        if current_user.role not in ["medical_officer", "block_officer", "district_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Medical Officers, Block Officers, or District Admins can approve transfers."
            )
        transfer.approved_by = current_user.name
    elif next_status in ["completed", "received"]:
        transfer.received_by = current_user.name

    transfer.status = next_status

    # Atomically adjust inventory at both PHCs when transfer is marked COMPLETED
    if next_status == "completed":
        for item in transfer.items:
            qty = item.approved_qty or item.requested_qty

            # Deduct from Donor Batches
            donor_batch = db.query(Batch).filter(
                Batch.phc_id == transfer.from_phc_id,
                Batch.medicine_id == item.medicine_id,
                Batch.quantity >= qty
            ).order_by(Batch.expiry_date.asc()).first()

            if donor_batch:
                donor_batch.quantity -= qty
                
                # Outgoing stock entry
                db.add(StockEntry(
                    id=f"se_tr_out_{int(datetime.utcnow().timestamp()*1000)}_{item.id}",
                    phc_id=transfer.from_phc_id,
                    medicine_id=item.medicine_id,
                    date=date.today(),
                    opening=donor_batch.quantity + qty,
                    received=0,
                    issued=qty,
                    closing=donor_batch.quantity,
                    batch_no=donor_batch.batch_number,
                    entered_by=current_user.name,
                    remarks=f"Inter-PHC Transfer Dispatched: {transfer.request_number}"
                ))

                # Add to Receiver Batches
                rec_batch = db.query(Batch).filter(
                    Batch.phc_id == transfer.to_phc_id,
                    Batch.medicine_id == item.medicine_id,
                    Batch.batch_number == donor_batch.batch_number
                ).first()

                if rec_batch:
                    rec_batch.quantity += qty
                else:
                    db.add(Batch(
                        id=f"b_tr_in_{int(datetime.utcnow().timestamp()*1000)}_{item.id}",
                        phc_id=transfer.to_phc_id,
                        medicine_id=item.medicine_id,
                        batch_number=donor_batch.batch_number,
                        expiry_date=donor_batch.expiry_date,
                        quantity=qty,
                        supplier_source=f"Transfer from {transfer.from_phc_id}"
                    ))

                # Incoming stock entry
                db.add(StockEntry(
                    id=f"se_tr_in_{int(datetime.utcnow().timestamp()*1000)}_{item.id}",
                    phc_id=transfer.to_phc_id,
                    medicine_id=item.medicine_id,
                    date=date.today(),
                    opening=0,
                    received=qty,
                    issued=0,
                    closing=qty,
                    batch_no=donor_batch.batch_number,
                    entered_by=current_user.name,
                    remarks=f"Inter-PHC Transfer Received: {transfer.request_number}"
                ))

        # Update CurrentStock metrics for both PHCs
        for item in transfer.items:
            m_donor = calculate_days_of_stock(db, transfer.from_phc_id, item.medicine_id)
            cs_donor = db.query(CurrentStock).filter(
                CurrentStock.phc_id == transfer.from_phc_id,
                CurrentStock.medicine_id == item.medicine_id
            ).first()
            if cs_donor:
                cs_donor.quantity = m_donor["quantity"]
                cs_donor.days_left = m_donor["days_left"]
                cs_donor.status = m_donor["status"]

            m_rec = calculate_days_of_stock(db, transfer.to_phc_id, item.medicine_id)
            cs_rec = db.query(CurrentStock).filter(
                CurrentStock.phc_id == transfer.to_phc_id,
                CurrentStock.medicine_id == item.medicine_id
            ).first()
            if cs_rec:
                cs_rec.quantity = m_rec["quantity"]
                cs_rec.days_left = m_rec["days_left"]
                cs_rec.status = m_rec["status"]

        # Resolve active alerts at receiving PHC
        active_alerts = db.query(Alert).filter(
            Alert.phc_id == transfer.to_phc_id,
            Alert.status == "new"
        ).all()
        for a in active_alerts:
            a.status = "resolved"
            a.resolved_at = datetime.utcnow()
            a.resolved_by = f"Transfer {transfer.request_number}"

    # Audit log
    audit = AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=current_user.name,
        action="UPDATE_TRANSFER_STATUS",
        entity="transfer_requests",
        entity_id=transfer.id,
        old_value=old_status,
        new_value=next_status,
        details=f"Transfer {transfer.request_number} status updated to {next_status}"
    )
    db.add(audit)
    db.commit()
    db.refresh(transfer)
    return format_transfer_out(transfer)


@router.get("/{transfer_id}/slip")
def download_transfer_slip(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    pdf_bytes = generate_transfer_slip_pdf(transfer)
    filename = f"Transfer_Slip_{transfer.request_number}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def format_transfer_out(t: TransferRequest) -> TransferOut:
    items_out = []
    for itm in t.items:
        items_out.append(TransferItemOut(
            id=itm.id,
            medicine_id=itm.medicine_id,
            medicine_name=itm.medicine.name if itm.medicine else itm.medicine_id,
            unit=itm.medicine.unit if itm.medicine else "units",
            batch_no=itm.batch_no,
            requested_qty=itm.requested_qty,
            approved_qty=itm.approved_qty,
            received_qty=itm.received_qty
        ))

    return TransferOut(
        id=t.id,
        request_number=t.request_number,
        from_phc_id=t.from_phc_id,
        from_phc_name=t.from_phc.name if t.from_phc else t.from_phc_id,
        to_phc_id=t.to_phc_id,
        to_phc_name=t.to_phc.name if t.to_phc else t.to_phc_id,
        status=t.status,
        urgency=t.urgency,
        reason=t.reason,
        cold_chain_confirmed=t.cold_chain_confirmed,
        distance_km=t.distance_km,
        created_by=t.created_by,
        approved_by=t.approved_by,
        received_by=t.received_by,
        created_at=t.created_at,
        updated_at=t.updated_at,
        items=items_out
    )
