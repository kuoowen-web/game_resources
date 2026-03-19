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
    },
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
};

// === Navigation ===
const views = ["overview", "compare", "chart", "cashflow"];

function switchView(name) {
    views.forEach(v => {
        document.getElementById(`view-${v}`).style.display = v === name ? "" : "none";
        document.getElementById(`nav-${v}`).classList.toggle("active", v === name);
    });
}

document.getElementById("nav-overview").onclick = () => switchView("overview");
document.getElementById("nav-compare").onclick = () => {
    switchView("compare");
    buildStrategyUI();
};
document.getElementById("nav-chart").onclick = () => switchView("chart");
document.getElementById("nav-cashflow").onclick = () => {
    switchView("cashflow");
    renderCashflowList();
};

document.querySelectorAll(".compare-cur-btn").forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll(".compare-cur-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        compareCurrencyMode = this.dataset.mode;
        // Re-render if comparison is already showing
        if (lastCompareA && lastCompareB) compareSnapshots(lastCompareA, lastCompareB);
    };
});

// === State ===
let currentSnapshot = null;
let currencyMode = "original";
const editingCategories = new Set();
let disguised = true;
let compareCurrencyMode = "original";
let lastCompareA = null;
let lastCompareB = null;

// === Currency Config ===
const ALL_CURRENCIES = ["TWD", "USD", "JPY", "EUR"];
const CURRENCY_PREFIXES = {TWD: "NT$", USD: "US$", JPY: "¥", EUR: "€"};
const DISGUISE_CURRENCY_MAP = {TWD: "G", USD: "D", JPY: "S", EUR: "R"};
const EXCHANGE_RATE_KEYS = ["USD_TWD", "JPY_TWD", "EUR_TWD"];

function getRate(rates, fromCurrency) {
    if (!fromCurrency || fromCurrency === "TWD") return 1;
    const key = `${fromCurrency}_TWD`;
    const rate = rates?.[key];
    if (!rate) {
        console.warn(`Missing exchange rate: ${key}`);
        return null;
    }
    return rate;
}

// === Disguise System ===
const DISGUISE_CATEGORIES = {
    deposits: "金幣儲藏",
    insurance: "防禦裝備",
    bonds: "鍛造材料",
    structured_products: "附魔寶石",
    tw_stocks: "本地市集",
    us_stocks: "跨境市集",
    crypto: "虛空碎片"
};

const DISGUISE_ITEM_PREFIXES = {
    deposits: "金幣袋",
    insurance: "護盾",
    bonds: "秘銀錠",
    structured_products: "混沌石",
    tw_stocks: "商品",
    us_stocks: "異界品",
    crypto: "碎片"
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function disguiseLabel(cat) {
    return disguised ? DISGUISE_CATEGORIES[cat] : CATEGORY_LABELS[cat];
}

function disguiseName(name, cat, idx) {
    if (!disguised) return name;
    const prefix = DISGUISE_ITEM_PREFIXES[cat] || "物品";
    return `${prefix} ${ROMAN[idx] || idx + 1}`;
}

function disguiseCurrency(currency) {
    if (!disguised) return currency;
    return DISGUISE_CURRENCY_MAP[currency] || "?";
}

function formatMoney(value, currency) {
    if (value == null || isNaN(value)) return "—";
    if (disguised) {
        const suffix = DISGUISE_CURRENCY_MAP[currency] || "?";
        return `${value.toLocaleString("en-US", {maximumFractionDigits: 0})}${suffix}`;
    }
    const prefix = CURRENCY_PREFIXES[currency] || "";
    return `${prefix}${value.toLocaleString("en-US", {maximumFractionDigits: 0})}`;
}

// Secret key sequence listener
let keyBuffer = "";
document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > 10) keyBuffer = keyBuffer.slice(-10);
    if (keyBuffer.endsWith("werwer")) {
        disguised = !disguised;
        keyBuffer = "";
        loadSnapshotList().then(() => {
            if (currentSnapshot) {
                document.getElementById("snapshot-select").value = currentSnapshot.date;
                renderSnapshot(currentSnapshot);
            }
        });
        document.querySelectorAll(".compare-cur-btn").forEach(btn => {
            if (btn.dataset.mode === "original") btn.textContent = disguised ? "Split" : "原幣";
            if (btn.dataset.mode === "twd") btn.textContent = disguised ? "Gold" : "TWD";
            if (btn.dataset.mode === "usd") btn.textContent = disguised ? "Diamond" : "USD";
        });
        showStrategySection();
        if (document.getElementById("view-compare").style.display !== "none") {
            buildStrategyUI();
            if (lastCompareA && lastCompareB) compareSnapshots(lastCompareA, lastCompareB);
        }
        document.getElementById("nav-cashflow").textContent = disguised ? "Events" : "現金流";
        if (document.getElementById("view-cashflow").style.display !== "none") {
            renderCashflowList();
        }
    }
});

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
            opt.textContent = disguised ? `Season ${item.date}` : `${item.date}${item.note ? " — " + item.note : ""}`;
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
    us_stocks: "美股",
    crypto: "虛擬貨幣"
};

