# Cash Flow-Aware Performance Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cash flow event tracking and Modified Dietz performance attribution so the compare view fairly accounts for income/expenses when benchmarking against strategies.

**Architecture:** Backend gets a new `cashflows.json` CRUD API (same pattern as snapshots). Frontend fetches cash flows when comparing, uses Modified Dietz formula to calculate actual return excluding cash flows, and adjusts strategy benchmarks to use the same cash flows. No new pages — everything integrates into the existing compare view.

**Tech Stack:** Flask (backend), Vanilla JS (frontend), pytest (tests)

**Spec:** `docs/superpowers/specs/2026-03-18-hypothetical-comparison-design.md` (Phase 2 section)

---

## File Structure

| File | Responsibility | Changes |
|------|---------------|---------|
| `server/app.py` | Flask API | Add cashflows CRUD endpoints (GET/POST/PUT/DELETE) |
| `server/test_app.py` | Backend tests | Add tests for cashflows API |
| `web/app.js` | Frontend logic | Add cashflow API client, Modified Dietz calculation, update `renderCompareGrandTotal()` |
| `web/index.html` | HTML | No changes needed (grand total container already exists) |
| `web/style.css` | Styling | Minor: style for cashflow info row in grand total |

---

### Task 1: Backend — Cashflows CRUD API with tests

**Files:**
- Modify: `server/app.py:12-84` (add cashflows endpoints inside `create_app`)
- Modify: `server/test_app.py` (add cashflow tests)

- [ ] **Step 1: Write failing tests for cashflows API**

Add to `server/test_app.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && python -m pytest test_app.py -v -k cashflow`
Expected: All cashflow tests FAIL (404 since endpoints don't exist)

- [ ] **Step 3: Implement cashflows API in app.py**

In `server/app.py`, add the following inside `create_app()`, after `os.makedirs(snapshots_dir, exist_ok=True)` (line 13):

```python
    cashflows_file = os.path.join(data_dir, "cashflows.json")

    def _load_cashflows():
        if not os.path.exists(cashflows_file):
            return []
        with open(cashflows_file, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def _save_cashflows(data):
        with open(cashflows_file, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
```

Then add these routes before `return app` (before line 85):

```python
    @app.route("/api/cashflows", methods=["GET"])
    def list_cashflows():
        return jsonify(_load_cashflows())

    @app.route("/api/cashflows", methods=["POST"])
    def create_cashflow():
        data = request.get_json()
        if not data or "date" not in data or "amount" not in data:
            return jsonify({"error": "Missing date or amount"}), 400
        flows = _load_cashflows()
        entry = {"id": len(flows), "date": data["date"], "amount": data["amount"], "note": data.get("note", "")}
        flows.append(entry)
        _save_cashflows(flows)
        return jsonify(entry), 201

    @app.route("/api/cashflows/<int:idx>", methods=["PUT"])
    def update_cashflow(idx):
        flows = _load_cashflows()
        if idx < 0 or idx >= len(flows):
            return jsonify({"error": "Not found"}), 404
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing body"}), 400
        flows[idx] = {"id": idx, "date": data.get("date", flows[idx]["date"]),
                       "amount": data.get("amount", flows[idx]["amount"]),
                       "note": data.get("note", flows[idx].get("note", ""))}
        _save_cashflows(flows)
        return jsonify(flows[idx])

    @app.route("/api/cashflows/<int:idx>", methods=["DELETE"])
    def delete_cashflow(idx):
        flows = _load_cashflows()
        if idx < 0 or idx >= len(flows):
            return jsonify({"error": "Not found"}), 404
        flows.pop(idx)
        # Re-index
        for i, f in enumerate(flows):
            f["id"] = i
        _save_cashflows(flows)
        return jsonify({"ok": True})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && python -m pytest test_app.py -v`
Expected: All tests pass (both existing snapshot tests and new cashflow tests)

- [ ] **Step 5: Commit**

```bash
git add server/app.py server/test_app.py
git commit -m "feat: add cashflows CRUD API with tests"
```

---

### Task 2: Frontend — Cashflows API client and Modified Dietz calculation

**Files:**
- Modify: `web/app.js` (add API methods, Modified Dietz function, update grand total rendering)

- [ ] **Step 1: Add cashflows to the API object**

In `web/app.js`, inside the `API` object (after the `remove` method, around line 36), add:

```javascript
    async listCashflows() {
        const resp = await fetch("/api/cashflows");
        return resp.json();
    },
    async createCashflow(cf) {
        const resp = await fetch("/api/cashflows", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(cf)
        });
        if (!resp.ok) throw new Error((await resp.json()).error || "Create failed");
        return resp.json();
    },
    async updateCashflow(id, cf) {
        const resp = await fetch(`/api/cashflows/${id}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(cf)
        });
        if (!resp.ok) throw new Error((await resp.json()).error || "Update failed");
        return resp.json();
    },
    async deleteCashflow(id) {
        const resp = await fetch(`/api/cashflows/${id}`, {method: "DELETE"});
        if (!resp.ok) throw new Error((await resp.json()).error || "Delete failed");
        return resp.json();
    }
