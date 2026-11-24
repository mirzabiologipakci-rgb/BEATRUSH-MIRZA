
const lanes = document.querySelectorAll(".lane");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("highScore");
const comboDisplay = document.getElementById("combo");
const timeDisplay = document.getElementById("time");
const message = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const finishBtn = document.getElementById("finishBtn");
const tempoSelect = document.getElementById("tempoSelect");

for (let bpm = 60; bpm <= 200; bpm++) {
    const option = document.createElement("option");
    option.value = bpm;
    option.textContent = `${bpm} BPM`;
    if (bpm === 120) option.selected = true;
    tempoSelect.appendChild(option);
}

const keys = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"];
const arrows = ["←", "↓", "↑", "→"];

let score = 0;
let highScore = Number(localStorage.getItem("beatRushHighScore")) || 0;
let combo = 0;
highScoreDisplay.textContent = highScore;
let time = 60;
let gameDuration = 60;
let playing = false;
let notes = [];
let countdown;
let animationId;
let gameStartedAt = 0;
let nextSpawnAt = 0;
let lastFrameTimestamp = 0;
let beatPeriod = 60000 / 120;
let beatPhase = 0;
let musicLoopDuration = 0;
let musicLoopCount = 0;
let previousMusicTime = 0;

const gameArea = document.querySelector(".game-area");
const NOTE_SPEED = 210; // pixels per second

function getHitLine() {
    const target = document.querySelector(".target");
    const areaRect = gameArea.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return targetRect.top - areaRect.top;
}

function startGame() {
    if (playing) return;

    score = 0;
    combo = 0;
    time = gameDuration;
    notes = [];
    playing = true;

    document.querySelectorAll(".note").forEach(n => n.remove());

    beatPeriod = 60000 / Number(tempoSelect.value);
    beatPhase = 0;

    updateStats();

    message.textContent = "LET'S GO!";
    gameArea.focus({ preventScroll: true });
    startBtn.disabled = true;
    finishBtn.disabled = false;
    tempoSelect.disabled = true;

    if (bgMusic.src) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(error => {
            console.error("Musik tidak dapat diputar:", error);
            musicStatus.textContent = "Musik gagal diputar. Coba pilih file MP3 lain.";
        });
    }
    startBtn.textContent = "GAME RUNNING...";

    countdown = setInterval(() => {
        time--;
        updateStats();

        if (time <= 0) {
            endGame();
        }
    }, 1000);

    gameStartedAt = performance.now();
    lastFrameTimestamp = gameStartedAt;
    const travelTime = ((getHitLine() + 50) / NOTE_SPEED) * 1000;
    const firstBeat = Math.max(0, Math.ceil((travelTime - beatPhase) / beatPeriod));
    nextSpawnAt = beatPhase + firstBeat * beatPeriod - travelTime;
    musicLoopDuration = bgMusic.duration * 1000 || musicLoopDuration;
    musicLoopCount = 0;
    previousMusicTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

function updateStats() {
    scoreDisplay.textContent = score;
    highScoreDisplay.textContent = highScore;
    comboDisplay.textContent = combo;
    timeDisplay.textContent = time;
}

function spawnNote() {
    const laneIndex = Math.floor(Math.random() * 4);

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = arrows[laneIndex];

    lanes[laneIndex].appendChild(note);

    notes.push({
        element: note,
        lane: laneIndex,
        y: -50
    });
}

