# Hypothetical Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add category subtotals, grand totals, currency toggle, and hypothetical strategy benchmarks to the Compare view.

**Architecture:** All changes are client-side. Strategy calculation is extracted into pure functions. The existing `compareSnapshots()` function is rewritten to support currency conversion, subtotals, grand totals, and strategy result columns. Strategy UI is dynamically built in JS.

**Tech Stack:** Vanilla JS, HTML, CSS (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-18-hypothetical-comparison-design.md`

---

## File Structure

| File | Responsibility | Changes |
|------|---------------|---------|
| `web/index.html` | Compare view HTML structure | Add currency toggle, strategy container, grand total container |
| `web/app.js` | All application logic | Add strategy calculation functions, strategy UI builder, rewrite `compareSnapshots()`, add compare currency toggle handler |
| `web/style.css` | Styling | Add styles for strategy inputs, subtotal rows, grand total block |

---

### Task 1: Add currency toggle to Compare view HTML

**Files:**
- Modify: `web/index.html:38-45` (compare view section)
- Modify: `web/app.js:50-51` (compare nav handler)

- [ ] **Step 1: Add currency toggle buttons and containers to compare view HTML**

In `web/index.html`, replace the compare view section (lines 38-45):

```html
<!-- Compare View -->
<section id="view-compare" style="display:none">
    <div class="toolbar">
        <select id="compare-a"><option value="">Snapshot A...</option></select>
        <select id="compare-b"><option value="">Snapshot B...</option></select>
        <div class="currency-toggle">
            <button class="compare-cur-btn active" data-mode="original">原幣</button>
            <button class="compare-cur-btn" data-mode="twd">TWD</button>
            <button class="compare-cur-btn" data-mode="usd">USD</button>
        </div>
    </div>
    <div id="compare-strategies" style="display:none"></div>
    <div class="toolbar">
        <button id="btn-compare">比較</button>
    </div>
    <div id="compare-content"></div>
    <div id="compare-grand-total"></div>
</section>
```

Note: The compare button is placed in its own toolbar below the strategy section, matching the spec layout: selectors → strategies → compare button → results.

- [ ] **Step 2: Add compare currency mode state and toggle handler in app.js**

In `web/app.js`, add new state variables immediately after `let disguised = true;` (line 57), in this exact order:

```javascript
let compareCurrencyMode = "original";
let lastCompareA = null;
let lastCompareB = null;
```

Then, immediately after the existing `document.getElementById("nav-chart").onclick = ...` line (line 51), add the currency toggle handler:

```javascript
document.querySelectorAll(".compare-cur-btn").forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll(".compare-cur-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        compareCurrencyMode = this.dataset.mode;
        // Re-render if comparison is already showing
        if (lastCompareA && lastCompareB) compareSnapshots(lastCompareA, lastCompareB);
    };
});
```

Note: `compareSnapshots` is defined later in the file but this works because the handler runs at click-time, not at definition-time.

- [ ] **Step 3: Update disguise mode to relabel compare currency buttons**

In the secret key sequence listener, find the closing `}` of the `if (keyBuffer.endsWith("werwer"))` block (line 139). Add the following **inside** that block, right before the closing `}`, at the same level as `keyBuffer = "";` and `loadSnapshotList().then(...)`:

```javascript
document.querySelectorAll(".compare-cur-btn").forEach(btn => {
    if (btn.dataset.mode === "original") btn.textContent = disguised ? "Split" : "原幣";
    if (btn.dataset.mode === "twd") btn.textContent = disguised ? "Gold" : "TWD";
    if (btn.dataset.mode === "usd") btn.textContent = disguised ? "Diamond" : "USD";
});
```

- [ ] **Step 4: Add CSS for compare currency toggle**

In `web/style.css`, add:

```css
.compare-cur-btn { border-radius: 0; border-right: none; }
.compare-cur-btn:first-child { border-radius: 4px 0 0 4px; }
.compare-cur-btn:last-child { border-radius: 0 4px 4px 0; border-right: 1px solid #ccc; }
.compare-cur-btn.active { background: #2c3e50; color: white; border-color: #2c3e50; }
```

- [ ] **Step 5: Verify** - Start the app (`cd server && python app.py`), go to Compare tab, confirm currency toggle buttons appear. They don't do anything yet but should render correctly.

- [ ] **Step 6: Commit**

```bash
git add web/index.html web/app.js web/style.css
git commit -m "feat: add currency toggle to compare view"
```

---

### Task 2: Rewrite compareSnapshots() with currency conversion and subtotals

**Files:**
- Modify: `web/app.js:751-811` (compareSnapshots function and btn-compare handler)

- [ ] **Step 1: Rewrite compareSnapshots() to support currency conversion and subtotals**

Replace the entire `compareSnapshots` function and `btn-compare` handler (lines 751-811) with:

```javascript
function compareSnapshots(a, b) {
    lastCompareA = a;
    lastCompareB = b;

    const container = document.getElementById("compare-content");
    const grandTotalContainer = document.getElementById("compare-grand-total");
    const hdrA = disguised ? `Season ${a.date}` : a.date;
    const hdrB = disguised ? `Season ${b.date}` : b.date;
    container.innerHTML = `<h2>${hdrA} vs ${hdrB}</h2>`;
    grandTotalContainer.innerHTML = "";

    const nameLabel = disguised ? "Item" : "名稱";
    const deltaLabel = disguised ? "Delta" : "變化";
    const subtotalLabel = disguised ? "Subtotal" : "小計";

    const ratesA = a.exchange_rates || {};
    const ratesB = b.exchange_rates || {};
    const mode = compareCurrencyMode;

    // Track grand totals (always in TWD for strategy comparison)
    let grandTotalA_TWD = 0;
    let grandTotalB_TWD = 0;
    const missingRatesA = new Set();
    const missingRatesB = new Set();

    const categories = Object.keys(CATEGORY_LABELS);
    for (const cat of categories) {
        const itemsA = a.assets?.[cat] || [];
        const itemsB = b.assets?.[cat] || [];
        if (itemsA.length === 0 && itemsB.length === 0) continue;

        const div = document.createElement("div");
        div.className = "compare-category";
        div.innerHTML = `<h3>${disguiseLabel(cat)}</h3>`;

        const table = document.createElement("table");
        table.className = "asset-table";
        table.innerHTML = `<thead><tr><th>${nameLabel}</th><th>${hdrA}</th><th>${hdrB}</th><th>${deltaLabel}</th><th>%</th></tr></thead>`;

        const tbody = document.createElement("tbody");
        const allNames = [...new Set([...itemsA.map(i => i.name), ...itemsB.map(i => i.name)])];

        // Track subtotals by currency
        const subtotalA = {};  // currency -> value
        const subtotalB = {};

        for (let i = 0; i < allNames.length; i++) {
            const name = allNames[i];
            const itemA = itemsA.find(it => it.name === name);
            const itemB = itemsB.find(it => it.name === name);
            const rawValA = itemA ? getAssetValue(cat, itemA) : 0;
            const rawValB = itemB ? getAssetValue(cat, itemB) : 0;
            const origCurrency = (itemA || itemB).currency || "TWD";

            // Accumulate TWD grand totals (always, regardless of display mode)
            const rateA = getRate(ratesA, origCurrency);
            const rateB = getRate(ratesB, origCurrency);
            if (rateA == null && origCurrency !== "TWD") missingRatesA.add(`${origCurrency}_TWD`);
            if (rateB == null && origCurrency !== "TWD") missingRatesB.add(`${origCurrency}_TWD`);
            grandTotalA_TWD += rawValA * (rateA || 0);
            grandTotalB_TWD += rawValB * (rateB || 0);

            // Convert for display
            const convA = convertValue(rawValA, origCurrency, mode, ratesA);
            const convB = convertValue(rawValB, origCurrency, mode, ratesB);
            const displayCurrency = convA.currency;

            // Accumulate subtotals in display currency
            const subKey = displayCurrency;
            subtotalA[subKey] = (subtotalA[subKey] || 0) + convA.value;
            subtotalB[subKey] = (subtotalB[subKey] || 0) + convB.value;

            const delta = convB.value - convA.value;
            const pct = convA.value !== 0 ? ((delta / convA.value) * 100).toFixed(1) + "%" : "—";

            const tr = document.createElement("tr");
            const deltaClass = !itemA ? "delta-new" : !itemB ? "delta-removed" : delta >= 0 ? "delta-positive" : "delta-negative";
            const sign = delta >= 0 ? "+" : "";
            const dName = disguiseName(name, cat, i);

            tr.innerHTML = `<td class="${!itemA ? "delta-new" : !itemB ? "delta-removed" : ""}">${dName}</td>
                <td>${itemA ? formatMoney(convA.value, displayCurrency) : "—"}</td>
                <td>${itemB ? formatMoney(convB.value, displayCurrency) : "—"}</td>
                <td class="${deltaClass}">${sign}${formatMoney(Math.abs(delta), displayCurrency)}</td>
                <td class="${deltaClass}">${pct}</td>`;
            tbody.appendChild(tr);
        }

        // Subtotal rows
        const currencies = Object.keys(subtotalA).concat(Object.keys(subtotalB));
        const uniqueCurrencies = [...new Set(currencies)];
        for (const cur of uniqueCurrencies) {
            const sA = subtotalA[cur] || 0;
            const sB = subtotalB[cur] || 0;
            const sDelta = sB - sA;
            const sPct = sA !== 0 ? ((sDelta / sA) * 100).toFixed(1) + "%" : "—";
            const sSign = sDelta >= 0 ? "+" : "";
            const sDeltaClass = sDelta >= 0 ? "delta-positive" : "delta-negative";

            const subRow = document.createElement("tr");
            subRow.className = "subtotal-row";
            const curLabel = uniqueCurrencies.length > 1 && mode === "original" ? ` (${disguiseCurrency(cur)})` : "";
            subRow.innerHTML = `<td>${subtotalLabel}${curLabel}</td>
                <td>${formatMoney(sA, cur)}</td>
                <td>${formatMoney(sB, cur)}</td>
                <td class="${sDeltaClass}">${sSign}${formatMoney(Math.abs(sDelta), cur)}</td>
                <td class="${sDeltaClass}">${sPct}</td>`;
            tbody.appendChild(subRow);
        }

        table.appendChild(tbody);
        div.appendChild(table);
        container.appendChild(div);
    }

    // Grand total block
    const allMissing = new Set([...missingRatesA, ...missingRatesB]);
    renderCompareGrandTotal(grandTotalContainer, grandTotalA_TWD, grandTotalB_TWD, a, b, allMissing);
}

function renderCompareGrandTotal(container, totalA, totalB, snapA, snapB, missingRates) {
    const strategies = collectStrategies();
    const days = (new Date(snapB.date) - new Date(snapA.date)) / (1000 * 60 * 60 * 24);
    const ratesA = snapA.exchange_rates || {};

    const delta = totalB - totalA;
    const pct = totalA !== 0 ? ((delta / totalA) * 100).toFixed(1) + "%" : "—";
    const sign = delta >= 0 ? "+" : "";
    const deltaClass = delta >= 0 ? "delta-positive" : "delta-negative";
    const totalLabel = disguised ? "Grand Total" : "總計 (TWD)";

    // Check if strategies can be calculated
    let strategyError = null;
    let strategyResults = [];

    if (strategies.length > 0) {
        if (days <= 0) {
            strategyError = disguised ? "Snapshot A must be before Snapshot B for strategy calculation" : "Snapshot A 必須早於 Snapshot B 才能計算假設策略";
        } else {
            // Check for missing exchange rates
            const missingRates = checkMissingRates(snapA);
            if (missingRates.length > 0) {
                strategyError = (disguised ? "Missing exchange rate: " : "缺少匯率: ") + missingRates.join(", ");
            } else {
                strategyResults = strategies.map(s => ({
                    name: s.name,
                    value: calculateStrategy(totalA, s, days)
                }));
            }
        }
    }

    // Build table
    const div = document.createElement("div");
    div.className = "compare-grand-total";

    let strategyHeaders = "";
    let strategyCells = "";

    if (!disguised && strategyResults.length > 0) {
        for (const sr of strategyResults) {
            strategyHeaders += `<th>${sr.name}</th>`;
            const sDelta = sr.value - totalA;
            const sPct = totalA !== 0 ? ((sDelta / totalA) * 100).toFixed(1) : "0";
            const sSign = sDelta >= 0 ? "+" : "";
            const sDeltaClass = sDelta >= 0 ? "delta-positive" : "delta-negative";
            strategyCells += `<td class="${sDeltaClass}">${formatMoney(sr.value, "TWD")}<br><small>${sSign}${formatMoney(Math.abs(sDelta), "TWD")} (${sSign}${sPct}%)</small></td>`;
        }
    }

    div.innerHTML = `
        <table class="asset-table grand-total-table">
            <thead><tr>
                <th></th><th>${disguised ? "Season " + snapA.date : snapA.date}</th>
                <th>${disguised ? "Season " + snapB.date : snapB.date}</th>
                <th>${disguised ? "Delta" : "變化"}</th><th>%</th>
                ${strategyHeaders}
            </tr></thead>
            <tbody><tr class="subtotal-row">
                <td>${totalLabel}</td>
                <td>${formatMoney(totalA, "TWD")}</td>
                <td>${formatMoney(totalB, "TWD")}</td>
                <td class="${deltaClass}">${sign}${formatMoney(Math.abs(delta), "TWD")}</td>
                <td class="${deltaClass}">${pct}</td>
                ${strategyCells}
            </tr></tbody>
        </table>`;

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

document.getElementById("btn-compare").onclick = async () => {
    const dateA = document.getElementById("compare-a").value;
    const dateB = document.getElementById("compare-b").value;
    if (!dateA || !dateB) { alert(disguised ? "Select two snapshots" : "請選擇兩個 Snapshot"); return; }
    const [a, b] = await Promise.all([API.get(dateA), API.get(dateB)]);
    compareSnapshots(a, b);
};
```

- [ ] **Step 2: Add placeholder functions** (will be implemented in later tasks)

Add these stubs right before the `compareSnapshots` function:

```javascript
// === Strategy Calculation ===
function collectStrategies() {
    // Stub: returns empty array until strategy UI is built
    return [];
}

function calculateStrategy(principal, strategy, days) {
    // Stub: implemented in Task 3
    return principal;
}

function checkMissingRates(snapshot) {
    const rates = snapshot.exchange_rates || {};
    const missing = [];
    const currenciesUsed = new Set();
    for (const items of Object.values(snapshot.assets || {})) {
        for (const item of items) {
            if (item.currency && item.currency !== "TWD") currenciesUsed.add(item.currency);
        }
    }
    for (const cur of currenciesUsed) {
        const key = `${cur}_TWD`;
        if (!rates[key]) missing.push(key);
    }
    return missing;
}
```

- [ ] **Step 3: Add CSS for subtotal rows and grand total block**

In `web/style.css`, add:

```css
.subtotal-row { font-weight: bold; border-top: 2px solid #ccc; }
.subtotal-row td { padding-top: 0.6rem; }

.compare-grand-total { background: white; border-radius: 8px; padding: 1rem; margin-top: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.grand-total-table .subtotal-row { font-size: 1.1rem; border-top: none; }
.grand-total-table .subtotal-row td small { font-size: 0.8rem; font-weight: normal; }

.strategy-error { color: #e74c3c; padding: 0.5rem 0; font-size: 0.9rem; }
.strategy-warning { color: #e67e22; padding: 0.5rem 0; font-size: 0.85rem; }
```

- [ ] **Step 4: Verify** - Start app, select two snapshots in Compare, click 比較. Confirm:
  - Each category has a subtotal row (bold, with delta and %)
  - Grand total block appears below all categories (TWD values)
  - Currency toggle switches per-item and subtotal values
  - Grand total always shows TWD
  - No strategy columns yet (stubs return empty)

- [ ] **Step 5: Commit**

```bash
git add web/app.js web/style.css
git commit -m "feat: add subtotals, grand total, and currency conversion to compare view"
```

---

### Task 3: Implement strategy calculation engine

**Files:**
- Modify: `web/app.js` (replace stubs from Task 2)

- [ ] **Step 1: Replace the `calculateStrategy` stub with the real implementation**

```javascript
function calculateStrategy(principal, strategy, days) {
    switch (strategy.type) {
        case "deposit": {
            const rate = strategy.rate;
            return principal * Math.pow(1 + rate / 100, days / 365);
        }
        case "index": {
            if (!strategy.startPrice || strategy.startPrice <= 0) return principal;
            return principal * (strategy.endPrice / strategy.startPrice);
        }
        case "mix": {
            return strategy.allocations.reduce((sum, alloc) => {
                const subPrincipal = principal * alloc.pct / 100;
                const subStrategy = {type: alloc.type, ...alloc.params};
                return sum + calculateStrategy(subPrincipal, subStrategy, days);
            }, 0);
        }
        default:
            return principal;
    }
}
```

- [ ] **Step 2: Quick manual test** - Open browser console, test:

```javascript
// Fixed deposit: 1,000,000 TWD at 2% for 365 days
calculateStrategy(1000000, {type: "deposit", rate: 2}, 365)
// Expected: ~1,020,000

// Index: 1,000,000 TWD, S&P from 480 to 510
calculateStrategy(1000000, {type: "index", startPrice: 480, endPrice: 510}, 365)
// Expected: 1,062,500

// Mix: 60% index + 40% deposit
calculateStrategy(1000000, {type: "mix", allocations: [
    {pct: 60, type: "index", params: {startPrice: 480, endPrice: 510}},
    {pct: 40, type: "deposit", params: {rate: 2}}
]}, 365)
// Expected: 60% * 1,062,500 + 40% * 1,020,000 = 637,500 + 408,000 = 1,045,500
```

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: implement strategy calculation engine (deposit, index, mix)"
```

---

### Task 4: Build strategy input UI

**Files:**
- Modify: `web/app.js` (add strategy UI builder, replace `collectStrategies` stub)
- Modify: `web/index.html` (strategy container already added in Task 1)
- Modify: `web/style.css` (strategy input styling)

- [ ] **Step 1: Add strategy UI builder functions in app.js**

Add before the `compareSnapshots` function, replacing the `collectStrategies` stub:

```javascript
let strategyCounter = 0;

function showStrategySection() {
    const section = document.getElementById("compare-strategies");
    section.style.display = disguised ? "none" : "";
}

function buildStrategyUI() {
    const section = document.getElementById("compare-strategies");
    section.innerHTML = "";
    section.style.display = disguised ? "none" : "";

    const header = document.createElement("div");
    header.className = "strategy-header";
    header.innerHTML = `<h3>假設策略</h3>`;
    const addBtn = document.createElement("button");
    addBtn.className = "btn-add-strategy";
    addBtn.textContent = "+ 新增策略";
    const rowsContainer = document.createElement("div");
    rowsContainer.id = "strategy-rows";
    addBtn.onclick = () => {
        strategyCounter++;
        rowsContainer.appendChild(buildStrategyRow(strategyCounter));
    };
    header.appendChild(addBtn);
    section.appendChild(header);
    section.appendChild(rowsContainer);
}

function buildStrategyRow(id) {
    const row = document.createElement("div");
    row.className = "strategy-row";
    row.dataset.id = id;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "strategy-name";
    nameInput.value = `策略 ${id}`;
    nameInput.style.width = "100px";

    const typeSelect = document.createElement("select");
    typeSelect.className = "strategy-type";
    typeSelect.innerHTML = `
        <option value="deposit">定存</option>
        <option value="index">指數追蹤</option>
        <option value="mix">混合</option>
    `;

    const paramsDiv = document.createElement("div");
    paramsDiv.className = "strategy-params";
    renderStrategyParams(paramsDiv, "deposit", id);

    typeSelect.onchange = () => renderStrategyParams(paramsDiv, typeSelect.value, id);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-row";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => row.remove();

    row.appendChild(nameInput);
    row.appendChild(typeSelect);
    row.appendChild(paramsDiv);
    row.appendChild(removeBtn);

    return row;
}

function renderStrategyParams(container, type, id) {
    container.innerHTML = "";
    switch (type) {
        case "deposit":
            container.innerHTML = `<label>年利率 %</label><input type="number" class="param-rate" step="0.1" value="2" style="width:70px">`;
            break;
        case "index":
            container.innerHTML = `
                <label>名稱</label><input type="text" class="param-index-name" value="S&P 500" style="width:80px">
                <label>起始價</label><input type="number" class="param-start" step="0.01" style="width:80px">
                <label>結束價</label><input type="number" class="param-end" step="0.01" style="width:80px">
            `;
            break;
        case "mix":
            container.innerHTML = `<div class="mix-allocations"></div><div class="mix-summary"></div>`;
            const allocDiv = container.querySelector(".mix-allocations");
            const addAllocBtn = document.createElement("button");
            addAllocBtn.className = "btn-add-row";
            addAllocBtn.textContent = "+ 新增配置";
            addAllocBtn.onclick = () => {
                allocDiv.appendChild(buildMixAllocationRow());
                updateMixSummary(container);
            };
            container.appendChild(addAllocBtn);
            break;
    }
}

function buildMixAllocationRow() {
    const row = document.createElement("div");
    row.className = "mix-alloc-row";
    row.innerHTML = `
        <input type="number" class="alloc-pct" min="0" max="100" step="1" placeholder="%" style="width:50px">
        <span>%</span>
        <select class="alloc-type">
            <option value="deposit">定存</option>
            <option value="index">指數追蹤</option>
        </select>
        <span class="alloc-params"></span>
    `;
    const typeSelect = row.querySelector(".alloc-type");
    const paramsSpan = row.querySelector(".alloc-params");
    renderAllocParams(paramsSpan, "deposit");
    typeSelect.onchange = () => renderAllocParams(paramsSpan, typeSelect.value);

    row.querySelector(".alloc-pct").onchange = () => {
        updateMixSummary(row.closest(".strategy-params"));
    };

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-row";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => {
        const params = row.closest(".strategy-params");
        row.remove();
        updateMixSummary(params);
    };
    row.appendChild(removeBtn);
    return row;
}

function renderAllocParams(container, type) {
    if (type === "deposit") {
        container.innerHTML = `<label>年利率%</label><input type="number" class="alloc-rate" step="0.1" value="2" style="width:60px">`;
    } else {
        container.innerHTML = `
            <input type="text" class="alloc-index-name" placeholder="名稱" style="width:70px">
            <label>起始</label><input type="number" class="alloc-start" step="0.01" style="width:70px">
            <label>結束</label><input type="number" class="alloc-end" step="0.01" style="width:70px">
        `;
    }
}

function updateMixSummary(paramsContainer) {
    if (!paramsContainer) return;
    const summary = paramsContainer.querySelector(".mix-summary");
    if (!summary) return;
    const rows = paramsContainer.querySelectorAll(".mix-alloc-row");
    let total = 0;
    rows.forEach(r => {
        total += parseFloat(r.querySelector(".alloc-pct")?.value || 0);
    });
    const remaining = 100 - total;
    summary.textContent = `目前 ${total}%，剩餘 ${remaining}%`;
    summary.style.color = total === 100 ? "#27ae60" : total > 100 ? "#e74c3c" : "#666";
}

function collectStrategies() {
    const rows = document.querySelectorAll(".strategy-row");
    const strategies = [];
    for (const row of rows) {
        const name = row.querySelector(".strategy-name")?.value || "策略";
        const type = row.querySelector(".strategy-type")?.value;
        const params = row.querySelector(".strategy-params");
        if (!type || !params) continue;

        switch (type) {
            case "deposit": {
                const rate = parseFloat(params.querySelector(".param-rate")?.value) || 0;
                strategies.push({name, type: "deposit", rate});
                break;
            }
            case "index": {
                const startPrice = parseFloat(params.querySelector(".param-start")?.value) || 0;
                const endPrice = parseFloat(params.querySelector(".param-end")?.value) || 0;
                if (startPrice <= 0 || endPrice < 0) break; // validation: start > 0, end >= 0
                strategies.push({name, type: "index", startPrice, endPrice});
                break;
            }
            case "mix": {
                const allocRows = params.querySelectorAll(".mix-alloc-row");
                const allocations = [];
                let totalPct = 0;
                for (const ar of allocRows) {
                    const pct = parseFloat(ar.querySelector(".alloc-pct")?.value) || 0;
                    const aType = ar.querySelector(".alloc-type")?.value;
                    totalPct += pct;
                    if (aType === "deposit") {
                        const rate = parseFloat(ar.querySelector(".alloc-rate")?.value) || 0;
                        allocations.push({pct, type: "deposit", params: {rate}});
                    } else {
                        const startPrice = parseFloat(ar.querySelector(".alloc-start")?.value) || 0;
                        const endPrice = parseFloat(ar.querySelector(".alloc-end")?.value) || 0;
                        allocations.push({pct, type: "index", params: {startPrice, endPrice}});
                    }
                }
                if (Math.abs(totalPct - 100) > 0.01) {
                    // Show inline error on the mix summary
                    const summary = params.querySelector(".mix-summary");
                    if (summary) {
                        summary.textContent = `配置比例必須合計 100%（目前 ${totalPct}%）`;
                        summary.style.color = "#e74c3c";
                    }
                    break;
                }
                strategies.push({name, type: "mix", allocations});
                break;
            }
        }
    }
    return strategies;
}
```

- [ ] **Step 2: Initialize strategy UI when switching to compare view**

**Note:** This replaces the existing `nav-compare` onclick handler from the original line 50. Update it to:

```javascript
document.getElementById("nav-compare").onclick = () => {
    switchView("compare");
    buildStrategyUI();
};
```

- [ ] **Step 3: Hide strategy section in disguise mode**

In the disguise toggle handler (werwer block), add:

```javascript
showStrategySection();
```

- [ ] **Step 4: Add CSS for strategy inputs**

In `web/style.css`, add:

```css
#compare-strategies { background: white; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.strategy-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.strategy-header h3 { color: #2c3e50; }
.btn-add-strategy { font-size: 0.85rem; padding: 0.3rem 0.8rem; border: 1px dashed #2c3e50; background: none; cursor: pointer; border-radius: 4px; color: #2c3e50; }
.strategy-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; margin-bottom: 0.3rem; background: #f9f9f9; border-radius: 4px; flex-wrap: wrap; }
.strategy-row select, .strategy-row input { padding: 0.2rem 0.4rem; border: 1px solid #ddd; border-radius: 3px; }
.strategy-params { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.strategy-params label { font-size: 0.8rem; color: #666; }
.mix-alloc-row { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; flex-wrap: wrap; }
.mix-alloc-row select, .mix-alloc-row input { padding: 0.2rem 0.4rem; border: 1px solid #ddd; border-radius: 3px; }
.mix-summary { font-size: 0.8rem; margin-top: 0.3rem; }
```

- [ ] **Step 5: Verify** - Start app, go to Compare tab:
  - Strategy section appears (with "假設策略" header and "+ 新增策略" button)
  - Add a 定存 strategy (2%), verify inputs render
  - Add an 指數追蹤 strategy, verify name/start/end inputs
  - Add a 混合 strategy, add sub-allocations, verify % summary updates
  - Select two snapshots, click 比較 — verify strategy results appear in grand total
  - Toggle disguise (werwer) — strategy section should hide

- [ ] **Step 6: Commit**

```bash
git add web/app.js web/style.css
git commit -m "feat: add hypothetical strategy input UI and calculation integration"
```

---

### Task 5: Final integration and edge cases

**Files:**
- Modify: `web/app.js` (edge case handling, disguise integration)

- [ ] **Step 1: Ensure compare currency toggle labels update on disguise toggle**

Verify the disguise toggle handler already includes the compare-cur-btn relabeling from Task 1 Step 3. Also ensure `buildStrategyUI()` is called after disguise toggle if compare view is active:

In the werwer handler, add:

```javascript
if (document.getElementById("view-compare").style.display !== "none") {
    buildStrategyUI();
    if (lastCompareA && lastCompareB) compareSnapshots(lastCompareA, lastCompareB);
}
```

- [ ] **Step 2: Test edge cases manually**

1. **Same date snapshots**: Select same snapshot for A and B, add a strategy, click Compare. Should see warning message, no strategy columns.
2. **Missing exchange rate**: If a snapshot has JPY assets but no JPY_TWD rate, add a strategy. Should see error message.
3. **Empty strategy list**: Compare without adding strategies. Should show grand total without strategy columns.
4. **Mix validation**: Add mix strategy with allocations totaling 80%. Click Compare. Mix strategy should be silently skipped (doesn't sum to 100%).
5. **Index with zero start price**: Add index strategy with start=0. Should be skipped.
6. **Disguise toggle**: Toggle disguise while comparison is showing. Strategy section hides, strategy columns hide, labels switch.

- [ ] **Step 3: Commit**

```bash
git add web/app.js
git commit -m "feat: add edge case handling and disguise integration for compare strategies"
```

---

### Task 6: Run existing tests and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run backend tests to confirm no regression**

```bash
cd server && python -m pytest test_app.py -v
```

Expected: All 10 tests pass (no backend changes were made).

- [ ] **Step 2: Full manual walkthrough**

1. Start app, go to Compare
2. Select two different snapshots
3. Verify currency toggle works (Original/TWD/USD)
4. Verify subtotals per category with correct deltas
5. Verify grand total in TWD
6. Add "2% 定存" strategy — verify calculation in grand total
7. Add "S&P 500 指數追蹤" strategy with prices — verify
8. Add "混合" strategy with 60/40 — verify
9. Toggle disguise — verify strategy section hides, labels change
10. Go back to Overview and Chart — verify no regression

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
