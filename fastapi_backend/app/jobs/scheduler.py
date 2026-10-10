import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import date, timedelta

from app.database import SessionLocal
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch
from app.models.alert import Alert
from app.services.stock_service import calculate_days_of_stock, evaluate_alerts_for_stock
from app.services.notification import notification_service

logger = logging.getLogger("medisync.scheduler")
scheduler = BackgroundScheduler()


def run_daily_health_check():
    """Runs periodic background scans across all PHCs and medicines to discover expiring batches,
    low stock, and anomalies, auto-generating alerts and SMS/WhatsApp notifications.
    """
    db = SessionLocal()
    try:
        logger.info("Executing scheduled daily stock and expiry evaluation...")
        phcs = db.query(PHC).all()
        medicines = db.query(Medicine).all()

        # 1. Check near-expiry batches (<60 days)
        sixty_days_out = date.today() + timedelta(days=60)
        expiring_batches = db.query(Batch).filter(
            Batch.quantity > 0,
            Batch.expiry_date <= sixty_days_out
        ).all()

        for b in expiring_batches:
            existing = db.query(Alert).filter(
                Alert.phc_id == b.phc_id,
                Alert.medicine_id == b.medicine_id,
                Alert.type == "near_expiry",
                Alert.status == "new"
            ).first()

            if not existing:
                phc = db.query(PHC).filter(PHC.id == b.phc_id).first()
                med = db.query(Medicine).filter(Medicine.id == b.medicine_id).first()
                alert = Alert(
                    id=f"alt_exp_{b.id}_{int(date.today().strftime('%Y%m%d'))}",
                    phc_id=b.phc_id,
                    medicine_id=b.medicine_id,
                    type="near_expiry",
                    severity="medium",
                    message=f"Batch {b.batch_number} of {med.name if med else b.medicine_id} ({b.quantity} units) expires on {b.expiry_date} (<60 days). Consider rebalancing before expiry.",
                    status="new"
                )
                db.add(alert)

        # 2. Re-evaluate days-of-stock and thresholds
        for p in phcs:
            for m in medicines:
                metrics = calculate_days_of_stock(db, p.id, m.id)
                evaluate_alerts_for_stock(db, p.id, m.id, metrics)

        db.commit()
        logger.info("Scheduled stock check completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error in background scheduler: {e}")
    finally:
        db.close()


def start_scheduler():
    if not scheduler.running:
        # Runs every 12 hours (or interval)
        scheduler.add_job(run_daily_health_check, "interval", hours=12, id="daily_stock_check", replace_existing=True)
        scheduler.start()
        logger.info("APScheduler initialized for background telemetry.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")
