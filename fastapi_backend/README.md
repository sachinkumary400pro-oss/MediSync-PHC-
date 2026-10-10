# MediSync PHC — Backend REST API

> **Medicine Stock Monitoring, Velocity Forecasting & Geospatial Redistribution for Primary Health Centres (PHCs) in Tamil Nadu, India.**

Built with **FastAPI**, **SQLAlchemy ORM**, **Alembic**, **Pydantic v2**, and **ReportLab**. Designed for high reliability, offline resilience, and human-in-the-loop medical governance.

---

## 1. Problem Context & Solution Overview

In Tamil Nadu's public healthcare infrastructure, Primary Health Centres (PHCs) typically receive bulk drug consignments from the Tamil Nadu Medical Services Corporation (TNMSC) only once a month. When local disease surges occur (e.g., dengue or viral fever clusters during the Northeast Monsoon), stock depletes rapidly and silently, turning away patients while nearby centres only 3–15 km away hold surplus inventory.

**MediSync PHC** solves this by:
1. **Real-time Velocity Tracking**: Dynamically computes daily burn rates using conservative moving averages ($\max(\text{avg}_{7\text{d}}, \text{avg}_{30\text{d}})$) to forecast stock-out dates weeks before they happen.
2. **Geospatial Surplus Sharing**: Computes Haversine distances to identify neighboring PHCs with genuine surplus (>40 days buffer) and consolidates multi-medicine transfers to minimize delivery trips.
3. **Atomic Transfer Lifecycle**: Ensures atomic inventory balance deduction at donor PHCs and addition at receiver PHCs with cryptographic audit logging and ReportLab PDF delivery slips.
4. **Epidemiological & Outbreak AI**: Applies Tamil Nadu monsoon seasonal multipliers and Z-score consumption anomaly detection to flag fever outbreaks in real time.
5. **Strict RBAC & Privacy**: Multi-tier permissions (Pharmacist, Medical Officer, Block Officer, District Admin, Public) ensuring citizen portals never expose warehouse counts while staff access is verified via JWT.

---

## 2. Technology Stack

- **Framework**: FastAPI (Python 3.11+ / 3.14)
- **Database ORM**: SQLAlchemy 2.0 with Alembic database migrations (SQLite for zero-config local dev, PostgreSQL for production)
- **Data Validation & Serialization**: Pydantic v2 with `ConfigDict`
- **Authentication**: JWT (JSON Web Tokens) with direct `bcrypt` password hashing
- **Geospatial Computation**: Geodesic Haversine matrix calculation
- **Document Generation**: ReportLab PDF generator (clinical transfer delivery slips)
- **Background Jobs**: APScheduler (12-hour automated stock depletion & expiry scanner)
- **Testing**: Pytest with HTTPX TestClient (100% core coverage)

---

## 3. Seeded Accounts & RBAC Matrix

| Role | Seeded Email | Password | Allowed Actions |
|---|---|---|---|
| **Pharmacist** (Alapakkam PHC) | `pharmacist1@tnhealth.gov.in` | `password123` | Log daily issues/receipts, view stock, request transfers, draft indents |
| **Medical Officer** (Alapakkam PHC) | `doctor1@tnhealth.gov.in` | `password123` | All Pharmacist actions + Approve transfers, approve indents, view audit logs |
| **Pharmacist** (Melamaiyur PHC) | `pharmacist2@tnhealth.gov.in` | `password123` | Pharmacist actions at donor centre |
| **Medical Officer** (Melamaiyur PHC) | `doctor2@tnhealth.gov.in` | `password123` | MO actions at Melamaiyur PHC |
| **Block Medical Officer** | `bmo1@tnhealth.gov.in` | `password123` | Block-wide cross-PHC oversight & approvals |
| **District Admin** (DDHS) | `admin@tnhealth.gov.in` | `admin123` | District-wide access, analytics, threshold overrides |
| **Public Citizen** | *No login required* | *N/A* | Public availability status (`AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`) |

