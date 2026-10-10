from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.services.forecasting import generate_consumption_forecast
from app.services.anomaly import detect_stock_anomalies
from app.services.seasonal import get_seasonal_profile
from app.services.chatbot import process_staff_chat_query
from app.services.distance import haversine_distance
from app.services.stock_service import calculate_days_of_stock
from app.auth import get_current_user, get_current_user_optional

router = APIRouter(tags=["AI & Forecasting Services"])


class ChatQueryRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None


@router.get("/forecast/{phc_id}/{medicine_id}")
def get_forecast(
    phc_id: str,
    medicine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return generate_consumption_forecast(db, phc_id, medicine_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/recommendations/redistribution")
def get_redistribution_recommendations(
    block: Optional[str] = Query(None, description="Optional block filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    phc_query = db.query(PHC)
    if block:
        phc_query = phc_query.filter(PHC.block == block)
    phcs = phc_query.all()
    medicines = db.query(Medicine).all()

    shortages = []
    surpluses = []

    for p in phcs:
        for m in medicines:
            metrics = calculate_days_of_stock(db, p.id, m.id)
            if metrics["days_left"] < metrics["threshold_days"]:
                shortages.append({
                    "phc": p,
                    "medicine": m,
                    "metrics": metrics,
                    "needed_qty": max(20, int((30 - metrics["days_left"]) * metrics["effective_daily_rate"]))
                })
            elif metrics["spareable_surplus"] > 15:
                surpluses.append({
                    "phc": p,
                    "medicine": m,
                    "spareable": metrics["spareable_surplus"],
                    "days_left": metrics["days_left"]
                })

    proposed_transfers = []
    unfulfilled_shortages = []

    for shortage in shortages:
        matching = [
            s for s in surpluses 
            if s["medicine"].id == shortage["medicine"].id and s["spareable"] > 0 and s["phc"].id != shortage["phc"].id
        ]
        if not matching:
            unfulfilled_shortages.append(shortage)
            continue

        # Calculate distances
        for s in matching:
            s["distance_km"] = haversine_distance(
                shortage["phc"].latitude, shortage["phc"].longitude,
                s["phc"].latitude, s["phc"].longitude
            )
        matching.sort(key=lambda x: x["distance_km"])

        best_donor = matching[0]
        if best_donor["distance_km"] > 35.0:
            unfulfilled_shortages.append(shortage)
            continue

        transfer_qty = min(shortage["needed_qty"], best_donor["spareable"])
        best_donor["spareable"] -= transfer_qty

        proposed_transfers.append({
            "from_phc_id": best_donor["phc"].id,
            "from_phc_name": best_donor["phc"].name,
            "to_phc_id": shortage["phc"].id,
            "to_phc_name": shortage["phc"].name,
            "medicine_id": shortage["medicine"].id,
            "medicine_name": shortage["medicine"].name,
            "form": shortage["medicine"].form,
            "unit": shortage["medicine"].unit,
            "is_cold_chain": shortage["medicine"].is_cold_chain,
            "quantity": transfer_qty,
            "distance_km": best_donor["distance_km"],
            "reasoning": f"{shortage['phc'].name} has {shortage['metrics']['days_left']} days remaining, while {best_donor['phc'].name} has surplus buffer ({best_donor['days_left']} days)."
        })

    # Group transfers by (from_phc, to_phc) route to consolidate deliveries
    grouped_routes = {}
    for t in proposed_transfers:
        route_key = f"{t['from_phc_id']}_to_{t['to_phc_id']}"
        if route_key not in grouped_routes:
            grouped_routes[route_key] = {
                "from_phc": {"id": t["from_phc_id"], "name": t["from_phc_name"]},
                "to_phc": {"id": t["to_phc_id"], "name": t["to_phc_name"]},
                "distance_km": t["distance_km"],
                "has_cold_chain": False,
                "items": []
            }
        if t["is_cold_chain"]:
            grouped_routes[route_key]["has_cold_chain"] = True
        grouped_routes[route_key]["items"].append(t)

    return {
        "total_shortages_detected": len(shortages),
        "fulfillable_via_nearby_transfers": len(proposed_transfers),
        "grouped_delivery_runs": list(grouped_routes.values()),
        "unfulfilled_needing_warehouse_indent": [
            {
                "phc_id": s["phc"].id,
                "phc_name": s["phc"].name,
                "medicine_id": s["medicine"].id,
                "medicine_name": s["medicine"].name,
                "current_stock": s["metrics"]["quantity"],
                "days_left": s["metrics"]["days_left"],
                "recommended_indent_qty": s["needed_qty"] * 2
            }
            for s in unfulfilled_shortages
        ],
        "disclaimer": "AI recommendations only. Human approval by Medical Officer required before dispatch."
    }


@router.post("/chatbot")
@router.post("/ai/chatbot")
def staff_chatbot(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    text = (payload.query or payload.message or "").strip()
    phc_id = current_user.phc_id if current_user else None
    return process_staff_chat_query(db, text, phc_id)


@router.get("/ai/anomalies")
def get_anomalies(
    phc_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return {"anomalies": detect_stock_anomalies(db, phc_id)}


@router.get("/ai/seasonal-profile")
def get_season():
    return {"profile": get_seasonal_profile()}
