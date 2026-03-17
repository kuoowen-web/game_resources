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

init();
