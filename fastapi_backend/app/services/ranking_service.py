from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple, Optional


DEFAULT_RANKING_WEIGHTS = {
    "base_available": 50.0,
    "cost_free": 35.0,
    "cost_low": 18.0,
    "dist_penalty_per_km": 2.0,
    "fresh_under_24h": 10.0,
    "stale_24h_to_72h": -15.0,
    "stale_over_72h": -45.0,
    "open_now_bonus": 10.0,
    "closed_penalty": -10.0,
    "near_expiry_penalty": -20.0,
    "quantity_surplus_bonus": 8.0,
}


def parse_is_open(opening_hours: str, is_24x7: bool) -> bool:
    """Determine whether a facility is currently open based on hours string or 24x7 flag."""
    if is_24x7:
        return True
    if not opening_hours:
        return True

    try:
        # Expected format like "08:00 - 20:00" or "08:00 - 22:00"
        parts = opening_hours.split("-")
        if len(parts) == 2:
            start_str = parts[0].strip()
            end_str = parts[1].strip()
            start_dt = datetime.strptime(start_str, "%H:%M").time()
            end_dt = datetime.strptime(end_str, "%H:%M").time()
            now_time = datetime.now().time()
            return start_dt <= now_time <= end_dt
    except Exception:
        pass
    return True


def compute_staleness(last_updated: Optional[datetime]) -> Tuple[bool, str, float]:
    """
    Returns (is_stale, severity_level, age_hours).
    severity_level: 'fresh', 'stale_warning' (>24h), 'severe_stale' (>72h).
    """
    if not last_updated:
        return True, "severe_stale", 999.0

    # Ensure timezone compatibility
    now = datetime.now(timezone.utc)
    if last_updated.tzinfo is None:
        last_updated = last_updated.replace(tzinfo=timezone.utc)

    age_hours = (now - last_updated).total_seconds() / 3600.0

    if age_hours <= 24.0:
        return False, "fresh", age_hours
    elif age_hours <= 72.0:
        return True, "stale_warning", age_hours
    else:
        return True, "severe_stale", age_hours


def is_near_expiry(expiry_date_str: Optional[str], days_threshold: int = 30) -> bool:
    """Checks if an expiry date is within days_threshold from today."""
    if not expiry_date_str:
        return False
    try:
        exp_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        return (exp_date - today).days <= days_threshold
    except Exception:
        return False


def score_source_result(
    source: Any,
    stock_item: Optional[Any],
    distance_km: float,
    weights: Optional[Dict[str, float]] = None,
) -> Tuple[float, List[str]]:
    """
    Computes a composite heuristic score and returns human-readable justification reasons.
    Higher score = better rank.
    """
    w = DEFAULT_RANKING_WEIGHTS if weights is None else {**DEFAULT_RANKING_WEIGHTS, **weights}
    score = 0.0
    reasons: List[str] = []

    qty = stock_item.quantity if stock_item else 0
    price = stock_item.price_per_unit if stock_item else 0.0
    ownership = getattr(source, "ownership", "government")
    is_free = (ownership == "government") or (price is None or price <= 0.0)

    # 1. Availability
    if qty > 0:
        score += w["base_available"]
        if qty >= 100:
            score += w["quantity_surplus_bonus"]
            reasons.append(f"Ample surplus stock ({qty} units)")
        else:
            reasons.append(f"In stock ({qty} units)")
    else:
        score -= 100.0
        reasons.append("Currently out of stock")

    # 2. Cost / Ownership
    if is_free:
        score += w["cost_free"]
        reasons.append("Free government healthcare item (+35 pts)")
    elif ownership == "cooperative" or (price and price <= 30.0):
        score += w["cost_low"]
        reasons.append(f"Low-cost generic: ₹{price:.2f} (+18 pts)")
    else:
        reasons.append(f"Retail price: ₹{price:.2f}")

    # 3. Distance penalty
    dist_penalty = distance_km * w["dist_penalty_per_km"]
    score -= dist_penalty
    if distance_km <= 3.0:
        reasons.append(f"Very close proximity ({distance_km:.1f} km)")
    elif distance_km <= 10.0:
        reasons.append(f"Nearby ({distance_km:.1f} km)")
    else:
        reasons.append(f"Distance: {distance_km:.1f} km (-{dist_penalty:.1f} pts)")

    # 4. Data freshness
    last_up = stock_item.last_updated if stock_item else getattr(source, "created_at", None)
    is_stale, severity, age_hours = compute_staleness(last_up)
    if severity == "fresh":
        score += w["fresh_under_24h"]
        if age_hours < 2.0:
            reasons.append("Fresh verified data (updated <2 hrs ago)")
        else:
            reasons.append(f"Verified recently (updated {int(age_hours)} hrs ago)")
    elif severity == "stale_warning":
        score += w["stale_24h_to_72h"]
        reasons.append(f"Caution: Data {int(age_hours)} hrs old (-15 pts)")
    else:
        score += w["stale_over_72h"]
        reasons.append(f"Warning: Severely stale stock data (>72 hrs) (-45 pts)")

    # 5. Open / Operating hours
    open_now = parse_is_open(source.opening_hours, source.is_24x7)
    if open_now:
        score += w["open_now_bonus"]
        reasons.append("Currently open now (+10 pts)")
    else:
        score += w["closed_penalty"]
        reasons.append("Currently closed (-10 pts)")

    # 6. Expiry penalty
    if stock_item and is_near_expiry(stock_item.expiry_date, 30):
        score += w["near_expiry_penalty"]
        reasons.append("Batch expiring within 30 days (-20 pts)")

    return round(score, 2), reasons
