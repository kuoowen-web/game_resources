# Asset Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local webapp for recording, viewing, and comparing personal asset snapshots with multi-currency support and inline market value calculator.

**Architecture:** Flask backend serving a REST API that reads/writes JSON snapshot files from `data/snapshots/`. Pure HTML/CSS/JS frontend as a single page application. No database — JSON files are the data store.

**Tech Stack:** Python 3 + Flask (backend), vanilla HTML/CSS/JS + Chart.js (frontend)

**Spec:** `docs/2026-03-17-asset-tracker-design.md`

---

## File Structure

```
game_resources/
  server/
    app.py              # Flask app: static file serving + REST API (5 endpoints)
    test_app.py         # API tests using Flask test client
  web/
    index.html          # SPA shell: nav, views, modals
    style.css           # All styles
    app.js              # All frontend logic: API calls, rendering, calculator, chart
  data/
    snapshots/          # JSON snapshot files (YYYY-MM-DD.json)
  requirements.txt      # Flask
```

---

## Task 1: Project Setup + Flask Skeleton

**Files:**
- Create: `requirements.txt`
- Create: `server/app.py`
- Create: `server/test_app.py`
- Create: `data/snapshots/.gitkeep`

- [ ] **Step 1: Create requirements.txt**

```
flask>=3.0
pytest>=8.0
```

- [ ] **Step 2: Create venv and install dependencies**

Run:
```bash
python -m venv venv
venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

- [ ] **Step 3: Write test for GET /api/snapshots (empty list)**

```python
# server/test_app.py
import json
import os
import shutil
import tempfile
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && python -m pytest test_app.py::test_list_snapshots_empty -v`
Expected: FAIL (cannot import create_app)

- [ ] **Step 5: Write minimal Flask app**

```python
# server/app.py
import json
import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

