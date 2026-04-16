(() => {
    "use strict";

    // 設定（デフォルト値）
    let workMinutes = 25;
    let breakMinutes = 5;
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 85; // r=85 の円周

    // サウンド設定
    let soundStart = true;
    let soundEnd = true;
    let soundTick = false;

    // DOM要素
    const timerDisplay = document.getElementById("timerDisplay");
    const statusLabel = document.getElementById("statusLabel");
    const startBtn = document.getElementById("startBtn");
    const resetBtn = document.getElementById("resetBtn");
    const progressCircle = document.getElementById("progressCircle");
    const completedCount = document.getElementById("completedCount");
    const focusTime = document.getElementById("focusTime");
    const settingsToggle = document.getElementById("settingsToggle");
    const settingsPanel = document.getElementById("settingsPanel");
    const workOptions = document.getElementById("workOptions");
    const breakOptions = document.getElementById("breakOptions");
    const themeOptions = document.getElementById("themeOptions");
    const soundStartEl = document.getElementById("soundStart");
    const soundEndEl = document.getElementById("soundEnd");
    const soundTickEl = document.getElementById("soundTick");

    // 状態
    let totalSeconds = workMinutes * 60;
    let remainingSeconds = totalSeconds;
    let timerInterval = null;
    let isRunning = false;
    let isBreak = false;

    // --- Web Audio API サウンド ---

    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTone(frequency, duration, type) {
        try {
            const ctx = getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = type || "sine";
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            // サウンド再生に失敗した場合は無視
        }
    }

    function playStartSound() {
        if (soundStart) {
            playTone(880, 0.15, "sine");
        }
    }

    function playEndSound() {
        if (soundEnd) {
            playTone(523.25, 0.3, "sine");
            setTimeout(() => playTone(659.25, 0.3, "sine"), 200);
            setTimeout(() => playTone(783.99, 0.5, "sine"), 400);
        }
    }

    function playTickSound() {
        if (soundTick) {
            playTone(1000, 0.03, "square");
        }
    }

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
            totalSeconds = breakMinutes * 60;
        } else {
            statusLabel.textContent = "作業中";
            statusLabel.classList.remove("break-mode");
            progressCircle.classList.remove("break-mode");
            totalSeconds = workMinutes * 60;
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
        playTickSound();
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
        playStartSound();
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
        playEndSound();
        if (!isBreak) {
            // 作業完了 → 進捗を記録して休憩へ
            postProgress(workMinutes);
            setMode(true);
        } else {
            // 休憩完了 → 作業モードへ
            setMode(false);
        }
    }

    // --- 設定パネル ---

    function selectOption(container, value) {
        container.querySelectorAll(".option-btn").forEach((btn) => {
            btn.classList.toggle("selected", btn.dataset.value === String(value));
        });
    }

    settingsToggle.addEventListener("click", () => {
        const isOpen = !settingsPanel.hidden;
        settingsPanel.hidden = isOpen;
        settingsToggle.classList.toggle("active", !isOpen);
    });

    workOptions.addEventListener("click", (e) => {
        const btn = e.target.closest(".option-btn");
        if (!btn || isRunning) return;
        workMinutes = parseInt(btn.dataset.value, 10);
        selectOption(workOptions, workMinutes);
        if (!isBreak) {
            setMode(false);
        }
    });

    breakOptions.addEventListener("click", (e) => {
        const btn = e.target.closest(".option-btn");
        if (!btn || isRunning) return;
        breakMinutes = parseInt(btn.dataset.value, 10);
        selectOption(breakOptions, breakMinutes);
        if (isBreak) {
            setMode(true);
        }
    });

    themeOptions.addEventListener("click", (e) => {
        const btn = e.target.closest(".option-btn");
        if (!btn) return;
        const theme = btn.dataset.value;
        document.documentElement.setAttribute("data-theme", theme);
        selectOption(themeOptions, theme);
    });

    soundStartEl.addEventListener("change", () => {
        soundStart = soundStartEl.checked;
    });

    soundEndEl.addEventListener("change", () => {
        soundEnd = soundEndEl.checked;
    });

    soundTickEl.addEventListener("change", () => {
        soundTick = soundTickEl.checked;
    });

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
