/**
 * cinematic.js — Cinematic intro: smooth camera flyover before gameplay starts
 *
 * Features:
 *  • Sweeping camera path over the city
 *  • Smooth bezier-like interpolation
 *  • Title card fade-in/out
 *  • Seamless transition to gameplay camera
 *
 * @module cinematic
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PLAYER_HEIGHT } from './config.js';

let isPlaying = false;
let cinematicTime = 0;
let onCompleteCallback = null;

const CINEMATIC_DURATION = 8; // seconds

// Camera path keyframes: { time: 0..1, pos: [x,y,z], lookAt: [x,y,z] }
const KEYFRAMES = [
    { time: 0.0, pos: [80, 40, 80], lookAt: [0, 0, 0] },
    { time: 0.25, pos: [40, 25, -60], lookAt: [0, 5, 0] },
    { time: 0.5, pos: [-50, 15, -30], lookAt: [0, 3, 0] },
    { time: 0.75, pos: [-20, 8, 20], lookAt: [0, 2, 0] },
    { time: 1.0, pos: [0, PLAYER_HEIGHT, 0], lookAt: [0, PLAYER_HEIGHT, -5] },
];

/**
 * Start the cinematic intro.
 * @param {function} onComplete - called when cinematic finishes
 */
export function startCinematic(onComplete) {
    isPlaying = true;
    cinematicTime = 0;
    onCompleteCallback = onComplete;

    // Show cinematic overlay
    const overlay = document.getElementById('cinematic-overlay');
    if (overlay) overlay.style.display = 'flex';
}

/**
 * Update cinematic camera each frame.
 * @param {number} delta
 * @param {THREE.PerspectiveCamera} camera
 * @returns {boolean} true if cinematic is still playing
 */
export function updateCinematic(delta, camera) {
    if (!isPlaying) return false;

    cinematicTime += delta;
    const t = Math.min(cinematicTime / CINEMATIC_DURATION, 1);

    // Find surrounding keyframes
    let k0 = KEYFRAMES[0];
    let k1 = KEYFRAMES[1];
    let localT = 0;

    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
        if (t >= KEYFRAMES[i].time && t <= KEYFRAMES[i + 1].time) {
            k0 = KEYFRAMES[i];
            k1 = KEYFRAMES[i + 1];
            localT = (t - k0.time) / (k1.time - k0.time);
            break;
        }
    }

    // Smooth interpolation
    const st = smoothstep(localT);

    camera.position.set(
        lerp(k0.pos[0], k1.pos[0], st),
        lerp(k0.pos[1], k1.pos[1], st),
        lerp(k0.pos[2], k1.pos[2], st)
    );

    const lookTarget = new THREE.Vector3(
        lerp(k0.lookAt[0], k1.lookAt[0], st),
        lerp(k0.lookAt[1], k1.lookAt[1], st),
        lerp(k0.lookAt[2], k1.lookAt[2], st)
    );
    camera.lookAt(lookTarget);

    // Update title card
    updateCinematicUI(t);

    // Check completion
    if (t >= 1) {
        isPlaying = false;
        const overlay = document.getElementById('cinematic-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 1000);
        }
        if (onCompleteCallback) onCompleteCallback();
    }

    return true;
}

function updateCinematicUI(t) {
    const title = document.getElementById('cinematic-title');
    const subtitle = document.getElementById('cinematic-subtitle');

    if (title) {
        if (t < 0.15) {
            title.style.opacity = t / 0.15;
        } else if (t > 0.6) {
            title.style.opacity = Math.max(0, 1 - (t - 0.6) / 0.3);
        } else {
            title.style.opacity = '1';
        }
    }

    if (subtitle) {
        if (t < 0.25) {
            subtitle.style.opacity = Math.max(0, (t - 0.1) / 0.15);
        } else if (t > 0.6) {
            subtitle.style.opacity = Math.max(0, 1 - (t - 0.6) / 0.3);
        } else {
            subtitle.style.opacity = '1';
        }
    }
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

/**
 * Skip the cinematic intro.
 */
export function skipCinematic() {
    if (!isPlaying) return;
    cinematicTime = CINEMATIC_DURATION;
}

export function isCinematicPlaying() { return isPlaying; }