function gameLoop(timestamp) {
    if (!playing) return;

    let elapsed = timestamp - gameStartedAt;
    const deltaSeconds = (timestamp - lastFrameTimestamp) / 1000;
    lastFrameTimestamp = timestamp;

    if (bgMusic.src && musicLoopDuration > 0) {
        const currentMusicTime = bgMusic.currentTime * 1000;
        if (currentMusicTime + 100 < previousMusicTime) musicLoopCount++;
        previousMusicTime = currentMusicTime;
        elapsed = musicLoopCount * musicLoopDuration + currentMusicTime;
    }

    if (elapsed >= nextSpawnAt) {
        spawnNote();
        nextSpawnAt += beatPeriod;
    }

    for (let index = notes.length - 1; index >= 0; index--) {
        const note = notes[index];
        note.y += NOTE_SPEED * deltaSeconds;
        note.element.style.top = note.y + "px";

        if (note.y > getHitLine() + 45) {
            note.element.remove();
            notes.splice(index, 1);
            combo = 0;
            message.textContent = "MISS!";
            updateStats();
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

function hitLane(laneIndex) {
    if (!playing) return;

    const available = notes.filter(note =>
        note.lane === laneIndex
    );

    if (available.length === 0) {
        combo = 0;
        message.textContent = "MISS!";
        updateStats();
        return;
    }

    const note = available.reduce((closest, current) => {
        return Math.abs(current.y - getHitLine()) <
               Math.abs(closest.y - getHitLine())
            ? current : closest;
    });

    const distance = Math.abs(note.y - getHitLine());

    if (distance > 65) {
        combo = 0;
        message.textContent = "MISS!";
        updateStats();
        return;
    }

    let points = 0;

    if (distance < 20) {
        points = 100;
        message.textContent = "PERFECT!";
    } else if (distance < 45) {
        points = 50;
        message.textContent = "GOOD!";
    } else {
        points = 20;
        message.textContent = "OK!";
    }

    score += points;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("beatRushHighScore", highScore);
    }
    combo++;

    note.element.remove();
    notes.splice(notes.indexOf(note), 1);

    lanes[laneIndex].classList.add("hit");

    setTimeout(() => {
        lanes[laneIndex].classList.remove("hit");
    }, 120);

    updateStats();
}


// Kontrol keyboard
window.addEventListener("keydown", function(event) {
    const laneIndex = keys.indexOf(event.key);

    if (laneIndex !== -1) {
        event.preventDefault();

        if (!event.repeat) {
            hitLane(laneIndex);
        }
    }
});

// Click juga menerima tap pada layar sentuh dan mouse.
lanes.forEach((lane, index) => {
    lane.addEventListener("click", function(event) {
        event.preventDefault();
        hitLane(index);
    });
});


function endGame() {
    playing = false;
    bgMusic.pause();
    bgMusic.currentTime = 0;

    clearInterval(countdown);
    cancelAnimationFrame(animationId);

    notes.forEach(note => note.element.remove());
    notes = [];

    message.textContent = "FINAL SCORE: " + score;
    startBtn.disabled = false;
    startBtn.textContent = "↻ START AGAIN";
    finishBtn.disabled = true;
    tempoSelect.disabled = false;
}

startBtn.addEventListener("click", startGame);
finishBtn.addEventListener("click", endGame);

const musicFile = document.getElementById("musicFile");
const bgMusic = document.getElementById("bgMusic");
const musicStatus = document.getElementById("musicStatus");

bgMusic.volume = 0.4;
bgMusic.loop = false;

bgMusic.addEventListener("loadedmetadata", function() {
    if (!Number.isFinite(bgMusic.duration) || bgMusic.duration <= 0) return;

    gameDuration = Math.ceil(bgMusic.duration);
    if (!playing) {
        time = gameDuration;
        updateStats();
    }
});

bgMusic.addEventListener("ended", function() {
    if (playing) endGame();
});

async function analyzeMusic(file) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        throw new Error("Browser ini tidak mendukung analisis audio.");
    }

    const context = new AudioContextClass();
    try {
        const audioData = await new Promise((resolve, reject) => {
            if (typeof file.arrayBuffer === "function") {
                file.arrayBuffer().then(resolve, reject);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("File MP3 tidak dapat dibaca."));
            reader.readAsArrayBuffer(file);
        });
        const buffer = await new Promise((resolve, reject) => {
            let settled = false;
            const succeed = value => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };
            const fail = error => {
                if (!settled) {
                    settled = true;
                    reject(error);
                }
            };
            try {
                const result = context.decodeAudioData(audioData, succeed, fail);
                if (result && typeof result.then === "function") result.then(succeed, fail);
            } catch (error) {
                fail(error);
            }
        });
        const frameSeconds = 0.02;
        const frameCount = Math.floor(buffer.duration / frameSeconds);
        const envelope = new Float32Array(frameCount);
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
        const samplesPerFrame = Math.floor(buffer.sampleRate * frameSeconds);

        for (let frame = 0; frame < frameCount; frame++) {
            const start = frame * samplesPerFrame;
            const end = Math.min(start + samplesPerFrame, channels[0].length);
            let energy = 0;
            let count = 0;
            for (const channel of channels) {
                for (let sample = start; sample < end; sample++) {
                    energy += channel[sample] * channel[sample];
                    count++;
                }
            }
            envelope[frame] = count ? Math.sqrt(energy / count) : 0;
        }

        const onset = new Float32Array(frameCount);
        let mean = 0;
        for (let i = 1; i < frameCount; i++) {
            onset[i] = Math.max(0, envelope[i] - envelope[i - 1]);
            mean += onset[i];
        }
        mean /= Math.max(1, frameCount - 1);
        for (let i = 0; i < frameCount; i++) onset[i] -= mean;

        const MIN_BPM = 60;
        const MAX_BPM = 200;
        const minLag = Math.round(60 / MAX_BPM / frameSeconds);
        const maxLag = Math.min(Math.round(60 / MIN_BPM / frameSeconds), Math.floor(frameCount / 2));
        let bestLag = Math.round(60 / 120 / frameSeconds);
        let bestCorrelation = -Infinity;

        for (let lag = minLag; lag <= maxLag; lag++) {
            let correlation = 0;
            let leftEnergy = 0;
            let rightEnergy = 0;
            for (let i = lag; i < frameCount; i++) {
                correlation += onset[i] * onset[i - lag];
                leftEnergy += onset[i] * onset[i];
                rightEnergy += onset[i - lag] * onset[i - lag];
            }
            const normalized = correlation / Math.sqrt(leftEnergy * rightEnergy || 1);
            if (normalized > bestCorrelation) {
                bestCorrelation = normalized;
                bestLag = lag;
            }
        }

        if (frameCount < 100 || bestCorrelation < 0.01) {
            beatPeriod = 60000 / 120;
            beatPhase = 0;
            musicLoopDuration = buffer.duration * 1000;
            return 120;
        }

        const phaseScores = new Float64Array(bestLag);
        for (let i = 0; i < frameCount; i++) {
            phaseScores[i % bestLag] += Math.max(0, onset[i]);
        }
        let bestPhase = 0;
        for (let i = 1; i < bestLag; i++) {
            if (phaseScores[i] > phaseScores[bestPhase]) bestPhase = i;
        }

        beatPeriod = bestLag * frameSeconds * 1000;
        beatPhase = bestPhase * frameSeconds * 1000;
        musicLoopDuration = buffer.duration * 1000;
        return Math.round(60000 / beatPeriod);
    } finally {
        if (context.state !== "closed") {
            try {
                await context.close();
            } catch (error) {
                console.warn("AudioContext tidak dapat ditutup:", error);
            }
        }
    }
}

musicFile.addEventListener("change", function() {
    const file = this.files[0];
    if (!file) return;

    bgMusic.src = URL.createObjectURL(file);
    musicStatus.textContent = `Lagu dipilih: ${file.name} • Tempo: ${tempoSelect.value} BPM`;
    musicStatus.style.color = "#00e5ff";
});

tempoSelect.addEventListener("change", function() {
    if (musicFile.files[0]) {
        musicStatus.textContent = `Lagu dipilih: ${musicFile.files[0].name} • Tempo: ${this.value} BPM`;
    }
});


