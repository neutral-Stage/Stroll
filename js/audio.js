/**
 * audio.js — Overhauled ambient sound system using Web Audio API
 *
 * Features:
 *  • Procedural wind via filtered noise with modulation
 *  • Lofi hip-hop background music
 *  • Bird chirps during daytime
 *  • Cricket sounds at night
 *  • Pickup sound effects for collectibles
 *  • Layered soundscape that evolves
 *
 * @module audio
 */

import { startLofi, stopLofi } from './lofi.js';

/** @type {AudioContext|null} */
let audioCtx = null;

/** @type {GainNode|null} */
let masterGain = null;

/** @type {Array<OscillatorNode|AudioBufferSourceNode>} */
let activeNodes = [];

/** @type {boolean} */
let soundOn = false;

/** Current time-of-day blend (0 = day, 1 = night) */
let currentNightAmount = 0;

// Gain nodes for day/night layers
let dayLayerGain = null;
let nightLayerGain = null;
let windGain = null;
let melodyGain = null;

// Melody state
let melodyInterval = null;

/**
 * Set up the sound toggle button.
 */
export function setupSoundToggle() {
    const toggle = document.getElementById('sound-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        if (!soundOn) {
            enableSound(toggle);
        } else {
            disableSound(toggle);
        }
    });
}

/**
 * Enable ambient sound.
 * @param {HTMLElement} toggle
 */
function enableSound(toggle) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
            masterGain.connect(audioCtx.destination);
            createSoundscape();
        } else {
            audioCtx.resume();
        }
        toggle.textContent = '🔊';
        soundOn = true;
    } catch (err) {
        console.warn('Failed to create AudioContext:', err);
    }
}

/**
 * Disable ambient sound.
 * @param {HTMLElement} toggle
 */
function disableSound(toggle) {
    if (audioCtx) audioCtx.suspend();
    toggle.textContent = '🔇';
    soundOn = false;
}

/**
 * Create the full layered soundscape.
 */
function createSoundscape() {
    const ctx = audioCtx;
    const now = ctx.currentTime;

    // ── Wind layer (filtered noise with slow modulation) ──
    windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.03, now);
    windGain.connect(masterGain);

    const windBuffer = createNoiseBuffer(ctx, 3);
    const wind = ctx.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(400, now);
    windFilter.Q.setValueAtTime(0.8, now);

    // Modulate wind filter frequency
    const windLFO = ctx.createOscillator();
    windLFO.type = 'sine';
    windLFO.frequency.setValueAtTime(0.1, now);
    const windLFOGain = ctx.createGain();
    windLFOGain.gain.setValueAtTime(200, now);
    windLFO.connect(windLFOGain);
    windLFOGain.connect(windFilter.frequency);
    windLFO.start(now);
    activeNodes.push(windLFO);

    wind.connect(windFilter);
    windFilter.connect(windGain);
    wind.start(now);
    activeNodes.push(wind);

    // ── Day/Night ambient pads (reduced volume to make room for lofi) ──
    dayLayerGain = ctx.createGain();
    dayLayerGain.gain.setValueAtTime(0.012, now);
    dayLayerGain.connect(masterGain);

    // Soft warm pad (day)
    [261.63, 329.63, 392.00].forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, now);
        osc.connect(g);
        g.connect(dayLayerGain);
        osc.start(now);
        activeNodes.push(osc);
    });

    nightLayerGain = ctx.createGain();
    nightLayerGain.gain.setValueAtTime(0, now);
    nightLayerGain.connect(masterGain);

    [220.00, 261.63, 329.63].forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, now);
        osc.connect(g);
        g.connect(nightLayerGain);
        osc.start(now);
        activeNodes.push(osc);
    });

    // ── Bird chirps (day) ──
    startBirdChirps(ctx);

    // ── Cricket sounds (night) ──
    startCrickets(ctx);

    // ── Lofi background music (replaces old melody + drone) ──
    startLofi(ctx, masterGain);
}

function createNoiseBuffer(ctx, duration) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buffer;
}

