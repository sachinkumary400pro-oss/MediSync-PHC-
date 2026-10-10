from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import date

from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch, StockEntry
from app.services.distance import haversine_distance
from app.services.stock_service import calculate_days_of_stock


def find_nearby_surplus(
    db: Session,
    requesting_phc_id: str,
    medicine_ids: List[str],
    radius_km: float = 40.0
) -> Dict[str, Any]:
    req_phc = db.query(PHC).filter(PHC.id == requesting_phc_id).first()
    if not req_phc:
        raise ValueError(f"Requesting PHC {requesting_phc_id} not found")

    # Fetch candidate donor PHCs in the district
    other_phcs = db.query(PHC).filter(
        PHC.id != requesting_phc_id,
        PHC.district == req_phc.district
    ).all()

    # Precompute distances
    phc_distances = {}
    for p in other_phcs:
        dist = haversine_distance(req_phc.latitude, req_phc.longitude, p.latitude, p.longitude)
        if dist <= radius_km:
            phc_distances[p.id] = {"phc": p, "distance_km": dist}

    donors_map = {}

    for med_id in medicine_ids:
        medicine = db.query(Medicine).filter(Medicine.id == med_id).first()
        if not medicine:
            continue

        for donor_id, d_info in phc_distances.items():
            donor_phc = d_info["phc"]
            dist_km = d_info["distance_km"]

            # Calculate donor current metrics
            metrics = calculate_days_of_stock(db, donor_id, med_id)
            spareable = metrics["spareable_surplus"]

            # Consider donor if they have surplus to spare
            if spareable > 0 or (metrics["days_left"] >= 40 and metrics["quantity"] >= 20):
                if donor_id not in donors_map:
                    donors_map[donor_id] = {
                        "donor_phc_id": donor_id,
                        "donor_phc_name": donor_phc.name,
                        "block": donor_phc.block,
                        "distance_km": dist_km,
                        "phone": donor_phc.phone,
                        "medical_officer_name": donor_phc.medical_officer_name,
                        "latitude": donor_phc.latitude,
                        "longitude": donor_phc.longitude,
                        "supplied_medicines_count": 0,
                        "matches": []
                    }

                # Find earliest batch
                earliest_batch = db.query(Batch).filter(
                    Batch.phc_id == donor_id,
                    Batch.medicine_id == med_id,
                    Batch.quantity > 0
                ).order_by(Batch.expiry_date.asc()).first()

                days_to_expiry = (earliest_batch.expiry_date - date.today()).days if earliest_batch else 999

                donors_map[donor_id]["supplied_medicines_count"] += 1
                donors_map[donor_id]["matches"].append({
                    "medicine_id": medicine.id,
                    "medicine_code": medicine.code,
                    "medicine_name": medicine.name,
                    "form": medicine.form,
                    "strength": medicine.strength,
                    "unit": medicine.unit,
                    "is_cold_chain": medicine.is_cold_chain,
                    "is_critical": medicine.is_critical,
                    "total_stock": metrics["quantity"],
                    "spareable_surplus": spareable if spareable > 0 else int(metrics["quantity"] * 0.3),
                    "donor_days_of_stock": metrics["days_left"],
                    "earliest_batch": earliest_batch.batch_number if earliest_batch else None,
                    "earliest_expiry": earliest_batch.expiry_date.isoformat() if earliest_batch else None,
                    "days_to_expiry": days_to_expiry,
                    "priority": "HIGH_NEAR_EXPIRY" if days_to_expiry < 90 else "NORMAL"
                })

    # Sort results nearest first; flag multi-item suppliers
    donor_list = list(donors_map.values())
    donor_list.sort(key=lambda x: (
        -x["supplied_medicines_count"],  # Donors supplying multiple items first
        x["distance_km"]                 # Then nearest distance
    ))

    return {
        "requesting_phc": {
            "id": req_phc.id,
            "name": req_phc.name,
            "latitude": req_phc.latitude,
            "longitude": req_phc.longitude,
        },
        "radius_km": radius_km,
        "searched_medicines_count": len(medicine_ids),
        "donors": donor_list
    }