---

## 4. Algorithmic & Mathematical Formulations

### A. Days-of-Stock & Consumption Velocity
$$\text{avg}_{7\text{d}} = \frac{1}{7}\sum_{t=0}^{6} \text{issued}_t, \quad \text{avg}_{30\text{d}} = \frac{1}{30}\sum_{t=0}^{29} \text{issued}_t$$
$$\text{effective\_daily\_rate} = \max(\text{avg}_{7\text{d}}, \text{avg}_{30\text{d}})$$
$$\text{days\_of\_stock} = \begin{cases} 0 & \text{if } \text{current\_stock} = 0 \\ \left\lfloor \frac{\text{current\_stock}}{\text{effective\_daily\_rate}} \right\rfloor & \text{if } \text{effective\_daily\_rate} > 0 \\ 999 & \text{otherwise} \end{cases}$$

### B. Haversine Geodesic Distance
$$d = 2 R \cdot \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
*(where $R = 6371\text{ km}$, $\phi = \text{latitude}$, $\lambda = \text{longitude}$)*

### C. Z-Score Anomaly & Epidemic Surge Detection
$$Z = \frac{x_{\text{today}} - \mu_{30\text{d}}}{\sigma_{30\text{d}}}$$
*An outbreak anomaly is raised when $Z \ge 2.0$, $x_{\text{today}} \ge 2.2 \times \mu$, and $x_{\text{today}} \ge 20$ units.*

### D. Tamil Nadu Seasonal Multipliers
- **Northeast Monsoon (Oct–Dec)**: Antipyretics $\times 1.6$, ORS $\times 1.8$, Antibiotics $\times 1.5$
- **Southwest Monsoon (Jun–Sep)**: ORS $\times 1.6$, Paracetamol $\times 1.3$, Anti-diarrheal $\times 1.4$
- **Agni Nakshatram Summer (Mar–May)**: ORS $\times 1.9$, IV fluids $\times 1.7$

---

## 5. Quickstart & Local Setup

### Using `uv` (Recommended)
```bash
# 1. Navigate to fastapi_backend
cd fastapi_backend

# 2. Run database migrations
uv run alembic upgrade head

# 3. Seed database (15 PHCs, 30 medicines, 90-day history, users)
uv run seed.py

# 4. Run tests
uv run pytest -v

# 5. Start development server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at **http://localhost:8000/docs**.

---

## 6. Docker & Docker-Compose Setup

```bash
# Build and run FastAPI backend and PostgreSQL container
docker-compose up --build -d

# Check service health
docker-compose ps
```

---

## 7. REST API Endpoints & Curl Examples

### 1. Authentication
```bash
# Log in as Pharmacist
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pharmacist1@tnhealth.gov.in","password":"password123"}'

# Get Current Authenticated Profile
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. Log Daily Stock Entry (Idempotent)
```bash
curl -X POST http://localhost:8000/api/v1/stock \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_entry_id": "entry-txn-20261010-001",
    "phc_id": "phc_cpt_01",
    "medicine_id": "med_01",
    "date": "2026-10-10",
    "opening": 25,
    "received": 0,
    "issued": 15,
    "closing": 10,
    "batch_no": "TN26-1001",
    "entered_by": "R. Murugan"
  }'
```

