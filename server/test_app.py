import json
import os
import pytest
from app import create_app

@pytest.fixture
def client(tmp_path):
    app = create_app(data_dir=str(tmp_path))
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_list_snapshots_empty(client):
    resp = client.get("/api/snapshots")
    assert resp.status_code == 200
    assert resp.get_json() == []

SAMPLE_SNAPSHOT = {
    "date": "2026-03-17",
    "note": "Q1 整理",
    "exchange_rates": {"USD_TWD": 32.5},
    "assets": {
        "deposits": [{"name": "台銀活存", "currency": "TWD", "amount": 500000}],
        "insurance": [],
        "bonds": [],
        "structured_products": [],
        "tw_stocks": [],
        "us_stocks": []
    }
}

def test_create_snapshot(client):
    resp = client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["date"] == "2026-03-17"

def test_get_snapshot(client):
    client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    resp = client.get("/api/snapshots/2026-03-17")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["note"] == "Q1 整理"
    assert data["assets"]["deposits"][0]["amount"] == 500000

def test_get_snapshot_not_found(client):
    resp = client.get("/api/snapshots/9999-01-01")
    assert resp.status_code == 404

def test_list_snapshots_with_data(client):
    client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    resp = client.get("/api/snapshots")
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["date"] == "2026-03-17"
    assert data[0]["note"] == "Q1 整理"

def test_update_snapshot(client):
    client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    updated = {**SAMPLE_SNAPSHOT, "note": "updated"}
    resp = client.put("/api/snapshots/2026-03-17", json=updated)
    assert resp.status_code == 200
    assert resp.get_json()["note"] == "updated"

def test_update_snapshot_not_found(client):
    resp = client.put("/api/snapshots/9999-01-01", json=SAMPLE_SNAPSHOT)
    assert resp.status_code == 404

def test_delete_snapshot(client):
    client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    resp = client.delete("/api/snapshots/2026-03-17")
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    resp = client.get("/api/snapshots/2026-03-17")
    assert resp.status_code == 404

def test_delete_snapshot_not_found(client):
    resp = client.delete("/api/snapshots/9999-01-01")
    assert resp.status_code == 404

def test_create_snapshot_missing_date(client):
    resp = client.post("/api/snapshots", json={"note": "no date"})
    assert resp.status_code == 400

def test_create_snapshot_overwrites(client):
    client.post("/api/snapshots", json=SAMPLE_SNAPSHOT)
    updated = {**SAMPLE_SNAPSHOT, "note": "overwritten"}
    resp = client.post("/api/snapshots", json=updated)
    assert resp.status_code == 201
    resp = client.get("/api/snapshots/2026-03-17")
    assert resp.get_json()["note"] == "overwritten"
