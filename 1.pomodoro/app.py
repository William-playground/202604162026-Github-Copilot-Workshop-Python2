import math
from flask import Flask, render_template, jsonify, request
from datetime import date, timedelta

app = Flask(__name__)

# --- データストア（インメモリ） ---

# 今日の進捗データ
progress = {
    "date": str(date.today()),
    "count": 0,
    "total_minutes": 0,
}

# ゲーミフィケーションデータ
gamification = {
    "xp": 0,
    "level": 1,
    "total_pomodoros": 0,
    "total_focus_minutes": 0,
    "badges": [],
    "streak_days": 0,
    "last_active_date": None,
    # 日別履歴: { "YYYY-MM-DD": { "count": N, "minutes": M } }
    "history": {},
}

# --- バッジ定義 ---

BADGE_DEFINITIONS = [
    {
        "id": "first_pomodoro",
        "name": "はじめの一歩",
        "description": "初めてのポモドーロを完了",
        "icon": "🌱",
        "check": lambda g, _h: g["total_pomodoros"] >= 1,
    },
    {
        "id": "five_pomodoros",
        "name": "集中の芽",
        "description": "累計5回のポモドーロを完了",
        "icon": "🌿",
        "check": lambda g, _h: g["total_pomodoros"] >= 5,
    },
    {
        "id": "ten_pomodoros",
        "name": "集中マスター",
        "description": "累計10回のポモドーロを完了",
        "icon": "🌳",
        "check": lambda g, _h: g["total_pomodoros"] >= 10,
    },
    {
        "id": "fifty_pomodoros",
        "name": "ポモドーロの達人",
        "description": "累計50回のポモドーロを完了",
        "icon": "🏆",
        "check": lambda g, _h: g["total_pomodoros"] >= 50,
    },
    {
        "id": "streak_3",
        "name": "3日連続",
        "description": "3日連続でポモドーロを完了",
        "icon": "🔥",
        "check": lambda g, _h: g["streak_days"] >= 3,
    },
    {
        "id": "streak_7",
        "name": "1週間連続",
        "description": "7日連続でポモドーロを完了",
        "icon": "💪",
        "check": lambda g, _h: g["streak_days"] >= 7,
    },
    {
        "id": "weekly_10",
        "name": "今週10回達成",
        "description": "1週間で10回のポモドーロを完了",
        "icon": "⭐",
        "check": lambda _g, h: _weekly_count(h) >= 10,
    },
    {
        "id": "hour_focus",
        "name": "1時間集中",
        "description": "累計60分以上集中",
        "icon": "⏰",
        "check": lambda g, _h: g["total_focus_minutes"] >= 60,
    },
    {
        "id": "five_hour_focus",
        "name": "5時間集中",
        "description": "累計300分以上集中",
        "icon": "🧠",
        "check": lambda g, _h: g["total_focus_minutes"] >= 300,
    },
]


def _weekly_count(history):
    """今週（月曜始まり）の完了数を返す"""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    total = 0
    for i in range(7):
        day_str = str(monday + timedelta(days=i))
        if day_str in history:
            total += history[day_str]["count"]
    return total


# --- XP・レベル計算 ---

XP_PER_POMODORO = 25
XP_STREAK_BONUS = 5  # ストリーク日数 × このボーナス


def _xp_for_level(level):
    """レベルに到達するために必要な累計XPを返す"""
    return (level - 1) * (level - 1) * 100


def _calculate_level(xp):
    """累計XPからレベルを算出"""
    level = 1
    while _xp_for_level(level + 1) <= xp:
        level += 1
    return level


# --- ヘルパー ---


def _reset_if_new_day():
    """日付が変わったらリセット"""
    today = str(date.today())
    if progress["date"] != today:
        progress["date"] = today
        progress["count"] = 0
        progress["total_minutes"] = 0


def _update_streak():
    """ストリーク（連続日数）を更新"""
    today = str(date.today())
    last = gamification["last_active_date"]

    if last is None:
        gamification["streak_days"] = 1
    elif last == today:
        pass  # 同じ日なら何もしない
    elif last == str(date.today() - timedelta(days=1)):
        gamification["streak_days"] += 1
    else:
        gamification["streak_days"] = 1

    gamification["last_active_date"] = today


def _record_history(minutes):
    """日別履歴を記録"""
    today = str(date.today())
    if today not in gamification["history"]:
        gamification["history"][today] = {"count": 0, "minutes": 0}
    gamification["history"][today]["count"] += 1
    gamification["history"][today]["minutes"] += int(minutes)


