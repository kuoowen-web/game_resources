import json
import os
import re
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

def create_app(data_dir=None):
    app = Flask(__name__, static_folder=None)

    if data_dir is None:
        data_dir = str(Path(__file__).parent.parent / "data")
    snapshots_dir = os.path.join(data_dir, "snapshots")
    os.makedirs(snapshots_dir, exist_ok=True)

    cashflows_file = os.path.join(data_dir, "cashflows.json")

    def _load_cashflows():
        if not os.path.exists(cashflows_file):
            return []
        with open(cashflows_file, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def _save_cashflows(data):
        with open(cashflows_file, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)

    web_dir = str(Path(__file__).parent.parent / "web")

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
            if f.endswith(".json") and is_valid_date(f[:-5]):
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
        for i, f in enumerate(flows):
            f["id"] = i
        _save_cashflows(flows)
        return jsonify({"ok": True})

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