function startBirdChirps(ctx) {
    const chirp = () => {
        if (!soundOn || !audioCtx) return;
        const now = ctx.currentTime;
        const dayAmount = 1 - currentNightAmount;
        if (dayAmount < 0.3) return; // No birds at night

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const baseFreq = 1800 + Math.random() * 1200;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, now + 0.15);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.02 * dayAmount, now + 0.02);
        g.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.25);

        // Schedule next chirp
        setTimeout(chirp, 3000 + Math.random() * 8000);
    };
    setTimeout(chirp, 2000);
}

function startCrickets(ctx) {
    const cricket = () => {
        if (!soundOn || !audioCtx) return;
        const now = ctx.currentTime;
        if (currentNightAmount < 0.3) {
            setTimeout(cricket, 2000);
            return;
        }

        // Cricket = rapid oscillation
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4500 + Math.random() * 500, now);

        const tremolo = ctx.createOscillator();
        tremolo.type = 'square';
        tremolo.frequency.setValueAtTime(40 + Math.random() * 20, now);
        const tremoloGain = ctx.createGain();
        tremoloGain.gain.setValueAtTime(0.008 * currentNightAmount, now);
        tremolo.connect(tremoloGain);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.008 * currentNightAmount, now + 0.05);
        g.gain.linearRampToValueAtTime(0, now + 0.4);

        tremoloGain.connect(g.gain);
        osc.connect(g);
        g.connect(masterGain);
        tremolo.start(now);
        osc.start(now);
        osc.stop(now + 0.5);
        tremolo.stop(now + 0.5);

        setTimeout(cricket, 1000 + Math.random() * 3000);
    };
    setTimeout(cricket, 5000);
}

function startMelody(ctx) {
    // Pentatonic scale notes (peaceful)
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

    const playNote = () => {
        if (!soundOn || !audioCtx) return;
        const now = ctx.currentTime;
        const freq = notes[Math.floor(Math.random() * notes.length)];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.6, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, now + 3);

        osc.connect(g);
        g.connect(melodyGain);
        osc.start(now);
        osc.stop(now + 3.5);

        setTimeout(playNote, 4000 + Math.random() * 8000);
    };
    setTimeout(playNote, 6000);
}

/**
 * Update audio layers based on time of day.
 * @param {number} nightAmount - 0 (day) to 1 (night)
 */
export function updateAudioTimeOfDay(nightAmount) {
    currentNightAmount = nightAmount;
    if (!audioCtx || !soundOn) return;

    const now = audioCtx.currentTime;
    if (dayLayerGain) {
        dayLayerGain.gain.linearRampToValueAtTime(0.025 * (1 - nightAmount), now + 0.5);
    }
    if (nightLayerGain) {
        nightLayerGain.gain.linearRampToValueAtTime(0.02 * nightAmount, now + 0.5);
    }
    if (windGain) {
        windGain.gain.linearRampToValueAtTime(0.03 + nightAmount * 0.02, now + 0.5);
    }
}

/**
 * Play a pickup sound effect.
 * @param {string} type - 'orb', 'crystal', 'star'
 */
export function playPickupSound(type) {
    if (!audioCtx || !soundOn) return;
    const now = audioCtx.currentTime;

    const freqMap = { orb: 880, crystal: 1100, star: 1320 };
    const baseFreq = freqMap[type] || 880;

    // Sparkle sound: rising arpeggio
    for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), now + i * 0.08);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.08, now + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.5);
    }

    // Shimmer
    const shimmer = audioCtx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(baseFreq * 2, now);
    shimmer.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.3);

    const sg = audioCtx.createGain();
    sg.gain.setValueAtTime(0.04, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    shimmer.connect(sg);
    sg.connect(masterGain);
    shimmer.start(now);
    shimmer.stop(now + 0.6);
}

/**
 * Play a discovery/waypoint sound.
 */
export function playDiscoverySound() {
    if (!audioCtx || !soundOn) return;
    const now = audioCtx.currentTime;

    // Ascending major chord
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.12);
        g.gain.linearRampToValueAtTime(0.06, now + i * 0.12 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.8);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1);
    });
}

/**
 * Play achievement unlock sound.
 */
export function playAchievementSound() {
    if (!audioCtx || !soundOn) return;
    const now = audioCtx.currentTime;

    // Triumphant fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.07, now + i * 0.1 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 1.0);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 1.2);
    });
}

export function isSoundOn() { return soundOn; }
