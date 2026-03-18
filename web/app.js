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

// === Comparison ===
function compareSnapshots(a, b) {
    const container = document.getElementById("compare-content");
    const hdrA = disguised ? `Season ${a.date}` : a.date;
    const hdrB = disguised ? `Season ${b.date}` : b.date;
    container.innerHTML = `<h2>${hdrA} vs ${hdrB}</h2>`;

    const nameLabel = disguised ? "Item" : "名稱";
    const deltaLabel = disguised ? "Delta" : "變化";

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

        for (let i = 0; i < allNames.length; i++) {
            const name = allNames[i];
            const itemA = itemsA.find(it => it.name === name);
            const itemB = itemsB.find(it => it.name === name);
            const valA = itemA ? getAssetValue(cat, itemA) : 0;
            const valB = itemB ? getAssetValue(cat, itemB) : 0;
            const currency = (itemA || itemB).currency || "TWD";
            const delta = valB - valA;
            const pct = valA !== 0 ? ((delta / valA) * 100).toFixed(1) + "%" : "—";

            const tr = document.createElement("tr");
            const deltaClass = !itemA ? "delta-new" : !itemB ? "delta-removed" : delta >= 0 ? "delta-positive" : "delta-negative";
            const sign = delta >= 0 ? "+" : "";
            const dName = disguiseName(name, cat, i);

            tr.innerHTML = `<td class="${!itemA ? "delta-new" : !itemB ? "delta-removed" : ""}">${dName}</td>
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
