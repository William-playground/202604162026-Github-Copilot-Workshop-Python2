(() => {
    "use strict";

    // 定数
    const WORK_MINUTES = 25;
    const BREAK_MINUTES = 5;
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 85; // r=85 の円周

    // DOM要素
    const timerDisplay = document.getElementById("timerDisplay");
    const statusLabel = document.getElementById("statusLabel");
    const startBtn = document.getElementById("startBtn");
    const resetBtn = document.getElementById("resetBtn");
    const progressCircle = document.getElementById("progressCircle");
    const completedCount = document.getElementById("completedCount");
    const focusTime = document.getElementById("focusTime");

    // ゲーミフィケーションDOM要素
    const levelBadge = document.getElementById("levelBadge");
    const xpText = document.getElementById("xpText");
    const xpBar = document.getElementById("xpBar");
    const streakBadge = document.getElementById("streakBadge");
    const badgesGrid = document.getElementById("badgesGrid");
    const weeklyChart = document.getElementById("weeklyChart");
    const weeklyCount = document.getElementById("weeklyCount");
    const weeklyMinutes = document.getElementById("weeklyMinutes");
    const weeklyAvg = document.getElementById("weeklyAvg");

    // 状態
    let totalSeconds = WORK_MINUTES * 60;
    let remainingSeconds = totalSeconds;
    let timerInterval = null;
    let isRunning = false;
    let isBreak = false;

    // --- 表示更新 ---

    function updateDisplay() {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        timerDisplay.textContent =
            String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function updateProgress() {
        const elapsed = totalSeconds - remainingSeconds;
        const fraction = totalSeconds > 0 ? elapsed / totalSeconds : 0;
        const offset = CIRCLE_CIRCUMFERENCE * (1 - fraction);
        progressCircle.style.strokeDashoffset = offset;
    }

    function setMode(breakMode) {
        isBreak = breakMode;
        if (breakMode) {
            statusLabel.textContent = "休憩中";
            statusLabel.classList.add("break-mode");
            progressCircle.classList.add("break-mode");
            totalSeconds = BREAK_MINUTES * 60;
        } else {
            statusLabel.textContent = "作業中";
            statusLabel.classList.remove("break-mode");
            progressCircle.classList.remove("break-mode");
            totalSeconds = WORK_MINUTES * 60;
        }
        remainingSeconds = totalSeconds;
        updateDisplay();
        updateProgress();
    }

    function formatFocusTime(totalMinutes) {
        if (totalMinutes < 60) {
            return totalMinutes + "分";
        }
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (mins === 0) {
            return hours + "時間";
        }
        return hours + "時間" + mins + "分";
    }

    function updateProgressStats(data) {
        completedCount.textContent = data.count;
        focusTime.textContent = formatFocusTime(data.totalMinutes);
    }

    // --- ゲーミフィケーション表示更新 ---

    function updateGamification(data) {
        // レベル・XP
        levelBadge.textContent = "Lv." + data.level;
        xpText.textContent = data.xpInLevel + " / " + data.xpNeeded + " XP";
        xpBar.style.width = Math.min(data.xpProgress * 100, 100) + "%";

        // ストリーク
        streakBadge.textContent = "🔥 " + data.streakDays + "日";

        // バッジ
        renderBadges(data.badges);
    }

    function renderBadges(badges) {
        badgesGrid.innerHTML = "";
        badges.forEach(function (badge) {
            const item = document.createElement("div");
            item.className = "badge-item " + (badge.earned ? "earned" : "locked");
            item.title = badge.description;

            const icon = document.createElement("span");
            icon.className = "badge-icon";
            icon.textContent = badge.earned ? badge.icon : "🔒";

            const name = document.createElement("span");
            name.className = "badge-name";
            name.textContent = badge.name;

            item.appendChild(icon);
            item.appendChild(name);
            badgesGrid.appendChild(item);
        });
    }

    function updateStatistics(data) {
        var weekly = data.weekly;

        // 週間チャート
        var maxCount = weekly.data.reduce(function (max, d) { return d.count > max ? d.count : max; }, 0);
        if (maxCount === 0) maxCount = 1;

        weeklyChart.innerHTML = "";
        weekly.data.forEach(function (day) {
            var wrapper = document.createElement("div");
            wrapper.className = "chart-bar-wrapper";

            var track = document.createElement("div");
            track.className = "chart-bar-track";

            var bar = document.createElement("div");
            var heightPercent = day.count > 0 ? Math.max((day.count / maxCount) * 100, 8) : 0;
            bar.className = "chart-bar" + (day.count === 0 ? " empty" : "");
            bar.style.height = heightPercent + "%";

            track.appendChild(bar);

            var label = document.createElement("span");
            label.className = "chart-day-label";
            label.textContent = day.dayLabel;

            wrapper.appendChild(track);
            wrapper.appendChild(label);
            weeklyChart.appendChild(wrapper);
        });

        // サマリー
        weeklyCount.textContent = weekly.totalCount;
        weeklyMinutes.textContent = formatFocusTime(weekly.totalMinutes);
        weeklyAvg.textContent = formatFocusTime(weekly.avgMinutesPerDay);
    }

    // --- API ---

    function fetchProgress() {
        fetch("/api/progress")
            .then(function (res) { return res.json(); })
            .then(function (data) { updateProgressStats(data); })
            .catch(function () {});
    }

    function fetchGamification() {
        fetch("/api/gamification")
            .then(function (res) { return res.json(); })
            .then(function (data) { updateGamification(data); })
            .catch(function () {});
    }

    function fetchStatistics() {
        fetch("/api/statistics")
            .then(function (res) { return res.json(); })
            .then(function (data) { updateStatistics(data); })
            .catch(function () {});
    }

    function postProgress(minutes) {
        fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutes: minutes }),
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                updateProgressStats(data);
                // ゲーミフィケーション・統計を更新
                fetchGamification();
                fetchStatistics();
            })
            .catch(function () {});
    }

    // --- タイマー制御 ---

    function tick() {
        remainingSeconds--;
        updateDisplay();
        updateProgress();

        if (remainingSeconds <= 0) {
            stop();
            onTimerComplete();
        }
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        startBtn.textContent = "一時停止";
        timerInterval = setInterval(tick, 1000);
    }

    function pause() {
        if (!isRunning) return;
        isRunning = false;
        startBtn.textContent = "再開";
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function stop() {
        isRunning = false;
        startBtn.textContent = "開始";
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function reset() {
        stop();
        setMode(false);
    }

    function onTimerComplete() {
        if (!isBreak) {
            // 作業完了 → 進捗を記録して休憩へ
            postProgress(WORK_MINUTES);
            setMode(true);
        } else {
            // 休憩完了 → 作業モードへ
            setMode(false);
        }
    }

    // --- イベント ---

    startBtn.addEventListener("click", function () {
        if (isRunning) {
            pause();
        } else {
            start();
        }
    });

    resetBtn.addEventListener("click", reset);

    // 初期化
    updateDisplay();
    updateProgress();
    fetchProgress();
    fetchGamification();
    fetchStatistics();
})();