const ASSET_FIELDS = {
    deposits: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ALL_CURRENCIES},
        {key: "amount", label: "金額", type: "number"}
    ],
    insurance: [
        {key: "name", label: "名稱", type: "text"},
        {key: "type", label: "類型", type: "select", options: ["savings", "health"]},
        {key: "currency", label: "幣別", type: "select", options: ALL_CURRENCIES},
        {key: "surrender_value", label: "保單價值", type: "number"},
        {key: "annual_premium", label: "年繳保費", type: "number"},
        {key: "paid_years", label: "已繳年數", type: "number"},
        {key: "total_years", label: "總繳年數", type: "number"}
    ],
    bonds: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ALL_CURRENCIES},
        {key: "units", label: "單位數", type: "number"},
        {key: "face_value_per_unit", label: "面額/單位", type: "number"},
        {key: "coupon_rate", label: "票面利率", type: "number", step: "0.001"},
        {key: "purchase_year", label: "購買年份", type: "number"},
        {key: "maturity_year", label: "到期年份", type: "number"}
    ],
    structured_products: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "幣別", type: "select", options: ALL_CURRENCIES},
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
    ],
    crypto: [
        {key: "name", label: "名稱", type: "text"},
        {key: "currency", label: "計價幣別", type: "select", options: ["USD", "TWD"]},
        {key: "amount", label: "數量", type: "number", step: "0.00000001"},
        {key: "avg_cost", label: "均成本", type: "number", step: "0.01"},
        {key: "current_price", label: "即時價格", type: "number", step: "0.01"}
    ]
};

function getAssetValue(category, item) {
    if (!item) return 0;
    switch (category) {
        case "deposits": return item.amount || 0;
        case "insurance": return item.surrender_value || 0;
        case "bonds": return item.market_value ?? ((item.units || 0) * (item.face_value_per_unit || 0));
        case "structured_products": return item.account_value || 0;
        case "tw_stocks":
        case "us_stocks": return item.market_value ?? ((item.shares || 0) * (item.avg_cost || 0));
        case "crypto": return item.market_value ?? ((item.amount || 0) * (item.avg_cost || 0));
        default: return 0;
    }
}

function convertValue(value, fromCurrency, toMode, rates) {
    if (value == null || isNaN(value)) return {value: 0, currency: fromCurrency || "TWD"};
    if (toMode === "original") return {value, currency: fromCurrency};
    const fromRate = getRate(rates, fromCurrency);
    if (fromRate == null) return {value, currency: fromCurrency}; // missing rate: show original
    if (toMode === "twd") {
        return {value: value * fromRate, currency: "TWD"};
    }
    if (toMode === "usd") {
        const usdRate = getRate(rates, "USD");
        if (usdRate == null) return {value, currency: fromCurrency};
        return {value: (value * fromRate) / usdRate, currency: "USD"};
    }
    return {value, currency: fromCurrency};
}