def create_app(data_dir=None):
    app = Flask(__name__, static_folder=None)

    if data_dir is None:
        data_dir = str(Path(__file__).parent.parent / "data")
    snapshots_dir = os.path.join(data_dir, "snapshots")
    os.makedirs(snapshots_dir, exist_ok=True)

    web_dir = str(Path(__file__).parent.parent / "web")

    import re
    def is_valid_date(date_str):
        return bool(re.match(r'^\d{4}-\d{2}-\d{2}$', date_str))

    @app.route("/")
    def index():
        return send_from_directory(web_dir, "index.html")

    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory(web_dir, filename)

    @app.route("/api/snapshots", methods=["GET"])
    def list_snapshots():
        result = []
        for f in sorted(os.listdir(snapshots_dir)):
            if f.endswith(".json"):
                filepath = os.path.join(snapshots_dir, f)
                with open(filepath, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                result.append({"date": data.get("date", f[:-5]), "note": data.get("note", "")})
        return jsonify(result)

    @app.route("/api/snapshots/<date>", methods=["GET"])
    def get_snapshot(date):
        if not is_valid_date(date):
            return jsonify({"error": "Invalid date format"}), 400
        filepath = os.path.join(snapshots_dir, f"{date}.json")
        if not os.path.exists(filepath):
            return jsonify({"error": "Snapshot not found"}), 404
        with open(filepath, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return jsonify(data)

    @app.route("/api/snapshots", methods=["POST"])
    def create_snapshot():
        data = request.get_json()
        if not data or "date" not in data:
            return jsonify({"error": "Missing date field"}), 400
        filepath = os.path.join(snapshots_dir, f"{data['date']}.json")
        with open(filepath, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        return jsonify(data), 201

    @app.route("/api/snapshots/<date>", methods=["PUT"])
    def update_snapshot(date):
        if not is_valid_date(date):
            return jsonify({"error": "Invalid date format"}), 400
        filepath = os.path.join(snapshots_dir, f"{date}.json")
        if not os.path.exists(filepath):
            return jsonify({"error": "Snapshot not found"}), 404
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), 400
        data["date"] = date
        with open(filepath, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        return jsonify(data)

    @app.route("/api/snapshots/<date>", methods=["DELETE"])
    def delete_snapshot(date):
        if not is_valid_date(date):
            return jsonify({"error": "Invalid date format"}), 400
        filepath = os.path.join(snapshots_dir, f"{date}.json")
        if not os.path.exists(filepath):
            return jsonify({"error": "Snapshot not found"}), 404
        os.remove(filepath)
        return jsonify({"ok": True})

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && python -m pytest test_app.py::test_list_snapshots_empty -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add requirements.txt server/app.py server/test_app.py data/snapshots/.gitkeep
git commit -m "feat: Flask skeleton with snapshot list API"
```

---

## Task 2: Full API CRUD Tests + Validation

**Files:**
- Modify: `server/test_app.py`

- [ ] **Step 1: Write all remaining API tests**

```python
# Append to server/test_app.py

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
```

- [ ] **Step 2: Run all tests**

Run: `cd server && python -m pytest test_app.py -v`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add server/test_app.py
git commit -m "test: complete API CRUD test coverage"
```

---

## Task 3: Frontend Shell — HTML + CSS + Snapshot Selector

**Files:**
- Create: `web/index.html`
- Create: `web/style.css`
- Create: `web/app.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asset Tracker</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
    <header>
        <h1>Asset Tracker</h1>
        <nav>
            <button id="nav-overview" class="nav-btn active">總覽</button>
            <button id="nav-compare" class="nav-btn">比較</button>
            <button id="nav-chart" class="nav-btn">趨勢</button>
        </nav>
    </header>
    <main>
        <!-- Overview View -->
        <section id="view-overview">
            <div class="toolbar">
                <select id="snapshot-select"><option value="">選擇 Snapshot...</option></select>
                <div class="currency-toggle">
                    <button class="cur-btn active" data-mode="original">原幣</button>
                    <button class="cur-btn" data-mode="twd">TWD</button>
                    <button class="cur-btn" data-mode="usd">USD</button>
                </div>
                <button id="btn-new-snapshot">+ 新增</button>
                <button id="btn-edit-snapshot" disabled>編輯</button>
            </div>
            <div id="snapshot-content"></div>
            <div id="snapshot-totals"></div>
        </section>

        <!-- Compare View -->
        <section id="view-compare" style="display:none">
            <div class="toolbar">
                <select id="compare-a"><option value="">Snapshot A...</option></select>
                <select id="compare-b"><option value="">Snapshot B...</option></select>
                <button id="btn-compare">比較</button>
            </div>
            <div id="compare-content"></div>
        </section>

        <!-- Chart View -->
        <section id="view-chart" style="display:none">
            <div class="toolbar">
                <div class="currency-toggle">
                    <button class="chart-cur-btn active" data-mode="twd">TWD</button>
                    <button class="chart-cur-btn" data-mode="usd">USD</button>
                    <button class="chart-cur-btn" data-mode="original">原幣</button>
                </div>
            </div>
            <canvas id="trend-chart"></canvas>
        </section>
    </main>

    <!-- Edit Modal -->
    <div id="edit-modal" class="modal" style="display:none">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">編輯 Snapshot</h2>
                <button id="modal-close">&times;</button>
            </div>
            <div id="modal-body"></div>
            <div class="modal-footer">
                <button id="modal-save">儲存</button>
                <button id="modal-cancel">取消</button>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

Basic clean styles: layout, toolbar, tables, modal, currency toggle buttons. Desktop-first, simple grid layout. Nothing fancy — functional and readable.

```css
/* web/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; color: #333; }
header { background: #2c3e50; color: white; padding: 1rem 2rem; display: flex; align-items: center; gap: 2rem; }
header h1 { font-size: 1.4rem; }
.nav-btn { background: none; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.4rem 1rem; cursor: pointer; border-radius: 4px; }
.nav-btn.active { background: rgba(255,255,255,0.2); border-color: white; }
main { max-width: 1200px; margin: 1rem auto; padding: 0 1rem; }
.toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.toolbar select { padding: 0.4rem; font-size: 0.9rem; }
.toolbar button { padding: 0.4rem 1rem; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: white; }
.currency-toggle { display: flex; gap: 0; }
.cur-btn, .chart-cur-btn { border-radius: 0; border-right: none; }
.cur-btn:first-child, .chart-cur-btn:first-child { border-radius: 4px 0 0 4px; }
.cur-btn:last-child, .chart-cur-btn:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #ccc; }
.cur-btn.active, .chart-cur-btn.active { background: #2c3e50; color: white; border-color: #2c3e50; }

/* Asset tables */
.asset-category { background: white; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.asset-category h3 { margin-bottom: 0.5rem; color: #2c3e50; }
.asset-table { width: 100%; border-collapse: collapse; }
.asset-table th, .asset-table td { padding: 0.5rem; text-align: right; border-bottom: 1px solid #eee; }
.asset-table th { text-align: right; font-weight: 600; color: #666; font-size: 0.85rem; }
.asset-table td:first-child, .asset-table th:first-child { text-align: left; }
.asset-table .calc-input { width: 100px; padding: 0.2rem 0.4rem; text-align: right; border: 1px solid #ddd; border-radius: 3px; }

/* Totals */
#snapshot-totals { background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 1.1rem; }
.total-row { display: flex; justify-content: space-between; padding: 0.3rem 0; }
.total-row.grand { font-weight: bold; font-size: 1.3rem; border-top: 2px solid #2c3e50; margin-top: 0.5rem; padding-top: 0.5rem; }

/* Compare */
.compare-category { background: white; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.delta-positive { color: #27ae60; }
.delta-negative { color: #e74c3c; }
.delta-new { color: #2980b9; font-style: italic; }
.delta-removed { color: #999; text-decoration: line-through; }

/* Modal */
.modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background: white; border-radius: 8px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; }
.modal-header button { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
#modal-body { padding: 1rem; }
.modal-footer { padding: 1rem; border-top: 1px solid #eee; display: flex; gap: 0.5rem; justify-content: flex-end; }
.modal-footer button { padding: 0.5rem 1.5rem; border-radius: 4px; cursor: pointer; }
#modal-save { background: #2c3e50; color: white; border: none; }
#modal-cancel { background: white; border: 1px solid #ccc; }

/* Form fields in modal */
.form-group { margin-bottom: 0.8rem; }
.form-group label { display: block; font-weight: 600; margin-bottom: 0.2rem; font-size: 0.85rem; }
.form-group input, .form-group select { width: 100%; padding: 0.4rem; border: 1px solid #ddd; border-radius: 3px; }
.form-section { border: 1px solid #eee; border-radius: 4px; padding: 0.8rem; margin-bottom: 1rem; }
.form-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.btn-add-item { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
.btn-remove-item { background: #e74c3c; color: white; border: none; padding: 0.2rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.8rem; }

/* Chart */
#trend-chart { background: white; border-radius: 8px; padding: 1rem; }
```

- [ ] **Step 3: Create app.js with API module and navigation**

```javascript
// web/app.js

// === API ===
const API = {
    async list() {
        const resp = await fetch("/api/snapshots");
        return resp.json();
    },
    async get(date) {
        const resp = await fetch(`/api/snapshots/${date}`);
        if (!resp.ok) throw new Error("Not found");
        return resp.json();
    },
    async create(snapshot) {
        const resp = await fetch("/api/snapshots", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(snapshot)
        });
        return resp.json();
    },
    async update(date, snapshot) {
        const resp = await fetch(`/api/snapshots/${date}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(snapshot)
        });
        return resp.json();
    },
    async remove(date) {
        const resp = await fetch(`/api/snapshots/${date}`, {method: "DELETE"});
        return resp.json();
    }
};

// === Navigation ===
const views = ["overview", "compare", "chart"];

function switchView(name) {
    views.forEach(v => {
        document.getElementById(`view-${v}`).style.display = v === name ? "" : "none";
        document.getElementById(`nav-${v}`).classList.toggle("active", v === name);
    });
}

document.getElementById("nav-overview").onclick = () => switchView("overview");
document.getElementById("nav-compare").onclick = () => switchView("compare");
document.getElementById("nav-chart").onclick = () => switchView("chart");

// === Init ===
let currentSnapshot = null;
let currencyMode = "original";

async function init() {
    await loadSnapshotList();
}

async function loadSnapshotList() {
    const list = await API.list();
    const sel = document.getElementById("snapshot-select");
    const compA = document.getElementById("compare-a");
    const compB = document.getElementById("compare-b");
    [sel, compA, compB].forEach(s => {
        const first = s.options[0];
        s.innerHTML = "";
        s.appendChild(first);
        list.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item.date;
            opt.textContent = `${item.date}${item.note ? " — " + item.note : ""}`;
            s.appendChild(opt);
        });
    });
}

init();
```

- [ ] **Step 4: Manual test — start server, open browser**

Run: `cd server && python app.py`
Open: http://localhost:5000
Expected: Page loads with header, navigation buttons work, dropdown is empty.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/style.css web/app.js
git commit -m "feat: frontend shell with navigation and API module"
```

---

## Task 4: Snapshot Overview — Render Assets + Currency Toggle

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add value resolution + currency conversion functions**

```javascript
// === Value Resolution ===
const CATEGORY_LABELS = {
    deposits: "存款",
    insurance: "保險",
    bonds: "債券",
    structured_products: "結構型商品",
    tw_stocks: "台股",
    us_stocks: "美股"
};

function getAssetValue(category, item) {
    switch (category) {
        case "deposits": return item.amount;
        case "insurance": return item.type === "savings" ? (item.surrender_value || 0) : 0;
        case "bonds": return item.market_value ?? (item.units * item.face_value_per_unit);
        case "structured_products": return item.account_value;
        case "tw_stocks":
        case "us_stocks": return item.market_value ?? (item.shares * item.avg_cost);
        default: return 0;
    }
}

function convertValue(value, fromCurrency, toMode, rate) {
    if (toMode === "original") return {value, currency: fromCurrency};
    if (toMode === "twd") {
        return {value: fromCurrency === "USD" ? value * rate : value, currency: "TWD"};
    }
    if (toMode === "usd") {
        return {value: fromCurrency === "TWD" ? value / rate : value, currency: "USD"};
    }
}

function formatMoney(value, currency) {
    const prefix = currency === "TWD" ? "NT$" : "US$";
    return `${prefix}${value.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
}
```

- [ ] **Step 2: Add snapshot rendering function**

```javascript
// === Render Overview ===
function renderSnapshot(snapshot) {
    const container = document.getElementById("snapshot-content");
    const totalsDiv = document.getElementById("snapshot-totals");
    container.innerHTML = "";
    totalsDiv.innerHTML = "";

    const rate = snapshot.exchange_rates?.USD_TWD || 32;
    let totalTWD = 0, totalUSD = 0;

    const categories = ["deposits", "insurance", "bonds", "structured_products", "tw_stocks", "us_stocks"];

    for (const cat of categories) {
        const items = snapshot.assets?.[cat] || [];
        if (items.length === 0) continue;

        // Skip health insurance that has 0 value, but still show the category
        const div = document.createElement("div");
        div.className = "asset-category";
        div.innerHTML = `<h3>${CATEGORY_LABELS[cat]}</h3>`;

        const table = document.createElement("table");
        table.className = "asset-table";

        // Build header based on category
        const headerRow = buildHeaderRow(cat);
        table.appendChild(headerRow);

        const tbody = document.createElement("tbody");
        let catTWD = 0, catUSD = 0;
        for (const item of items) {
            const value = getAssetValue(cat, item);
            const currency = item.currency;

            if (currency === "TWD") { totalTWD += value; catTWD += value; }
            else if (currency === "USD") { totalUSD += value; catUSD += value; }

            const row = buildAssetRow(cat, item, value, rate);
            tbody.appendChild(row);
        }
        // Category subtotal row
        const subtotalRow = document.createElement("tr");
        subtotalRow.style.fontWeight = "bold";
        subtotalRow.style.borderTop = "2px solid #ccc";
        const subtotalText = buildSubtotalText(catTWD, catUSD, rate);
        const colCount = table.querySelector("thead tr").children.length;
        subtotalRow.innerHTML = `<td>小計</td><td colspan="${colCount - 1}" style="text-align:right">${subtotalText}</td>`;
        tbody.appendChild(subtotalRow);

        table.appendChild(tbody);
        div.appendChild(table);
        container.appendChild(div);
    }

    renderTotals(totalsDiv, totalTWD, totalUSD, rate);
}

function buildHeaderRow(cat) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    let headers = [];

    switch (cat) {
        case "deposits":
            headers = ["名稱", "幣別", "金額"]; break;
        case "insurance":
            headers = ["名稱", "類型", "幣別", "保單價值", "年繳保費"]; break;
        case "bonds":
            headers = ["名稱", "幣別", "單位數", "票面利率", "即時價格", "市值"]; break;
        case "structured_products":
            headers = ["名稱", "幣別", "本金", "帳戶價值", "連結標的"]; break;
        case "tw_stocks":
        case "us_stocks":
            headers = ["名稱", "股數", "均成本", "即時價格", "市值"]; break;
    }

    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
}

function buildAssetRow(cat, item, value, rate) {
    const tr = document.createElement("tr");
    const converted = convertValue(value, item.currency, currencyMode, rate);
    const displayVal = formatMoney(converted.value, converted.currency);

    switch (cat) {
        case "deposits":
            tr.innerHTML = `<td>${item.name}</td><td>${item.currency}</td><td>${displayVal}</td>`;
            break;
        case "insurance":
            const insVal = item.type === "savings"
                ? formatMoney(convertValue(item.surrender_value || 0, item.currency, currencyMode, rate).value, convertValue(0, item.currency, currencyMode, rate).currency)
                : "—";
            const premConv = convertValue(item.annual_premium, item.currency, currencyMode, rate);
            tr.innerHTML = `<td>${item.name}</td><td>${item.type === "savings" ? "儲蓄" : "醫療"}</td><td>${item.currency}</td><td>${insVal}</td><td>${formatMoney(premConv.value, premConv.currency)}</td>`;
            break;
        case "bonds":
            tr.innerHTML = `<td>${item.name}</td><td>${item.currency}</td><td>${item.units}</td><td>${(item.coupon_rate * 100).toFixed(1)}%</td>
                <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price_per_unit" value="${item.current_price_per_unit ?? ""}"></td>
                <td>${displayVal}</td>`;
            break;
        case "structured_products":
            const prinConv = convertValue(item.principal, item.currency, currencyMode, rate);
            tr.innerHTML = `<td>${item.name}</td><td>${item.currency}</td><td>${formatMoney(prinConv.value, prinConv.currency)}</td><td>${displayVal}</td><td>${item.linked_to || ""}</td>`;
            break;
        case "tw_stocks":
        case "us_stocks":
            tr.innerHTML = `<td>${item.name}</td><td>${item.shares}</td><td>${item.avg_cost}</td>
                <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price" value="${item.current_price ?? ""}"></td>
                <td>${displayVal}</td>`;
            break;
    }
    return tr;
}

function buildSubtotalText(catTWD, catUSD, rate) {
    if (currencyMode === "original") {
        const parts = [];
        if (catTWD) parts.push(formatMoney(catTWD, "TWD"));
        if (catUSD) parts.push(formatMoney(catUSD, "USD"));
        return parts.join(" + ") || "—";
    } else if (currencyMode === "twd") {
        return formatMoney(catTWD + catUSD * rate, "TWD");
    } else {
        return formatMoney(catTWD / rate + catUSD, "USD");
    }
}

function renderTotals(container, totalTWD, totalUSD, rate) {
    if (currencyMode === "original") {
        container.innerHTML = `
            <div class="total-row"><span>台幣資產</span><span>${formatMoney(totalTWD, "TWD")}</span></div>
            <div class="total-row"><span>美元資產</span><span>${formatMoney(totalUSD, "USD")}</span></div>`;
    } else if (currencyMode === "twd") {
        const total = totalTWD + totalUSD * rate;
        container.innerHTML = `<div class="total-row grand"><span>總資產</span><span>${formatMoney(total, "TWD")}</span></div>`;
    } else {
        const total = totalTWD / rate + totalUSD;
        container.innerHTML = `<div class="total-row grand"><span>總資產</span><span>${formatMoney(total, "USD")}</span></div>`;
    }
}
```

- [ ] **Step 3: Wire up snapshot selector and currency toggle**

```javascript
// === Event Handlers ===
document.getElementById("snapshot-select").onchange = async function() {
    const date = this.value;
    if (!date) { currentSnapshot = null; return; }
    currentSnapshot = await API.get(date);
    document.getElementById("btn-edit-snapshot").disabled = false;
    renderSnapshot(currentSnapshot);
};

document.querySelectorAll(".cur-btn").forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll(".cur-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currencyMode = this.dataset.mode;
        if (currentSnapshot) renderSnapshot(currentSnapshot);
    };
});
```

- [ ] **Step 4: Manual test — create a test snapshot JSON, verify rendering**

Create `data/snapshots/2026-03-17.json` with the sample data from the spec. Start server, verify:
- Dropdown shows the snapshot
- Selecting it renders all asset categories in tables
- Currency toggle switches display correctly
- Calculator input fields appear for bonds and stocks

- [ ] **Step 5: Commit**

```bash
git add web/app.js
git commit -m "feat: snapshot overview rendering with currency toggle"
```

---

## Task 5: Inline Calculator — Compute + Save Back

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add calculate and save functions**

```javascript
// === Calculator ===
function calculateMarketValues() {
    if (!currentSnapshot) return;
    const inputs = document.querySelectorAll(".calc-input");
    inputs.forEach(input => {
        const cat = input.dataset.cat;
        const name = input.dataset.name;
        const field = input.dataset.field;
        const val = parseFloat(input.value);
        if (isNaN(val)) return;

        const items = currentSnapshot.assets[cat] || [];
        const item = items.find(i => i.name === name);
        if (!item) return;

        item[field] = val;
        if (cat === "bonds") {
            item.market_value = item.units * val;
        } else {
            item.market_value = item.shares * val;
        }
    });
    renderSnapshot(currentSnapshot);
}

async function saveSnapshot() {
    if (!currentSnapshot) return;
    calculateMarketValues();
    await API.update(currentSnapshot.date, currentSnapshot);
    alert("已儲存");
}
```

- [ ] **Step 2: Add Calculate + Save buttons to the toolbar in index.html**

Add after the edit button in the overview toolbar:
```html
<button id="btn-calculate">計算市值</button>
<button id="btn-save-snapshot" disabled>儲存</button>
```

- [ ] **Step 3: Wire up buttons in app.js**

```javascript
document.getElementById("btn-calculate").onclick = calculateMarketValues;
document.getElementById("btn-save-snapshot").onclick = saveSnapshot;

// Enable save button when a snapshot is loaded
// (update the snapshot-select onchange handler to also enable btn-save-snapshot)
```

- [ ] **Step 4: Manual test**

Load a snapshot with stocks/bonds → enter prices in input fields → click 計算市值 → verify market_value updates in the table → click 儲存 → refresh page → verify values persisted.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/app.js
git commit -m "feat: inline calculator with save-back to snapshot"
```

---

## Task 6: Edit / Create Snapshot Modal

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add modal form generation**

```javascript
// === Edit Modal ===
const ASSET_FIELDS = {
    deposits: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ["TWD", "USD"]},
        {key: "amount", label: "金額", type: "number"}
    ],
    insurance: [
        {key: "name", label: "名稱", type: "text"},
        {key: "type", label: "類型", type: "select", options: ["savings", "health"]},
        {key: "currency", label: "幣別", type: "select", options: ["TWD", "USD"]},
        {key: "surrender_value", label: "保單價值", type: "number"},
        {key: "annual_premium", label: "年繳保費", type: "number"},
        {key: "paid_years", label: "已繳年數", type: "number"},
        {key: "total_years", label: "總繳年數", type: "number"}
    ],
    bonds: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ["TWD", "USD"]},
        {key: "units", label: "單位數", type: "number"},
        {key: "face_value_per_unit", label: "面額/單位", type: "number"},
        {key: "coupon_rate", label: "票面利率", type: "number", step: "0.001"},
        {key: "purchase_year", label: "購買年份", type: "number"},
        {key: "maturity_year", label: "到期年份", type: "number"}
    ],
    structured_products: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ["TWD", "USD"]},
        {key: "principal", label: "本金", type: "number"},
        {key: "account_value", label: "帳戶價值", type: "number"},
        {key: "linked_to", label: "連結標的", type: "text"},
        {key: "maturity_date", label: "到期日 (YYYY-MM)", type: "text"}
    ],
    tw_stocks: [
        {key: "name", label: "名稱", type: "text"},
        {key: "shares", label: "股數", type: "number"},
        {key: "avg_cost", label: "均成本", type: "number"}
    ],
    us_stocks: [
        {key: "name", label: "名稱", type: "text"},
        {key: "shares", label: "股數", type: "number"},
        {key: "avg_cost", label: "均成本", type: "number"}
    ]
};

function openEditModal(snapshot, isNew = false) {
    const modal = document.getElementById("edit-modal");
    const body = document.getElementById("modal-body");
    const title = document.getElementById("modal-title");
    title.textContent = isNew ? "新增 Snapshot" : `編輯 ${snapshot.date}`;
    modal.style.display = "flex";

    // Build form — date, note, exchange_rates, then each asset category
    // Each category has add/remove buttons for items
    // Implementation: generate HTML form from ASSET_FIELDS config + snapshot data
    body.innerHTML = buildEditForm(snapshot);
}

function buildEditForm(snapshot) {
    const s = snapshot || {date: new Date().toISOString().slice(0, 10), note: "", exchange_rates: {USD_TWD: 32}, assets: {}};
    let html = `
        <div class="form-group"><label>日期</label><input id="edit-date" type="date" value="${s.date}"></div>
        <div class="form-group"><label>備註</label><input id="edit-note" type="text" value="${s.note || ""}"></div>
        <div class="form-group"><label>USD/TWD 匯率</label><input id="edit-rate" type="number" step="0.1" value="${s.exchange_rates?.USD_TWD || 32}"></div>
    `;

    for (const [cat, fields] of Object.entries(ASSET_FIELDS)) {
        const items = s.assets?.[cat] || [];
        html += `<div class="form-section" data-cat="${cat}">
            <div class="form-section-header"><h3>${CATEGORY_LABELS[cat]}</h3><button type="button" class="btn-add-item" onclick="addItemRow('${cat}')">+ 新增</button></div>
            <div class="item-list" id="items-${cat}">`;
        items.forEach((item, idx) => {
            html += buildItemRow(cat, fields, item, idx);
        });
        html += `</div></div>`;
    }
    return html;
}

function buildItemRow(cat, fields, item, idx) {
    let html = `<div class="form-item" data-idx="${idx}">
        <button type="button" class="btn-remove-item" onclick="this.parentElement.remove()">✕</button>`;
    for (const f of fields) {
        const val = item?.[f.key] ?? "";
        if (f.type === "select") {
            const opts = f.options.map(o => `<option value="${o}"${val === o ? " selected" : ""}>${o}</option>`).join("");
            html += `<div class="form-group" style="display:inline-block;width:auto;margin-right:0.5rem"><label>${f.label}</label><select data-key="${f.key}">${opts}</select></div>`;
        } else {
            html += `<div class="form-group" style="display:inline-block;width:auto;margin-right:0.5rem"><label>${f.label}</label><input type="${f.type}" data-key="${f.key}" value="${val}"${f.step ? ` step="${f.step}"` : ""}></div>`;
        }
    }
    html += `</div>`;
    return html;
}

function addItemRow(cat) {
    const container = document.getElementById(`items-${cat}`);
    const fields = ASSET_FIELDS[cat];
    const idx = container.children.length;
    container.insertAdjacentHTML("beforeend", buildItemRow(cat, fields, {}, idx));
}

function collectFormData() {
    const snapshot = {
        date: document.getElementById("edit-date").value,
        note: document.getElementById("edit-note").value,
        exchange_rates: {USD_TWD: parseFloat(document.getElementById("edit-rate").value)},
        assets: {}
    };
    for (const cat of Object.keys(ASSET_FIELDS)) {
        const items = [];
        const container = document.getElementById(`items-${cat}`);
        if (!container) continue;
        for (const itemDiv of container.querySelectorAll(".form-item")) {
            const item = {};
            for (const input of itemDiv.querySelectorAll("[data-key]")) {
                const key = input.dataset.key;
                const val = input.value;
                item[key] = input.type === "number" ? (val ? parseFloat(val) : null) : val;
            }
            // Set fixed currency for tw_stocks and us_stocks
            if (cat === "tw_stocks") item.currency = "TWD";
            if (cat === "us_stocks") item.currency = "USD";
            items.push(item);
        }
        snapshot.assets[cat] = items;
    }
    return snapshot;
}
```

- [ ] **Step 2: Wire up modal open/close/save**

```javascript
document.getElementById("btn-new-snapshot").onclick = () => {
    // Copy from current snapshot as template if one is loaded, but reset date to today
    if (currentSnapshot) {
        const copy = JSON.parse(JSON.stringify(currentSnapshot));
        copy.date = new Date().toISOString().slice(0, 10);
        copy.note = "";
        openEditModal(copy, true);  // true = isNew
    } else {
        openEditModal(null, true);
    }
};
document.getElementById("btn-edit-snapshot").onclick = () => openEditModal(currentSnapshot, false);
document.getElementById("modal-close").onclick = () => document.getElementById("edit-modal").style.display = "none";
document.getElementById("modal-cancel").onclick = () => document.getElementById("edit-modal").style.display = "none";

document.getElementById("modal-save").onclick = async () => {
    const data = collectFormData();
    if (!data.date) { alert("請輸入日期"); return; }
    await API.create(data);
    document.getElementById("edit-modal").style.display = "none";
    await loadSnapshotList();
    document.getElementById("snapshot-select").value = data.date;
    currentSnapshot = await API.get(data.date);
    document.getElementById("btn-edit-snapshot").disabled = false;
    document.getElementById("btn-save-snapshot").disabled = false;
    renderSnapshot(currentSnapshot);
};
```

- [ ] **Step 3: Manual test**

Click 新增 → fill form → save → verify snapshot appears in dropdown and renders correctly.
Click 編輯 → modify a value → save → verify change persisted.

- [ ] **Step 4: Commit**

```bash
git add web/app.js web/index.html
git commit -m "feat: edit/create snapshot modal with form generation"
```

---

## Task 7: Snapshot Comparison

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add comparison logic**

```javascript
// === Comparison ===
function compareSnapshots(a, b) {
    const rate_a = a.exchange_rates?.USD_TWD || 32;
    const rate_b = b.exchange_rates?.USD_TWD || 32;
    const container = document.getElementById("compare-content");
    container.innerHTML = `<h2>${a.date} vs ${b.date}</h2>`;

    const categories = Object.keys(CATEGORY_LABELS);
    for (const cat of categories) {
        const itemsA = a.assets?.[cat] || [];
        const itemsB = b.assets?.[cat] || [];
        if (itemsA.length === 0 && itemsB.length === 0) continue;

        const div = document.createElement("div");
        div.className = "compare-category";
        div.innerHTML = `<h3>${CATEGORY_LABELS[cat]}</h3>`;

        const table = document.createElement("table");
        table.className = "asset-table";
        table.innerHTML = `<thead><tr><th>名稱</th><th>${a.date}</th><th>${b.date}</th><th>變化</th><th>%</th></tr></thead>`;

        const tbody = document.createElement("tbody");
        const namesA = new Set(itemsA.map(i => i.name));
        const namesB = new Set(itemsB.map(i => i.name));
        const allNames = [...new Set([...namesA, ...namesB])];

        for (const name of allNames) {
            const itemA = itemsA.find(i => i.name === name);
            const itemB = itemsB.find(i => i.name === name);
            const valA = itemA ? getAssetValue(cat, itemA) : 0;
            const valB = itemB ? getAssetValue(cat, itemB) : 0;
            const currency = (itemA || itemB).currency;
            const delta = valB - valA;
            const pct = valA !== 0 ? ((delta / valA) * 100).toFixed(1) + "%" : "—";

            const tr = document.createElement("tr");
            const deltaClass = !itemA ? "delta-new" : !itemB ? "delta-removed" : delta >= 0 ? "delta-positive" : "delta-negative";
            const sign = delta >= 0 ? "+" : "";

            tr.innerHTML = `<td class="${!itemA ? "delta-new" : !itemB ? "delta-removed" : ""}">${name}</td>
                <td>${itemA ? formatMoney(valA, currency) : "—"}</td>
                <td>${itemB ? formatMoney(valB, currency) : "—"}</td>
                <td class="${deltaClass}">${sign}${formatMoney(Math.abs(delta), currency)}</td>
                <td class="${deltaClass}">${pct}</td>`;
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        div.appendChild(table);
        container.appendChild(div);
    }
}

document.getElementById("btn-compare").onclick = async () => {
    const dateA = document.getElementById("compare-a").value;
    const dateB = document.getElementById("compare-b").value;
    if (!dateA || !dateB) { alert("請選擇兩個 Snapshot"); return; }
    const [a, b] = await Promise.all([API.get(dateA), API.get(dateB)]);
    compareSnapshots(a, b);
};
```

- [ ] **Step 2: Manual test**

Create two snapshots with slightly different values. Go to 比較 tab, select both, click 比較. Verify deltas and percentages display correctly, new/removed assets highlighted.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: snapshot comparison with delta and percentage"
```

---

## Task 8: Time Series Chart

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: Add chart rendering**

```javascript
// === Time Series Chart ===
let trendChart = null;
let chartCurrencyMode = "twd";

document.querySelectorAll(".chart-cur-btn").forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll(".chart-cur-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        chartCurrencyMode = this.dataset.mode;
        renderChart();
    };
});

async function renderChart() {
    const list = await API.list();
    if (list.length === 0) return;

    const snapshots = await Promise.all(list.map(item => API.get(item.date)));
    const labels = snapshots.map(s => s.date);

    const datasets = [];

    if (chartCurrencyMode === "original") {
        // Two lines: total TWD + total USD
        const twdData = snapshots.map(s => {
            const rate = s.exchange_rates?.USD_TWD || 32;
            let total = 0;
            for (const [cat, items] of Object.entries(s.assets || {})) {
                for (const item of items) {
                    if (item.currency === "TWD") total += getAssetValue(cat, item);
                }
            }
            return total;
        });
        const usdData = snapshots.map(s => {
            let total = 0;
            for (const [cat, items] of Object.entries(s.assets || {})) {
                for (const item of items) {
                    if (item.currency === "USD") total += getAssetValue(cat, item);
                }
            }
            return total;
        });
        datasets.push(
            {label: "TWD 資產 (NT$)", data: twdData, borderColor: "#e74c3c", yAxisID: "y-twd"},
            {label: "USD 資產 (US$)", data: usdData, borderColor: "#2980b9", yAxisID: "y-usd"}
        );
    } else {
        // Single line
        const currency = chartCurrencyMode.toUpperCase();
        const data = snapshots.map(s => {
            const rate = s.exchange_rates?.USD_TWD || 32;
            let total = 0;
            for (const [cat, items] of Object.entries(s.assets || {})) {
                for (const item of items) {
                    const val = getAssetValue(cat, item);
                    total += convertValue(val, item.currency, chartCurrencyMode, rate).value;
                }
            }
            return total;
        });
        datasets.push({
            label: `總資產 (${currency === "TWD" ? "NT$" : "US$"})`,
            data, borderColor: "#2c3e50", fill: false
        });
    }

    if (trendChart) trendChart.destroy();

    const config = {
        type: "line",
        data: {labels, datasets},
        options: {
            responsive: true,
            scales: chartCurrencyMode === "original" ? {
                "y-twd": {type: "linear", position: "left", title: {display: true, text: "NT$"}},
                "y-usd": {type: "linear", position: "right", title: {display: true, text: "US$"}, grid: {drawOnChartArea: false}}
            } : {
                y: {beginAtZero: false}
            }
        }
    };

    trendChart = new Chart(document.getElementById("trend-chart"), config);
}

// Render chart when switching to chart view
document.getElementById("nav-chart").addEventListener("click", renderChart);
```

- [ ] **Step 2: Manual test**

Create 3+ snapshots with different dates. Switch to 趨勢 tab. Verify:
- TWD mode: single line
- USD mode: single line
- 原幣 mode: two lines with dual Y-axis

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: time series chart with multi-currency modes"
```

---

## Task 9: Final Polish + Sample Data

**Files:**
- Create: `data/snapshots/2026-03-17.json` (sample data for testing)

- [ ] **Step 1: Create sample snapshot with realistic data**

```json
{
  "date": "2026-03-17",
  "note": "範例資料",
  "exchange_rates": {"USD_TWD": 32.5},
  "assets": {
    "deposits": [
      {"name": "台銀活存", "currency": "TWD", "amount": 500000},
      {"name": "郵局", "currency": "TWD", "amount": 200000}
    ],
    "insurance": [
      {"name": "美元儲蓄險", "type": "savings", "currency": "USD", "surrender_value": 15000, "annual_premium": 3000, "paid_years": 3, "total_years": 6},
      {"name": "重大傷病險", "type": "health", "currency": "TWD", "annual_premium": 25000}
    ],
    "bonds": [
      {"name": "A銀行債券", "currency": "USD", "units": 10, "face_value_per_unit": 1000, "coupon_rate": 0.045, "purchase_year": 2024, "maturity_year": 2029}
    ],
    "structured_products": [
      {"name": "B銀行結構型商品", "currency": "USD", "principal": 20000, "account_value": 19500, "linked_to": "S&P500", "maturity_date": "2027-06"}
    ],
    "tw_stocks": [
      {"name": "2330 台積電", "currency": "TWD", "shares": 10, "avg_cost": 580}
    ],
    "us_stocks": [
      {"name": "VOO", "currency": "USD", "shares": 5, "avg_cost": 480}
    ]
  }
}
```

- [ ] **Step 2: Full manual smoke test**

Start server: `cd server && python app.py`
Open http://localhost:5000

Test checklist:
1. Snapshot loads in dropdown and renders all categories
2. Currency toggle works (原幣 / TWD / USD)
3. Enter stock prices → 計算市值 → values update → 儲存 → refresh → values persist
4. 新增 snapshot → fill form → save → appears in dropdown
5. 編輯 existing snapshot → modify → save → changes reflect
6. 比較 tab → select two snapshots → compare → deltas show correctly
7. 趨勢 tab → chart renders with all three currency modes

- [ ] **Step 3: Commit**

```bash
git add data/snapshots/2026-03-17.json
git commit -m "feat: add sample snapshot data"
```

- [ ] **Step 4: Final commit — all done**

```bash
git add -A
git commit -m "feat: asset tracker webapp complete"
```
