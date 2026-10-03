import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://garage-stock-4.preview.emergentagent.com"
BASE = BASE.rstrip("/")

@pytest.fixture(scope="module")
def s():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s

@pytest.fixture(scope="module", autouse=True)
def cleanup(s):
    # cleanup after module
    yield
    try:
        tires = s.get(f"{BASE}/api/tires", timeout=15).json()
        for t in tires:
            if t.get("brand") in {"Michelin", "Pirelli", "Continental", "Bridgestone"} and "TEST" in t.get("size", "") or t.get("size", "").startswith("TEST_"):
                s.delete(f"{BASE}/api/tires/{t['id']}", timeout=15)
    except Exception:
        pass


def test_brands_meta(s):
    r = s.get(f"{BASE}/api/brands", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["brands"]) == 20
    assert set(data["seasons"]) == {"All Season", "Invernali", "Estive"}


def test_list_tires_ok(s):
    r = s.get(f"{BASE}/api/tires", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


created_ids = []

def test_create_tire_parses_rim(s):
    payload = {"size": "TEST_185/60 R15 91V", "brand": "Michelin", "season": "Estive", "quantity": 2}
    r = s.post(f"{BASE}/api/tires", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["rim"] == 15
    assert data["quantity"] == 2
    created_ids.append(data["id"])


def test_create_merge_dup(s):
    # Same size+brand+season -> merge
    payload = {"size": "TEST_185/60 R15 91V", "brand": "Michelin", "season": "Estive", "quantity": 3}
    r = s.post(f"{BASE}/api/tires", json=payload, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == created_ids[0]
    assert data["quantity"] == 5


def test_create_different_season_new(s):
    payload = {"size": "TEST_185/60 R15 91V", "brand": "Michelin", "season": "Invernali", "quantity": 1}
    r = s.post(f"{BASE}/api/tires", json=payload, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] != created_ids[0]
    created_ids.append(data["id"])


def test_create_invalid_size(s):
    r = s.post(f"{BASE}/api/tires", json={"size": "185/60 91V", "brand": "Michelin", "season": "Estive", "quantity": 1}, timeout=15)
    assert r.status_code == 422


def test_create_invalid_brand(s):
    r = s.post(f"{BASE}/api/tires", json={"size": "195/65 R15", "brand": "FakeBrand", "season": "Estive", "quantity": 1}, timeout=15)
    assert r.status_code == 422


def test_create_invalid_season(s):
    r = s.post(f"{BASE}/api/tires", json={"size": "195/65 R15", "brand": "Michelin", "season": "Winter", "quantity": 1}, timeout=15)
    assert r.status_code == 422


def test_create_invalid_qty(s):
    r = s.post(f"{BASE}/api/tires", json={"size": "195/65 R15", "brand": "Michelin", "season": "Estive", "quantity": 0}, timeout=15)
    assert r.status_code == 422


def test_patch_qty_add_remove(s):
    tid = created_ids[0]
    r = s.patch(f"{BASE}/api/tires/{tid}/quantity", json={"delta": 3}, timeout=15)
    assert r.status_code == 200
    assert r.json()["quantity"] == 8
    r = s.patch(f"{BASE}/api/tires/{tid}/quantity", json={"delta": -2}, timeout=15)
    assert r.status_code == 200
    assert r.json()["quantity"] == 6


def test_patch_qty_negative_rejected(s):
    tid = created_ids[0]
    r = s.patch(f"{BASE}/api/tires/{tid}/quantity", json={"delta": -999}, timeout=15)
    assert r.status_code == 400


def test_patch_qty_404(s):
    r = s.patch(f"{BASE}/api/tires/does-not-exist/quantity", json={"delta": 1}, timeout=15)
    assert r.status_code == 404


def test_movements_list(s):
    r = s.get(f"{BASE}/api/movements", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    ts = [m["timestamp"] for m in data]
    assert ts == sorted(ts, reverse=True)
    for m in data[:5]:
        assert "delta" in m and "quantity_after" in m and "type" in m


def test_delete_tire(s):
    for tid in created_ids:
        r = s.delete(f"{BASE}/api/tires/{tid}", timeout=15)
        assert r.status_code == 200
    # 404 on second delete
    r = s.delete(f"{BASE}/api/tires/{created_ids[0]}", timeout=15)
    assert r.status_code == 404