// === Render Overview ===
function renderSnapshot(snapshot) {
    const container = document.getElementById("snapshot-content");
    const totalsDiv = document.getElementById("snapshot-totals");
    container.innerHTML = "";
    totalsDiv.innerHTML = "";

    const rates = snapshot.exchange_rates || {};
    let totalsByOrigCurrency = {};

    // Snapshot meta
    const metaDiv = document.createElement("div");
    metaDiv.className = "snapshot-meta";
    if (disguised) {
        metaDiv.innerHTML = `
            <div class="form-group"><label>Season</label><span>${snapshot.date}</span></div>
        `;
    } else {
        let rateFields = EXCHANGE_RATE_KEYS.map(k => {
            const label = k.replace("_TWD", "/TWD");
            const val = rates[k] || "";
            return `<div class="form-group"><label>${label}</label><input class="meta-rate-input" data-key="${k}" type="number" step="0.01" value="${val}" style="width:80px"></div>`;
        }).join("");
        metaDiv.innerHTML = `
            <div class="form-group"><label>日期</label><span>${snapshot.date}</span></div>
            <div class="form-group"><label>備註</label><input id="meta-note" type="text" value="${snapshot.note || ""}" style="width:200px"></div>
            ${rateFields}
        `;
    }
    container.appendChild(metaDiv);

    // Update UI for disguise mode
    document.getElementById("btn-new-snapshot").style.display = disguised ? "none" : "";
    document.getElementById("btn-calculate").style.display = disguised ? "none" : "";
    document.getElementById("btn-save-snapshot").style.display = disguised ? "none" : "";
    document.querySelectorAll(".cur-btn").forEach(btn => {
        if (btn.dataset.mode === "original") btn.textContent = disguised ? "Split" : "原幣";
        if (btn.dataset.mode === "twd") btn.textContent = disguised ? "Gold" : "TWD";
        if (btn.dataset.mode === "usd") btn.textContent = disguised ? "Diamond" : "USD";
    });

    const categories = ["deposits", "insurance", "bonds", "structured_products", "tw_stocks", "us_stocks", "crypto"];

    for (const cat of categories) {
        const items = snapshot.assets?.[cat] || [];
        const isEditing = editingCategories.has(cat);

        if (items.length === 0 && !isEditing && disguised) continue;

        const div = document.createElement("div");
        div.className = "asset-category";

        // Category header with edit toggle
        const header = document.createElement("div");
        header.className = "category-header";
        header.innerHTML = `<h3>${disguiseLabel(cat)}</h3>`;
        if (!disguised) {
            const editBtn = document.createElement("button");
            editBtn.className = `btn-edit-cat${isEditing ? " active" : ""}`;
            editBtn.textContent = isEditing ? "完成編輯" : "編輯";
            editBtn.onclick = async () => {
                if (isEditing) {
                    collectCategoryData(cat, snapshot);
                    editingCategories.delete(cat);
                    // Auto-save on finish editing
                    collectMetaFields(snapshot);
                    try {
                        await API.update(snapshot.date, snapshot);
                    } catch (e) {
                        alert("儲存失敗: " + e.message);
                    }
                } else {
                    editingCategories.add(cat);
                }
                renderSnapshot(snapshot);
            };
            header.appendChild(editBtn);
        }
        div.appendChild(header);

        if (isEditing) {
            const editContainer = document.createElement("div");
            editContainer.id = `edit-${cat}`;
            const fields = ASSET_FIELDS[cat];

            for (let i = 0; i < items.length; i++) {
                editContainer.appendChild(buildEditRow(cat, fields, items[i], i));
            }

            const addBtn = document.createElement("button");
            addBtn.className = "btn-add-row";
            addBtn.textContent = `+ 新增${CATEGORY_LABELS[cat]}`;
            addBtn.onclick = () => {
                const idx = editContainer.querySelectorAll(".edit-row").length;
                editContainer.insertBefore(buildEditRow(cat, fields, {}, idx), addBtn);
            };
            editContainer.appendChild(addBtn);
            div.appendChild(editContainer);
        } else {
            const table = document.createElement("table");
            table.className = "asset-table";
            table.appendChild(buildHeaderRow(cat));

            const tbody = document.createElement("tbody");
            let catByCurrency = {};
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                // Ensure currency fallback for stock categories
                if (cat === "tw_stocks" && !item.currency) item.currency = "TWD";
                if (cat === "us_stocks" && !item.currency) item.currency = "USD";
                const value = getAssetValue(cat, item);
                const currency = item.currency || "TWD";
                catByCurrency[currency] = (catByCurrency[currency] || 0) + value;
                totalsByOrigCurrency[currency] = (totalsByOrigCurrency[currency] || 0) + value;
                tbody.appendChild(buildAssetRow(cat, item, value, rates, i));
            }

            // Subtotal
            const subtotalRow = document.createElement("tr");
            subtotalRow.style.fontWeight = "bold";
            subtotalRow.style.borderTop = "2px solid #ccc";
            const subtotalText = buildSubtotalText(catByCurrency, rates);
            const colCount = table.querySelector("thead tr").children.length;
            const subtotalLabel = disguised ? "Subtotal" : "小計";
            subtotalRow.innerHTML = `<td>${subtotalLabel}</td><td colspan="${colCount - 1}" style="text-align:right">${subtotalText}</td>`;
            tbody.appendChild(subtotalRow);

            table.appendChild(tbody);
            div.appendChild(table);
        }

        container.appendChild(div);
    }

    renderTotals(totalsDiv, totalsByOrigCurrency, rates);
}

function collectMetaFields(snapshot) {
    const noteEl = document.getElementById("meta-note");
    if (noteEl) snapshot.note = noteEl.value;
    const rateInputs = document.querySelectorAll(".meta-rate-input");
    if (rateInputs.length > 0) {
        if (!snapshot.exchange_rates) snapshot.exchange_rates = {};
        rateInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) snapshot.exchange_rates[input.dataset.key] = val;
        });
    }
}

