from flask import Flask, render_template, jsonify, request
from datetime import date

app = Flask(__name__)

# 今日の進捗データ（インメモリ）
progress = {
    "date": str(date.today()),
    "count": 0,
    "total_minutes": 0,
}


def _reset_if_new_day():
    """日付が変わったらリセット"""
    today = str(date.today())
    if progress["date"] != today:
        progress["date"] = today
        progress["count"] = 0
        progress["total_minutes"] = 0


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/progress", methods=["GET"])
def get_progress():
    _reset_if_new_day()
    return jsonify(
        {"count": progress["count"], "totalMinutes": progress["total_minutes"]}
    )


@app.route("/api/progress", methods=["POST"])
def add_progress():
    _reset_if_new_day()
    data = request.get_json()
    minutes = data.get("minutes", 25) if data else 25
    # 不正な値を防ぐ
    if not isinstance(minutes, (int, float)) or minutes <= 0 or minutes > 60:
        minutes = 25
    progress["count"] += 1
    progress["total_minutes"] += int(minutes)
    return jsonify(
        {"count": progress["count"], "totalMinutes": progress["total_minutes"]}
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
