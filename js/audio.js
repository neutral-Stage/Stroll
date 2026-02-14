/**
 * audio.js — Procedural ambient soundscape using Web Audio API
 *
 * Complete overhaul: layered ambient sounds that change with time of day,
 * spatial audio for environment, and subtle sound effects for interactions.
 *
 * Layers:
 *  - Base drone (warm pad, changes pitch day/night)
 *  - Wind (filtered noise, intensity varies)
 *  - Water/fountain (when near park)
 *  - Birds (daytime chirps using oscillators)
 *  - Crickets (nighttime)
 *  - Footstep sounds
 *  - Collection chimes
 *  - Achievement fanfare
 *
 * @module audio
 */

/** @type {AudioContext|null} */
let audioCtx = null;

/** @type {GainNode} */
let masterGain = null;

/** @type {boolean} */
let soundOn = false;

/** Current volume 0..1 */
let volume = 0.7;

/** Night amount 0..1 for layer mixing */
let currentNightAmount = 0;

// Layer nodes
let baseDroneGain = null;
let windGain = null;
let birdGain = null;
let cricketGain = null;
let waterGain = null;

// Active oscillators/sources
const activeNodes = [];

// Scheduled bird chirps
let birdChirpTimer = 0;
let cricketTimer = 0;

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
            masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
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
 * Set master volume.
 * @param {number} v - 0..1
 */
export function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.1);
    }
}

/**
 * Create the full ambient soundscape.
 */
function createSoundscape() {
    const ctx = audioCtx;
    const now = ctx.currentTime;

    // ── Base Drone Layer ──
    baseDroneGain = ctx.createGain();
    baseDroneGain.gain.setValueAtTime(0.025, now);
    baseDroneGain.connect(masterGain);

    // Warm fundamental
    const drone1 = ctx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.setValueAtTime(82.41, now); // E2
    drone1.connect(baseDroneGain);
    drone1.start(now);
    activeNodes.push(drone1);

    // Perfect fifth
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.setValueAtTime(123.47, now); // B2
    const drone2Gain = ctx.createGain();
    drone2Gain.gain.setValueAtTime(0.015, now);
    drone2.connect(drone2Gain);
    drone2Gain.connect(masterGain);
    drone2.start(now);
    activeNodes.push(drone2);

    // Octave shimmer with slow LFO
    const drone3 = ctx.createOscillator();
    drone3.type = 'sine';
    drone3.frequency.setValueAtTime(164.81, now); // E3
    const drone3Gain = ctx.createGain();
    drone3Gain.gain.setValueAtTime(0.008, now);
    
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.004, now);
    lfo.connect(lfoGain);
    lfoGain.connect(drone3Gain.gain);
    lfo.start(now);
    activeNodes.push(lfo);

    drone3.connect(drone3Gain);
    drone3Gain.connect(masterGain);
    drone3.start(now);
    activeNodes.push(drone3);

    // Ethereal high pad
    const pad = ctx.createOscillator();
    pad.type = 'sine';
    pad.frequency.setValueAtTime(329.63, now); // E4
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.003, now);
    const padLfo = ctx.createOscillator();
    padLfo.type = 'triangle';
    padLfo.frequency.setValueAtTime(0.08, now);
    const padLfoGain = ctx.createGain();
    padLfoGain.gain.setValueAtTime(0.002, now);
    padLfo.connect(padLfoGain);
    padLfoGain.connect(padGain.gain);
    padLfo.start(now);
    activeNodes.push(padLfo);
    pad.connect(padGain);
    padGain.connect(masterGain);
    pad.start(now);
    activeNodes.push(pad);

    // ── Wind Layer (filtered noise) ──
    windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.012, now);
    
    const windBuffer = createNoiseBuffer(ctx, 3);
    const wind = ctx.createBufferSource();
    wind.buffer = windBuffer;
    wind.loop = true;
    
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(400, now);
    windFilter.Q.setValueAtTime(0.8, now);
    
    // Wind modulation
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.05, now);
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(200, now);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start(now);
    activeNodes.push(windLfo);
    
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    wind.start(now);
    activeNodes.push(wind);

    // ── Water/Fountain Layer ──
    waterGain = ctx.createGain();
    waterGain.gain.setValueAtTime(0, now); // starts silent, increases near fountain
    
    const waterBuffer = createNoiseBuffer(ctx, 2);
    const water = ctx.createBufferSource();
    water.buffer = waterBuffer;
    water.loop = true;
    
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'highpass';
    waterFilter.frequency.setValueAtTime(2000, now);
    waterFilter.Q.setValueAtTime(0.3, now);
    
    const waterFilter2 = ctx.createBiquadFilter();
    waterFilter2.type = 'lowpass';
    waterFilter2.frequency.setValueAtTime(6000, now);
    
    water.connect(waterFilter);
    waterFilter.connect(waterFilter2);
    waterFilter2.connect(waterGain);
    waterGain.connect(masterGain);
    water.start(now);
    activeNodes.push(water);

    // ── Bird Layer (gain node, chirps scheduled dynamically) ──
    birdGain = ctx.createGain();
    birdGain.gain.setValueAtTime(0.015, now);
    birdGain.connect(masterGain);

    // ── Cricket Layer ──
    cricketGain = ctx.createGain();
    cricketGain.gain.setValueAtTime(0, now);
    cricketGain.connect(masterGain);
}

