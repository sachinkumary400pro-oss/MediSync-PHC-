import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta

from app.main import app
from app.database import SessionLocal
from app.models.stock_source import StockSource, SourceStock, SourceUser
from app.models.medicine import Medicine
from app.models.user import User
from app.auth import create_access_token


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


@pytest.fixture(scope="module")
def staff_headers(db):
    user = db.query(User).filter(User.role == "pharmacist").first()
    token = create_access_token(data={"sub": user.id, "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def source_manager_headers(db):
    user = db.query(User).filter(User.email == "manager_apollo@medisync.tn.gov.in").first()
    token = create_access_token(data={"sub": user.id, "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Mixed-Type Ranking & Sorting Tests
# ==============================================================================
def test_mixed_type_ranking_and_sorting(client):
    """
    Demo scenario:
    PHC Alapakkam has 0 paracetamol syrup (med_01).
    Nearby Melamaiyur PHC (Free, 2.9 km away) has 380.
    Apollo Pharmacy (Paid ₹45, 3 km away) has 65.
    Jan Aushadhi (Low-cost ₹18, 5 km away) has 120.
    Default ranking should prioritize Free/Government and higher score nearest first.
    """
    resp = client.get("/api/v1/finder/search?medicine_ids=med_01&from_source_id=phc_cpt_01&radius_km=30&page_size=60")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    results = data["results"]

    # Verify top results prioritize free government healthcare
    top = results[0]
    assert top["is_free"] is True
    assert top["score"] > 0
    assert any("Free" in r for r in top["score_reasons"])

    # Verify when filtering by source_types=phc, PHC Melamaiyur is the top donor
    phc_resp = client.get("/api/v1/finder/search?medicine_ids=med_01&from_source_id=phc_cpt_01&source_types=phc&radius_km=30")
    assert phc_resp.status_code == 200
    phc_results = phc_resp.json()["results"]
    assert len(phc_results) > 0
    assert phc_results[0]["source_id"] == "phc_cpt_02"
    assert phc_results[0]["distance_km"] <= 3.5

    # Verify both Jan Aushadhi (cooperative) and Apollo (private) are discoverable in search
    all_source_ids = [r["source_id"] for r in results]
    assert "src_ja_01" in all_source_ids
    assert "src_pharm_01" in all_source_ids

    # Test sorting by price
    resp_price = client.get("/api/v1/finder/search?medicine_ids=med_01&from_source_id=phc_cpt_01&sort=price")
    assert resp_price.status_code == 200
    p_results = resp_price.json()["results"]
    prices = [r["price_per_unit"] or 0.0 for r in p_results if r["quantity_status"] != "out_of_stock"]
    assert prices == sorted(prices)

    # Test sorting by distance
    resp_dist = client.get("/api/v1/finder/search?medicine_ids=med_01&from_source_id=phc_cpt_01&sort=distance")
    assert resp_dist.status_code == 200
    d_results = resp_dist.json()["results"]
    distances = [r["distance_km"] for r in d_results]
    assert distances == sorted(distances)


# ==============================================================================
# 2. Multi-Medicine Coverage & Minimal Set Suggestion
# ==============================================================================
def test_multi_medicine_coverage_and_minimal_set(client):
    med_ids = "med_01,med_02,med_03"
    resp = client.get(f"/api/v1/finder/multi?medicine_ids={med_ids}&from_source_id=phc_cpt_01&radius_km=35")
    assert resp.status_code == 200
    data = resp.json()

    assert "requested_medicines" in data
    assert len(data["requested_medicines"]) == 3
    assert "sources_with_coverage" in data
    assert "best_combination" in data

    combo = data["best_combination"]
    assert "suggested_sources" in combo
    assert len(combo["suggested_sources"]) >= 1
    assert combo["total_covered"] > 0


# ==============================================================================
# 3. Staff-Only Sources Hidden From Public & Privacy Rules
# ==============================================================================
def test_staff_only_sources_hidden_from_public(client, staff_headers):
    # Unauthenticated / Public call
    public_resp = client.get("/api/v1/finder/search?medicine_ids=med_01&radius_km=50")
    assert public_resp.status_code == 200
    pub_results = public_resp.json()["results"]
    # Verify no warehouse source is in public results
    pub_source_types = [r["source_type"] for r in pub_results]
    assert "warehouse" not in pub_source_types
    # Verify exact quantities are hidden for public (exposed_qty is None, quantity_status is populated)
    for r in pub_results:
        assert r["quantity"] is None
        assert r["quantity_status"] in ["available", "low_stock", "out_of_stock"]

    # Staff call: warehouse is visible and exact quantities are exposed
    staff_resp = client.get("/api/v1/finder/search?medicine_ids=med_01&radius_km=50", headers=staff_headers)
    assert staff_resp.status_code == 200
    staff_results = staff_resp.json()["results"]
    staff_types = [r["source_type"] for r in staff_results]
    assert "warehouse" in staff_types
    assert any(r["quantity"] is not None for r in staff_results)


# ==============================================================================
# 4. Stale-Stock Penalty
# ==============================================================================
def test_stale_stock_penalty(client, db):
    # Create two test sources at same coordinates, one fresh and one 80 hours stale
    now = datetime.now(timezone.utc)
    fresh_src = StockSource(
        id="test_src_fresh",
        source_type="private_pharmacy",
        name="Fresh Test Pharmacy",
        address="Test Road",
        block="Chengalpattu Block",
        latitude=12.6841,
        longitude=79.9830,
        phone="044-11111111",
        ownership="private",
        is_verified=True,
        is_active=True,
        visibility="public",
    )
    stale_src = StockSource(
        id="test_src_stale",
        source_type="private_pharmacy",
        name="Stale Test Pharmacy",
        address="Test Road",
        block="Chengalpattu Block",
        latitude=12.6841,
        longitude=79.9830,
        phone="044-22222222",
        ownership="private",
        is_verified=True,
        is_active=True,
        visibility="public",
    )
    db.add(fresh_src)
    db.add(stale_src)
    db.flush()

    db.add(SourceStock(
        id="stk_test_fresh",
        source_id="test_src_fresh",
        medicine_id="med_04",
        quantity=50,
        price_per_unit=50.0,
        last_updated=now - timedelta(hours=1),
    ))
    db.add(SourceStock(
        id="stk_test_stale",
        source_id="test_src_stale",
        medicine_id="med_04",
        quantity=50,
        price_per_unit=50.0,
        last_updated=now - timedelta(hours=85),
    ))
    db.commit()

    resp = client.get("/api/v1/finder/search?medicine_ids=med_04&lat=12.6841&lng=79.9830&radius_km=5")
    assert resp.status_code == 200
    results = {r["source_id"]: r for r in resp.json()["results"]}

    assert "test_src_fresh" in results
    assert "test_src_stale" in results
    assert results["test_src_fresh"]["is_stale"] is False
    assert results["test_src_stale"]["is_stale"] is True
    assert results["test_src_stale"]["stale_severity"] == "severe_stale"
    assert results["test_src_fresh"]["score"] > results["test_src_stale"]["score"]

    # Cleanup test sources
    db.query(SourceStock).filter(SourceStock.id.in_(["stk_test_fresh", "stk_test_stale"])).delete()
    db.query(StockSource).filter(StockSource.id.in_(["test_src_fresh", "test_src_stale"])).delete()
    db.commit()


# ==============================================================================
# 5. Bounding-Box Filtering
# ==============================================================================
def test_bounding_box_filtering(client):
    # Chengalpattu town tight bounding box
    bbox = "12.65,79.95,12.72,80.00"
    resp = client.get(f"/api/v1/map/sources?bbox={bbox}")
    assert resp.status_code == 200
    markers = resp.json()
    assert len(markers) > 0
    for m in markers:
        assert 12.65 <= m["latitude"] <= 12.72
        assert 79.95 <= m["longitude"] <= 80.00


# ==============================================================================
# 6. Source Manager RBAC & Stock Updates
# ==============================================================================
def test_source_manager_permissions(client, source_manager_headers):
    # manager_apollo is assigned to src_pharm_01
    # 1. Updating own source should succeed
    payload = {
        "medicine_id": "med_01",
        "quantity": 80,
        "price_per_unit": 45.0,
        "batch_no": "TEST-APL-01",
        "expiry_date": "2027-10-31",
    }
    resp_ok = client.post(
        "/api/v1/finder/sources/src_pharm_01/stock",
        json=payload,
        headers=source_manager_headers,
    )
    assert resp_ok.status_code == 201
    assert resp_ok.json()["status"] == "success"

    # 2. Updating another source (e.g., phc_cpt_02) should return 403 Forbidden
    resp_forbidden = client.post(
        "/api/v1/finder/sources/phc_cpt_02/stock",
        json=payload,
        headers=source_manager_headers,
    )
    assert resp_forbidden.status_code == 403


# ==============================================================================
# 7. Suggestions for Out-of-Stock PHC
# ==============================================================================
def test_suggest_alternatives(client):
    resp = client.get("/api/v1/finder/suggest?from_source_id=phc_cpt_01&medicine_id=med_01&radius_km=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_alternatives"] > 0
    suggs = data["suggestions"]
    assert len(suggs) > 0
    top_sugg = suggs[0]
    assert "tagline" in top_sugg
    assert "reasons" in top_sugg
    assert top_sugg["source_id"] != "phc_cpt_01"
