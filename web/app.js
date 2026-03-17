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
        if (!resp.ok) throw new Error((await resp.json()).error || "Create failed");
        return resp.json();
    },
    async update(date, snapshot) {
        const resp = await fetch(`/api/snapshots/${date}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(snapshot)
        });
        if (!resp.ok) throw new Error((await resp.json()).error || "Update failed");
        return resp.json();
    },
    async remove(date) {
        const resp = await fetch(`/api/snapshots/${date}`, {method: "DELETE"});
        if (!resp.ok) throw new Error((await resp.json()).error || "Delete failed");
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

        const div = document.createElement("div");
        div.className = "asset-category";
        div.innerHTML = `<h3>${CATEGORY_LABELS[cat]}</h3>`;

        const table = document.createElement("table");
        table.className = "asset-table";

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

// === Event Handlers ===
document.getElementById("snapshot-select").onchange = async function() {
    const date = this.value;
    if (!date) { currentSnapshot = null; return; }
    currentSnapshot = await API.get(date);
    document.getElementById("btn-edit-snapshot").disabled = false;
    document.getElementById("btn-save-snapshot").disabled = false;
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

document.getElementById("btn-calculate").onclick = calculateMarketValues;
document.getElementById("btn-save-snapshot").onclick = saveSnapshot;

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
                item[key] = input.type === "number" ? (val !== "" ? parseFloat(val) : null) : val;
            }
            if (cat === "tw_stocks") item.currency = "TWD";
            if (cat === "us_stocks") item.currency = "USD";
            items.push(item);
        }
        snapshot.assets[cat] = items;
    }
    return snapshot;
}

document.getElementById("btn-new-snapshot").onclick = () => {
    if (currentSnapshot) {
        const copy = JSON.parse(JSON.stringify(currentSnapshot));
        copy.date = new Date().toISOString().slice(0, 10);
        copy.note = "";
        openEditModal(copy, true);
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

init();
