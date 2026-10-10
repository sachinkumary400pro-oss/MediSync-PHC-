from datetime import datetime, date, timedelta
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.medicine import Medicine
from app.models.phc import PHC
from app.models.stock import StockEntry, CurrentStock, Batch
from app.models.alert import Alert
from app.models.audit import AuditLog
from app.schemas.stock import StockEntryCreate


def calculate_days_of_stock(db: Session, phc_id: str, medicine_id: str) -> Dict[str, Any]:
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise ValueError(f"Medicine with ID {medicine_id} not found")

    # Current stock from active batches
    batches = db.query(Batch).filter(
        Batch.phc_id == phc_id,
        Batch.medicine_id == medicine_id,
        Batch.quantity > 0
    ).all()
    current_quantity = sum(b.quantity for b in batches)

    # Historical consumption from stock entries
    entries = db.query(StockEntry).filter(
        StockEntry.phc_id == phc_id,
        StockEntry.medicine_id == medicine_id
    ).order_by(desc(StockEntry.date)).limit(30).all()

    total_issued_30 = sum(e.issued for e in entries)
    total_issued_7 = sum(e.issued for e in entries[:7])

    count_30 = len(entries)
    count_7 = min(7, len(entries))

    avg_7d = round(total_issued_7 / count_7, 2) if count_7 > 0 else 0.0
    avg_30d = round(total_issued_30 / count_30, 2) if count_30 > 0 else 0.0

    # Rule: use the higher consumption to be safe (conservative forecast)
    if avg_7d > 0 or avg_30d > 0:
        effective_daily_rate = max(avg_7d, avg_30d)
    else:
        # Edge case: new medicine or zero history -> default safe estimate (2 units/day)
        effective_daily_rate = 2.0

    # Days left calculation
    if current_quantity == 0:
        days_left = 0
    elif effective_daily_rate > 0:
        days_left = int(current_quantity / effective_daily_rate)
    else:
        days_left = 999

    # Configurable threshold: higher for critical medicines
    threshold_days = 20 if medicine.is_critical else medicine.default_threshold_days

    # Status classification
    if current_quantity == 0:
        status = "Out of Stock"
    elif days_left < threshold_days:
        status = "Critical Shortage"
    elif days_left <= 30:
        status = "Low Stock"
    elif days_left > 60:
        status = "Surplus"
    else:
        status = "Adequate"

    # Trend: accelerating vs decelerating demand
    if avg_7d > (avg_30d * 1.15) and avg_30d > 0:
        trend = "increasing"
    elif avg_7d < (avg_30d * 0.85) and avg_30d > 0:
        trend = "decreasing"
    else:
        trend = "stable"

    # Projected run-out date
    runout_date = None
    if 0 < days_left < 365:
        target_d = date.today() + timedelta(days=days_left)
        runout_date = target_d.isoformat()
    elif current_quantity == 0:
        runout_date = date.today().isoformat()

    # Spareable surplus = current stock - (own threshold days * daily use)
    reserved_buffer = int(threshold_days * effective_daily_rate * 1.5)  # 1.5x buffer before donating
    spareable = max(0, current_quantity - reserved_buffer)

    return {
        "quantity": current_quantity,
        "avg_daily_use_7d": avg_7d,
        "avg_daily_use_30d": avg_30d,
        "effective_daily_rate": round(effective_daily_rate, 2),
        "days_left": days_left,
        "threshold_days": threshold_days,
        "status": status,
        "trend": trend,
        "runout_date": runout_date,
        "spareable_surplus": spareable,
    }


