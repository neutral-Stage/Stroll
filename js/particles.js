/**
 * particles.js — Subtle particle effects (floating leaves, fireflies)
 *
 * Adds atmospheric particles that enhance the calm aesthetic:
 *  • Leaves gently drifting in the wind during daytime.
 *  • Fireflies appearing as warm glowing dots during evening/night.
 *
 * Uses a single Points object per effect for minimal draw calls.
 *
 * @module particles
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { LEAF_COUNT, FIREFLY_COUNT, CITY_SIZE } from './config.js';

/** @type {THREE.Points} */
let leafSystem = null;
/** @type {Float32Array} */
let leafVelocities = null;

/** @type {THREE.Points} */
let fireflySystem = null;
/** @type {Float32Array} */
let fireflyPhases = null;

/**
 * Create all particle systems and add to scene.
 * @param {THREE.Scene} scene
 */
export function createParticles(scene) {
    createLeaves(scene);
    createFireflies(scene);
}

/**
 * Create floating leaf particles.
 * @param {THREE.Scene} scene
 */
function createLeaves(scene) {
    const positions = new Float32Array(LEAF_COUNT * 3);
    leafVelocities = new Float32Array(LEAF_COUNT * 3);

    for (let i = 0; i < LEAF_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 80;     // x — near player area
        positions[i3 + 1] = 2 + Math.random() * 15;      // y — above ground
        positions[i3 + 2] = (Math.random() - 0.5) * 80;  // z

        // Gentle drift velocities
        leafVelocities[i3] = (Math.random() - 0.5) * 0.3;     // x drift
        leafVelocities[i3 + 1] = -0.1 - Math.random() * 0.2;  // y fall
        leafVelocities[i3 + 2] = (Math.random() - 0.5) * 0.3; // z drift
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0x8BC34A,
        size: 0.15,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
        fog: true
    });

    leafSystem = new THREE.Points(geometry, material);
    scene.add(leafSystem);
}

/**
 * Create firefly particles (warm glowing dots).
 * @param {THREE.Scene} scene
 */
function createFireflies(scene) {
    const positions = new Float32Array(FIREFLY_COUNT * 3);
    fireflyPhases = new Float32Array(FIREFLY_COUNT);

    for (let i = 0; i < FIREFLY_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 60;
        positions[i3 + 1] = 1 + Math.random() * 5;
        positions[i3 + 2] = (Math.random() - 0.5) * 60;
        fireflyPhases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xFFE082,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        fog: true
    });

    fireflySystem = new THREE.Points(geometry, material);
    scene.add(fireflySystem);
}

/**
 * Update particle positions each frame.
 * @param {number} delta - frame delta in seconds
 * @param {number} elapsed - total elapsed time in seconds
 * @param {{x:number, z:number}} playerPos - player position for re-centering
 */
export function updateParticles(delta, elapsed, playerPos) {
    updateLeaves(delta, playerPos);
    updateFireflies(delta, elapsed);
}

/**
 * Update leaf positions — drift and respawn when they fall below ground.
 */
function updateLeaves(delta, playerPos) {
    if (!leafSystem) return;
    const positions = leafSystem.geometry.attributes.position.array;

    for (let i = 0; i < LEAF_COUNT; i++) {
        const i3 = i * 3;

        // Add wind sway
        positions[i3] += leafVelocities[i3] * delta + Math.sin(positions[i3 + 1] * 0.5) * 0.01;
        positions[i3 + 1] += leafVelocities[i3 + 1] * delta;
        positions[i3 + 2] += leafVelocities[i3 + 2] * delta;

        // Respawn above when leaf falls below ground
        if (positions[i3 + 1] < 0) {
            positions[i3] = playerPos.x + (Math.random() - 0.5) * 60;
            positions[i3 + 1] = 10 + Math.random() * 10;
            positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 60;
        }
    }

    leafSystem.geometry.attributes.position.needsUpdate = true;
}

/**
 * Update firefly positions — gentle floating with pulsing opacity.
 */
function updateFireflies(delta, elapsed) {
    if (!fireflySystem) return;
    const positions = fireflySystem.geometry.attributes.position.array;

    for (let i = 0; i < FIREFLY_COUNT; i++) {
        const i3 = i * 3;
        fireflyPhases[i] += delta * (0.5 + Math.random() * 0.5);

        // Gentle circular drift
        positions[i3] += Math.sin(fireflyPhases[i]) * 0.02;
        positions[i3 + 1] += Math.cos(fireflyPhases[i] * 1.3) * 0.01;
        positions[i3 + 2] += Math.cos(fireflyPhases[i] * 0.7) * 0.02;

        // Keep within bounds
        if (positions[i3 + 1] < 0.5) positions[i3 + 1] = 0.5;
        if (positions[i3 + 1] > 8) positions[i3 + 1] = 8;
    }

    fireflySystem.geometry.attributes.position.needsUpdate = true;

    // Pulse opacity based on time
    fireflySystem.material.opacity = 0.4 + Math.sin(elapsed * 0.8) * 0.4;
}