function buildEditRow(cat, fields, item, idx) {
    const row = document.createElement("div");
    row.className = "edit-row";
    row.dataset.idx = idx;
    row.style.padding = "0.5rem";
    row.style.marginBottom = "0.3rem";
    row.style.borderRadius = "4px";
    row.style.display = "flex";
    row.style.gap = "0.5rem";
    row.style.alignItems = "end";
    row.style.flexWrap = "wrap";

    for (const f of fields) {
        const val = item?.[f.key] ?? "";
        const wrapper = document.createElement("div");
        wrapper.style.display = "inline-flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.minWidth = "80px";

        const label = document.createElement("label");
        label.textContent = f.label;
        label.style.fontSize = "0.75rem";
        label.style.color = "#666";
        wrapper.appendChild(label);

        if (f.type === "select") {
            const sel = document.createElement("select");
            sel.dataset.key = f.key;
            f.options.forEach(o => {
                const opt = document.createElement("option");
                opt.value = o;
                opt.textContent = o;
                if (val === o) opt.selected = true;
                sel.appendChild(opt);
            });
            wrapper.appendChild(sel);
        } else {
            const input = document.createElement("input");
            input.type = f.type;
            input.dataset.key = f.key;
            input.value = val;
            if (f.step) input.step = f.step;
            wrapper.appendChild(input);
        }
        row.appendChild(wrapper);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-row";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => row.remove();
    row.appendChild(removeBtn);

    return row;
}

function collectCategoryData(cat, snapshot) {
    const container = document.getElementById(`edit-${cat}`);
    if (!container) return;
    const items = [];
    for (const row of container.querySelectorAll(".edit-row")) {
        const item = {};
        for (const input of row.querySelectorAll("[data-key]")) {
            const key = input.dataset.key;
            const val = input.value;
            item[key] = input.type === "number" ? (val !== "" ? parseFloat(val) : null) : val;
        }
        if (cat === "tw_stocks") item.currency = "TWD";
        if (cat === "us_stocks") item.currency = "USD";
        items.push(item);
    }
    if (!snapshot.assets) snapshot.assets = {};
    snapshot.assets[cat] = items;
}

function buildHeaderRow(cat) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    let headers = [];

    if (disguised) {
        switch (cat) {
            case "deposits":
                headers = ["Item", "Type", "Amount"]; break;
            case "insurance":
                headers = ["Item", "Class", "Type", "Power", "Cost/Season"]; break;
            case "bonds":
                headers = ["Item", "Type", "Qty", "Buff%", "Market Price", "Value"]; break;
            case "structured_products":
                headers = ["Item", "Type", "Base", "Current", "Linked"]; break;
            case "tw_stocks":
            case "us_stocks":
                headers = ["Item", "Qty", "Avg Cost", "Market Price", "Value"]; break;
            case "crypto":
                headers = ["Item", "Type", "Qty", "Avg Cost", "Market Price", "Value"]; break;
        }
    } else {
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
            case "crypto":
                headers = ["名稱", "計價幣別", "數量", "均成本", "即時價格", "市值"]; break;
        }
    }

    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
}

function buildAssetRow(cat, item, value, rates, idx) {
    const tr = document.createElement("tr");
    const converted = convertValue(value, item.currency, currencyMode, rates);
    const displayVal = formatMoney(converted.value, converted.currency);
    const dName = disguiseName(item.name, cat, idx);
    const dCur = disguiseCurrency(item.currency);

    switch (cat) {
        case "deposits":
            tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${displayVal}</td>`;
            break;
        case "insurance": {
            const insType = disguised ? (item.type === "savings" ? "Buff" : "Passive") : (item.type === "savings" ? "儲蓄" : "醫療");
            const svConv = convertValue(item.surrender_value || 0, item.currency, currencyMode, rates);
            const insVal = item.surrender_value ? formatMoney(svConv.value, svConv.currency) : "—";
            const premConv = convertValue(item.annual_premium || 0, item.currency, currencyMode, rates);
            tr.innerHTML = `<td>${dName}</td><td>${insType}</td><td>${dCur}</td><td>${insVal}</td><td>${formatMoney(premConv.value, premConv.currency)}</td>`;
            break;
        }
        case "bonds":
            if (disguised) {
                const coupon = item.coupon_rate != null ? (item.coupon_rate * 100).toFixed(1) + "%" : "—";
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.units || ""}</td><td>${coupon}</td><td>—</td><td>${displayVal}</td>`;
            } else {
                const coupon = item.coupon_rate != null ? (item.coupon_rate * 100).toFixed(1) + "%" : "—";
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.units || ""}</td><td>${coupon}</td>
                    <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price_per_unit" value="${item.current_price_per_unit ?? ""}"></td>
                    <td>${displayVal}</td>`;
            }
            break;
        case "structured_products": {
            const prinConv = convertValue(item.principal || 0, item.currency, currencyMode, rates);
            const dLinked = disguised ? "Enchant" : (item.linked_to || "");
            tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${formatMoney(prinConv.value, prinConv.currency)}</td><td>${displayVal}</td><td>${dLinked}</td>`;
            break;
        }
        case "tw_stocks":
        case "us_stocks":
            if (disguised) {
                tr.innerHTML = `<td>${dName}</td><td>${item.shares || ""}</td><td>${item.avg_cost ?? ""}</td><td>—</td><td>${displayVal}</td>`;
            } else {
                tr.innerHTML = `<td>${dName}</td><td>${item.shares || ""}</td><td>${item.avg_cost ?? ""}</td>
                    <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price" value="${item.current_price ?? ""}"></td>
                    <td>${displayVal}</td>`;
            }
            break;
        case "crypto": {
            const mvConv = convertValue(value, item.currency, currencyMode, rates);
            const mvVal = formatMoney(mvConv.value, mvConv.currency);
            if (disguised) {
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.amount ?? ""}</td><td>${item.avg_cost ?? ""}</td><td>—</td><td>${mvVal}</td>`;
            } else {
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.amount ?? ""}</td><td>${item.avg_cost ?? ""}</td>
                    <td><input class="calc-input" type="number" step="0.01" data-cat="${cat}" data-name="${item.name}" data-field="current_price" value="${item.current_price ?? ""}"></td>
                    <td>${mvVal}</td>`;
            }
            break;
        }
    }
    return tr;
}

