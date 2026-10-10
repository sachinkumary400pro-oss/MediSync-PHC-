import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.services.distance import haversine_distance
from app.services.seasonal import get_seasonal_profile, get_seasonal_multiplier_for_medicine
from app.services.anomaly import compute_zscore_anomaly, detect_stock_anomalies
from app.services.stock_service import calculate_days_of_stock
from app.models.phc import PHC
from app.models.medicine import Medicine
from app.models.stock import Batch


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ==============================================================================
# 1. Geodesic & Haversine Distance Tests
# ==============================================================================
def test_haversine_same_point():
    lat, lon = 12.6937, 79.9754
    dist = haversine_distance(lat, lon, lat, lon)
    assert dist == 0.0


def test_haversine_known_phc_distance():
    # Alapakkam PHC to Melamaiyur PHC in Chengalpattu district
    # Alapakkam: (12.6937, 79.9754), Melamaiyur: (12.6842, 79.9965)
    dist = haversine_distance(12.6937, 79.9754, 12.6842, 79.9965)
    assert 2.0 <= dist <= 3.5, f"Expected approx 2.9 km, got {dist} km"


# ==============================================================================
# 2. Tamil Nadu Epidemiological & Seasonal Multiplier Tests
# ==============================================================================
def test_seasonal_multiplier_northeast_monsoon():
    # October is Northeast Monsoon peak in Tamil Nadu
    mult_fever = get_seasonal_multiplier_for_medicine("Paracetamol Tablets 500mg", month=10)
    assert mult_fever >= 1.3, "Northeast monsoon should yield elevated antipyretic demand"

    mult_ors = get_seasonal_multiplier_for_medicine("Oral Rehydration Salts (ORS)", month=10)
    assert mult_ors >= 1.5, "ORS is in high demand during floods/monsoon"


def test_seasonal_multiplier_summer_heat():
    # May is Peak Summer (Agni Nakshatram) in Tamil Nadu
    mult_ors = get_seasonal_multiplier_for_medicine("Oral Rehydration Salts (ORS)", month=5)
    assert mult_ors >= 1.5, "Summer should trigger heatwave rehydration multiplier"


# ==============================================================================
# 3. Z-Score Anomaly Detection Tests
# ==============================================================================
def test_detect_anomalies_stable_series():
    series = [20, 22, 21, 19, 20, 23, 21, 20, 22, 21]
    result = compute_zscore_anomaly(series, z_threshold=2.0)
    assert result["is_anomaly"] is False
    assert result["severity"] == "NORMAL"


def test_detect_anomalies_surge_detection():
    # Baseline ~20 with sudden surge to 85
    series = [20, 21, 19, 20, 22, 20, 21, 20, 22, 85]
    result = compute_zscore_anomaly(series, z_threshold=2.0)
    assert result["is_anomaly"] is True
    assert result["z_score"] > 2.0
    assert result["severity"] in ["CRITICAL_SURGE", "SURGE"]


def test_detect_stock_anomalies_db(db):
    anomalies = detect_stock_anomalies(db)
    assert isinstance(anomalies, list)


# ==============================================================================
# 4. Days of Stock & Conservative Daily Rate Logic
# ==============================================================================
def test_days_of_stock_calculation(db):
    # Alapakkam PHC with Paracetamol (med_01)
    res = calculate_days_of_stock(db, "phc_cpt_01", "med_01")
    assert "days_left" in res
    assert "effective_daily_rate" in res
    assert "status" in res
    assert res["status"] in ["Out of Stock", "Critical Shortage", "Low Stock", "Surplus", "Adequate"]


# ==============================================================================
# 5. API Health & Public Transparency Endpoints
# ==============================================================================
def test_api_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "MediSync" in data["service"]


def test_public_availability_privacy(client):
    # Public citizen endpoint should NEVER leak batch numbers, warehouse counts, or exact stock
    res = client.get("/api/v1/public/availability?phc_id=phc_cpt_01")
    assert res.status_code == 200
    data = res.json()
    assert "medicines" in data
    assert len(data["medicines"]) > 0

    for item in data["medicines"]:
        assert "stock_status" in item
        assert item["stock_status"] in ["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"]
        # Confirm sensitive quantities are not exposed to public
        assert "quantity" not in item
        assert "batch_no" not in item
        assert "spareable_surplus" not in item


# ==============================================================================
# 6. Authentication & RBAC Tests
# ==============================================================================
def test_auth_login_invalid(client):
    res = client.post("/api/v1/auth/login", json={"email": "fake@tnhealth.gov.in", "password": "wrongpassword"})
    assert res.status_code == 401


