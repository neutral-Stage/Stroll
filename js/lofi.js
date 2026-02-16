/**
 * lofi.js — Procedural lofi hip-hop style background music
 *
 * Generates a relaxing lofi beat using Web Audio API:
 *  • Mellow chord progressions with detuned piano-like tones
 *  • Soft vinyl crackle/noise texture
 *  • Gentle kick and hi-hat pattern
 *  • Warm bass line
 *  • Everything loops seamlessly
 *
 * @module lofi
 */

/** @type {AudioContext|null} */
let ctx = null;
/** @type {GainNode|null} */
let lofiMaster = null;
let isPlaying = false;
let beatInterval = null;
let chordInterval = null;
let bassInterval = null;

// BPM and timing
const BPM = 72;
const BEAT_TIME = 60 / BPM;

// Chord progressions (lofi jazz chords - 7ths and 9ths)
const CHORD_PROGRESSIONS = [
    // ii-V-I-vi in C
    [[293.66, 349.23, 440.00, 523.25], [392.00, 493.88, 587.33, 698.46], [261.63, 329.63, 392.00, 493.88], [440.00, 523.25, 659.25, 783.99]],
    // I-vi-IV-V in Eb
    [[311.13, 392.00, 466.16, 587.33], [466.16, 554.37, 659.25, 783.99], [415.30, 523.25, 622.25, 739.99], [466.16, 587.33, 698.46, 830.61]],
];

let currentProgression = 0;
let currentChordIndex = 0;

/**
 * Initialize and start the lofi music.
 * Call this when the user enables sound.
 * @param {AudioContext} audioContext - shared audio context
 * @param {GainNode} masterGain - shared master gain
 */
export function startLofi(audioContext, masterGain) {
    if (isPlaying) return;

    ctx = audioContext;
    lofiMaster = ctx.createGain();
    lofiMaster.gain.setValueAtTime(0.12, ctx.currentTime); // Keep it subtle
    lofiMaster.connect(masterGain);

    isPlaying = true;

    // Start vinyl crackle
    startVinylCrackle();

    // Start beat pattern
    startBeatLoop();

    // Start chord progression
    startChordLoop();

    // Start bass line
    startBassLoop();
}

/**
 * Stop the lofi music.
 */
export function stopLofi() {
    isPlaying = false;
    if (beatInterval) clearInterval(beatInterval);
    if (chordInterval) clearInterval(chordInterval);
    if (bassInterval) clearInterval(bassInterval);
    beatInterval = null;
    chordInterval = null;
    bassInterval = null;
}

/**
 * Create continuous vinyl crackle texture.
 */
function startVinylCrackle() {
    if (!ctx || !lofiMaster) return;

    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        // Sparse crackle noise
        data[i] = Math.random() > 0.997 ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 0.01;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(lofiMaster);
    source.start();
}

/**
 * Start the drum beat loop (kick + hi-hat).
 */
function startBeatLoop() {
    let beatCount = 0;

    const playBeat = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const beat = beatCount % 8;

        // Kick on beats 0, 4 (and sometimes 6)
        if (beat === 0 || beat === 4 || (beat === 6 && Math.random() > 0.5)) {
            playKick(now);
        }

        // Hi-hat on every beat, open on 2 and 6
        playHiHat(now, beat === 2 || beat === 6);

        // Snare/rim on 2 and 6
        if (beat === 2 || beat === 6) {
            playRimshot(now);
        }

        beatCount++;
    };

    beatInterval = setInterval(playBeat, BEAT_TIME * 500); // 8th notes
    playBeat();
}

/**
 * Play a soft kick drum.
 */
function playKick(time) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(lofiMaster);
    osc.start(time);
    osc.stop(time + 0.35);
}

/**
 * Play a soft hi-hat.
 */
function playHiHat(time, open) {
    const bufferSize = ctx.sampleRate * (open ? 0.15 : 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (open ? 0.08 : 0.015)));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.12 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.15 : 0.05));

    source.connect(filter);
    filter.connect(gain);
    gain.connect(lofiMaster);
    source.start(time);
}

/**
 * Play a soft rimshot/snare.
 */
function playRimshot(time) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, time);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, time);
    filter.Q.setValueAtTime(2, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.05, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(oscGain);
    oscGain.connect(lofiMaster);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(lofiMaster);

    osc.start(time);
    osc.stop(time + 0.08);
    noise.start(time);
}

/**
 * Start the chord progression loop.
 */
function startChordLoop() {
    const playChord = () => {
        if (!isPlaying || !ctx) return;

        const progression = CHORD_PROGRESSIONS[currentProgression];
        const chord = progression[currentChordIndex];

        const now = ctx.currentTime;

        // Play each note of the chord with slight detuning (lofi character)
        chord.forEach((freq, i) => {
            // Main tone
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * 0.5, now); // One octave down for warmth
            osc.detune.setValueAtTime(-10 + Math.random() * 20, now); // Slight detune

            // Second oscillator for richness
            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq * 0.5, now);
            osc2.detune.setValueAtTime(5 + Math.random() * 10, now);

            const gain = ctx.createGain();
            const volume = 0.06 - i * 0.01; // Higher notes slightly quieter
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(Math.max(volume, 0.02), now + 0.1);
            gain.gain.setValueAtTime(Math.max(volume, 0.02), now + BEAT_TIME * 1.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + BEAT_TIME * 2);

            // Low-pass filter for warmth
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800 + Math.random() * 400, now);
            filter.Q.setValueAtTime(1, now);

            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(lofiMaster);

            osc.start(now);
            osc.stop(now + BEAT_TIME * 2.5);
            osc2.start(now);
            osc2.stop(now + BEAT_TIME * 2.5);
        });

        currentChordIndex = (currentChordIndex + 1) % progression.length;

        // Occasionally switch progression
        if (currentChordIndex === 0 && Math.random() > 0.6) {
            currentProgression = (currentProgression + 1) % CHORD_PROGRESSIONS.length;
        }
    };

    chordInterval = setInterval(playChord, BEAT_TIME * 2000); // Every 2 beats
    playChord();
}

/**
 * Start the bass line loop.
 */
function startBassLoop() {
    const bassNotes = [65.41, 73.42, 82.41, 87.31]; // C2, D2, E2, F2
    let bassIndex = 0;

    const playBass = () => {
        if (!isPlaying || !ctx) return;

        const now = ctx.currentTime;
        const freq = bassNotes[bassIndex % bassNotes.length];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Sub bass
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(freq * 0.5, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + BEAT_TIME * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + BEAT_TIME * 1.8);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);

        osc.connect(filter);
        sub.connect(filter);
        filter.connect(gain);
        gain.connect(lofiMaster);

        osc.start(now);
        osc.stop(now + BEAT_TIME * 2);
        sub.start(now);
        sub.stop(now + BEAT_TIME * 2);

        bassIndex++;
    };

    bassInterval = setInterval(playBass, BEAT_TIME * 2000); // Every 2 beats
    setTimeout(playBass, BEAT_TIME * 500); // Offset from chords
}