```

- [ ] **Step 2: Add Modified Dietz calculation function**

Add after `checkMissingRates` function (around line 1023):

```javascript
function calcModifiedDietz(vStart, vEnd, cashflows, startDate, endDate) {
    const totalDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) return {return: 0, netFlow: 0, investmentGain: 0};

    let netFlow = 0;
    let weightedFlow = 0;
    for (const cf of cashflows) {
        const cfDate = new Date(cf.date);
        const daysSinceStart = (cfDate - new Date(startDate)) / (1000 * 60 * 60 * 24);
        const weight = (totalDays - daysSinceStart) / totalDays;
        netFlow += cf.amount;
        weightedFlow += cf.amount * weight;
    }

    const investmentGain = vEnd - vStart - netFlow;
    const denominator = vStart + weightedFlow;
    const mdReturn = denominator !== 0 ? investmentGain / denominator : 0;
    const annualized = Math.pow(1 + mdReturn, 365 / totalDays) - 1;

    return {return: mdReturn, annualized, netFlow, investmentGain};
}

function calcStrategyWithCashflows(vStart, cashflows, strategy, startDate, endDate) {
    const totalDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) return vStart;

    // Start with principal growing from start to end
    let result = calculateStrategy(vStart, strategy, totalDays);

    // Each cash flow grows from its date to end date
    for (const cf of cashflows) {
        const cfDate = new Date(cf.date);
        const remainingDays = (new Date(endDate) - cfDate) / (1000 * 60 * 60 * 24);
        if (remainingDays > 0 && cf.amount > 0) {
            result += calculateStrategy(cf.amount, strategy, remainingDays);
        } else if (cf.amount < 0) {
            // Withdrawal: less capital earning returns
            result += cf.amount; // negative, so subtracts
        }
    }
    return result;
}
```

- [ ] **Step 3: Update renderCompareGrandTotal to use cashflows**

Replace the `renderCompareGrandTotal` function signature and the strategy calculation block. The function now receives cashflows and uses Modified Dietz.

Find `function renderCompareGrandTotal(container, totalA, totalB, snapA, snapB, missingRates)` and replace the entire function with:

```javascript
async function renderCompareGrandTotal(container, totalA, totalB, snapA, snapB, missingRates) {
    const strategies = collectStrategies();
    const days = (new Date(snapB.date) - new Date(snapA.date)) / (1000 * 60 * 60 * 24);

    // Fetch cashflows for this period
    let allCashflows = [];
    try {
        allCashflows = await API.listCashflows();
    } catch (e) { /* no cashflows file yet, that's fine */ }
    const periodCashflows = allCashflows.filter(cf => cf.date > snapA.date && cf.date <= snapB.date);

    // Modified Dietz actual return
    const md = calcModifiedDietz(totalA, totalB, periodCashflows, snapA.date, snapB.date);

    const totalLabel = disguised ? "Grand Total" : "總計 (TWD)";
    const delta = totalB - totalA;
    const deltaClass = md.investmentGain >= 0 ? "delta-positive" : "delta-negative";

    // Strategy calculations
    let strategyError = null;
    let strategyResults = [];

    if (strategies.length > 0) {
        if (days <= 0) {
            strategyError = disguised ? "Snapshot A must be before Snapshot B" : "Snapshot A 必須早於 Snapshot B 才能計算假設策略";
        } else {
            const missingRatesList = checkMissingRates(snapA);
            if (missingRatesList.length > 0) {
                strategyError = (disguised ? "Missing exchange rate: " : "缺少匯率: ") + missingRatesList.join(", ");
            } else {
                strategyResults = strategies.map(s => {
                    const endVal = calcStrategyWithCashflows(totalA, periodCashflows, s, snapA.date, snapB.date);
                    const sGain = endVal - totalA - md.netFlow;
                    return {name: s.name, endVal, gain: sGain};
                });
            }
        }
    }

    // Build display
    const div = document.createElement("div");
    div.className = "compare-grand-total";

    // Actual return row
    const sign = md.investmentGain >= 0 ? "+" : "";
    const annPct = days > 0 ? (md.annualized * 100).toFixed(1) + "%" : "—";

    let strategyHeaders = "";
    let strategyCells = "";
    if (!disguised && strategyResults.length > 0) {
        for (const sr of strategyResults) {
            strategyHeaders += `<th>${sr.name}</th>`;
            const sSign = sr.gain >= 0 ? "+" : "";
            const sEndMd = calcModifiedDietz(totalA, sr.endVal, periodCashflows, snapA.date, snapB.date);
            const sAnnPct = days > 0 ? (sEndMd.annualized * 100).toFixed(1) + "%" : "—";
            const sDeltaClass = sr.gain >= 0 ? "delta-positive" : "delta-negative";
            strategyCells += `<td class="${sDeltaClass}">${formatMoney(sr.endVal, "TWD")}<br><small>${sSign}${formatMoney(Math.abs(sr.gain), "TWD")} (${sAnnPct})</small></td>`;
        }
    }

    const hdrA = disguised ? "Season " + snapA.date : snapA.date;
    const hdrB = disguised ? "Season " + snapB.date : snapB.date;
    const netFlowLabel = disguised ? "Net Flow" : "淨流入";
    const gainLabel = disguised ? "Return" : "投資報酬";
    const annLabel = disguised ? "Ann." : "年化";

    div.innerHTML = `
        <table class="asset-table grand-total-table">
            <thead><tr>
                <th></th><th>${hdrA}</th><th>${hdrB}</th>
                <th>${netFlowLabel}</th><th>${gainLabel}</th><th>${annLabel}</th>
                ${strategyHeaders}
            </tr></thead>
            <tbody><tr class="subtotal-row">
                <td>${totalLabel}</td>
                <td>${formatMoney(totalA, "TWD")}</td>
                <td>${formatMoney(totalB, "TWD")}</td>
                <td>${formatMoney(md.netFlow, "TWD")}</td>
                <td class="${deltaClass}">${sign}${formatMoney(Math.abs(md.investmentGain), "TWD")}</td>
                <td class="${deltaClass}">${annPct}</td>
                ${strategyCells}
            </tr></tbody>
        </table>`;

    if (periodCashflows.length > 0 && !disguised) {
        const cfList = periodCashflows.map(cf => {
            const s = cf.amount >= 0 ? "+" : "";
            return `${cf.date}: ${s}${formatMoney(Math.abs(cf.amount), "TWD")}${cf.note ? " (" + cf.note + ")" : ""}`;
        }).join("<br>");
        const cfDiv = document.createElement("div");
        cfDiv.className = "cashflow-details";
        cfDiv.innerHTML = `<small>期間現金流事件：<br>${cfList}</small>`;
        div.appendChild(cfDiv);
    }

    if (missingRates && missingRates.size > 0) {
        const warnDiv = document.createElement("div");
        warnDiv.className = "strategy-warning";
        const label = disguised ? "Total excludes some assets (missing rates: " : "總計不含部分資產（缺少匯率: ";
        warnDiv.textContent = label + [...missingRates].join(", ") + ")";
        div.appendChild(warnDiv);
    }

    if (strategyError) {
        const errDiv = document.createElement("div");
        errDiv.className = "strategy-error";
        errDiv.textContent = strategyError;
        div.appendChild(errDiv);
    }

    container.appendChild(div);
}
```

- [ ] **Step 4: Update compareSnapshots to await the now-async renderCompareGrandTotal**

In `compareSnapshots`, find the line (around line 1143):
```javascript
    renderCompareGrandTotal(grandTotalContainer, grandTotalA_TWD, grandTotalB_TWD, a, b, allMissing);
