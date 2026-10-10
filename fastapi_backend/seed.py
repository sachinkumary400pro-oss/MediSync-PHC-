import sys
import os
import math
from datetime import datetime, date, timedelta
from passlib.context import CryptContext

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch, StockEntry, CurrentStock
from app.models.alert import Alert
from app.models.transfer import TransferRequest, TransferItem
from app.models.indent import EmergencyIndent, EmergencyIndentItem
from app.models.audit import AuditLog
from app.services.stock_service import calculate_days_of_stock
from app.auth import get_password_hash


def seed_database():
    print("[INFO] Seeding MediSync PHC FastAPI database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing data
        db.query(AuditLog).delete()
        db.query(Alert).delete()
        db.query(EmergencyIndentItem).delete()
        db.query(EmergencyIndent).delete()
        db.query(TransferItem).delete()
        db.query(TransferRequest).delete()
        db.query(StockEntry).delete()
        db.query(CurrentStock).delete()
        db.query(Batch).delete()
        db.query(User).delete()
        db.query(Medicine).delete()
        db.query(PHC).delete()
        db.commit()

        # 1. 15 PHCs across 3 Blocks
        phcs_data = [
            # Chengalpattu Block (5 PHCs)
            {"id": "phc_cpt_01", "name": "PHC Alapakkam", "block": "Chengalpattu Block", "district": "Chengalpattu", "lat": 12.6841, "lon": 79.9830, "pop": 34000, "phone": "044-27420101", "mo": "Dr. S. Karthi, MBBS", "pharm": "Mr. R. Murugan, D.Pharm"},
            {"id": "phc_cpt_02", "name": "PHC Melamaiyur", "block": "Chengalpattu Block", "district": "Chengalpattu", "lat": 12.7052, "lon": 79.9678, "pop": 41000, "phone": "044-27420102", "mo": "Dr. M. Deepa, MBBS", "pharm": "Mrs. K. Banumathi, B.Pharm"},
            {"id": "phc_cpt_03", "name": "PHC Vallam", "block": "Chengalpattu Block", "district": "Chengalpattu", "lat": 12.7230, "lon": 80.0120, "pop": 28500, "phone": "044-27420103", "mo": "Dr. K. Vignesh, MD", "pharm": "Mr. T. Selvam, D.Pharm"},
            {"id": "phc_cpt_04", "name": "PHC Singaperumal Koil", "block": "Chengalpattu Block", "district": "Chengalpattu", "lat": 12.7635, "lon": 80.0034, "pop": 52000, "phone": "044-27420104", "mo": "Dr. P. Revathi, MBBS", "pharm": "Mr. A. Manikandan, D.Pharm"},
            {"id": "phc_cpt_05", "name": "PHC Maraimalai Nagar", "block": "Chengalpattu Block", "district": "Chengalpattu", "lat": 12.7981, "lon": 80.0247, "pop": 58000, "phone": "044-27420105", "mo": "Dr. R. Anand, MBBS", "pharm": "Mrs. S. Gomathi, B.Pharm"},

            # Maduranthakam Block (5 PHCs)
            {"id": "phc_mdk_01", "name": "PHC Karunguzhi", "block": "Maduranthakam Block", "district": "Chengalpattu", "lat": 12.5180, "lon": 79.9021, "pop": 31000, "phone": "044-27560201", "mo": "Dr. V. Arunkumar, MBBS", "pharm": "Mr. P. Velu, D.Pharm"},
            {"id": "phc_mdk_02", "name": "PHC Padalam", "block": "Maduranthakam Block", "district": "Chengalpattu", "lat": 12.5721, "lon": 79.9324, "pop": 33500, "phone": "044-27560202", "mo": "Dr. B. Kavitha, MBBS", "pharm": "Mrs. N. Lakshmi, D.Pharm"},
            {"id": "phc_mdk_03", "name": "PHC Acharapakkam", "block": "Maduranthakam Block", "district": "Chengalpattu", "lat": 12.4332, "lon": 79.8156, "pop": 39000, "phone": "044-27560203", "mo": "Dr. G. Natarajan, MBBS", "pharm": "Mr. C. Rajendran, B.Pharm"},
            {"id": "phc_mdk_04", "name": "PHC Orathi", "block": "Maduranthakam Block", "district": "Chengalpattu", "lat": 12.4820, "lon": 79.7912, "pop": 26000, "phone": "044-27560204", "mo": "Dr. T. Geetha, MBBS", "pharm": "Mr. E. Saravanan, D.Pharm"},
            {"id": "phc_mdk_05", "name": "PHC Chunampet", "block": "Maduranthakam Block", "district": "Chengalpattu", "lat": 12.3385, "lon": 79.9214, "pop": 29000, "phone": "044-27560205", "mo": "Dr. N. Dinesh, MBBS", "pharm": "Mrs. J. Malathi, D.Pharm"},

            # Tirukalukundram Coastal Block (5 PHCs)
            {"id": "phc_tkd_01", "name": "PHC Anupuram", "block": "Tirukalukundram Block", "district": "Chengalpattu", "lat": 12.5412, "lon": 80.1345, "pop": 36000, "phone": "044-27440301", "mo": "Dr. K. Jayasree, MBBS", "pharm": "Mr. G. Kumar, D.Pharm"},
            {"id": "phc_tkd_02", "name": "PHC Nerumbur", "block": "Tirukalukundram Block", "district": "Chengalpattu", "lat": 12.4891, "lon": 80.0912, "pop": 27500, "phone": "044-27440302", "mo": "Dr. S. Mohan, MBBS", "pharm": "Mrs. V. Radhika, B.Pharm"},
            {"id": "phc_tkd_03", "name": "PHC Sadras / Kalpakkam", "block": "Tirukalukundram Block", "district": "Chengalpattu", "lat": 12.5189, "lon": 80.1610, "pop": 44000, "phone": "044-27440303", "mo": "Dr. R. Senthamil, MD", "pharm": "Mr. D. Baskaran, D.Pharm"},
            {"id": "phc_tkd_04", "name": "PHC Mamallapuram", "block": "Tirukalukundram Block", "district": "Chengalpattu", "lat": 12.6269, "lon": 80.1927, "pop": 48000, "phone": "044-27440304", "mo": "Dr. H. Priya, MBBS", "pharm": "Mrs. M. Anitha, D.Pharm"},
            {"id": "phc_tkd_05", "name": "PHC Mullikolathur", "block": "Tirukalukundram Block", "district": "Chengalpattu", "lat": 12.5630, "lon": 80.0821, "pop": 31500, "phone": "044-27440305", "mo": "Dr. Y. Naveen, MBBS", "pharm": "Mr. S. Balaji, D.Pharm"}
        ]

        for p in phcs_data:
            db.add(PHC(
                id=p["id"],
                name=p["name"],
                block=p["block"],
                district=p["district"],
                latitude=p["lat"],
                longitude=p["lon"],
                population_served=p["pop"],
                phone=p["phone"],
                medical_officer_name=p["mo"],
                pharmacist_name=p["pharm"],
                address=f"{p['name']}, {p['block']}, Chengalpattu"
            ))

        # 2. 30 Essential TNMSC Formulary Medicines
        medicines_data = [
            {"id": "med_01", "code": "TN-0101", "name": "Paracetamol Pediatric Oral Suspension", "generic_name": "Paracetamol", "form": "Syrup", "strength": "125mg / 5ml (60ml)", "category": "Analgesic & Antipyretic", "unit": "bottles", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "monsoon_surge"},
            {"id": "med_02", "code": "TN-0102", "name": "Paracetamol Tablets", "generic_name": "Paracetamol", "form": "Tablet", "strength": "500mg", "category": "Analgesic & Antipyretic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "monsoon_surge"},
            {"id": "med_03", "code": "TN-0201", "name": "Oral Rehydration Salts (ORS)", "generic_name": "ORS WHO Formula", "form": "Sachet", "strength": "20.5g / sachet", "category": "Fluid & Electrolyte", "unit": "sachets", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "summer_gastro"},
            {"id": "med_04", "code": "TN-0301", "name": "Amoxicillin Trihydrate Capsules", "generic_name": "Amoxicillin", "form": "Capsule", "strength": "500mg", "category": "Antibiotic", "unit": "capsules", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "monsoon_surge"},
            {"id": "med_05", "code": "TN-0302", "name": "Amoxicillin Pediatric Dry Syrup", "generic_name": "Amoxicillin", "form": "Suspension", "strength": "125mg / 5ml (60ml)", "category": "Antibiotic", "unit": "bottles", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "monsoon_surge"},
            {"id": "med_06", "code": "TN-0401", "name": "Metformin Hydrochloride Tablets", "generic_name": "Metformin", "form": "Tablet", "strength": "500mg", "category": "NCD / Chronic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 20, "seasonal": "normal"},
            {"id": "med_07", "code": "TN-0402", "name": "Amlodipine Besylate Tablets", "generic_name": "Amlodipine", "form": "Tablet", "strength": "5mg", "category": "NCD / Chronic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 20, "seasonal": "normal"},
            {"id": "med_08", "code": "TN-0501", "name": "Iron & Folic Acid (Large) Tablets", "generic_name": "Ferrous Sulphate + Folic Acid", "form": "Tablet", "strength": "100mg Fe + 0.5mg FA", "category": "Maternal & Child Health", "unit": "tablets", "cold_chain": False, "critical": True, "threshold": 25, "seasonal": "normal"},
            {"id": "med_09", "code": "TN-0502", "name": "Albendazole Chewable Tablets", "generic_name": "Albendazole", "form": "Tablet", "strength": "400mg", "category": "Anthelmintic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_10", "code": "TN-0303", "name": "Azithromycin Tablets", "generic_name": "Azithromycin", "form": "Tablet", "strength": "500mg", "category": "Antibiotic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_11", "code": "TN-0601", "name": "Human Insulin Regular Injection", "generic_name": "Insulin (rDNA)", "form": "Vial", "strength": "40 IU / ml (10ml)", "category": "NCD / Chronic", "unit": "vials", "cold_chain": True, "critical": True, "threshold": 25, "seasonal": "normal"},
            {"id": "med_12", "code": "TN-0701", "name": "Anti-Snake Venom Polyvalent", "generic_name": "Polyvalent ASV", "form": "Vial", "strength": "10ml reconstituted", "category": "Emergency / Antidote", "unit": "vials", "cold_chain": True, "critical": True, "threshold": 30, "seasonal": "monsoon_surge"},
            {"id": "med_13", "code": "TN-0702", "name": "Anti-Rabies Vaccine (ARV)", "generic_name": "Purified Cell Culture Vaccine", "form": "Vial", "strength": "0.5ml IM/ID", "category": "Vaccine", "unit": "vials", "cold_chain": True, "critical": True, "threshold": 30, "seasonal": "normal"},
            {"id": "med_14", "code": "TN-0703", "name": "Tetanus Toxoid (TT) Injection", "generic_name": "Tetanus Vaccine", "form": "Ampoule", "strength": "0.5ml", "category": "Vaccine", "unit": "ampoules", "cold_chain": True, "critical": True, "threshold": 20, "seasonal": "normal"},
            {"id": "med_15", "code": "TN-0304", "name": "Doxycycline Hydrochloride Capsules", "generic_name": "Doxycycline", "form": "Capsule", "strength": "100mg", "category": "Antibiotic", "unit": "capsules", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "monsoon_surge"},
            {"id": "med_16", "code": "TN-0801", "name": "Cetirizine Hydrochloride Tablets", "generic_name": "Cetirizine", "form": "Tablet", "strength": "10mg", "category": "Antihistamine", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "monsoon_surge"},
            {"id": "med_17", "code": "TN-0901", "name": "Ciprofloxacin Eye / Ear Drops", "generic_name": "Ciprofloxacin", "form": "Drops", "strength": "0.3% w/v (5ml)", "category": "Ophthalmic / ENT", "unit": "bottles", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_18", "code": "TN-0305", "name": "Metronidazole Tablets", "generic_name": "Metronidazole", "form": "Tablet", "strength": "400mg", "category": "Antiprotozoal", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "summer_gastro"},
            {"id": "med_19", "code": "TN-0202", "name": "Normal Saline (0.9% NaCl) IV", "generic_name": "Sodium Chloride 0.9%", "form": "Bottle", "strength": "500ml FFS bottle", "category": "Fluid & Electrolyte", "unit": "bottles", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "summer_gastro"},
            {"id": "med_20", "code": "TN-0203", "name": "Dextrose 5% IV Infusion", "generic_name": "Dextrose 5%", "form": "Bottle", "strength": "500ml bottle", "category": "Fluid & Electrolyte", "unit": "bottles", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_21", "code": "TN-0204", "name": "Zinc Sulphate Dispersible Tablets", "generic_name": "Zinc Sulphate", "form": "Tablet", "strength": "20mg", "category": "Maternal & Child Health", "unit": "tablets", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "summer_gastro"},
            {"id": "med_22", "code": "TN-1001", "name": "Pantoprazole Gastro-Resistant Tablets", "generic_name": "Pantoprazole", "form": "Tablet", "strength": "40mg", "category": "Gastrointestinal", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_23", "code": "TN-1101", "name": "Salbutamol Inhaler", "generic_name": "Salbutamol", "form": "Inhaler", "strength": "100mcg (200 doses)", "category": "Respiratory", "unit": "canisters", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "normal"},
            {"id": "med_24", "code": "TN-0306", "name": "Co-trimoxazole Pediatric Suspension", "generic_name": "Trimethoprim + Sulfa", "form": "Suspension", "strength": "40mg+200mg/5ml", "category": "Antibiotic", "unit": "bottles", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_25", "code": "TN-0103", "name": "Ibuprofen Tablets", "generic_name": "Ibuprofen", "form": "Tablet", "strength": "400mg", "category": "Analgesic & Antipyretic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_26", "code": "TN-0503", "name": "Vitamin A Oral Solution", "generic_name": "Retinol Palmitate", "form": "Solution", "strength": "100,000 IU/ml", "category": "Maternal & Child Health", "unit": "bottles", "cold_chain": False, "critical": True, "threshold": 25, "seasonal": "normal"},
            {"id": "med_27", "code": "TN-0403", "name": "Enalapril Maleate Tablets", "generic_name": "Enalapril", "form": "Tablet", "strength": "5mg", "category": "NCD / Chronic", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 20, "seasonal": "normal"},
            {"id": "med_28", "code": "TN-1201", "name": "Povidone Iodine Antiseptic Ointment", "generic_name": "Povidone Iodine", "form": "Ointment", "strength": "5% w/w (15g)", "category": "Antiseptic & Wound Care", "unit": "tubes", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"},
            {"id": "med_29", "code": "TN-0104", "name": "Diclofenac Sodium Injection", "generic_name": "Diclofenac", "form": "Ampoule", "strength": "75mg / 3ml", "category": "Emergency / Analgesic", "unit": "ampoules", "cold_chain": False, "critical": True, "threshold": 20, "seasonal": "normal"},
            {"id": "med_30", "code": "TN-0504", "name": "Vitamin B-Complex Tablets NFI", "generic_name": "B-Complex", "form": "Tablet", "strength": "Standard NFI", "category": "Nutritional", "unit": "tablets", "cold_chain": False, "critical": False, "threshold": 15, "seasonal": "normal"}
        ]

        for m in medicines_data:
            db.add(Medicine(
                id=m["id"],
                code=m["code"],
                name=m["name"],
                generic_name=m["generic_name"],
                form=m["form"],
                strength=m["strength"],
                category=m["category"],
                unit=m["unit"],
                is_cold_chain=m["cold_chain"],
                is_critical=m["critical"],
                default_threshold_days=m["threshold"],
                emergency_buffer_days=30,
                seasonal_sensitivity=m["seasonal"]
            ))

        # 3. User accounts with bcrypt hashed passwords
        user_hash = get_password_hash("password123")
        admin_hash = get_password_hash("admin123")

        users_data = [
            {"id": "usr_pharm_01", "email": "pharmacist1@tnhealth.gov.in", "name": "R. Murugan (Pharmacist)", "role": "pharmacist", "phc": "phc_cpt_01", "block": "Chengalpattu Block", "pass": user_hash},
            {"id": "usr_mo_01", "email": "doctor1@tnhealth.gov.in", "name": "Dr. S. Karthi (Medical Officer)", "role": "medical_officer", "phc": "phc_cpt_01", "block": "Chengalpattu Block", "pass": user_hash},
            {"id": "usr_pharm_02", "email": "pharmacist2@tnhealth.gov.in", "name": "K. Banumathi (Pharmacist)", "role": "pharmacist", "phc": "phc_cpt_02", "block": "Chengalpattu Block", "pass": user_hash},
            {"id": "usr_mo_02", "email": "doctor2@tnhealth.gov.in", "name": "Dr. M. Deepa (Medical Officer)", "role": "medical_officer", "phc": "phc_cpt_02", "block": "Chengalpattu Block", "pass": user_hash},
            {"id": "usr_bmo_01", "email": "bmo1@tnhealth.gov.in", "name": "Dr. T. Rajan (Block Medical Officer)", "role": "block_officer", "phc": None, "block": "Chengalpattu Block", "pass": user_hash},
            {"id": "usr_admin_01", "email": "admin@tnhealth.gov.in", "name": "Dr. P. Sundaram (DDHS / District Admin)", "role": "district_admin", "phc": None, "block": None, "pass": admin_hash}
        ]

        for u in users_data:
            db.add(User(
                id=u["id"],
                email=u["email"],
                name=u["name"],
                hashed_password=u["pass"],
                role=u["role"],
                phc_id=u["phc"],
                block=u["block"]
            ))

        db.commit()

        # 4. Batches and 90-day history with the orchestrated test scenario:
        # PHC Alapakkam (phc_cpt_01): Paracetamol syrup (med_01) is 0 (stock-out)!
        # PHC Melamaiyur (phc_cpt_02, 2.9 km away): Paracetamol syrup has 380 bottles surplus!
        print("Seeding stock history and batches...")
        today = date.today()
        batch_counter = 1
        entry_counter = 1

        for p in phcs_data:
            for m in medicines_data:
                target_stock = 120
                daily_usage = 8

                if p["id"] == "phc_cpt_01":
                    if m["id"] == "med_01":
                        target_stock = 0  # Stockout scenario
                        daily_usage = 12
                    elif m["id"] == "med_05":
                        target_stock = 18  # Critical shortage (~3.6 days)
                        daily_usage = 5
                elif p["id"] == "phc_cpt_02":
                    if m["id"] == "med_01":
                        target_stock = 380  # Surplus nearby!
                        daily_usage = 5
                    elif m["id"] == "med_05":
                        target_stock = 210  # Surplus nearby!
                        daily_usage = 4
                else:
                    hash_val = sum(ord(c) for c in (p["id"] + m["id"]))
                    target_stock = 40 + (hash_val % 140)

                # Batch
                batch_id = f"b_{batch_counter}"
                batch_no = f"TN26-{1000 + batch_counter}"
                exp_date = today + timedelta(days=75 if (p["id"] == "phc_cpt_02" and m["id"] == "med_01") else 540)
                batch_counter += 1

                db.add(Batch(
                    id=batch_id,
                    phc_id=p["id"],
                    medicine_id=m["id"],
                    batch_number=batch_no,
                    expiry_date=exp_date,
                    quantity=target_stock,
                    supplier_source="TNMSC Central Medical Store"
                ))

                # 90-day history entries
                running = target_stock + (daily_usage * 60)
                for day_offset in range(90, -1, -1):
                    e_date = today - timedelta(days=day_offset)
                    issued = max(0, int(daily_usage + (math.sin(day_offset) * 2.5)))
                    
                    # Anomaly spike on day 15 at Alapakkam for Paracetamol
                    if p["id"] == "phc_cpt_01" and m["id"] == "med_01" and day_offset == 15:
                        issued = 45

                    received = 0
                    if day_offset in [60, 30] and target_stock > 0:
                        received = daily_usage * 30

                    opening = running
                    closing = max(0, opening + received - issued)
                    if day_offset == 0:
                        closing = target_stock
                    running = closing

                    db.add(StockEntry(
                        id=f"se_{entry_counter}",
                        client_entry_id=f"client_se_{p['id']}_{m['id']}_{e_date.isoformat()}",
                        phc_id=p["id"],
                        medicine_id=m["id"],
                        date=e_date,
                        opening=opening,
                        received=received,
                        issued=issued,
                        closing=closing,
                        batch_no=batch_no,
                        expiry_date=exp_date,
                        entered_by="Mr. R. Murugan",
                        remarks="Routine daily OPD dispensing"
                    ))
                    entry_counter += 1

        db.commit()

        # 5. Populate CurrentStock view table
        print("Populating current_stock summary table...")
        for p in phcs_data:
            for m in medicines_data:
                metrics = calculate_days_of_stock(db, p["id"], m["id"])
                db.add(CurrentStock(
                    id=f"cs_{p['id']}_{m['id']}",
                    phc_id=p["id"],
                    medicine_id=m["id"],
                    quantity=metrics["quantity"],
                    avg_daily_use_7d=metrics["avg_daily_use_7d"],
                    avg_daily_use_30d=metrics["avg_daily_use_30d"],
                    days_left=metrics["days_left"],
                    status=metrics["status"]
                ))
        db.commit()

        # 6. Seed Alerts
        db.add(Alert(
            id="alt_01",
            phc_id="phc_cpt_01",
            medicine_id="med_01",
            type="stockout",
            severity="critical",
            message="Zero Stock Alert: Paracetamol Pediatric Suspension at PHC Alapakkam. Stock depleted.",
            status="new"
        ))
        db.add(Alert(
            id="alt_02",
            phc_id="phc_cpt_01",
            medicine_id="med_05",
            type="low_stock",
            severity="high",
            message="Critical Shortage: Amoxicillin Pediatric Dry Syrup at PHC Alapakkam (<4 days left).",
            status="new"
        ))
        db.add(Alert(
            id="alt_03",
            phc_id="phc_cpt_02",
            medicine_id="med_01",
            type="near_expiry",
            severity="medium",
            message="Near-Expiry Notice: 380 bottles of Paracetamol Syrup expiring within 75 days.",
            status="new"
        ))

        # 7. Seed Transfers
        t1 = TransferRequest(
            id="tr_01",
            request_number="TR-2026-CPT-0042",
            from_phc_id="phc_cpt_02",
            to_phc_id="phc_cpt_01",
            status="approved",
            urgency="critical",
            reason="Pediatric viral fever cluster at Alapakkam; urgent stock transfer.",
            cold_chain_confirmed=False,
            distance_km=2.9,
            created_by="Mr. R. Murugan (Pharmacist)",
            approved_by="Dr. M. Deepa (MO)"
        )
        db.add(t1)
        db.flush()

        db.add(TransferItem(
            id="tri_01",
            transfer_id="tr_01",
            medicine_id="med_01",
            batch_no="TN26-1002",
            requested_qty=150,
            approved_qty=150
        ))
        db.add(TransferItem(
            id="tri_02",
            transfer_id="tr_01",
            medicine_id="med_05",
            batch_no="TN26-1003",
            requested_qty=60,
            approved_qty=60
        ))

        db.commit()
        print("[SUCCESS] MediSync PHC FastAPI Database seeded successfully!")

        from seed_sources import seed_stock_sources
        seed_stock_sources(db)

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
