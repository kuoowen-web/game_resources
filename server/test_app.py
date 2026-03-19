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

# === Cashflow Tests ===

def test_list_cashflows_empty(client):
    resp = client.get("/api/cashflows")
    assert resp.status_code == 200
    assert resp.get_json() == []

SAMPLE_CASHFLOW = {"date": "2026-08-15", "amount": 9000000, "note": "年度收入進帳"}

def test_create_cashflow(client):
    resp = client.post("/api/cashflows", json=SAMPLE_CASHFLOW)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["date"] == "2026-08-15"
    assert data["amount"] == 9000000
    assert data["id"] == 0

def test_list_cashflows_with_data(client):
    client.post("/api/cashflows", json=SAMPLE_CASHFLOW)
    client.post("/api/cashflows", json={"date": "2026-05-20", "amount": -3200000, "note": "繳稅"})
    resp = client.get("/api/cashflows")
    data = resp.get_json()
    assert len(data) == 2
    assert data[0]["amount"] == 9000000
    assert data[1]["amount"] == -3200000

def test_update_cashflow(client):
    client.post("/api/cashflows", json=SAMPLE_CASHFLOW)
    resp = client.put("/api/cashflows/0", json={"date": "2026-08-16", "amount": 9500000, "note": "修正"})
    assert resp.status_code == 200
    assert resp.get_json()["amount"] == 9500000

def test_update_cashflow_not_found(client):
    resp = client.put("/api/cashflows/99", json=SAMPLE_CASHFLOW)
    assert resp.status_code == 404

def test_delete_cashflow(client):
    client.post("/api/cashflows", json=SAMPLE_CASHFLOW)
    resp = client.delete("/api/cashflows/0")
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    resp = client.get("/api/cashflows")
    assert resp.get_json() == []

def test_delete_cashflow_not_found(client):
    resp = client.delete("/api/cashflows/99")
    assert resp.status_code == 404

def test_create_cashflow_missing_fields(client):
    resp = client.post("/api/cashflows", json={"note": "no date"})
    assert resp.status_code == 400