def record_stock_entry(db: Session, entry_in: StockEntryCreate, user_name: str) -> StockEntry:
    # 1. Check idempotency: if client_entry_id already exists, return existing entry to prevent double-count
    if entry_in.client_entry_id:
        existing = db.query(StockEntry).filter(
            StockEntry.client_entry_id == entry_in.client_entry_id
        ).first()
        if existing:
            return existing

    # 2. Update or create batch
    batch_record = None
    if entry_in.batch_no:
        batch_record = db.query(Batch).filter(
            Batch.phc_id == entry_in.phc_id,
            Batch.medicine_id == entry_in.medicine_id,
            Batch.batch_number == entry_in.batch_no
        ).first()

        if batch_record:
            batch_record.quantity = entry_in.closing
            if entry_in.expiry_date:
                batch_record.expiry_date = entry_in.expiry_date
        else:
            batch_record = Batch(
                id=f"b_{int(datetime.utcnow().timestamp()*1000)}",
                phc_id=entry_in.phc_id,
                medicine_id=entry_in.medicine_id,
                batch_number=entry_in.batch_no,
                expiry_date=entry_in.expiry_date or (date.today() + timedelta(days=540)),
                quantity=entry_in.closing,
                supplier_source="Routine Stock Logging"
            )
            db.add(batch_record)
    else:
        # Update existing batch if any
        top_batch = db.query(Batch).filter(
            Batch.phc_id == entry_in.phc_id,
            Batch.medicine_id == entry_in.medicine_id
        ).order_by(Batch.expiry_date.asc()).first()
        if top_batch:
            top_batch.quantity = entry_in.closing

    # 3. Create StockEntry record
    entry_id = f"se_{int(datetime.utcnow().timestamp()*1000)}"
    entry = StockEntry(
        id=entry_id,
        client_entry_id=entry_in.client_entry_id,
        phc_id=entry_in.phc_id,
        medicine_id=entry_in.medicine_id,
        date=entry_in.date,
        opening=entry_in.opening,
        received=entry_in.received,
        issued=entry_in.issued,
        closing=entry_in.closing,
        batch_no=entry_in.batch_no,
        expiry_date=entry_in.expiry_date,
        entered_by=user_name,
        remarks=entry_in.remarks
    )
    db.add(entry)
    db.flush()

    # 4. Recalculate days of stock and update CurrentStock table
    metrics = calculate_days_of_stock(db, entry_in.phc_id, entry_in.medicine_id)
    
    current_stock = db.query(CurrentStock).filter(
        CurrentStock.phc_id == entry_in.phc_id,
        CurrentStock.medicine_id == entry_in.medicine_id
    ).first()

    if current_stock:
        current_stock.quantity = metrics["quantity"]
        current_stock.avg_daily_use_7d = metrics["avg_daily_use_7d"]
        current_stock.avg_daily_use_30d = metrics["avg_daily_use_30d"]
        current_stock.days_left = metrics["days_left"]
        current_stock.status = metrics["status"]
    else:
        current_stock = CurrentStock(
            id=f"cs_{int(datetime.utcnow().timestamp()*1000)}",
            phc_id=entry_in.phc_id,
            medicine_id=entry_in.medicine_id,
            quantity=metrics["quantity"],
            avg_daily_use_7d=metrics["avg_daily_use_7d"],
            avg_daily_use_30d=metrics["avg_daily_use_30d"],
            days_left=metrics["days_left"],
            status=metrics["status"]
        )
        db.add(current_stock)

    # 5. Check and generate/resolve Alerts automatically
    evaluate_alerts_for_stock(db, entry_in.phc_id, entry_in.medicine_id, metrics)

    # 6. Audit Log
    audit = AuditLog(
        id=f"aud_{int(datetime.utcnow().timestamp()*1000)}",
        user_id=user_name,
        action="STOCK_ENTRY",
        entity="stock_entries",
        entity_id=entry_id,
        details=f"Closing stock {entry_in.closing} logged for medicine {entry_in.medicine_id} at {entry_in.phc_id}"
    )
    db.add(audit)
    db.commit()
    db.refresh(entry)
    return entry


def evaluate_alerts_for_stock(db: Session, phc_id: str, medicine_id: str, metrics: Dict[str, Any]):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    phc = db.query(PHC).filter(PHC.id == phc_id).first()

    # If stock is 0 -> Create Stockout alert
    if metrics["quantity"] == 0:
        existing_alert = db.query(Alert).filter(
            Alert.phc_id == phc_id,
            Alert.medicine_id == medicine_id,
            Alert.type == "stockout",
            Alert.status == "new"
        ).first()

        if not existing_alert:
            alert = Alert(
                id=f"alt_{int(datetime.utcnow().timestamp()*1000)}",
                phc_id=phc_id,
                medicine_id=medicine_id,
                type="stockout",
                severity="critical",
                message=f"Zero stock alert: {medicine.name} at {phc.name if phc else phc_id}. Immediate transfer or emergency indent needed.",
                status="new"
            )
            db.add(alert)
    elif metrics["days_left"] < metrics["threshold_days"]:
        # Low stock alert
        existing_alert = db.query(Alert).filter(
            Alert.phc_id == phc_id,
            Alert.medicine_id == medicine_id,
            Alert.type == "low_stock",
            Alert.status == "new"
        ).first()

        if not existing_alert:
            alert = Alert(
                id=f"alt_{int(datetime.utcnow().timestamp()*1000)}",
                phc_id=phc_id,
                medicine_id=medicine_id,
                type="low_stock",
                severity="high" if medicine.is_critical else "medium",
                message=f"Low stock: {medicine.name} has only {metrics['days_left']} days remaining ({metrics['quantity']} {medicine.unit}) at {phc.name if phc else phc_id}.",
                status="new"
            )
            db.add(alert)
    else:
        # Stock recovered -> auto-resolve new alerts!
        active_alerts = db.query(Alert).filter(
            Alert.phc_id == phc_id,
            Alert.medicine_id == medicine_id,
            Alert.status == "new"
        ).all()
        for a in active_alerts:
            a.status = "resolved"
            a.resolved_at = datetime.utcnow()
            a.resolved_by = "System Auto-Recovery"
