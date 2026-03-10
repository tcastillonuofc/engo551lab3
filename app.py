from flask import Flask, render_template, request, jsonify
import requests
import os
from datetime import datetime, timedelta, date

app = Flask(__name__)

username = os.environ.get("CALGARY_API_KEY_ID")
password = os.environ.get("CALGARY_API_KEY_SECRET")

BASE_URL = "https://data.calgary.ca/api/v3/views/c2es-76ed/query.geojson"

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/permits")
def get_permits():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return jsonify({"error": "start_date and end_date are required"}), 400

    try:
        start_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Dates must be in YYYY-MM-DD format"}), 400

    today = date.today()

    if start_obj > today or end_obj > today:
        return jsonify({"error": "Date range cannot exceed the present date."}), 400

    if end_obj < start_obj:
        return jsonify({"error": "End date must be on or after start date"}), 400

    end_exclusive = end_obj + timedelta(days=1)

    where_clause = (
        f"issueddate >= '{start_date}T00:00:00' "
        f"and issueddate < '{end_exclusive.strftime('%Y-%m-%d')}T00:00:00'"
    )

    params = {
        "$where": where_clause,
        "pageNumber": 1,
        "pageSize": 5000
    }

    try:
        response = requests.get(
            BASE_URL,
            auth=(username, password),
            params=params,
            timeout=30
        )
        response.raise_for_status()

        data = response.json()
        raw_features = data.get("features", [])

        filtered_features = []
        for feature in raw_features:
            props = feature.get("properties", {})
            issued = props.get("issueddate")

            if not issued:
                continue

            issued_day = issued[:10]
            if start_date <= issued_day <= end_date:
                filtered_features.append(feature)

        data["features"] = filtered_features
        return jsonify(data)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)