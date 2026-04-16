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

    // --- API ---

    function fetchProgress() {
        fetch("/api/progress")
            .then((res) => res.json())
            .then((data) => updateProgressStats(data))
            .catch(() => {});
    }

    function postProgress(minutes) {
        fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutes: minutes }),
        })
            .then((res) => res.json())
            .then((data) => updateProgressStats(data))
            .catch(() => {});
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

    startBtn.addEventListener("click", () => {
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
})();
