from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch
from app.models.alert import Alert
from app.services.stock_service import calculate_days_of_stock
from app.services.recommender import find_nearby_surplus


def process_staff_chat_query(db: Session, query: str, user_phc_id: Optional[str] = None) -> Dict[str, Any]:
    text = query.strip().lower()
    phc_id = user_phc_id or "phc_cpt_01"
    phc = db.query(PHC).filter(PHC.id == phc_id).first()
    phc_name = phc.name if phc else "your Primary Health Centre"

    # Match medicine names in query
    medicines = db.query(Medicine).all()
    matched_med = None
    for m in medicines:
        m_lower = m.name.lower()
        gen_lower = m.generic_name.lower()
        tokens = m_lower.split()
        if m_lower in text or gen_lower in text or any(len(t) > 3 and t in text for t in tokens):
            matched_med = m
            break

    # 1. Nearby stock surplus query
    nearby_keywords = ["nearby", "who has", "where can i get", "surplus", "how far", "spare", "எங்கே", "யாரிடம்", "அருகில்"]
    if any(k in text for k in nearby_keywords) or (matched_med and ("where" in text or "who" in text or "find" in text)):
        if not matched_med:
            return {
                "reply": "I can help locate surplus stock at nearby PHCs! Which medicine are you searching for? (e.g., Paracetamol syrup, ORS, Amoxicillin, Insulin)",
                "action": "PROMPT_MEDICINE"
            }

        # Check multi-source finder first for comprehensive results across all facility types
        from app.models.stock_source import StockSource, SourceStock
        from app.services.distance import haversine_distance
        from app.services.ranking_service import score_source_result, parse_is_open

        anchor_phc = db.query(StockSource).filter(StockSource.id == phc_id).first()
        lat = anchor_phc.latitude if anchor_phc else 12.6841
        lon = anchor_phc.longitude if anchor_phc else 79.9830

        sources_with_med = (
            db.query(StockSource, SourceStock)
            .join(SourceStock, StockSource.id == SourceStock.source_id)
            .filter(
                SourceStock.medicine_id == matched_med.id,
                SourceStock.quantity > 0,
                StockSource.is_active == True,
                StockSource.is_verified == True,
            )
            .all()
        )

        if sources_with_med:
            scored_candidates = []
            for src, stk in sources_with_med:
                dist = haversine_distance(lat, lon, src.latitude, src.longitude)
                if dist <= 45.0:
                    score, _ = score_source_result(src, stk, dist)
                    price_str = "FREE (Govt)" if (src.ownership == "government" or not stk.price_per_unit) else f"₹{stk.price_per_unit:.2f}"
                    is_open = parse_is_open(src.opening_hours, src.is_24x7)
                    open_tag = "🟢 Open now" if is_open else "🔴 Closed"
                    type_label = src.source_type.replace("_", " ").title()
                    scored_candidates.append({
                        "source": src,
                        "stock": stk,
                        "dist": dist,
                        "score": score,
                        "price_str": price_str,
                        "open_tag": open_tag,
                        "type_label": type_label,
                    })

            scored_candidates.sort(key=lambda c: -c["score"])

            if scored_candidates:
                lines = []
                for idx, c in enumerate(scored_candidates[:4]):
                    s = c["source"]
                    st = c["stock"]
                    lines.append(
                        f"{idx + 1}. **{s.name}** ({c['type_label']}) — **{c['dist']:.1f} km away**\n"
                        f"   • **Cost:** {c['price_str']} | **Status:** {c['open_tag']}\n"
                        f"   • **Stock Available:** {st.quantity} {matched_med.unit} (Batch: {st.batch_no or 'N/A'})\n"
                        f"   • **Phone:** {s.phone} | **Hours:** {s.opening_hours}"
                    )

                results_text = "\n\n".join(lines)
                is_free_available = any(c["source"].ownership == "government" for c in scored_candidates)
                free_note = "✅ **Free Government healthcare stock is available nearby!**" if is_free_available else "ℹ️ Available primarily at cooperative low-cost outlets or private pharmacies."

                return {
                    "reply": (
                        f"Here is where you can get **{matched_med.name}** nearby:\n\n"
                        f"{free_note}\n\n"
                        f"{results_text}\n\n"
                        f"💡 *Would you like to initiate a transfer request or view these facilities on the live interactive map?*"
                    ),
                    "action": "MULTI_SOURCE_RESULTS",
                    "data": {
                        "medicine_id": matched_med.id,
                        "total_found": len(scored_candidates),
                        "top_source_id": scored_candidates[0]["source"].id,
                    }
                }

        # Fallback to PHC recommender
        res = find_nearby_surplus(db, phc_id, [matched_med.id], radius_km=50.0)
        donors = res.get("donors", [])
        if not donors:
            return {
                "reply": f"⚠️ No nearby facilities currently hold stock of **{matched_med.name}** within 50 km of {phc_name}. I recommend submitting an **Emergency Indent** to the district medical warehouse.",
                "action": "EMERGENCY_INDENT_SUGGESTION"
            }

        top_donors = donors[:3]
        lines = []
        for idx, d in enumerate(top_donors):
            m_item = d["matches"][0]
            lines.append(
                f"{idx + 1}. **{d['donor_phc_name']}** — **{d['distance_km']} km away**\n"
                f"   • Spareable surplus: **{m_item['spareable_surplus']} {m_item['unit']}** (Total: {m_item['total_stock']})\n"
                f"   • Cost: Free Government Formulary\n"
                f"   • Contact: {d['phone']}"
            )

        donor_text = "\n\n".join(lines)
        return {
            "reply": f"Here are the nearest centres with surplus stock of **{matched_med.name}**:\n\n{donor_text}\n\n💡 Would you like to create an Inter-PHC transfer request from **{top_donors[0]['donor_phc_name']}**?",
            "action": "TRANSFER_OPTION",
            "data": {
                "medicine_id": matched_med.id,
                "donor_phc_id": top_donors[0]["donor_phc_id"],
                "distance_km": top_donors[0]["distance_km"]
            }
        }


    # 2. Days-of-Stock query
    days_keywords = ["how many days", "days left", "run out", "velocity", "எத்தனை நாள்", "எவ்வளவு நாள்"]
    if any(k in text for k in days_keywords) or (matched_med and "days" in text):
        if not matched_med:
            return {
                "reply": "Please specify the medicine to check remaining days of stock (e.g. 'How many days of Amoxicillin do we have?').",
                "action": "PROMPT_MEDICINE"
            }

        metrics = calculate_days_of_stock(db, phc_id, matched_med.id)
        alert_str = "🚨 **Critical Alert:** Stock is below the minimum threshold! Immediate transfer or indent recommended." if metrics["days_left"] < metrics["threshold_days"] else "✅ Stock level is within safe operating parameters."

        return {
            "reply": (
                f"📊 **Stock Status at {phc_name} for {matched_med.name}**:\n"
                f"• **Current stock:** {metrics['quantity']} {matched_med.unit}\n"
                f"• **Daily consumption rate:** {metrics['effective_daily_rate']} {matched_med.unit}/day\n"
                f"• **Estimated days remaining:** **{metrics['days_left']} days** ({metrics['status']})\n"
                f"• **Projected run-out date:** {metrics['runout_date'] or 'Depleted'}\n\n"
                f"{alert_str}"
            ),
            "action": "STOCK_SUMMARY",
            "data": metrics
        }

    # 3. Expiry query
    if "expir" in text or "காலாவதி" in text:
        batches = db.query(Batch).filter(
            Batch.phc_id == phc_id,
            Batch.quantity > 0,
            Batch.expiry_date <= (date.today() + timedelta(days=90))
        ).order_by(Batch.expiry_date.asc()).limit(5).all()

        if not batches:
            return {
                "reply": f"Great news! No medicine batches at {phc_name} are scheduled to expire within the next 90 days. All stock is fresh."
            }

        exp_lines = [
            f"• **{b.medicine.name if b.medicine else b.medicine_id}** (Batch: {b.batch_number}): **{b.quantity} {b.medicine.unit if b.medicine else 'units'}** expiring on **{b.expiry_date}**"
            for b in batches
        ]
        return {
            "reply": f"⚠️ **Batches Expiring Soon (Next 90 Days) at {phc_name}**:\n\n" + "\n".join(exp_lines) + "\n\n💡 Tip: Consider offering these batches for transfer to higher-velocity centres before shelf-life expires.",
            "action": "EXPIRY_LIST"
        }

    # 4. Critical Shortages
    if "shortage" in text or "critical" in text or "low stock" in text or "பற்றாக்குறை" in text:
        alerts = db.query(Alert).filter(Alert.phc_id == phc_id, Alert.status == "new").all()
        if not alerts:
            return {
                "reply": f"All monitored medicines at {phc_name} are currently above minimum safety thresholds. No active shortage alerts!"
            }

        alert_lines = [f"• **{a.medicine.name if a.medicine else a.medicine_id}** [{a.severity.upper()}]: {a.message}" for a in alerts[:5]]
        return {
            "reply": f"🚨 **Active Shortages & Alerts for {phc_name}**:\n\n" + "\n".join(alert_lines) + "\n\nWould you like me to match these shortages with nearby PHC donors?",
            "action": "SHORTAGE_LIST"
        }

    # 5. Tamil / English Greetings
    if "வணக்கம்" in text or "hello" in text or "help" in text or "உதவி" in text:
        return {
            "reply": (
                "வணக்கம்! I am your **MediSync PHC AI Clinical Inventory Assistant**.\n\n"
                "You can ask me questions like:\n"
                "1. *'Who nearby has Paracetamol syrup and how far is it?'*\n"
                "2. *'How many days of Amoxicillin do we have?'*\n"
                "3. *'Which medicines are expiring within 90 days?'*\n"
                "4. *'Show active critical shortages at my PHC.'*\n\n"
                "How can I assist you today?"
            )
        }

    return {
        "reply": (
            "I can help you monitor medicine stock, find nearby surplus, estimate days-of-stock, and track expiry.\n\n"
            "Try asking:\n"
            "• *'Who nearby has ORS sachets?'*\n"
            "• *'How many days of Metformin do we have?'*\n"
            "• *'Which batches are expiring soon?'*\n"
            "• *'What are our active stock shortages?'*"
        )
    }
