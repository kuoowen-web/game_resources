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

// === State ===
let currentSnapshot = null;
let currencyMode = "original";
const editingCategories = new Set();
let disguised = true; // privacy: show game terms by default

// === Disguise System ===
const DISGUISE_CATEGORIES = {
    deposits: "金幣儲藏",
    insurance: "防禦裝備",
    bonds: "鍛造材料",
    structured_products: "附魔寶石",
    tw_stocks: "本地市集",
    us_stocks: "跨境市集"
};

const DISGUISE_ITEM_PREFIXES = {
    deposits: "金幣袋",
    insurance: "護盾",
    bonds: "秘銀錠",
    structured_products: "混沌石",
    tw_stocks: "商品",
    us_stocks: "異界品"
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
    return currency === "TWD" ? "G" : "D";
}

function disguiseMoneyPrefix(currency) {
    if (!disguised) return currency === "TWD" ? "NT$" : "US$";
    return currency === "TWD" ? "" : "";
}

function formatMoney(value, currency) {
    const prefix = disguised ? "" : (currency === "TWD" ? "NT$" : "US$");
    const suffix = disguised ? (currency === "TWD" ? "G" : "D") : "";
    const num = value.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 0});
    return `${prefix}${num}${suffix}`;
}

// Secret key sequence listener
let keyBuffer = "";
document.addEventListener("keydown", (e) => {
    // Only listen when not focused on an input/select
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
    us_stocks: "美股"
};

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

// === Render Overview ===
function renderSnapshot(snapshot) {
    const container = document.getElementById("snapshot-content");
    const totalsDiv = document.getElementById("snapshot-totals");
    container.innerHTML = "";
    totalsDiv.innerHTML = "";

    const rate = snapshot.exchange_rates?.USD_TWD || 32;
    let totalTWD = 0, totalUSD = 0;

    // Snapshot meta (note + exchange rate, editable inline)
    const metaDiv = document.createElement("div");
    metaDiv.className = "snapshot-meta";
    if (disguised) {
        metaDiv.innerHTML = `
            <div class="form-group"><label>Season</label><span>${snapshot.date}</span></div>
            <div class="form-group"><label>G/D Rate</label><span>${rate}</span></div>
        `;
    } else {
        metaDiv.innerHTML = `
            <div class="form-group"><label>日期</label><span>${snapshot.date}</span></div>
            <div class="form-group"><label>備註</label><input id="meta-note" type="text" value="${snapshot.note || ""}" style="width:200px"></div>
            <div class="form-group"><label>USD/TWD</label><input id="meta-rate" type="number" step="0.1" value="${rate}" style="width:80px"></div>
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

    const categories = ["deposits", "insurance", "bonds", "structured_products", "tw_stocks", "us_stocks"];

    for (const cat of categories) {
        const items = snapshot.assets?.[cat] || [];
        const isEditing = editingCategories.has(cat);

        // Show category even if empty when editing
        if (items.length === 0 && !isEditing) continue;

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
            editBtn.onclick = () => {
                if (isEditing) {
                    collectCategoryData(cat, snapshot);
                    editingCategories.delete(cat);
                } else {
                    editingCategories.add(cat);
                }
                renderSnapshot(snapshot);
            };
            header.appendChild(editBtn);
        }
        div.appendChild(header);

        if (isEditing) {
            // Edit mode: show editable form rows
            const editContainer = document.createElement("div");
            editContainer.id = `edit-${cat}`;
            const fields = ASSET_FIELDS[cat];

            for (let i = 0; i < items.length; i++) {
                editContainer.appendChild(buildEditRow(cat, fields, items[i], i));
            }

            // Add item button
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
            // View mode: show table
            const table = document.createElement("table");
            table.className = "asset-table";
            table.appendChild(buildHeaderRow(cat));

            const tbody = document.createElement("tbody");
            let catTWD = 0, catUSD = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const value = getAssetValue(cat, item);
                const currency = item.currency;
                if (currency === "TWD") { totalTWD += value; catTWD += value; }
                else if (currency === "USD") { totalUSD += value; catUSD += value; }
                tbody.appendChild(buildAssetRow(cat, item, value, rate, i));
            }

            // Subtotal
            const subtotalRow = document.createElement("tr");
            subtotalRow.style.fontWeight = "bold";
            subtotalRow.style.borderTop = "2px solid #ccc";
            const subtotalText = buildSubtotalText(catTWD, catUSD, rate);
            const colCount = table.querySelector("thead tr").children.length;
            const subtotalLabel = disguised ? "Subtotal" : "小計";
        subtotalRow.innerHTML = `<td>${subtotalLabel}</td><td colspan="${colCount - 1}" style="text-align:right">${subtotalText}</td>`;
            tbody.appendChild(subtotalRow);

            table.appendChild(tbody);
            div.appendChild(table);
        }

        container.appendChild(div);
    }

    renderTotals(totalsDiv, totalTWD, totalUSD, rate);
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

function buildAssetRow(cat, item, value, rate, idx) {
    const tr = document.createElement("tr");
    const converted = convertValue(value, item.currency, currencyMode, rate);
    const displayVal = formatMoney(converted.value, converted.currency);
    const dName = disguiseName(item.name, cat, idx);
    const dCur = disguiseCurrency(item.currency);

    switch (cat) {
        case "deposits":
            tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${displayVal}</td>`;
            break;
        case "insurance": {
            const insType = disguised ? (item.type === "savings" ? "Buff" : "Passive") : (item.type === "savings" ? "儲蓄" : "醫療");
            const insVal = item.type === "savings"
                ? formatMoney(convertValue(item.surrender_value || 0, item.currency, currencyMode, rate).value, convertValue(0, item.currency, currencyMode, rate).currency)
                : "—";
            const premConv = convertValue(item.annual_premium, item.currency, currencyMode, rate);
            tr.innerHTML = `<td>${dName}</td><td>${insType}</td><td>${dCur}</td><td>${insVal}</td><td>${formatMoney(premConv.value, premConv.currency)}</td>`;
            break;
        }
        case "bonds":
            if (disguised) {
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.units}</td><td>${(item.coupon_rate * 100).toFixed(1)}%</td><td>—</td><td>${displayVal}</td>`;
            } else {
                tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${item.units}</td><td>${(item.coupon_rate * 100).toFixed(1)}%</td>
                    <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price_per_unit" value="${item.current_price_per_unit ?? ""}"></td>
                    <td>${displayVal}</td>`;
            }
            break;
        case "structured_products": {
            const prinConv = convertValue(item.principal, item.currency, currencyMode, rate);
            const dLinked = disguised ? "Enchant" : (item.linked_to || "");
            tr.innerHTML = `<td>${dName}</td><td>${dCur}</td><td>${formatMoney(prinConv.value, prinConv.currency)}</td><td>${displayVal}</td><td>${dLinked}</td>`;
            break;
        }
        case "tw_stocks":
        case "us_stocks":
            if (disguised) {
                tr.innerHTML = `<td>${dName}</td><td>${item.shares}</td><td>${item.avg_cost}</td><td>—</td><td>${displayVal}</td>`;
            } else {
                tr.innerHTML = `<td>${dName}</td><td>${item.shares}</td><td>${item.avg_cost}</td>
                    <td><input class="calc-input" type="number" data-cat="${cat}" data-name="${item.name}" data-field="current_price" value="${item.current_price ?? ""}"></td>
                    <td>${displayVal}</td>`;
            }
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
    const labelTWD = disguised ? "Gold Assets" : "台幣資產";
    const labelUSD = disguised ? "Diamond Assets" : "美元資產";
    const labelTotal = disguised ? "Total Power" : "總資產";

    if (currencyMode === "original") {
        container.innerHTML = `
            <div class="total-row"><span>${labelTWD}</span><span>${formatMoney(totalTWD, "TWD")}</span></div>
            <div class="total-row"><span>${labelUSD}</span><span>${formatMoney(totalUSD, "USD")}</span></div>`;
    } else if (currencyMode === "twd") {
        const total = totalTWD + totalUSD * rate;
        container.innerHTML = `<div class="total-row grand"><span>${labelTotal}</span><span>${formatMoney(total, "TWD")}</span></div>`;
    } else {
        const total = totalTWD / rate + totalUSD;
        container.innerHTML = `<div class="total-row grand"><span>${labelTotal}</span><span>${formatMoney(total, "USD")}</span></div>`;
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
    // Collect meta fields
    const noteEl = document.getElementById("meta-note");
    const rateEl = document.getElementById("meta-rate");
    if (noteEl) currentSnapshot.note = noteEl.value;
    if (rateEl) currentSnapshot.exchange_rates = {USD_TWD: parseFloat(rateEl.value)};
    // Collect any categories still in edit mode
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

    let assets = {deposits: [], insurance: [], bonds: [], structured_products: [], tw_stocks: [], us_stocks: []};
    if (copyExisting && currentSnapshot) {
        assets = JSON.parse(JSON.stringify(currentSnapshot.assets));
    }

    const snapshot = {date, note, exchange_rates: {USD_TWD: rate}, assets};
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
        const twdData = snapshots.map(s => {
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

document.getElementById("nav-chart").addEventListener("click", renderChart);

init();