function buildSubtotalText(byCurrency, rates) {
    if (currencyMode === "original") {
        const parts = [];
        for (const [cur, val] of Object.entries(byCurrency)) {
            if (val) parts.push(formatMoney(val, cur));
        }
        return parts.join(" + ") || "—";
    } else if (currencyMode === "twd") {
        let total = 0;
        for (const [cur, val] of Object.entries(byCurrency)) {
            total += val * getRate(rates, cur);
        }
        return formatMoney(total, "TWD");
    } else {
        const usdRate = getRate(rates, "USD");
        let total = 0;
        for (const [cur, val] of Object.entries(byCurrency)) {
            total += (val * getRate(rates, cur)) / usdRate;
        }
        return formatMoney(total, "USD");
    }
}

function renderTotals(container, totalsByOrigCurrency, rates) {
    if (currencyMode === "original") {
        let html = "";
        for (const cur of ALL_CURRENCIES) {
            const val = totalsByOrigCurrency[cur];
            if (val) {
                const label = disguised ? `${DISGUISE_CURRENCY_MAP[cur]} Assets` : `${cur} 資產`;
                html += `<div class="total-row"><span>${label}</span><span>${formatMoney(val, cur)}</span></div>`;
            }
        }
        container.innerHTML = html || "—";
    } else if (currencyMode === "twd") {
        let total = 0;
        for (const [cur, val] of Object.entries(totalsByOrigCurrency)) {
            total += val * getRate(rates, cur);
        }
        const label = disguised ? "Total Power" : "總資產";
        container.innerHTML = `<div class="total-row grand"><span>${label}</span><span>${formatMoney(total, "TWD")}</span></div>`;
    } else {
        const usdRate = getRate(rates, "USD");
        let total = 0;
        for (const [cur, val] of Object.entries(totalsByOrigCurrency)) {
            total += (val * getRate(rates, cur)) / usdRate;
        }
        const label = disguised ? "Total Power" : "總資產";
        container.innerHTML = `<div class="total-row grand"><span>${label}</span><span>${formatMoney(total, "USD")}</span></div>`;
    }
}

// === Event Handlers ===
document.getElementById("snapshot-select").onchange = async function() {
    const date = this.value;
    if (!date) { currentSnapshot = null; return; }
    currentSnapshot = await API.get(date);
    document.getElementById("btn-save-snapshot").disabled = false;
    editingCategories.clear();
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

        const items = currentSnapshot.assets?.[cat] || [];
        const item = items.find(i => i.name === name);
        if (!item) return;

        item[field] = val;
        if (cat === "bonds") {
            item.market_value = (item.units || 0) * val;
        } else if (cat === "crypto") {
            item.market_value = (item.amount || 0) * val;
        } else {
            item.market_value = (item.shares || 0) * val;
        }
    });
    renderSnapshot(currentSnapshot);
}

async function saveSnapshot() {
    if (!currentSnapshot) return;
    collectMetaFields(currentSnapshot);
    for (const cat of editingCategories) {
        collectCategoryData(cat, currentSnapshot);
    }
    calculateMarketValues();
    await API.update(currentSnapshot.date, currentSnapshot);
    editingCategories.clear();
    await loadSnapshotList();
    renderSnapshot(currentSnapshot);
    alert("已儲存");
}

document.getElementById("btn-calculate").onclick = calculateMarketValues;
document.getElementById("btn-save-snapshot").onclick = saveSnapshot;

// === New Snapshot Modal ===
function closeNewModal() {
    document.getElementById("new-modal").style.display = "none";
}

document.getElementById("btn-new-snapshot").onclick = () => {
    const modal = document.getElementById("new-modal");
    document.getElementById("new-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("new-note").value = "";
    document.getElementById("new-rate").value = currentSnapshot?.exchange_rates?.USD_TWD || 32;
    document.getElementById("new-copy-existing").checked = !!currentSnapshot;
    modal.style.display = "flex";
};

document.getElementById("new-modal-close").onclick = closeNewModal;
document.getElementById("new-modal-cancel").onclick = closeNewModal;

document.getElementById("new-modal-save").onclick = async () => {
    const date = document.getElementById("new-date").value;
    if (!date) { alert("請輸入日期"); return; }
    const note = document.getElementById("new-note").value;
    const rate = parseFloat(document.getElementById("new-rate").value);
    const copyExisting = document.getElementById("new-copy-existing").checked;

    let assets = {deposits: [], insurance: [], bonds: [], structured_products: [], tw_stocks: [], us_stocks: [], crypto: []};
    if (copyExisting && currentSnapshot) {
        assets = JSON.parse(JSON.stringify(currentSnapshot.assets));
    }

    let exchange_rates = {USD_TWD: rate};
    if (copyExisting && currentSnapshot?.exchange_rates) {
        exchange_rates = {...currentSnapshot.exchange_rates, USD_TWD: rate};
    }
    const snapshot = {date, note, exchange_rates, assets};
    await API.create(snapshot);
    closeNewModal();
    await loadSnapshotList();
    document.getElementById("snapshot-select").value = date;
    currentSnapshot = await API.get(date);
    document.getElementById("btn-save-snapshot").disabled = false;
    editingCategories.clear();
    renderSnapshot(currentSnapshot);
};

// === Strategy Calculation ===
let strategyCounter = 0;

function showStrategySection() {
    const section = document.getElementById("compare-strategies");
    section.style.display = disguised ? "none" : "";
}

function buildStrategyUI() {
    strategyCounter = 0;
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
                if (startPrice <= 0 || endPrice < 0) break;
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

function calcModifiedDietz(vStart, vEnd, cashflows, startDate, endDate) {
    const totalDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) return {return: 0, annualized: 0, netFlow: 0, investmentGain: 0};

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
            result += cf.amount;
        }
    }
    return result;
}