### 3. Check Days of Stock & Critical Alerts
```bash
# Days of stock summary for Alapakkam PHC
curl "http://localhost:8000/api/v1/stock/days-left?phc_id=phc_cpt_01" \
  -H "Authorization: Bearer <TOKEN>"

# Get Active Alerts
curl "http://localhost:8000/api/v1/alerts?phc_id=phc_cpt_01&status=new" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4. Find Nearby Surplus Stock (Geospatial Search)
```bash
# Search within 30km of Alapakkam PHC for Paracetamol and Amoxicillin
curl "http://localhost:8000/api/v1/nearby-stock?phc_id=phc_cpt_01&medicine_ids=med_01&medicine_ids=med_02&radius_km=30" \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Inter-PHC Stock Transfer Lifecycle
```bash
# 1. Request Transfer (Pharmacist)
curl -X POST http://localhost:8000/api/v1/transfers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "from_phc_id": "phc_cpt_02",
    "to_phc_id": "phc_cpt_01",
    "reason": "Pediatric viral fever surge at Alapakkam",
    "cold_chain_confirmed": false,
    "distance_km": 2.9,
    "items": [{"medicine_id":"med_01","batch_no":"TN26-1002","requested_qty":100}]
  }'

# 2. Approve Transfer (Medical Officer Only)
curl -X PATCH http://localhost:8000/api/v1/transfers/<TRANSFER_ID>/status \
  -H "Authorization: Bearer <MO_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'

# 3. Mark In-Transit
curl -X PATCH http://localhost:8000/api/v1/transfers/<TRANSFER_ID>/status \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_transit"}'

# 4. Mark Completed (Atomically decrements donor and increments receiver inventory)
curl -X PATCH http://localhost:8000/api/v1/transfers/<TRANSFER_ID>/status \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'

# 5. Download Official PDF Transfer Delivery Slip
curl -O http://localhost:8000/api/v1/transfers/<TRANSFER_ID>/slip \
  -H "Authorization: Bearer <TOKEN>"
```

### 6. Emergency Indents & AI Auto-Drafting
```bash
# Auto-draft an Emergency Indent based on burn rate and population served
curl -X POST "http://localhost:8000/api/v1/indents/auto-draft?phc_id=phc_cpt_01" \
  -H "Authorization: Bearer <TOKEN>"
```

### 7. AI Forecasting & Staff Chatbot (Bilingual)
```bash
# Get 30-day forecast with seasonal multiplier
curl "http://localhost:8000/api/v1/forecast/phc_cpt_01/med_01" \
  -H "Authorization: Bearer <TOKEN>"

# Chatbot Query in English
curl -X POST http://localhost:8000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{"query":"Do we have Paracetamol available at Alapakkam PHC?"}'

# Chatbot Query in Tamil
curl -X POST http://localhost:8000/api/v1/chatbot \
  -H "Content-Type: application/json" \
  -d '{"query":"Alapakkam ஆரம்ப சுகாதார நிலையத்தில் பாராசிட்டமால் உள்ளதா?"}'
```

### 8. Public Citizen Transparency Portal (No Login Required)
```bash
# Citizens verify medicine availability without exposing internal batch counts
curl "http://localhost:8000/api/v1/public/availability?phc_id=phc_cpt_01&medicine_id=med_01"
```

### 9. District Reports & CSV Exports
```bash
# Export District Stockouts Report as CSV
curl "http://localhost:8000/api/v1/reports/stockouts?format=csv" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 10. Multi-Source Stock Finder & Map Endpoints (Add-on)
```bash
# 1. Unified Geospatial Multi-Facility Search (PHCs, Sub-Centres, Jan Aushadhi, Private)
curl "http://localhost:8000/api/v1/finder/search?medicine_ids=med_01&from_source_id=phc_cpt_01&radius_km=30"

# 2. Filter Free Government Healthcare Facilities Only
curl "http://localhost:8000/api/v1/finder/search?medicine_ids=med_01&free_only=true&radius_km=25"

# 3. Multi-Medicine Search with Minimal-Set Itinerary Recommendation
curl "http://localhost:8000/api/v1/finder/multi?medicine_ids=med_01,med_02,med_03&from_source_id=phc_cpt_01&radius_km=35"

# 4. Map Bounding-Box Markers Query (Visible viewport only with 30s caching)
curl "http://localhost:8000/api/v1/map/sources?bbox=12.65,79.95,12.72,80.00&medicine_id=med_01"

# 5. Full Inventory for Clicked Facility Marker
curl "http://localhost:8000/api/v1/map/sources/phc_cpt_02/stock?page=1&page_size=50"