/**
 * Create a noise buffer.
 */
function createNoiseBuffer(ctx, seconds) {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buffer;
}

/**
 * Play a bird chirp sound.
 */
function playBirdChirp() {
    if (!audioCtx || !soundOn || !birdGain) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 2000 + Math.random() * 2000;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.2 + Math.random() * 0.5), now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.12);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(birdGain);
    osc.start(now);
    osc.stop(now + 0.2);
    
    // Sometimes do a double chirp
    if (Math.random() < 0.4) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 1.1, now + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.2);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0, now + 0.15);
        gain2.gain.linearRampToValueAtTime(0.025, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(birdGain);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.35);
    }
}

/**
 * Play a cricket chirp.
 */
function playCricketChirp() {
    if (!audioCtx || !soundOn || !cricketGain) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const chirpCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < chirpCount; i++) {
        const t = now + i * 0.06;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4500 + Math.random() * 1000, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.015, t + 0.01);
        gain.gain.linearRampToValueAtTime(0, t + 0.04);
        osc.connect(gain);
        gain.connect(cricketGain);
        osc.start(t);
        osc.stop(t + 0.05);
    }
}

/**
 * Play collection chime sound.
 * @param {string} type - 'orb', 'crystal', 'flower'
 */
export function playCollectionSound(type) {
    if (!audioCtx || !soundOn) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const notes = type === 'orb' ? [523, 659, 784] : 
                  type === 'crystal' ? [440, 554, 659, 880] :
                  [392, 494, 587];
    
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = type === 'crystal' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.06, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.6);
    });
}

/**
 * Play achievement fanfare.
 */
export function playAchievementSound() {
    if (!audioCtx || !soundOn) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.8);
        
        // Add reverb-like tail with second oscillator
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now + i * 0.12);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0, now + i * 0.12);
        gain2.gain.linearRampToValueAtTime(0.02, now + i * 0.12 + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 1.0);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1.0);
        osc2.start(now + i * 0.12);
        osc2.stop(now + i * 0.12 + 1.2);
    });
}

/**
 * Play footstep sound.
 */
export function playFootstep() {
    if (!audioCtx || !soundOn) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    // Soft thud using filtered noise
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300 + Math.random() * 200, now);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
}

/**
 * Play interaction sound (flower bloom, etc).
 */
export function playInteractionSound() {
    if (!audioCtx || !soundOn) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
}

/**
 * Play camera shutter sound for photo mode.
 */
export function playShutterSound() {
    if (!audioCtx || !soundOn) return;
    const ctx = audioCtx;
    const now = ctx.currentTime;
    
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.3;
        if (t > 0.05 && t < 0.07) data[i] += (Math.random() * 2 - 1) * 0.2;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    source.connect(gain);
    gain.connect(masterGain);
    source.start(now);
}

/**
 * Update audio layers based on time of day and player position.
 * @param {number} delta
 * @param {number} nightAmount - 0..1
 * @param {{x:number, z:number}} playerPos
 */
export function updateAudio(delta, nightAmount, playerPos) {
    if (!audioCtx || !soundOn) return;
    currentNightAmount = nightAmount;
    const now = audioCtx.currentTime;
    
    // Adjust bird volume (louder during day)
    if (birdGain) {
        birdGain.gain.setTargetAtTime(0.015 * (1 - nightAmount), now, 0.5);
    }
    
    // Adjust cricket volume (louder at night)
    if (cricketGain) {
        cricketGain.gain.setTargetAtTime(0.02 * nightAmount, now, 0.5);
    }
    
    // Water proximity (louder near center/fountain)
    if (waterGain) {
        const distToCenter = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
        const waterVolume = Math.max(0, 1 - distToCenter / 30) * 0.02;
        waterGain.gain.setTargetAtTime(waterVolume, now, 0.3);
    }
    
    // Schedule bird chirps during day
    birdChirpTimer -= delta;
    if (birdChirpTimer <= 0 && nightAmount < 0.5) {
        playBirdChirp();
        birdChirpTimer = 2 + Math.random() * 6;
    }
    
    // Schedule cricket chirps at night
    cricketTimer -= delta;
    if (cricketTimer <= 0 && nightAmount > 0.3) {
        playCricketChirp();
        cricketTimer = 1 + Math.random() * 3;
    }
}

/**
 * Check if sound is currently on.
 */
export function isSoundOn() {
    return soundOn;
}