// === Comparison ===
async function compareSnapshots(a, b) {
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
    let grandTotalB_atRatesA = 0; // B's assets valued at A's exchange rates (for FX decomposition)
    const missingRatesA = new Set();
    const missingRatesB = new Set();

    const categories = Object.keys(CATEGORY_LABELS);
    for (const cat of categories) {
        const itemsA = a.assets?.[cat] || [];
        const itemsB = b.assets?.[cat] || [];
        if (itemsA.length === 0 && itemsB.length === 0) continue;

        const div = document.createElement("div");
        div.className = "compare-category";

        const header = document.createElement("div");
        header.className = "compare-cat-header";
        header.innerHTML = `<h3>${disguiseLabel(cat)}</h3><span class="toggle-icon">▼</span>`;

        const table = document.createElement("table");
        table.className = "asset-table";
        table.innerHTML = `<thead><tr><th>${nameLabel}</th><th>${hdrA}</th><th>${hdrB}</th><th>${deltaLabel}</th><th>%</th></tr></thead>`;

        const tbody = document.createElement("tbody");
        const allNames = [...new Set([...itemsA.map(i => i.name), ...itemsB.map(i => i.name)])];

        // Track subtotals by currency
        const subtotalA = {};
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
            grandTotalB_atRatesA += rawValB * (rateA || 0); // B assets at A's rates

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
        div.appendChild(header);
        div.appendChild(table);
        container.appendChild(div);

        // Toggle: clicking header collapses detail rows, keeps subtotals visible
        const detailRows = tbody.querySelectorAll("tr:not(.subtotal-row)");
        const thead = table.querySelector("thead");
        header.style.cursor = "pointer";
        header.onclick = () => {
            const collapsed = thead.style.display === "none";
            thead.style.display = collapsed ? "" : "none";
            detailRows.forEach(r => r.style.display = collapsed ? "" : "none");
            header.querySelector(".toggle-icon").textContent = collapsed ? "▼" : "▶";
        };
        // Start collapsed
        thead.style.display = "none";
        detailRows.forEach(r => r.style.display = "none");
        header.querySelector(".toggle-icon").textContent = "▶";
    }

    // Grand total block
    const allMissing = new Set([...missingRatesA, ...missingRatesB]);
    await renderCompareGrandTotal(grandTotalContainer, grandTotalA_TWD, grandTotalB_TWD, grandTotalB_atRatesA, a, b, allMissing);
}