# 6. Alternative Out-of-Stock Suggestions for a Depleted PHC
curl "http://localhost:8000/api/v1/finder/suggest?from_source_id=phc_cpt_01&medicine_id=med_01&radius_km=30"

# 7. Facility Stock Manager Single Update (Idempotent)
curl -X POST http://localhost:8000/api/v1/finder/sources/src_pharm_01/stock \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "medicine_id": "med_01",
    "quantity": 100,
    "price_per_unit": 45.0,
    "batch_no": "APL-2026-09",
    "expiry_date": "2027-12-31"
  }'

# 8. Facility Stock Manager CSV Bulk Ingestion
curl -X POST http://localhost:8000/api/v1/finder/sources/src_pharm_01/stock/csv \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -F "file=@stock_update.csv"
```

---

## 8. Multi-Source Ranking & Coverage Formulations

### A. Composite Heuristic Ranking Score
$$\text{Score} = S_{\text{avail}} + S_{\text{cost}} - (\text{dist\_km} \times w_{\text{dist}}) + S_{\text{freshness}} + S_{\text{open}} - S_{\text{near\_expiry}}$$
- **Availability ($S_{\text{avail}}$)**: $+50$ pts if stock $>0$, $+8$ bonus pts if ample surplus ($\ge 100$ units).
- **Cost / Ownership ($S_{\text{cost}}$)**: $+35$ pts for Free Government care (PHC/HWC/CHC/Hospital); $+18$ pts for Low-Cost Cooperative Generics (Jan Aushadhi / Amma Marundhagam); $0$ pts for full retail.
- **Distance Penalty**: $-2.0$ pts per kilometre from search anchor point.
- **Data Freshness ($S_{\text{freshness}}$)**: $+10$ pts for data updated $<24\text{h}$; $-15$ pts for data $24-72\text{h}$ old; $-45$ pts penalty for severely stale data ($>72\text{h}$).
- **Operating Hours ($S_{\text{open}}$)**: $+10$ pts if currently open; $-10$ pts if closed.
- **Near Expiry ($S_{\text{near\_expiry}}$)**: $-20$ pts if stock batch expires within $\le 30$ days.

### B. Greedy Minimal Set Cover (Multi-Medicine)
When multiple medicines $\{M_1, M_2, \dots, M_k\}$ are searched, MediSync runs a Greedy Set Cover algorithm:
1. Iteratively selects the facility that satisfies the largest number of remaining uncovered medicines.
2. Breaks ties by prioritizing free government ownership and minimizing geodesic distance.
3. Outputs an optimal minimal-stop itinerary with total travel distance and estimated total cost.

---


## 8. Directory Structure

```
fastapi_backend/
├── app/
│   ├── config.py              # Environment settings & Pydantic ConfigDict
│   ├── database.py            # SQLAlchemy Engine, SessionLocal, get_db
│   ├── auth.py                # JWT authentication, bcrypt & RBAC guards
│   ├── main.py                # FastAPI app initialization, CORS & lifespan
│   ├── models/                # SQLAlchemy models (User, PHC, Medicine, Stock, Transfer, Indent, Alert, Audit)
│   ├── schemas/               # Pydantic v2 validation models
│   ├── routers/               # 10 modular REST API routers
│   ├── services/              # Domain logic (Stock, Distance, Recommender, PDF, Seasonal, Anomaly, Chatbot)
│   └── jobs/                  # APScheduler background tasks
├── alembic/                   # Database migration scripts
├── tests/                     # Pytest suite with 16 automated tests
├── data/                      # SQLite storage directory
├── Dockerfile                 # Multi-stage production container
├── docker-compose.yml         # Full-stack composition with PostgreSQL 16
├── seed.py                    # 15 PHCs, 30 medicines, 90-day stock data seeder
├── pyproject.toml             # uv / pyproject dependencies
└── README.md                  # System & API documentation
```
