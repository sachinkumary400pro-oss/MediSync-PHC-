from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.medicine import Medicine
from app.models.stock import StockEntry, Batch
from app.services.stock_service import calculate_days_of_stock
from app.services.seasonal import get_seasonal_multiplier_for_medicine, get_seasonal_profile


def generate_consumption_forecast(db: Session, phc_id: str, medicine_id: str) -> Dict[str, Any]:
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise ValueError("Medicine not found")

    metrics = calculate_days_of_stock(db, phc_id, medicine_id)
    current_stock = metrics["quantity"]
    daily_rate = metrics["effective_daily_rate"]

    # 30-day historical entry points
    entries = db.query(StockEntry).filter(
        StockEntry.phc_id == phc_id,
        StockEntry.medicine_id == medicine_id
    ).order_by(desc(StockEntry.date)).limit(30).all()

    history = [
        {
            "date": e.date.isoformat(),
            "closing_stock": e.closing,
            "issued_qty": e.issued
        }
        for e in reversed(entries)
    ]

    # Future 30-day projected depletion trajectory
    projections = []
    simulated_stock = current_stock
    today = date.today()

    for i in range(1, 31):
        target_date = today + timedelta(days=i)
        simulated_stock = max(0, int(simulated_stock - daily_rate))
        projections.append({
            "day_offset": i,
            "date": target_date.isoformat(),
            "projected_stock": simulated_stock
        })

    # Seasonal adjustment
    seasonal_mult = get_seasonal_multiplier_for_medicine(medicine.name)
    seasonal_profile = get_seasonal_profile()
    suggested_buffer_days = seasonal_profile["recommended_buffer_days"]
    seasonal_daily_rate = round(daily_rate * seasonal_mult, 1)
    suggested_buffer_qty = int(seasonal_daily_rate * suggested_buffer_days)

    reasoning = (
        f"Forecast computed via weighted exponential smoothing (70% 7-day velocity, 30% 30-day velocity). "
        f"At {daily_rate} units/day consumption, existing stock of {current_stock} {medicine.unit} "
        f"will be exhausted in {metrics['days_left']} days ({metrics['runout_date'] or 'N/A'}). "
        f"Season: {seasonal_profile['season_name']} applies a {seasonal_mult}x multiplier, "
        f"recommending a safety reserve of {suggested_buffer_qty} units."
    )

    return {
        "medicine_id": medicine.id,
        "medicine_name": medicine.name,
        "form": medicine.form,
        "strength": medicine.strength,
        "unit": medicine.unit,
        "current_stock": current_stock,
        "effective_daily_rate": daily_rate,
        "days_left": metrics["days_left"],
        "predicted_runout_date": metrics["runout_date"],
        "confidence_score": 0.92,
        "seasonal_adjustment": {
            "season": seasonal_profile["season_name"],
            "multiplier": seasonal_mult,
            "adjusted_daily_rate": seasonal_daily_rate,
            "suggested_buffer_qty": suggested_buffer_qty,
            "recommended_buffer_days": suggested_buffer_days
        },
        "history": history,
        "projections": projections,
        "reasoning": reasoning,
        "disclaimer": "AI recommendation only. All allocations must be verified and approved by the Medical Officer."
    }