async function renderCompareGrandTotal(container, totalA, totalB, totalB_atRatesA, snapA, snapB, missingRates) {
    const strategies = collectStrategies();
    const days = (new Date(snapB.date) - new Date(snapA.date)) / (1000 * 60 * 60 * 24);

    // Fetch cashflows for this period
    let allCashflows = [];
    try {
        allCashflows = await API.listCashflows();
    } catch (e) { /* no cashflows file yet */ }
    const periodCashflows = allCashflows.filter(cf => cf.date > snapA.date && cf.date <= snapB.date);

    // Modified Dietz actual return
    const md = calcModifiedDietz(totalA, totalB, periodCashflows, snapA.date, snapB.date);

    const totalLabel = disguised ? "Grand Total" : "總計 (TWD)";
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
                    // Stated rate for display context
                    let statedRate = null;
                    if (s.type === "deposit") statedRate = s.rate.toFixed(1) + "%/年";
                    else if (s.type === "index") {
                        const idxReturn = ((s.endPrice / s.startPrice - 1) * 100).toFixed(1);
                        statedRate = `${idxReturn}%（${s.startPrice}→${s.endPrice}）`;
                    }
                    return {name: s.name, endVal, gain: sGain, statedRate};
                });
            }
        }
    }

    // Build display
    const div = document.createElement("div");
    div.className = "compare-grand-total";

    const sign = md.investmentGain >= 0 ? "+" : "";
    const annPct = days > 0 ? (md.annualized * 100).toFixed(1) + "%" : "—";
    const totalChange = totalB - totalA;
    const totalChangeSign = totalChange >= 0 ? "+" : "";
    const totalChangeClass = totalChange >= 0 ? "delta-positive" : "delta-negative";
    const daysLabel = Math.round(days);

    if (disguised) {
        // Simplified disguised view
        div.innerHTML = `
            <table class="asset-table grand-total-table">
                <thead><tr><th></th><th>Value</th></tr></thead>
                <tbody>
                    <tr><td>Start</td><td>${formatMoney(totalA, "TWD")}</td></tr>
                    <tr><td>End</td><td>${formatMoney(totalB, "TWD")}</td></tr>
                    <tr class="subtotal-row"><td>Grand Total Change</td>
                        <td class="${totalChangeClass}">${totalChangeSign}${formatMoney(Math.abs(totalChange), "TWD")}</td></tr>
                </tbody>
            </table>`;
    } else {
        // Detailed breakdown view
        const rateNote = Object.keys(snapA.exchange_rates || {}).map(k => {
            const rA = snapA.exchange_rates[k];
            const rB = (snapB.exchange_rates || {})[k];
            const label = k.replace("_TWD", "/TWD");
            return rB && rA !== rB ? `${label}: ${rA}→${rB}` : `${label}: ${rA}`;
        }).join("、");
        let html = `<h3>績效總結（TWD 換算）</h3>`;
        if (rateNote) html += `<p class="rate-note">匯率：期初各用各的匯率換算　<small>${rateNote}</small></p>`;
        html += `<table class="asset-table grand-total-table"><tbody>`;
        html += `<tr><td>期初資產 (${snapA.date})</td><td style="text-align:right">${formatMoney(totalA, "TWD")}</td></tr>`;
        html += `<tr><td>期末資產 (${snapB.date})</td><td style="text-align:right">${formatMoney(totalB, "TWD")}</td></tr>`;
        html += `<tr class="subtotal-row"><td>資產總變化</td><td style="text-align:right" class="${totalChangeClass}">${totalChangeSign}${formatMoney(Math.abs(totalChange), "TWD")}</td></tr>`;

        if (periodCashflows.length > 0) {
            html += `<tr><td colspan="2" style="padding-top:1rem"><strong>扣除外部現金流</strong></td></tr>`;
            for (const cf of periodCashflows) {
                const cfSign = cf.amount >= 0 ? "+" : "";
                const cfClass = cf.amount >= 0 ? "delta-positive" : "delta-negative";
                html += `<tr><td style="padding-left:1rem">${cf.date}　${cf.note || ""}</td><td style="text-align:right" class="${cfClass}">${cfSign}${formatMoney(Math.abs(cf.amount), "TWD")}</td></tr>`;
            }
            html += `<tr style="border-top:1px solid #ddd"><td style="padding-left:1rem">淨流入小計</td><td style="text-align:right">${formatMoney(md.netFlow, "TWD")}</td></tr>`;
        }

        html += `<tr class="subtotal-row"><td>實際投資報酬（扣除現金流）</td><td style="text-align:right" class="${deltaClass}"><strong>${sign}${formatMoney(Math.abs(md.investmentGain), "TWD")}</strong></td></tr>`;

        // FX decomposition
        const fxImpact = totalB - totalB_atRatesA;
        if (Math.abs(fxImpact) > 100) {
            const assetReturn = md.investmentGain - fxImpact;
            const fxSign = fxImpact >= 0 ? "+" : "";
            const fxClass = fxImpact >= 0 ? "delta-positive" : "delta-negative";
            const arSign = assetReturn >= 0 ? "+" : "";
            const arClass = assetReturn >= 0 ? "delta-positive" : "delta-negative";
            html += `<tr><td style="padding-left:1rem;color:#666">├ 匯率影響</td><td style="text-align:right" class="${fxClass}"><small>${fxSign}${formatMoney(Math.abs(fxImpact), "TWD")}</small></td></tr>`;
            html += `<tr><td style="padding-left:1rem;color:#666">└ 資產本身變化</td><td style="text-align:right" class="${arClass}"><small>${arSign}${formatMoney(Math.abs(assetReturn), "TWD")}</small></td></tr>`;
        }

        html += `<tr><td>報酬率（${daysLabel} 天）</td><td style="text-align:right" class="${deltaClass}">${(md.return * 100).toFixed(2)}%</td></tr>`;
        html += `<tr><td>年化報酬率</td><td style="text-align:right" class="${deltaClass}">${annPct}</td></tr>`;

        // Strategy comparison
        if (strategyResults.length > 0) {
            html += `<tr><td colspan="2" style="padding-top:1rem"><strong>假設策略比較</strong>　<small style="color:#999">（同樣的本金和現金流，如果全部用以下策略）</small></td></tr>`;
            for (const sr of strategyResults) {
                const sSign = sr.gain >= 0 ? "+" : "";
                const sEndMd = calcModifiedDietz(totalA, sr.endVal, periodCashflows, snapA.date, snapB.date);
                const sAnnPct = days > 0 ? (sEndMd.annualized * 100).toFixed(1) + "%" : "—";
                const sDeltaClass = sr.gain >= 0 ? "delta-positive" : "delta-negative";
                const diff = md.investmentGain - sr.gain;
                const diffSign = diff >= 0 ? "+" : "";
                const diffClass = diff >= 0 ? "delta-positive" : "delta-negative";

                // Stated rate for context
                let statedNote = "";
                if (sr.statedRate != null) statedNote = `　<small style="color:#999">策略設定 ${sr.statedRate}</small>`;

                html += `<tr><td style="padding-left:1rem">${sr.name}${statedNote}</td><td style="text-align:right" class="${sDeltaClass}">${sSign}${formatMoney(Math.abs(sr.gain), "TWD")}（年化 ${sAnnPct}）</td></tr>`;
                if (sAnnPct !== sr.statedRate && sr.statedRate) {
                    html += `<tr><td style="padding-left:2rem;color:#999">↳ 年化與設定利率的差異來自現金流時間點加權</td><td></td></tr>`;
                }
                html += `<tr><td style="padding-left:2rem;color:#999">vs 你的實際報酬差距</td><td style="text-align:right" class="${diffClass}"><small>${diffSign}${formatMoney(Math.abs(diff), "TWD")}</small></td></tr>`;
            }
        }

        html += `</tbody></table>`;
        div.innerHTML = html;
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

document.getElementById("btn-compare").onclick = async () => {
    const dateA = document.getElementById("compare-a").value;
    const dateB = document.getElementById("compare-b").value;
    if (!dateA || !dateB) { alert(disguised ? "Select two snapshots" : "請選擇兩個 Snapshot"); return; }
    const [a, b] = await Promise.all([API.get(dateA), API.get(dateB)]);
    compareSnapshots(a, b);
};

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
    const amount = existing?.amount ?? "";
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
    // Update chart currency toggle labels for disguise
    document.querySelectorAll(".chart-cur-btn").forEach(btn => {
        if (btn.dataset.mode === "original") btn.textContent = disguised ? "Split" : "原幣";
        if (btn.dataset.mode === "twd") btn.textContent = disguised ? "Gold" : "TWD";
        if (btn.dataset.mode === "usd") btn.textContent = disguised ? "Diamond" : "USD";
    });

    const list = await API.list();
    if (list.length === 0) return;

    const snapshots = await Promise.all(list.map(item => API.get(item.date)));
    const labels = snapshots.map(s => s.date);

    const datasets = [];

    if (chartCurrencyMode === "original") {
        // One line per currency that has data
        const currenciesUsed = new Set();
        snapshots.forEach(s => {
            for (const [cat, items] of Object.entries(s.assets || {})) {
                for (const item of items) if (item.currency) currenciesUsed.add(item.currency);
            }
        });
        const colors = {TWD: "#e74c3c", USD: "#2980b9", JPY: "#f39c12", EUR: "#27ae60"};
        let axisIdx = 0;
        for (const cur of currenciesUsed) {
            const data = snapshots.map(s => {
                let total = 0;
                for (const [cat, items] of Object.entries(s.assets || {})) {
                    for (const item of items) {
                        if (item.currency === cur) total += getAssetValue(cat, item);
                    }
                }
                return total;
            });
            const yId = `y-${cur.toLowerCase()}`;
            const curLabel = disguised ? `${DISGUISE_CURRENCY_MAP[cur] || "?"} Assets` : `${cur} Assets`;
            datasets.push({label: curLabel, data, borderColor: colors[cur] || "#999", yAxisID: yId});
            axisIdx++;
        }
    } else {
        const currency = chartCurrencyMode.toUpperCase();
        const data = snapshots.map(s => {
            const rates = s.exchange_rates || {};
            let total = 0;
            for (const [cat, items] of Object.entries(s.assets || {})) {
                for (const item of items) {
                    const val = getAssetValue(cat, item);
                    total += convertValue(val, item.currency, chartCurrencyMode, rates).value;
                }
            }
            return total;
        });
        const totalLabel = disguised ? "Total Power" : `總資產 (${CURRENCY_PREFIXES[currency] || currency})`;
        datasets.push({
            label: totalLabel,
            data, borderColor: "#2c3e50", fill: false
        });
    }

    if (trendChart) trendChart.destroy();

    let scales = {};
    if (chartCurrencyMode === "original") {
        // Build dual/multi axis
        const axisIds = [...new Set(datasets.map(d => d.yAxisID))];
        axisIds.forEach((id, i) => {
            const cur = id.replace("y-", "").toUpperCase();
            const axisLabel = disguised ? (DISGUISE_CURRENCY_MAP[cur] || cur) : cur;
            scales[id] = {
                type: "linear",
                position: i === 0 ? "left" : "right",
                title: {display: true, text: axisLabel},
                grid: {drawOnChartArea: i === 0}
            };
        });
    } else {
        scales = {y: {beginAtZero: false}};
    }

    const config = {
        type: "line",
        data: {labels, datasets},
        options: {responsive: true, scales}
    };

    trendChart = new Chart(document.getElementById("trend-chart"), config);
}

document.getElementById("nav-chart").addEventListener("click", renderChart);

init();