def _check_badges():
    """新しいバッジを獲得したかチェック"""
    earned_ids = {b["id"] for b in gamification["badges"]}
    for badge_def in BADGE_DEFINITIONS:
        if badge_def["id"] not in earned_ids:
            if badge_def["check"](gamification, gamification["history"]):
                gamification["badges"].append(
                    {
                        "id": badge_def["id"],
                        "name": badge_def["name"],
                        "description": badge_def["description"],
                        "icon": badge_def["icon"],
                        "earned_date": str(date.today()),
                    }
                )


def _get_statistics():
    """週間・月間統計を計算"""
    today = date.today()
    history = gamification["history"]

    # 週間統計（過去7日）
    weekly_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = str(day)
        entry = history.get(day_str, {"count": 0, "minutes": 0})
        weekly_data.append(
            {
                "date": day_str,
                "dayLabel": ["月", "火", "水", "木", "金", "土", "日"][day.weekday()],
                "count": entry["count"],
                "minutes": entry["minutes"],
            }
        )

    weekly_total_count = sum(d["count"] for d in weekly_data)
    weekly_total_minutes = sum(d["minutes"] for d in weekly_data)
    weekly_active_days = sum(1 for d in weekly_data if d["count"] > 0)
    weekly_avg_minutes = (
        round(weekly_total_minutes / weekly_active_days)
        if weekly_active_days > 0
        else 0
    )

    # 月間統計（過去30日）
    monthly_total_count = 0
    monthly_total_minutes = 0
    monthly_active_days = 0
    for i in range(30):
        day_str = str(today - timedelta(days=i))
        if day_str in history:
            monthly_total_count += history[day_str]["count"]
            monthly_total_minutes += history[day_str]["minutes"]
            monthly_active_days += 1

    monthly_avg_minutes = (
        round(monthly_total_minutes / monthly_active_days)
        if monthly_active_days > 0
        else 0
    )

    return {
        "weekly": {
            "data": weekly_data,
            "totalCount": weekly_total_count,
            "totalMinutes": weekly_total_minutes,
            "activeDays": weekly_active_days,
            "avgMinutesPerDay": weekly_avg_minutes,
        },
        "monthly": {
            "totalCount": monthly_total_count,
            "totalMinutes": monthly_total_minutes,
            "activeDays": monthly_active_days,
            "avgMinutesPerDay": monthly_avg_minutes,
        },
    }


# --- ルート ---


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

    # ゲーミフィケーション更新
    _update_streak()
    _record_history(minutes)
    gamification["total_pomodoros"] += 1
    gamification["total_focus_minutes"] += int(minutes)

    # XP加算（基本XP + ストリークボーナス）
    earned_xp = XP_PER_POMODORO + (gamification["streak_days"] * XP_STREAK_BONUS)
    gamification["xp"] += earned_xp
    gamification["level"] = _calculate_level(gamification["xp"])

    # バッジチェック
    _check_badges()

    return jsonify(
        {"count": progress["count"], "totalMinutes": progress["total_minutes"]}
    )


@app.route("/api/gamification", methods=["GET"])
def get_gamification():
    """XP、レベル、バッジ、ストリーク情報を返す"""
    level = gamification["level"]
    current_level_xp = _xp_for_level(level)
    next_level_xp = _xp_for_level(level + 1)
    xp_in_level = gamification["xp"] - current_level_xp
    xp_needed = next_level_xp - current_level_xp

    # 全バッジ定義の取得（獲得状況付き）
    earned_ids = {b["id"] for b in gamification["badges"]}
    all_badges = []
    for badge_def in BADGE_DEFINITIONS:
        badge_info = {
            "id": badge_def["id"],
            "name": badge_def["name"],
            "description": badge_def["description"],
            "icon": badge_def["icon"],
            "earned": badge_def["id"] in earned_ids,
        }
        if badge_def["id"] in earned_ids:
            earned_badge = next(
                b for b in gamification["badges"] if b["id"] == badge_def["id"]
            )
            badge_info["earnedDate"] = earned_badge["earned_date"]
        all_badges.append(badge_info)

    return jsonify(
        {
            "xp": gamification["xp"],
            "level": level,
            "xpInLevel": max(xp_in_level, 0),
            "xpNeeded": xp_needed,
            "xpProgress": max(xp_in_level / xp_needed, 0) if xp_needed > 0 else 0,
            "totalPomodoros": gamification["total_pomodoros"],
            "totalFocusMinutes": gamification["total_focus_minutes"],
            "streakDays": gamification["streak_days"],
            "badges": all_badges,
        }
    )


@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """週間・月間統計を返す"""
    return jsonify(_get_statistics())


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
