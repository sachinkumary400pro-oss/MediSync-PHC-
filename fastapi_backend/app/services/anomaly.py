import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import StockEntry


def detect_stock_anomalies(db: Session, phc_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query = db.query(StockEntry)
    if phc_id:
        query = query.filter(StockEntry.phc_id == phc_id)

    entries = query.order_by(StockEntry.phc_id, StockEntry.medicine_id, StockEntry.date.asc()).all()

    # Group by (phc_id, medicine_id)
    grouped = {}
    for e in entries:
        key = (e.phc_id, e.medicine_id)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(e)

    anomalies = []

    for (p_id, m_id), history in grouped.items():
        if len(history) < 6:
            continue

        baseline = history[:-1]
        latest = history[-1]

        issued_vals = [e.issued for e in baseline]
        mean = sum(issued_vals) / len(issued_vals)
        variance = sum((x - mean) ** 2 for x in issued_vals) / len(issued_vals)
        std_dev = math.sqrt(variance)

        if std_dev > 0:
            z_score = (latest.issued - mean) / std_dev
        else:
            z_score = 0.0

        # Anomaly threshold: Z >= 2.0 and at least 2.2x mean and at least 20 units dispensed
        if z_score >= 2.0 and latest.issued >= (mean * 2.2) and latest.issued >= 20:
            phc = db.query(PHC).filter(PHC.id == p_id).first()
            med = db.query(Medicine).filter(Medicine.id == m_id).first()

            anomalies.append({
                "id": f"anom_{p_id}_{m_id}_{latest.date.isoformat()}",
                "phc_id": p_id,
                "phc_name": phc.name if phc else p_id,
                "medicine_id": m_id,
                "medicine_name": med.name if med else m_id,
                "date": latest.date.isoformat(),
                "observed_issued": latest.issued,
                "baseline_mean": round(mean, 1),
                "std_dev": round(std_dev, 1),
                "z_score": round(z_score, 2),
                "surge_ratio": round(latest.issued / max(1.0, mean), 1),
                "severity": "critical" if z_score > 3.0 else "high",
                "description": f"Abnormal consumption spike of {latest.issued} units vs baseline average of {round(mean, 1)} (Z={round(z_score, 2)}σ). Potential fever cluster or epidemic surge."
            })

    return anomalies


def compute_zscore_anomaly(series: List[float], z_threshold: float = 2.0) -> Dict[str, Any]:
    """Pure mathematical helper to compute Z-score surge over a historical consumption series."""
    if len(series) < 2:
        return {"is_anomaly": False, "z_score": 0.0, "severity": "NORMAL"}

    baseline = series[:-1]
    latest = series[-1]
    mean = sum(baseline) / len(baseline)
    variance = sum((x - mean) ** 2 for x in baseline) / len(baseline)
    std_dev = math.sqrt(variance)

    if std_dev > 0:
        z_score = (latest - mean) / std_dev
    else:
        z_score = 0.0

    is_anomaly = z_score >= z_threshold and latest > mean
    severity = "NORMAL"
    if is_anomaly:
        severity = "CRITICAL_SURGE" if z_score >= 3.0 else "SURGE"

    return {
        "is_anomaly": is_anomaly,
        "z_score": round(z_score, 2),
        "mean": round(mean, 2),
        "std_dev": round(std_dev, 2),
        "severity": severity
    }