```
Change to:
```javascript
    await renderCompareGrandTotal(grandTotalContainer, grandTotalA_TWD, grandTotalB_TWD, a, b, allMissing);
```

Also change the function signature from `function compareSnapshots(a, b)` to `async function compareSnapshots(a, b)`.

- [ ] **Step 5: Add CSS for cashflow details**

At the end of `web/style.css`, add:

```css
.cashflow-details { padding: 0.5rem 0; font-size: 0.85rem; color: #666; line-height: 1.6; }
```

- [ ] **Step 6: Commit**

```bash
git add web/app.js web/style.css
git commit -m "feat: add Modified Dietz calculation and cashflow-aware grand total"
```

---

### Task 3: Cashflow management UI

**Files:**
- Modify: `web/app.js` (add cashflow CRUD UI functions)
- Modify: `web/index.html` (add cashflow management section)
- Modify: `web/style.css` (cashflow UI styling)

- [ ] **Step 1: Add cashflow management section to HTML**

In `web/index.html`, find the Chart View section (`<!-- Chart View -->`). Add a new section BEFORE it:

```html
        <!-- Cashflow View -->
        <section id="view-cashflow" style="display:none">
            <div class="toolbar">
                <h2>現金流事件</h2>
                <button id="btn-add-cashflow">+ 新增事件</button>
            </div>
            <div id="cashflow-list"></div>
        </section>
```

- [ ] **Step 2: Add nav button for cashflow view**

In `web/index.html`, find the nav buttons. Add after the 趨勢 button:

```html
            <button id="nav-cashflow" class="nav-btn">現金流</button>
```

- [ ] **Step 3: Update navigation in app.js**

Change the `views` array (line 40) from:
```javascript
const views = ["overview", "compare", "chart"];
```
to:
```javascript
const views = ["overview", "compare", "chart", "cashflow"];
```

Add after the chart nav handler:
```javascript
document.getElementById("nav-cashflow").onclick = () => {
    switchView("cashflow");
    renderCashflowList();
};
```

- [ ] **Step 4: Add cashflow list rendering and CRUD functions**

Add before `// === Time Series Chart ===`:

```javascript
// === Cashflow Management ===
async function renderCashflowList() {
    const container = document.getElementById("cashflow-list");
    container.innerHTML = "";
    if (disguised) {
        container.textContent = "Locked";
        document.getElementById("btn-add-cashflow").style.display = "none";
        return;
    }
    document.getElementById("btn-add-cashflow").style.display = "";

    let flows = [];
    try { flows = await API.listCashflows(); } catch(e) {}

    if (flows.length === 0) {
        container.innerHTML = "<p style='color:#999'>尚無現金流事件。點「+ 新增事件」來記錄收入或支出。</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "asset-table";
    table.innerHTML = `<thead><tr><th>日期</th><th>金額</th><th>備註</th><th></th></tr></thead>`;
    const tbody = document.createElement("tbody");

    for (const cf of flows) {
        const tr = document.createElement("tr");
        const amtClass = cf.amount >= 0 ? "delta-positive" : "delta-negative";
        const sign = cf.amount >= 0 ? "+" : "";
        tr.innerHTML = `
            <td>${cf.date}</td>
            <td class="${amtClass}">${sign}${formatMoney(Math.abs(cf.amount), "TWD")}</td>
            <td>${cf.note || ""}</td>
            <td>
                <button class="btn-edit-cf" data-id="${cf.id}">編輯</button>
                <button class="btn-remove-row" data-id="${cf.id}">✕</button>
            </td>`;
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    container.querySelectorAll(".btn-remove-row").forEach(btn => {
        btn.onclick = async () => {
            if (!confirm("確定刪除？")) return;
            await API.deleteCashflow(parseInt(btn.dataset.id));
            renderCashflowList();
        };
    });

    container.querySelectorAll(".btn-edit-cf").forEach(btn => {
        btn.onclick = () => {
            const cf = flows.find(f => f.id === parseInt(btn.dataset.id));
            if (cf) showCashflowModal(cf);
        };
    });
}

function showCashflowModal(existing) {
    const isEdit = !!existing;
    const date = existing?.date || new Date().toISOString().slice(0, 10);
    const amount = existing?.amount || "";
    const note = existing?.note || "";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h2>${isEdit ? "編輯" : "新增"}現金流事件</h2>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div style="padding:1rem">
                <div class="form-group"><label>日期</label><input id="cf-date" type="date" value="${date}"></div>
                <div class="form-group"><label>金額（正=流入，負=流出）</label><input id="cf-amount" type="number" value="${amount}"></div>
                <div class="form-group"><label>備註</label><input id="cf-note" type="text" value="${note}" placeholder="年度收入、繳稅..."></div>
            </div>
            <div class="modal-footer">
                <button id="cf-save">${isEdit ? "更新" : "新增"}</button>
                <button id="cf-cancel">取消</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector(".modal-close-btn").onclick = close;
    modal.querySelector("#cf-cancel").onclick = close;
    modal.querySelector("#cf-save").onclick = async () => {
        const d = document.getElementById("cf-date").value;
        const a = parseFloat(document.getElementById("cf-amount").value);
        const n = document.getElementById("cf-note").value;
        if (!d || isNaN(a)) { alert("請填入日期和金額"); return; }
        try {
            if (isEdit) {
                await API.updateCashflow(existing.id, {date: d, amount: a, note: n});
            } else {
                await API.createCashflow({date: d, amount: a, note: n});
            }
            close();
            renderCashflowList();
        } catch (e) { alert("儲存失敗: " + e.message); }
    };
}

document.getElementById("btn-add-cashflow").onclick = () => showCashflowModal(null);
```

- [ ] **Step 5: Update disguise toggle for cashflow nav**

In the `werwer` disguise toggle block, add with the other button relabeling:

```javascript
document.getElementById("nav-cashflow").textContent = disguised ? "Events" : "現金流";
if (document.getElementById("view-cashflow").style.display !== "none") {
    renderCashflowList();
}
```

- [ ] **Step 6: Add CSS for cashflow UI**

At the end of `web/style.css`, add:

```css
.btn-edit-cf { font-size: 0.75rem; padding: 0.1rem 0.4rem; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer; margin-right: 0.3rem; }
```

- [ ] **Step 7: Commit**

```bash
git add web/app.js web/index.html web/style.css
git commit -m "feat: add cashflow management UI with CRUD operations"
```

---

### Task 4: Run tests and manual verification

**Files:** None (verification only)

- [ ] **Step 1: Run backend tests**

```bash
cd server && python -m pytest test_app.py -v
```

Expected: All tests pass (snapshot tests + cashflow tests).

- [ ] **Step 2: Manual walkthrough**

1. Start app, go to **現金流** tab
2. Add a cashflow event: 2026-08-15, +9000000, "年度收入"
3. Add another: 2026-05-20, -3200000, "繳稅"
4. Verify list renders with correct amounts and colors
5. Edit one event, verify it updates
6. Go to **比較** tab, select two snapshots
7. Add a 2% 定存 strategy, click 比較
8. Verify grand total shows: 淨流入、投資報酬、年化、strategy result
9. Verify cashflow events listed below grand total
10. Toggle disguise (werwer) — cashflow tab shows "Locked", events hidden
11. Go to Overview and Chart — no regression
