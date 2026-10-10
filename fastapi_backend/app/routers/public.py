from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.database import get_db
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.services.stock_service import calculate_days_of_stock

router = APIRouter(prefix="/public", tags=["Public Citizen Portal (No Login)"])


@router.get("/availability")
def check_public_availability(
    phc_id: str = Query(..., description="ID of the PHC"),
    medicine_id: Optional[str] = Query(None, description="Optional ID of the medicine"),
    db: Session = Depends(get_db)
):
    """Citizen-facing medicine stock availability endpoint.
    Strictly conforms to privacy requirements: returns status only (Available / Low / Out),
    and NEVER returns exact counts or patient metrics.
    """
    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not phc:
        raise HTTPException(status_code=404, detail="PHC not found")

    if medicine_id:
        med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
        if not med:
            raise HTTPException(status_code=404, detail="Medicine not found")

        metrics = calculate_days_of_stock(db, phc_id, medicine_id)
        quantity = metrics["quantity"]
        days_left = metrics["days_left"]

        if quantity == 0:
            status_code = "OUT_OF_STOCK"
            display_text = "Temporarily Unavailable (தற்போது இருப்பில் இல்லை)"
            color = "red"
        elif days_left < 10:
            status_code = "LOW_STOCK"
            display_text = "Limited Supply (குறைந்த அளவு இருப்பு)"
            color = "amber"
        else:
            status_code = "AVAILABLE"
            display_text = "In Stock (இருப்பில் உள்ளது)"
            color = "green"

        return {
            "phc": {
                "name": phc.name,
                "block": phc.block,
                "address": phc.address or f"{phc.name}, {phc.block}",
                "phone": phc.phone
            },
            "medicine": {
                "id": med.id,
                "name": med.name,
                "form": med.form,
                "strength": med.strength,
                "category": med.category
            },
            "status": status_code,
            "status_display": display_text,
            "badge_color": color,
            "as_of_date": date.today().isoformat()
        }

    # If no medicine_id provided, return list of all medicines for that PHC
    medicines = db.query(Medicine).all()
    results = []
    for med in medicines:
        metrics = calculate_days_of_stock(db, phc_id, med.id)
        quantity = metrics["quantity"]
        days_left = metrics["days_left"]

        if quantity == 0:
            status_code = "OUT_OF_STOCK"
            display_text = "Temporarily Unavailable"
            color = "red"
        elif days_left < 10:
            status_code = "LOW_STOCK"
            display_text = "Limited Supply"
            color = "amber"
        else:
            status_code = "AVAILABLE"
            display_text = "In Stock"
            color = "green"

        results.append({
            "medicine_id": med.id,
            "medicine_name": med.name,
            "category": med.category,
            "form": med.form,
            "stock_status": status_code,
            "status_display": display_text,
            "badge_color": color
        })

    return {
        "phc": {
            "id": phc.id,
            "name": phc.name,
            "block": phc.block,
            "phone": phc.phone
        },
        "as_of_date": date.today().isoformat(),
        "total_medicines_tracked": len(results),
        "medicines": results
    }
