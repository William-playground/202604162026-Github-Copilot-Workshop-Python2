"""ポモドーロタイマー ゲーミフィケーション機能のテスト"""

import json
from datetime import date, timedelta
from unittest.mock import patch

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import (
    app,
    progress,
    gamification,
    _calculate_level,
    _xp_for_level,
    _weekly_count,
    BADGE_DEFINITIONS,
    XP_PER_POMODORO,
    XP_STREAK_BONUS,
)


@pytest.fixture
def client():
    """テスト用Flaskクライアント"""
    app.config["TESTING"] = True
    with app.test_client() as client:
        # 各テスト前にデータをリセット
        progress["date"] = str(date.today())
        progress["count"] = 0
        progress["total_minutes"] = 0
        gamification["xp"] = 0
        gamification["level"] = 1
        gamification["total_pomodoros"] = 0
        gamification["total_focus_minutes"] = 0
        gamification["badges"] = []
        gamification["streak_days"] = 0
        gamification["last_active_date"] = None
        gamification["history"] = {}
        yield client


class TestExistingEndpoints:
    """既存APIエンドポイントのテスト（後方互換性確認）"""

    def test_index(self, client):
        res = client.get("/")
        assert res.status_code == 200

    def test_get_progress_initial(self, client):
        res = client.get("/api/progress")
        data = json.loads(res.data)
        assert data["count"] == 0
        assert data["totalMinutes"] == 0

    def test_post_progress(self, client):
        res = client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        data = json.loads(res.data)
        assert data["count"] == 1
        assert data["totalMinutes"] == 25

    def test_post_progress_invalid_minutes(self, client):
        res = client.post(
            "/api/progress",
            data=json.dumps({"minutes": -5}),
            content_type="application/json",
        )
        data = json.loads(res.data)
        assert data["count"] == 1
        assert data["totalMinutes"] == 25  # デフォルト値


