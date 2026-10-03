"""Tests for operator field + Z-suffixed UTC timestamps (iteration 2)."""
import os
import re
from datetime import datetime, timezone

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ISO_Z_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")


@pytest.fixture(scope="module")
def s():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s


created_ids: list[str] = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(s):
    yield
    for tid in list(created_ids):
        try:
            s.delete(f"{BASE}/api/tires/{tid}?operator=TEST_cleanup", timeout=15)
        except Exception:
            pass


# -------- Create with operator --------
def test_create_tire_with_operator_persists_in_movement(s):
    payload = {
        "size": "TEST_205/55 R16 91V",
        "brand": "Pirelli",
        "season": "Estive",
        "quantity": 2,
        "operator": "TEST_Mario",
    }
    r = s.post(f"{BASE}/api/tires", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    tire = r.json()
    assert tire["rim"] == 16
    assert tire["quantity"] == 2
    created_ids.append(tire["id"])

    # Latest movement should have operator=TEST_Mario, type=create
    r = s.get(f"{BASE}/api/movements?limit=20", timeout=15)
    assert r.status_code == 200
    movs = r.json()
    mv = next((m for m in movs if m["tire_id"] == tire["id"]), None)
    assert mv is not None, "Movement for created tire not found"
    assert mv["type"] == "create"
    assert mv["operator"] == "TEST_Mario"
    assert mv["delta"] == 2
    assert mv["quantity_after"] == 2


# -------- PATCH with operator --------
def test_patch_quantity_logs_operator(s):
    tid = created_ids[0]
    r = s.patch(
        f"{BASE}/api/tires/{tid}/quantity",
        json={"delta": 3, "operator": "TEST_Luigi"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["quantity"] == 5

    movs = s.get(f"{BASE}/api/movements?limit=20", timeout=15).json()
    mv = next((m for m in movs if m["tire_id"] == tid and m["type"] == "add" and m["delta"] == 3), None)
    assert mv is not None
    assert mv["operator"] == "TEST_Luigi"

    r = s.patch(
        f"{BASE}/api/tires/{tid}/quantity",
        json={"delta": -1, "operator": "TEST_Luigi"},
        timeout=15,
    )
    assert r.status_code == 200
    movs = s.get(f"{BASE}/api/movements?limit=20", timeout=15).json()
    mv = next((m for m in movs if m["tire_id"] == tid and m["type"] == "remove"), None)
    assert mv is not None
    assert mv["operator"] == "TEST_Luigi"


# -------- Operator optional (null) --------
def test_create_without_operator_null(s):
    payload = {
        "size": "TEST_215/60 R17",
        "brand": "Continental",
        "season": "Invernali",
        "quantity": 1,
    }
    r = s.post(f"{BASE}/api/tires", json=payload, timeout=15)
    assert r.status_code == 200
    tire = r.json()
    created_ids.append(tire["id"])
    movs = s.get(f"{BASE}/api/movements?limit=20", timeout=15).json()
    mv = next((m for m in movs if m["tire_id"] == tire["id"]), None)
    assert mv is not None
    assert mv["operator"] is None


# -------- Delete with ?operator=NAME --------
def test_delete_with_operator_query_logs_delete_mv(s):
    tid = created_ids[-1]
    r = s.delete(f"{BASE}/api/tires/{tid}?operator=TEST_Anna", timeout=15)
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    created_ids.remove(tid)

    movs = s.get(f"{BASE}/api/movements?limit=50", timeout=15).json()
    mv = next((m for m in movs if m["tire_id"] == tid and m["type"] == "delete"), None)
    assert mv is not None
    assert mv["operator"] == "TEST_Anna"
    assert mv["quantity_after"] == 0

    # Delete again -> 404
    r = s.delete(f"{BASE}/api/tires/{tid}?operator=TEST_Anna", timeout=15)
    assert r.status_code == 404


# -------- Z timestamps on tires --------
def test_tire_timestamps_have_Z_suffix(s):
    r = s.get(f"{BASE}/api/tires", timeout=15)
    assert r.status_code == 200
    tires = r.json()
    # Use the first created tire from this module to guarantee presence
    assert any(t["id"] == created_ids[0] for t in tires)
    t = next(t for t in tires if t["id"] == created_ids[0])
    assert ISO_Z_RE.match(t["created_at"]), f"created_at not Z-iso: {t['created_at']}"
    assert ISO_Z_RE.match(t["updated_at"]), f"updated_at not Z-iso: {t['updated_at']}"


# -------- Z timestamps on movements --------
def test_movement_timestamps_have_Z_suffix(s):
    r = s.get(f"{BASE}/api/movements?limit=20", timeout=15)
    assert r.status_code == 200
    movs = r.json()
    assert len(movs) > 0
    for m in movs[:10]:
        assert ISO_Z_RE.match(m["timestamp"]), f"Movement ts not Z-iso: {m['timestamp']}"


# -------- Timestamps are actually UTC (close to server now) --------
def test_timestamps_are_utc(s):
    r = s.get(f"{BASE}/api/movements?limit=5", timeout=15)
    movs = r.json()
    assert len(movs) > 0
    latest = movs[0]["timestamp"]
    # Parse Z-suffixed iso
    parsed = datetime.fromisoformat(latest.replace("Z", "+00:00"))
    now_utc = datetime.now(timezone.utc)
    delta = abs((now_utc - parsed).total_seconds())
    assert delta < 300, f"Timestamp off by {delta}s from UTC now: {latest}"


# -------- Existing endpoints still green (sanity) --------
def test_brands_still_20_and_3_seasons(s):
    r = s.get(f"{BASE}/api/brands", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data["brands"]) == 20
    assert set(data["seasons"]) == {"All Season", "Invernali", "Estive"}


def test_invalid_payload_still_422(s):
    r = s.post(
        f"{BASE}/api/tires",
        json={"size": "nope", "brand": "Michelin", "season": "Estive", "quantity": 1},
        timeout=15,
    )
    assert r.status_code == 422


def test_delete_404_for_unknown(s):
    r = s.delete(f"{BASE}/api/tires/does-not-exist", timeout=15)
    assert r.status_code == 404
