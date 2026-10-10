"""
Seed script for Multi-Source Stock Finder (60-100 sources across 3 medical blocks).
Populates stock_sources, source_stock, and source_users.
"""

import sys
import os
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app.models.stock_source import StockSource, SourceStock, SourceUser
from app.models.medicine import Medicine
from app.models.phc import PHC
from app.models.user import User
from app.auth import get_password_hash


def build_sources_dataset():
    sources = []

    # 1. 15 Government PHCs (Free)
    phc_list = [
        ("phc_cpt_01", "PHC Alapakkam", "Chengalpattu Block", 12.6841, 79.9830, "044-27420101"),
        ("phc_cpt_02", "PHC Melamaiyur", "Chengalpattu Block", 12.7052, 79.9678, "044-27420102"),
        ("phc_cpt_03", "PHC Vallam", "Chengalpattu Block", 12.7230, 80.0120, "044-27420103"),
        ("phc_cpt_04", "PHC Singaperumal Koil", "Chengalpattu Block", 12.7635, 80.0034, "044-27420104"),
        ("phc_cpt_05", "PHC Maraimalai Nagar", "Chengalpattu Block", 12.7981, 80.0247, "044-27420105"),
        ("phc_mdk_01", "PHC Karunguzhi", "Maduranthakam Block", 12.5180, 79.9021, "044-27560201"),
        ("phc_mdk_02", "PHC Maduranthakam", "Maduranthakam Block", 12.5098, 79.8841, "044-27560202"),
        ("phc_mdk_03", "PHC Padalam", "Maduranthakam Block", 12.5743, 79.9321, "044-27560203"),
        ("phc_mdk_04", "PHC Pavunjur", "Maduranthakam Block", 12.4412, 79.9543, "044-27560204"),
        ("phc_mdk_05", "PHC Acharapakkam", "Maduranthakam Block", 12.4211, 79.8214, "044-27560205"),
        ("phc_tkr_01", "PHC Tirukalukundram", "Tirukalukundram Block", 12.6124, 80.0571, "044-27440301"),
        ("phc_tkr_02", "PHC Sadras", "Tirukalukundram Block", 12.5214, 80.1623, "044-27440302"),
        ("phc_tkr_03", "PHC Anupuram", "Tirukalukundram Block", 12.5532, 80.1342, "044-27440303"),
        ("phc_tkr_04", "PHC Mamallapuram", "Tirukalukundram Block", 12.6269, 80.1928, "044-27440304"),
        ("phc_tkr_05", "PHC Kokilamedu", "Tirukalukundram Block", 12.6543, 80.1834, "044-27440305"),
    ]
    for pid, name, blk, lat, lon, phone in phc_list:
        sources.append({
            "id": pid,
            "source_type": "phc",
            "name": name,
            "address": f"{name}, Near Bus Route, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
            "opening_hours": "08:00 - 17:00",
            "is_24x7": False,
            "ownership": "government",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": None,
        })

    # 2. 20 Government Sub-centres / Health & Wellness Centres (HWCs, Free)
    hwc_defs = [
        ("hwc_01", "Alapakkam West HWC", "phc_cpt_01", "Chengalpattu Block", 12.6780, 79.9790),
        ("hwc_02", "Hanumanthaputheri HWC", "phc_cpt_01", "Chengalpattu Block", 12.6910, 79.9860),
        ("hwc_03", "Pazhaveli HWC", "phc_cpt_01", "Chengalpattu Block", 12.6690, 79.9650),
        ("hwc_04", "Melamaiyur South HWC", "phc_cpt_02", "Chengalpattu Block", 12.7090, 79.9620),
        ("hwc_05", "Keelavalampettai HWC", "phc_cpt_02", "Chengalpattu Block", 12.7150, 79.9730),
        ("hwc_06", "Vallam Colony HWC", "phc_cpt_03", "Chengalpattu Block", 12.7290, 80.0180),
        ("hwc_07", "Thirumani HWC", "phc_cpt_03", "Chengalpattu Block", 12.7350, 80.0050),
        ("hwc_08", "Singaperumal East HWC", "phc_cpt_04", "Chengalpattu Block", 12.7680, 80.0120),
        ("hwc_09", "Paranur Rail Nagar HWC", "phc_cpt_04", "Chengalpattu Block", 12.7530, 80.0010),
        ("hwc_10", "Maraimalai West HWC", "phc_cpt_05", "Chengalpattu Block", 12.8020, 80.0210),
        ("hwc_11", "Karunguzhi Lakeview HWC", "phc_mdk_01", "Maduranthakam Block", 12.5240, 79.9080),
        ("hwc_12", "Maduranthakam South HWC", "phc_mdk_02", "Maduranthakam Block", 12.5020, 79.8800),
        ("hwc_13", "Mambakkam HWC", "phc_mdk_02", "Maduranthakam Block", 12.5150, 79.8730),
        ("hwc_14", "Padalam Cross HWC", "phc_mdk_03", "Maduranthakam Block", 12.5790, 79.9390),
        ("hwc_15", "Pavunjur Market HWC", "phc_mdk_04", "Maduranthakam Block", 12.4470, 79.9610),
        ("hwc_16", "Acharapakkam Hillview HWC", "phc_mdk_05", "Maduranthakam Block", 12.4270, 79.8270),
        ("hwc_17", "Erumaiyur HWC", "phc_tkr_01", "Tirukalukundram Block", 12.6180, 80.0630),
        ("hwc_18", "Sadras Port HWC", "phc_tkr_02", "Tirukalukundram Block", 12.5260, 80.1680),
        ("hwc_19", "Anupuram Colony HWC", "phc_tkr_03", "Tirukalukundram Block", 12.5580, 80.1410),
        ("hwc_20", "Poonjeri HWC", "phc_tkr_04", "Tirukalukundram Block", 12.6210, 80.1870),
    ]
    for hid, hname, p_parent, blk, lat, lon in hwc_defs:
        sources.append({
            "id": hid,
            "source_type": "sub_centre",
            "name": hname,
            "address": f"{hname}, Grama Niladhari Street, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": "044-27419900",
            "opening_hours": "09:00 - 16:00",
            "is_24x7": False,
            "ownership": "government",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": p_parent,
        })

    # 3. 3 Community Health Centres (CHCs, Free, 24x7)
    chc_list = [
        ("src_chc_01", "CHC Tirukalukundram", "Tirukalukundram Block", 12.6102, 80.0541, "044-27440100"),
        ("src_chc_02", "CHC Maduranthakam", "Maduranthakam Block", 12.5115, 79.8824, "044-27560100"),
        ("src_chc_03", "CHC Acharapakkam", "Maduranthakam Block", 12.4180, 79.8152, "044-27560150"),
    ]
    for cid, cname, blk, lat, lon, phone in chc_list:
        sources.append({
            "id": cid,
            "source_type": "chc_hospital",
            "name": cname,
            "address": f"{cname}, Taluk Road, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
            "opening_hours": "24 Hours",
            "is_24x7": True,
            "ownership": "government",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": None,
        })

    # 4. 1 District Hospital (Free, 24x7)
    sources.append({
        "id": "src_hosp_01",
        "source_type": "chc_hospital",
        "name": "Chengalpattu Govt Medical College & Hospital (CGMCH)",
        "address": "G.S.T Road, Vedachalam Nagar, Chengalpattu - 603001",
        "block": "Chengalpattu Block",
        "district": "Chengalpattu",
        "latitude": 12.6895,
        "longitude": 79.9822,
        "phone": "044-27426566",
        "opening_hours": "24 Hours",
        "is_24x7": True,
        "ownership": "government",
        "is_verified": True,
        "is_active": True,
        "visibility": "public",
        "parent_source_id": None,
    })

    # 5. 1 District Warehouse (TNMSC, Staff Only, Free supply)
    sources.append({
        "id": "src_wh_01",
        "source_type": "warehouse",
        "name": "TNMSC District Medical Drug Warehouse",
        "address": "SIDCO Industrial Estate, Chengalpattu - 603002",
        "block": "Chengalpattu Block",
        "district": "Chengalpattu",
        "latitude": 12.6950,
        "longitude": 79.9710,
        "phone": "044-27429111",
        "opening_hours": "09:00 - 18:00",
        "is_24x7": False,
        "ownership": "government",
        "is_verified": True,
        "is_active": True,
        "visibility": "staff_only",
        "parent_source_id": None,
    })

    # 6. 5 Jan Aushadhi & Amma Marundhagam Generic Stores (Cooperative / Low-Cost)
    coop_list = [
        ("src_ja_01", "PM Jan Aushadhi Kendra - Chengalpattu Bus Stand", "Chengalpattu Block", 12.6820, 79.9840, "044-27431101"),
        ("src_ja_02", "PM Jan Aushadhi Kendra - GST Road", "Chengalpattu Block", 12.6910, 79.9810, "044-27431102"),
        ("src_ja_03", "Amma Marundhagam Cooperative - Vedachalam Nagar", "Chengalpattu Block", 12.6880, 79.9790, "044-27431103"),
        ("src_ja_04", "PM Jan Aushadhi Kendra - Maduranthakam Bazaar", "Maduranthakam Block", 12.5090, 79.8850, "044-27561104"),
        ("src_ja_05", "Amma Marundhagam - Tirukalukundram Car Street", "Tirukalukundram Block", 12.6120, 80.0560, "044-27441105"),
    ]
    for jid, jname, blk, lat, lon, phone in coop_list:
        sources.append({
            "id": jid,
            "source_type": "jan_aushadhi_coop",
            "name": jname,
            "address": f"{jname}, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
            "opening_hours": "08:00 - 21:00",
            "is_24x7": False,
            "ownership": "cooperative",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": None,
        })

    # 7. 30 Private Pharmacies (Paid Retail)
    pvt_pharm_defs = [
        ("src_pharm_01", "Apollo Pharmacy - Alapakkam Road", "Chengalpattu Block", 12.6855, 79.9805, "044-27428801"),
        ("src_pharm_02", "MedPlus Pharmacy - Chengalpattu Bazaar", "Chengalpattu Block", 12.6830, 79.9860, "044-27428802"),
        ("src_pharm_03", "Netmeds Pharmacy - Singaperumal Koil", "Chengalpattu Block", 12.7620, 80.0050, "044-27428803"),
        ("src_pharm_04", "Apollo Pharmacy - Maraimalai Nagar", "Chengalpattu Block", 12.7960, 80.0260, "044-27428804"),
        ("src_pharm_05", "Sanjeevi Medicals - GST Road", "Chengalpattu Block", 12.6870, 79.9815, "044-27428805"),
        ("src_pharm_06", "Sri Balaji Medicals - Vedachalam Nagar", "Chengalpattu Block", 12.6900, 79.9770, "044-27428806"),
        ("src_pharm_07", "Thirumalai Medicals - Melamaiyur Junction", "Chengalpattu Block", 12.7030, 79.9690, "044-27428807"),
        ("src_pharm_08", "Apollo Pharmacy - Guduvancheri High Road", "Chengalpattu Block", 12.8350, 80.0620, "044-27428808"),
        ("src_pharm_09", "MedPlus - Paranur Station Link Road", "Chengalpattu Block", 12.7560, 80.0030, "044-27428809"),
        ("src_pharm_10", "Sri Krishna Medicals - Vallam Post", "Chengalpattu Block", 12.7210, 80.0100, "044-27428810"),
        ("src_pharm_11", "Maduranthakam Medicals - Railway Gate", "Maduranthakam Block", 12.5080, 79.8830, "044-27568811"),
        ("src_pharm_12", "Apollo Pharmacy - Maduranthakam GST Road", "Maduranthakam Block", 12.5120, 79.8870, "044-27568812"),
        ("src_pharm_13", "Meenakshi Medicals - Karunguzhi Bus Stop", "Maduranthakam Block", 12.5200, 79.9040, "044-27568813"),
        ("src_pharm_14", "MedPlus - Padalam Junction", "Maduranthakam Block", 12.5760, 79.9340, "044-27568814"),
        ("src_pharm_15", "Vignesh Medicals - Pavunjur Cross Road", "Maduranthakam Block", 12.4430, 79.9560, "044-27568815"),
        ("src_pharm_16", "Sri Murugan Medicals - Acharapakkam Town", "Maduranthakam Block", 12.4190, 79.8190, "044-27568816"),
        ("src_pharm_17", "Ganesh Medical Store - Melmaruvathur", "Maduranthakam Block", 12.4340, 79.8310, "044-27568817"),
        ("src_pharm_18", "Rajan Medicals - Vedanthangal Road", "Maduranthakam Block", 12.5310, 79.8650, "044-27568818"),
        ("src_pharm_19", "Apollo Pharmacy - Tirukalukundram North", "Tirukalukundram Block", 12.6140, 80.0580, "044-27448819"),
        ("src_pharm_20", "MedPlus - Tirukalukundram Hill Temple Road", "Tirukalukundram Block", 12.6110, 80.0530, "044-27448820"),
        ("src_pharm_21", "Sri Kumaran Medicals - Sadras Fort Road", "Tirukalukundram Block", 12.5230, 80.1640, "044-27448821"),
        ("src_pharm_22", "Anupuram DAE Township Medicals", "Tirukalukundram Block", 12.5550, 80.1360, "044-27448822"),
        ("src_pharm_23", "Apollo Pharmacy - Mamallapuram ECR Bypass", "Tirukalukundram Block", 12.6280, 80.1940, "044-27448823"),
        ("src_pharm_24", "Coastal Health Medicals - Mamallapuram Othavadai", "Tirukalukundram Block", 12.6250, 80.1910, "044-27448824"),
        ("src_pharm_25", "Mahabalipuram Seafront Pharmacy", "Tirukalukundram Block", 12.6290, 80.1970, "044-27448825"),
        ("src_pharm_26", "Kokilamedu Fisheries Colony Medicals", "Tirukalukundram Block", 12.6560, 80.1850, "044-27448826"),
        ("src_pharm_27", "Kalpakkam DAE Gate Pharmacy", "Tirukalukundram Block", 12.5180, 80.1710, "044-27448827"),
        ("src_pharm_28", "Nethaji Medicals - Nerumbur", "Tirukalukundram Block", 12.5410, 80.0980, "044-27448828"),
        ("src_pharm_29", "Sri Ramanujar Medicals - Salavakkam Road", "Chengalpattu Block", 12.6990, 79.9450, "044-27428829"),
        ("src_pharm_30", "Cauvery Medicals - Chengalpattu Railway Border", "Chengalpattu Block", 12.6860, 79.9870, "044-27428830"),
    ]
    for pid, pname, blk, lat, lon, phone in pvt_pharm_defs:
        sources.append({
            "id": pid,
            "source_type": "private_pharmacy",
            "name": pname,
            "address": f"{pname}, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
            "opening_hours": "08:00 - 22:30",
            "is_24x7": False,
            "ownership": "private",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": None,
        })

    # 8. 4 Private Hospital / Clinic Pharmacies (24x7, Paid)
    pvt_hosp_defs = [
        ("src_pvt_hosp_01", "SRM Global Hospital 24x7 Pharmacy", "Chengalpattu Block", 12.8230, 80.0440, "044-47432345"),
        ("src_pvt_hosp_02", "Chettinad Health City Super Speciality Pharmacy", "Tirukalukundram Block", 12.7910, 80.2190, "044-47411000"),
        ("src_pvt_hosp_03", "Apollo Spectra Hospital Pharmacy", "Chengalpattu Block", 12.6860, 79.9790, "044-27429999"),
        ("src_pvt_hosp_04", "Karpaga Vinayaga Medical Institute Pharmacy", "Maduranthakam Block", 12.5640, 79.9230, "044-27565555"),
    ]
    for phid, phname, blk, lat, lon, phone in pvt_hosp_defs:
        sources.append({
            "id": phid,
            "source_type": "private_hospital",
            "name": phname,
            "address": f"{phname}, In-patient Block, {blk}",
            "block": blk,
            "district": "Chengalpattu",
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
            "opening_hours": "24 Hours",
            "is_24x7": True,
            "ownership": "private",
            "is_verified": True,
            "is_active": True,
            "visibility": "public",
            "parent_source_id": None,
        })

    return sources