def test_auth_login_success_and_me(client):
    # Pharmacist 1 login
    res = client.post("/api/v1/auth/login", json={"email": "pharmacist1@tnhealth.gov.in", "password": "password123"})
    assert res.status_code == 200
    token_data = res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Verify profile via /auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    user = me_res.json()
    assert user["email"] == "pharmacist1@tnhealth.gov.in"
    assert user["role"] == "pharmacist"
    assert user["phc_id"] == "phc_cpt_01"


# ==============================================================================
# 7. Nearby Stock Finder & Multi-Medicine Recommendations
# ==============================================================================
def test_nearby_stock_finder(client):
    # Log in as Pharmacist
    login_res = client.post("/api/v1/auth/login", json={"email": "pharmacist1@tnhealth.gov.in", "password": "password123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query nearby stock for med_01 (Paracetamol) from Alapakkam PHC
    res = client.get("/api/v1/nearby-stock?phc_id=phc_cpt_01&medicine_ids=med_01&radius_km=30", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "donors" in data
    # Melamaiyur PHC (phc_cpt_02) should be candidate donor within 5km
    assert len(data["donors"]) > 0
    donor = data["donors"][0]
    assert "distance_km" in donor
    assert donor["distance_km"] <= 30.0


# ==============================================================================
# 8. Transfer Workflow & Atomic Stock State Transition
# ==============================================================================
def test_transfer_lifecycle(client, db):
    # 1. Pharmacist 1 requests transfer
    p_login = client.post("/api/v1/auth/login", json={"email": "pharmacist1@tnhealth.gov.in", "password": "password123"})
    p_token = p_login.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    req_payload = {
        "from_phc_id": "phc_cpt_02",  # Donor: Melamaiyur
        "to_phc_id": "phc_cpt_01",    # Requester: Alapakkam
        "reason": "Test unit transfer lifecycle verification",
        "distance_km": 2.9,
        "cold_chain_confirmed": False,
        "items": [
            {
                "medicine_id": "med_02",  # Amoxicillin
                "batch_no": "TN26-1004",
                "requested_qty": 20
            }
        ]
    }
    create_res = client.post("/api/v1/transfers", json=req_payload, headers=p_headers)
    assert create_res.status_code in [200, 201]
    transfer_id = create_res.json()["id"]
    assert create_res.json()["status"] in ["requested", "pending"]

    # 2. Pharmacist tries to approve (Should FAIL RBAC 403 - only MO/Admin can approve)
    fail_res = client.patch(f"/api/v1/transfers/{transfer_id}/status", json={"status": "approved"}, headers=p_headers)
    assert fail_res.status_code == 403

    # 3. Medical Officer approves
    mo_login = client.post("/api/v1/auth/login", json={"email": "doctor2@tnhealth.gov.in", "password": "password123"})
    mo_token = mo_login.json()["access_token"]
    mo_headers = {"Authorization": f"Bearer {mo_token}"}

    approve_res = client.patch(f"/api/v1/transfers/{transfer_id}/status", json={"status": "approved"}, headers=mo_headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    # 4. Dispatch transfer (in_transit)
    transit_res = client.patch(f"/api/v1/transfers/{transfer_id}/status", json={"status": "in_transit"}, headers=p_headers)
    assert transit_res.status_code == 200
    assert transit_res.json()["status"] == "in_transit"

    # 5. Mark as completed (triggers atomic DB stock updates on both PHCs)
    complete_res = client.patch(f"/api/v1/transfers/{transfer_id}/status", json={"status": "completed"}, headers=p_headers)
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # 6. Verify Transfer Delivery Slip PDF generation
    slip_res = client.get(f"/api/v1/transfers/{transfer_id}/slip", headers=p_headers)
    assert slip_res.status_code == 200
    assert slip_res.headers["content-type"] == "application/pdf"
    assert slip_res.content.startswith(b"%PDF"), "Must return valid binary PDF"


# ==============================================================================
# 9. AI Chatbot Query Endpoint
# ==============================================================================
def test_ai_chatbot_english(client):
    res = client.post("/api/v1/ai/chatbot", json={"message": "Do we have Paracetamol available at Alapakkam PHC?"})
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0


def test_ai_chatbot_tamil(client):
    res = client.post("/api/v1/ai/chatbot", json={"message": "Alapakkam ஆரம்ப சுகாதார நிலையத்தில் பாராசிட்டமால் உள்ளதா?"})
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
