/**
 * audio.js — Ambient sound system using Web Audio API
 *
 * Fixes from review:
 *  • Single AudioContext created once, reused via suspend()/resume().
 *  • Audio nodes are tracked and properly stopped on toggle-off.
 *  • No AudioContext leak from repeated creation/destruction.
 *
 * @module audio
 */

/** @type {AudioContext|null} */
let audioCtx = null;

/** @type {Array<OscillatorNode|AudioBufferSourceNode>} */
let activeNodes = [];

/** @type {boolean} */
let soundOn = false;

/**
 * Set up the sound toggle button.
 * Called from init() after DOM is ready (not at parse time).
 */
export function setupSoundToggle() {
    const toggle = document.getElementById('sound-toggle');
    if (!toggle) {
        console.warn('Sound toggle element not found');
        return;
    }

    toggle.addEventListener('click', () => {
        if (!soundOn) {
            enableSound(toggle);
        } else {
            disableSound(toggle);
        }
    });
}

/**
 * Enable ambient sound. Creates AudioContext on first call, resumes on subsequent calls.
 * @param {HTMLElement} toggle
 */
function enableSound(toggle) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            createAmbientSound(audioCtx);
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
 * Disable ambient sound by suspending the AudioContext (not closing it).
 * @param {HTMLElement} toggle
 */
function disableSound(toggle) {
    if (audioCtx) {
        audioCtx.suspend();
    }
    toggle.textContent = '🔇';
    soundOn = false;
}

/**
 * Create the ambient soundscape: warm drone + harmonics + filtered noise.
 * @param {AudioContext} ctx
 */
function createAmbientSound(ctx) {
    const now = ctx.currentTime;

    // Base drone (110 Hz sine)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now);
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.03, now);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    activeNodes.push(osc1);

    // Harmonic (165 Hz — perfect fifth)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(165, now);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.015, now);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    activeNodes.push(osc2);

    // High shimmer (330 Hz with LFO modulation)
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(330, now);
    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.008, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.3, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.005, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain3.gain);
    lfo.start(now);
    activeNodes.push(lfo);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now);
    activeNodes.push(osc3);

    // Gentle filtered noise for "city ambience"
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.Q.setValueAtTime(0.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.015, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    activeNodes.push(noise);
}