def seed_stock_sources(db):
    print("[INFO] Seeding multi-source stock sources (79 facilities across 3 blocks)...")
    
    # Clean previous records
    db.query(SourceUser).delete()
    db.query(SourceStock).delete()
    db.query(StockSource).delete()
    db.commit()

    sources_data = build_sources_dataset()
    for s in sources_data:
        db.add(StockSource(**s))
    db.commit()
    print(f" -> Inserted {len(sources_data)} stock sources successfully.")

    # Fetch medicines
    medicines = db.query(Medicine).all()
    med_ids = [m.id for m in medicines]
    now = datetime.now(timezone.utc)

    stock_items_to_add = []

    # Retail price book for generic vs private
    price_book = {
        "med_01": (18.0, 45.0),   # Paracetamol syrup
        "med_02": (8.0, 20.0),    # Paracetamol tab
        "med_03": (10.0, 24.0),   # ORS
        "med_04": (25.0, 75.0),   # Amoxicillin 500mg
        "med_05": (22.0, 68.0),   # Amoxicillin dry syrup
        "med_06": (12.0, 35.0),   # Metformin 500mg
        "med_07": (10.0, 32.0),   # Amlodipine 5mg
        "med_08": (15.0, 45.0),   # Iron & Folic
        "med_09": (12.0, 30.0),   # Albendazole 400mg
        "med_10": (35.0, 110.0),  # Azithromycin 500mg
        "med_11": (95.0, 210.0),  # Insulin
        "med_12": (450.0, 950.0), # ASV
        "med_13": (280.0, 420.0), # ARV
        "med_14": (15.0, 30.0),   # TT
        "med_15": (18.0, 52.0),   # Doxycycline 100mg
        "med_16": (8.0, 25.0),    # Cetirizine 10mg
        "med_17": (15.0, 42.0),   # Ciprofloxacin drops
        "med_18": (12.0, 36.0),   # Metronidazole 400mg
        "med_19": (20.0, 48.0),   # Normal Saline IV
        "med_20": (22.0, 50.0),   # Dextrose 5%
        "med_21": (14.0, 38.0),   # Zinc Sulphate
        "med_22": (18.0, 65.0),   # Pantoprazole 40mg
        "med_23": (75.0, 165.0),  # Salbutamol Inhaler
        "med_24": (20.0, 55.0),   # Co-trimoxazole syrup
        "med_25": (12.0, 34.0),   # Ibuprofen 400mg
        "med_26": (15.0, 40.0),   # Vitamin A
        "med_27": (14.0, 42.0),   # Enalapril 5mg
        "med_28": (16.0, 48.0),   # Povidone Iodine
        "med_29": (18.0, 50.0),   # Diclofenac inj
        "med_30": (10.0, 28.0),   # B-Complex
    }

    random.seed(42)

    for s in sources_data:
        src_id = s["id"]
        ownership = s["ownership"]

        # Number of stocked medicines depending on facility size
        if s["source_type"] in ["warehouse", "chc_hospital"]:
            stocked_meds = med_ids  # All 30
        elif s["source_type"] == "phc":
            stocked_meds = med_ids[:25]
        elif s["source_type"] == "sub_centre":
            stocked_meds = med_ids[:15]
        elif s["source_type"] == "jan_aushadhi_coop":
            stocked_meds = med_ids[:22]
        else:
            stocked_meds = random.sample(med_ids, k=20)

        for m_id in stocked_meds:
            # Baseline pricing
            if ownership == "government":
                price = 0.0
            elif ownership == "cooperative":
                price = price_book.get(m_id, (15.0, 40.0))[0]
            else:
                price = price_book.get(m_id, (15.0, 40.0))[1]

            # Quantities
            if s["source_type"] == "warehouse":
                qty = random.randint(1000, 5000)
            elif s["source_type"] == "chc_hospital":
                qty = random.randint(150, 800)
            elif s["source_type"] == "phc":
                qty = random.randint(40, 400)
            elif s["source_type"] == "sub_centre":
                qty = random.randint(10, 80)
            else:
                qty = random.randint(15, 120)

            # Randomize freshness
            # 80% fresh (<24h), 12% stale (24-72h), 8% severely stale (>72h)
            rand_fresh = random.random()
            if rand_fresh < 0.80:
                age_hours = random.uniform(0.5, 18.0)
            elif rand_fresh < 0.92:
                age_hours = random.uniform(25.0, 68.0)
            else:
                age_hours = random.uniform(75.0, 160.0)

            last_up = now - timedelta(hours=age_hours)

            # Expiry date: 90% normal (1-2 years), 10% near-expiry (15-28 days)
            if random.random() < 0.10:
                exp_dt = (now + timedelta(days=random.randint(15, 28))).strftime("%Y-%m-%d")
            else:
                exp_dt = (now + timedelta(days=random.randint(120, 600))).strftime("%Y-%m-%d")

            stock_items_to_add.append(SourceStock(
                id=f"stk_{src_id}_{m_id}",
                source_id=src_id,
                medicine_id=m_id,
                quantity=qty,
                price_per_unit=price,
                batch_no=f"BAT-26-{random.randint(100, 999)}",
                expiry_date=exp_dt,
                last_updated=last_up,
                updated_by="System Seeder",
                data_origin="system",
            ))

    db.bulk_save_objects(stock_items_to_add)
    db.commit()

    # =========================================================================
    # ORCHESTRATED DEMO SCENARIO SETUP
    # Target Medicine: med_01 (Paracetamol Pediatric Suspension)
    # Search origin: PHC Alapakkam (phc_cpt_01)
    # 1. PHC Alapakkam: OUT OF STOCK (qty=0)
    # 2. PHC Melamaiyur (phc_cpt_02): SURPLUS (qty=380, Free Govt, 2.9 km away)
    # 3. Jan Aushadhi Kendra Chengalpattu (src_ja_01): IN STOCK (qty=120, ₹18.00, 5 km away)
    # 4. Apollo Pharmacy Alapakkam Road (src_pharm_01): IN STOCK (qty=65, ₹45.00, 3 km away)
    # =========================================================================
    
    # 1. Alapakkam -> 0
    alapakkam_stock = db.query(SourceStock).filter(SourceStock.source_id == "phc_cpt_01", SourceStock.medicine_id == "med_01").first()
    if alapakkam_stock:
        alapakkam_stock.quantity = 0
        alapakkam_stock.price_per_unit = 0.0
        alapakkam_stock.last_updated = now - timedelta(hours=1.5)
    else:
        db.add(SourceStock(
            id="stk_phc_cpt_01_med_01",
            source_id="phc_cpt_01",
            medicine_id="med_01",
            quantity=0,
            price_per_unit=0.0,
            batch_no="TN26-1001",
            expiry_date="2027-06-30",
            last_updated=now - timedelta(hours=1.5),
            updated_by="Mr. R. Murugan",
            data_origin="manual",
        ))

    # 2. Melamaiyur -> 380 (Free)
    melamaiyur_stock = db.query(SourceStock).filter(SourceStock.source_id == "phc_cpt_02", SourceStock.medicine_id == "med_01").first()
    if melamaiyur_stock:
        melamaiyur_stock.quantity = 380
        melamaiyur_stock.price_per_unit = 0.0
        melamaiyur_stock.batch_no = "TN26-1002"
        melamaiyur_stock.last_updated = now - timedelta(hours=1.0)
    else:
        db.add(SourceStock(
            id="stk_phc_cpt_02_med_01",
            source_id="phc_cpt_02",
            medicine_id="med_01",
            quantity=380,
            price_per_unit=0.0,
            batch_no="TN26-1002",
            expiry_date="2027-08-31",
            last_updated=now - timedelta(hours=1.0),
            updated_by="Mrs. K. Banumathi",
            data_origin="manual",
        ))

    # 3. Jan Aushadhi -> 120 (₹18.00)
    ja_stock = db.query(SourceStock).filter(SourceStock.source_id == "src_ja_01", SourceStock.medicine_id == "med_01").first()
    if ja_stock:
        ja_stock.quantity = 120
        ja_stock.price_per_unit = 18.0
        ja_stock.batch_no = "JA-26-881"
        ja_stock.last_updated = now - timedelta(hours=2.0)
    else:
        db.add(SourceStock(
            id="stk_src_ja_01_med_01",
            source_id="src_ja_01",
            medicine_id="med_01",
            quantity=120,
            price_per_unit=18.0,
            batch_no="JA-26-881",
            expiry_date="2027-09-30",
            last_updated=now - timedelta(hours=2.0),
            updated_by="Jan Aushadhi In-Charge",
            data_origin="manual",
        ))

    # 4. Apollo Pharmacy -> 65 (₹45.00)
    apollo_stock = db.query(SourceStock).filter(SourceStock.source_id == "src_pharm_01", SourceStock.medicine_id == "med_01").first()
    if apollo_stock:
        apollo_stock.quantity = 65
        apollo_stock.price_per_unit = 45.0
        apollo_stock.batch_no = "APL-5421"
        apollo_stock.last_updated = now - timedelta(hours=3.5)
    else:
        db.add(SourceStock(
            id="stk_src_pharm_01_med_01",
            source_id="src_pharm_01",
            medicine_id="med_01",
            quantity=65,
            price_per_unit=45.0,
            batch_no="APL-5421",
            expiry_date="2027-04-30",
            last_updated=now - timedelta(hours=3.5),
            updated_by="Pharmacist Kumar",
            data_origin="manual",
        ))

    # Seed source managers
    existing_mgr_apollo = db.query(User).filter(User.email == "manager_apollo@medisync.tn.gov.in").first()
    if not existing_mgr_apollo:
        mgr1 = User(
            id="usr_mgr_apollo",
            name="Mr. S. Ramesh (Apollo Manager)",
            email="manager_apollo@medisync.tn.gov.in",
            hashed_password=get_password_hash("password123"),
            role="source_manager",
            block="Chengalpattu Block",
        )
        db.add(mgr1)
        db.flush()
        db.add(SourceUser(
            id="su_01",
            user_id="usr_mgr_apollo",
            source_id="src_pharm_01",
        ))

    existing_mgr_ja = db.query(User).filter(User.email == "manager_janaushadhi@medisync.tn.gov.in").first()
    if not existing_mgr_ja:
        mgr2 = User(
            id="usr_mgr_ja",
            name="Mrs. N. Lakshmi (Jan Aushadhi Manager)",
            email="manager_janaushadhi@medisync.tn.gov.in",
            hashed_password=get_password_hash("password123"),
            role="source_manager",
            block="Chengalpattu Block",
        )
        db.add(mgr2)
        db.flush()
        db.add(SourceUser(
            id="su_02",
            user_id="usr_mgr_ja",
            source_id="src_ja_01",
        ))

    db.commit()
    print("[SUCCESS] Multi-source stock finder dataset and scenario seeded successfully!")


if __name__ == "__main__":
    session = SessionLocal()
    try:
        seed_stock_sources(session)
    finally:
        session.close()
