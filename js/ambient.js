/**
 * ambient.js — Additional ambient soundscapes and music varieties
 *
 * Features:
 *  • Nature sounds (forest, ocean waves, wind chimes)
 *  • Piano melodies
 *  • Meditation bells
 *  • Gentle synth pads
 *  • Randomized peaceful compositions
 *
 * @module ambient
 */

/** @type {AudioContext|null} */
let ctx = null;
/** @type {GainNode|null} */
let ambientMaster = null;
let isPlaying = false;
let currentMood = 'calm'; // calm, meditative, dreamy, nature

// Meditation bell intervals
let bellInterval = null;

/**
 * Initialize ambient sound system.
 * @param {AudioContext} audioContext
 * @param {GainNode} masterGain
 */
export function startAmbient(audioContext, masterGain) {
    if (isPlaying) return;

    ctx = audioContext;
    ambientMaster = ctx.createGain();
    ambientMaster.gain.setValueAtTime(0.08, ctx.currentTime);
    ambientMaster.connect(masterGain);

    isPlaying = true;

    // Start ambient layers based on mood
    startAmbientLayers();
}

/**
 * Stop ambient sounds.
 */
export function stopAmbient() {
    isPlaying = false;
    if (bellInterval) clearInterval(bellInterval);
    bellInterval = null;
}

/**
 * Set ambient mood.
 * @param {string} mood - 'calm', 'meditative', 'dreamy', 'nature'
 */
export function setAmbientMood(mood) {
    currentMood = mood;
    if (isPlaying) {
        stopAmbient();
        startAmbientLayers();
    }
}

/**
 * Start ambient layers based on current mood.
 */
function startAmbientLayers() {
    if (!ctx || !ambientMaster) return;

    switch (currentMood) {
        case 'meditative':
            startMeditationBells();
            startDeepDrone();
            break;
        case 'dreamy':
            startDreamyPad();
            startSoftPiano();
            break;
        case 'nature':
            startNatureSounds();
            startWindChimes();
            break;
        case 'calm':
        default:
            startCalmPad();
            startSoftPiano();
            break;
    }
}

/**
 * Start meditation bells.
 */
function startMeditationBells() {
    const playBell = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const freq = [523.25, 659.25, 783.99, 1046.50][Math.floor(Math.random() * 4)];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ambientMaster);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 4.5);
        osc2.stop(now + 4.5);
    };

    bellInterval = setInterval(playBell, 6000 + Math.random() * 4000);
    playBell();
}

/**
 * Start deep meditation drone.
 */
function startDeepDrone() {
    if (!ctx || !ambientMaster) return;

    const now = ctx.currentTime;
    const baseFreq = 110; // A2

    [1, 1.5, 2].forEach((mult, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * mult, now);
        osc.detune.setValueAtTime(-5 + Math.random() * 10, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.015 - i * 0.003, now + 3);

        osc.connect(gain);
        gain.connect(ambientMaster);
        osc.start(now);
    });
}

/**
 * Start dreamy pad synth.
 */
function startDreamyPad() {
    if (!ctx || !ambientMaster) return;

    const chords = [
        [261.63, 329.63, 392.00], // C major
        [293.66, 369.99, 440.00], // D minor
        [329.63, 415.30, 493.88], // E minor
        [392.00, 493.88, 587.33]  // G major
    ];

    let chordIndex = 0;

    const playChord = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const chord = chords[chordIndex];

        chord.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq * 0.5, now);
            osc.detune.setValueAtTime(-8 + Math.random() * 16, now);

            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 0.5, now);
            osc2.detune.setValueAtTime(5 + Math.random() * 10, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.02 - i * 0.005, now + 2);
            gain.gain.setValueAtTime(0.02 - i * 0.005, now + 6);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 10);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600 + Math.random() * 400, now);
            filter.Q.setValueAtTime(2, now);

            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(ambientMaster);

            osc.start(now);
            osc2.start(now);
            osc.stop(now + 10.5);
            osc2.stop(now + 10.5);
        });

        chordIndex = (chordIndex + 1) % chords.length;
        setTimeout(playChord, 8000);
    };

    playChord();
}

/**
 * Start calm ambient pad.
 */
function startCalmPad() {
    if (!ctx || !ambientMaster) return;

    const now = ctx.currentTime;
    const notes = [261.63, 293.66, 329.63, 392.00]; // C D E G

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, now);
        osc.detune.setValueAtTime(-10 + Math.random() * 20, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.018 - i * 0.003, now + 4);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ambientMaster);
        osc.start(now);
    });
}

/**
 * Start soft piano melody.
 */
function startSoftPiano() {
    if (!ctx || !ambientMaster) return;

    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];

    const playNote = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const freq = scale[Math.floor(Math.random() * scale.length)];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.025, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ambientMaster);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 3);
        osc2.stop(now + 3);

        setTimeout(playNote, 3000 + Math.random() * 5000);
    };

    setTimeout(playNote, 2000);
}

/**
 * Start nature sounds.
 */
function startNatureSounds() {
    if (!ctx || !ambientMaster) return;

    // Ocean waves simulation
    const playWave = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const bufferSize = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const envelope = Math.sin((i / bufferSize) * Math.PI);
            data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.Q.setValueAtTime(0.5, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ambientMaster);
        source.start(now);

        setTimeout(playWave, 5000 + Math.random() * 3000);
    };

    playWave();
}

/**
 * Start wind chimes.
 */
function startWindChimes() {
    if (!ctx || !ambientMaster) return;

    const chimeFreqs = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00];

    const playChime = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 2, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.01, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.015, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ambientMaster);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 3.5);
        osc2.stop(now + 3.5);

        setTimeout(playChime, 4000 + Math.random() * 8000);
    };

    setTimeout(playChime, 3000);
}

export function getCurrentMood() {
    return currentMood;
}
