/**
 * meditation.js — Meditation mode: sit down, camera slowly orbits scenic view
 *
 * Features:
 *  • Smooth transition to seated position
 *  • Slow cinematic orbit around a scenic point
 *  • Calming breathing guide overlay
 *  • Auto-exit after a period or on keypress
 *
 * @module meditation
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let isActive = false;
let meditationTime = 0;
let orbitAngle = 0;
let transitionProgress = 0;
let savedCameraPos = new THREE.Vector3();
let savedCameraRot = new THREE.Euler();
let targetPos = new THREE.Vector3();

const ORBIT_SPEED = 0.08; // radians per second
const ORBIT_RADIUS = 12;
const ORBIT_HEIGHT = 5;
const TRANSITION_SPEED = 0.8;
const LOOK_HEIGHT = 2;

/**
 * Toggle meditation mode.
 * @param {THREE.PerspectiveCamera} camera
 * @param {{x:number, z:number}} playerPos
 * @returns {boolean} new active state
 */
export function toggleMeditation(camera, playerPos) {
    isActive = !isActive;

    if (isActive) {
        savedCameraPos.copy(camera.position);
        savedCameraRot.copy(camera.rotation);
        targetPos.set(playerPos.x, LOOK_HEIGHT, playerPos.z);
        orbitAngle = Math.atan2(camera.position.z - playerPos.z, camera.position.x - playerPos.x);
        meditationTime = 0;
        transitionProgress = 0;
    }

    updateMeditationUI();
    return isActive;
}

/**
 * Update meditation mode camera.
 * @param {number} delta
 * @param {THREE.PerspectiveCamera} camera
 */
export function updateMeditation(delta, camera) {
    if (!isActive) return;

    meditationTime += delta;
    transitionProgress = Math.min(1, transitionProgress + delta * TRANSITION_SPEED);

    // Smooth ease
    const t = smoothstep(transitionProgress);

    orbitAngle += ORBIT_SPEED * delta;

    // Target orbit position
    const orbX = targetPos.x + Math.cos(orbitAngle) * ORBIT_RADIUS;
    const orbY = ORBIT_HEIGHT + Math.sin(meditationTime * 0.2) * 0.5;
    const orbZ = targetPos.z + Math.sin(orbitAngle) * ORBIT_RADIUS;

    // Lerp camera to orbit position
    camera.position.x = THREE.MathUtils.lerp(savedCameraPos.x, orbX, t);
    camera.position.y = THREE.MathUtils.lerp(savedCameraPos.y, orbY, t);
    camera.position.z = THREE.MathUtils.lerp(savedCameraPos.z, orbZ, t);

    // Look at center
    camera.lookAt(targetPos);

    // Update breathing guide
    updateBreathingGuide(meditationTime);
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function updateBreathingGuide(time) {
    const guide = document.getElementById('breathing-guide');
    if (!guide) return;

    if (!isActive) {
        guide.style.display = 'none';
        return;
    }

    guide.style.display = 'block';

    // 4-second breathe in, 4-second breathe out cycle
    const cycle = time % 8;
    const breatheIn = cycle < 4;
    const progress = breatheIn ? cycle / 4 : (8 - cycle) / 4;

    const text = document.getElementById('breathing-text');
    const circle = document.getElementById('breathing-circle');

    if (text) text.textContent = breatheIn ? 'Breathe in...' : 'Breathe out...';
    if (circle) {
        const scale = 0.6 + progress * 0.4;
        circle.style.transform = `scale(${scale})`;
        circle.style.opacity = 0.3 + progress * 0.4;
    }
}

function updateMeditationUI() {
    const ui = document.getElementById('meditation-ui');
    const guide = document.getElementById('breathing-guide');

    if (ui) ui.style.display = isActive ? 'block' : 'none';
    if (guide) guide.style.display = isActive ? 'block' : 'none';
}

export function isMeditationActive() { return isActive; }
export function getMeditationTime() { return meditationTime; }