class TestXPAndLevel:
    """XP・レベルシステムのテスト"""

    def test_xp_for_level(self):
        assert _xp_for_level(1) == 0
        assert _xp_for_level(2) == 100
        assert _xp_for_level(3) == 400
        assert _xp_for_level(4) == 900

    def test_calculate_level(self):
        assert _calculate_level(0) == 1
        assert _calculate_level(99) == 1
        assert _calculate_level(100) == 2
        assert _calculate_level(399) == 2
        assert _calculate_level(400) == 3
        assert _calculate_level(899) == 3
        assert _calculate_level(900) == 4

    def test_xp_earned_on_pomodoro(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        # 初回: ストリーク1日目なので XP_PER_POMODORO + 1 * XP_STREAK_BONUS
        expected_xp = XP_PER_POMODORO + 1 * XP_STREAK_BONUS
        assert gamification["xp"] == expected_xp

    def test_level_up(self, client):
        # レベル2に到達するには100XP必要
        # 1回あたり 25 + 1*5 = 30XP -> 4回で120XP -> レベル2
        for _ in range(4):
            client.post(
                "/api/progress",
                data=json.dumps({"minutes": 25}),
                content_type="application/json",
            )
        assert gamification["level"] >= 2


class TestBadges:
    """バッジシステムのテスト"""

    def test_first_pomodoro_badge(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        badge_ids = [b["id"] for b in gamification["badges"]]
        assert "first_pomodoro" in badge_ids

    def test_five_pomodoros_badge(self, client):
        for _ in range(5):
            client.post(
                "/api/progress",
                data=json.dumps({"minutes": 25}),
                content_type="application/json",
            )
        badge_ids = [b["id"] for b in gamification["badges"]]
        assert "five_pomodoros" in badge_ids

    def test_hour_focus_badge(self, client):
        # 60分以上の集中で獲得
        for _ in range(3):
            client.post(
                "/api/progress",
                data=json.dumps({"minutes": 25}),
                content_type="application/json",
            )
        badge_ids = [b["id"] for b in gamification["badges"]]
        assert "hour_focus" in badge_ids

    def test_no_duplicate_badges(self, client):
        for _ in range(3):
            client.post(
                "/api/progress",
                data=json.dumps({"minutes": 25}),
                content_type="application/json",
            )
        first_count = sum(
            1 for b in gamification["badges"] if b["id"] == "first_pomodoro"
        )
        assert first_count == 1


class TestStreak:
    """ストリークのテスト"""

    def test_initial_streak(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        assert gamification["streak_days"] == 1

    def test_same_day_streak(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        assert gamification["streak_days"] == 1

    def test_consecutive_day_streak(self, client):
        today = date.today()
        yesterday = today - timedelta(days=1)

        # 昨日のアクティビティをシミュレート
        gamification["last_active_date"] = str(yesterday)
        gamification["streak_days"] = 1

        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        assert gamification["streak_days"] == 2

    def test_streak_reset(self, client):
        two_days_ago = date.today() - timedelta(days=2)

        # 2日前のアクティビティをシミュレート
        gamification["last_active_date"] = str(two_days_ago)
        gamification["streak_days"] = 5

        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        assert gamification["streak_days"] == 1


class TestGamificationAPI:
    """ゲーミフィケーションAPIのテスト"""

    def test_get_gamification_initial(self, client):
        res = client.get("/api/gamification")
        data = json.loads(res.data)
        assert data["xp"] == 0
        assert data["level"] == 1
        assert data["streakDays"] == 0
        assert data["totalPomodoros"] == 0
        assert len(data["badges"]) == len(BADGE_DEFINITIONS)
        # 初期状態では全バッジ未獲得
        for badge in data["badges"]:
            assert badge["earned"] is False

    def test_get_gamification_after_pomodoro(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        res = client.get("/api/gamification")
        data = json.loads(res.data)
        assert data["xp"] > 0
        assert data["level"] >= 1
        assert data["streakDays"] == 1
        assert data["totalPomodoros"] == 1
        # first_pomodoro バッジが earned
        first_badge = next(b for b in data["badges"] if b["id"] == "first_pomodoro")
        assert first_badge["earned"] is True


class TestStatisticsAPI:
    """統計APIのテスト"""

    def test_get_statistics_initial(self, client):
        res = client.get("/api/statistics")
        data = json.loads(res.data)
        assert "weekly" in data
        assert "monthly" in data
        assert data["weekly"]["totalCount"] == 0
        assert data["monthly"]["totalCount"] == 0
        assert len(data["weekly"]["data"]) == 7

    def test_get_statistics_after_pomodoro(self, client):
        client.post(
            "/api/progress",
            data=json.dumps({"minutes": 25}),
            content_type="application/json",
        )
        res = client.get("/api/statistics")
        data = json.loads(res.data)
        assert data["weekly"]["totalCount"] == 1
        assert data["weekly"]["totalMinutes"] == 25
        assert data["monthly"]["totalCount"] == 1
        assert data["monthly"]["totalMinutes"] == 25

    def test_weekly_data_has_day_labels(self, client):
        res = client.get("/api/statistics")
        data = json.loads(res.data)
        for day in data["weekly"]["data"]:
            assert "dayLabel" in day
            assert day["dayLabel"] in ["月", "火", "水", "木", "金", "土", "日"]

    def test_statistics_multiple_pomodoros(self, client):
        for _ in range(3):
            client.post(
                "/api/progress",
                data=json.dumps({"minutes": 25}),
                content_type="application/json",
            )
        res = client.get("/api/statistics")
        data = json.loads(res.data)
        assert data["weekly"]["totalCount"] == 3
        assert data["weekly"]["totalMinutes"] == 75


class TestWeeklyCount:
    """週間カウントヘルパーのテスト"""

    def test_weekly_count_empty(self):
        assert _weekly_count({}) == 0

    def test_weekly_count_with_data(self):
        today = date.today()
        history = {str(today): {"count": 3, "minutes": 75}}
        assert _weekly_count(history) == 3
