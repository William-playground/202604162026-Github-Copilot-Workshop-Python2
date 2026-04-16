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
    const particleCanvas = document.getElementById("particleCanvas");
    const ctx = particleCanvas.getContext("2d");

    // 状態
    let totalSeconds = WORK_MINUTES * 60;
    let remainingSeconds = totalSeconds;
    let timerInterval = null;
    let isRunning = false;
    let isBreak = false;

    // --- 色の変化（青→黄→赤） ---

    /**
     * 残り時間の割合に応じた色を返す
     * 100%~50%: 青(#4A90D9) → 黄(#F5A623)
     * 50%~0%:   黄(#F5A623) → 赤(#E74C3C)
     */
    function getProgressColor(fraction) {
        // fraction: 0(開始) → 1(完了)
        if (fraction <= 0.5) {
            // 青→黄
            const t = fraction / 0.5;
            return lerpColor(0x4A, 0x90, 0xD9, 0xF5, 0xA6, 0x23, t);
        } else {
            // 黄→赤
            const t = (fraction - 0.5) / 0.5;
            return lerpColor(0xF5, 0xA6, 0x23, 0xE7, 0x4C, 0x3C, t);
        }
    }

    function lerpColor(r1, g1, b1, r2, g2, b2, t) {
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return "rgb(" + r + "," + g + "," + b + ")";
    }

    // --- パーティクルエフェクト ---

    const particles = [];
    const MAX_PARTICLES = 30;
    let animationFrameId = null;

    function resizeCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            radius: Math.random() * 3 + 1,
            opacity: Math.random() * 0.4 + 0.1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            pulseSpeed: Math.random() * 0.02 + 0.01,
            pulsePhase: Math.random() * Math.PI * 2,
        };
    }

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            particles.push(createParticle());
        }
    }

    function updateParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.pulsePhase += p.pulseSpeed;

            // 画面外に出たら反対側に戻す
            if (p.x < -10) p.x = particleCanvas.width + 10;
            if (p.x > particleCanvas.width + 10) p.x = -10;
            if (p.y < -10) p.y = particleCanvas.height + 10;
            if (p.y > particleCanvas.height + 10) p.y = -10;
        }
    }

    function drawParticles() {
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const pulse = Math.sin(p.pulsePhase) * 0.5 + 0.5;
            const currentRadius = p.radius + pulse * 2;
            const currentOpacity = p.opacity * (0.5 + pulse * 0.5);

            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, " + currentOpacity + ")";
            ctx.fill();
        }
    }

    function animateParticles() {
        updateParticles();
        drawParticles();
        animationFrameId = requestAnimationFrame(animateParticles);
    }

    function startParticles() {
        if (animationFrameId !== null) return;
        initParticles();
        animateParticles();
    }

    function stopParticles() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

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

        // 作業中のみ色を変化させる（休憩中は緑のまま）
        if (!isBreak) {
            progressCircle.style.stroke = getProgressColor(fraction);
        }
    }

    function setMode(breakMode) {
        isBreak = breakMode;
        if (breakMode) {
            statusLabel.textContent = "休憩中";
            statusLabel.classList.add("break-mode");
            progressCircle.classList.add("break-mode");
            progressCircle.style.stroke = "";
            totalSeconds = BREAK_MINUTES * 60;
            stopParticles();
        } else {
            statusLabel.textContent = "作業中";
            statusLabel.classList.remove("break-mode");
            progressCircle.classList.remove("break-mode");
            progressCircle.style.stroke = "";
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
        // 作業中はパーティクル開始
        if (!isBreak) {
            startParticles();
        }
    }

    function pause() {
        if (!isRunning) return;
        isRunning = false;
        startBtn.textContent = "再開";
        clearInterval(timerInterval);
        timerInterval = null;
        stopParticles();
    }

    function stop() {
        isRunning = false;
        startBtn.textContent = "開始";
        clearInterval(timerInterval);
        timerInterval = null;
        stopParticles();
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
