/**
 * particles.js — Leaves and fireflies
 * @module particles
 */

import * as THREE from 'three';
import { getQuality } from './quality.js';
import { getNightAmount } from './lighting.js';

/** @type {THREE.Points} */
let leafSystem = null;
/** @type {Float32Array} */
let leafVelocities = null;

/** @type {THREE.Points} */
let fireflySystem = null;
/** @type {Float32Array} */
let fireflyPhases = null;
/** @type {Float32Array} */
let fireflyDriftSpeed = null;

let leafCount = 0;
let fireflyCount = 0;

export function createParticles(scene) {
    createLeaves(scene);
    createFireflies(scene);
}

function createLeaves(scene) {
    leafCount = getQuality().leafCount;
    const positions = new Float32Array(leafCount * 3);
    leafVelocities = new Float32Array(leafCount * 3);

    for (let i = 0; i < leafCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 80;
        positions[i3 + 1] = 2 + Math.random() * 15;
        positions[i3 + 2] = (Math.random() - 0.5) * 80;

        leafVelocities[i3] = (Math.random() - 0.5) * 0.25;
        leafVelocities[i3 + 1] = -0.08 - Math.random() * 0.12;
        leafVelocities[i3 + 2] = (Math.random() - 0.5) * 0.25;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    leafSystem = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
            color: 0x8BC34A,
            size: 0.15,
            transparent: true,
            opacity: 0.55,
            sizeAttenuation: true,
            fog: true,
        }),
    );
    scene.add(leafSystem);
}

function createFireflies(scene) {
    fireflyCount = getQuality().fireflyCount;
    const positions = new Float32Array(fireflyCount * 3);
    fireflyPhases = new Float32Array(fireflyCount);
    fireflyDriftSpeed = new Float32Array(fireflyCount);

    for (let i = 0; i < fireflyCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 60;
        positions[i3 + 1] = 1 + Math.random() * 5;
        positions[i3 + 2] = (Math.random() - 0.5) * 60;
        fireflyPhases[i] = Math.random() * Math.PI * 2;
        fireflyDriftSpeed[i] = 0.4 + Math.random() * 0.4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    fireflySystem = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
            color: 0xFFE082,
            size: 0.2,
            transparent: true,
            opacity: 0,
            sizeAttenuation: true,
            fog: true,
        }),
    );
    scene.add(fireflySystem);
}

export function updateParticles(delta, elapsed, playerPos) {
    updateLeaves(delta, elapsed, playerPos);
    updateFireflies(delta, elapsed, playerPos);
}

function updateLeaves(delta, elapsed, playerPos) {
    if (!leafSystem) return;
    const positions = leafSystem.geometry.attributes.position.array;
    const night = getNightAmount();
    leafSystem.material.opacity = 0.55 * (1 - night * 0.35);

    for (let i = 0; i < leafCount; i++) {
        const i3 = i * 3;
        const sway = Math.sin(positions[i3 + 1] * 0.5 + elapsed * 0.3) * 0.012 * delta * 60;

        positions[i3] += leafVelocities[i3] * delta + sway;
        positions[i3 + 1] += leafVelocities[i3 + 1] * delta;
        positions[i3 + 2] += leafVelocities[i3 + 2] * delta + sway;

        if (positions[i3 + 1] < 0) {
            positions[i3] = playerPos.x + (Math.random() - 0.5) * 60;
            positions[i3 + 1] = 10 + Math.random() * 10;
            positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 60;
        }
    }

    leafSystem.geometry.attributes.position.needsUpdate = true;
}

function updateFireflies(delta, elapsed, playerPos) {
    if (!fireflySystem) return;

    const night = getNightAmount();
    const nightVis = Math.max(0, (night - 0.25) / 0.75);
    fireflySystem.visible = nightVis > 0.02;
    fireflySystem.material.opacity = nightVis * (0.35 + Math.sin(elapsed * 0.8) * 0.25);

    if (!fireflySystem.visible) return;

    const positions = fireflySystem.geometry.attributes.position.array;

    for (let i = 0; i < fireflyCount; i++) {
        const i3 = i * 3;
        const spd = fireflyDriftSpeed[i];
        fireflyPhases[i] += delta * spd;

        positions[i3] += Math.sin(fireflyPhases[i]) * 0.015 * delta * 60;
        positions[i3 + 1] += Math.cos(fireflyPhases[i] * 1.3) * 0.008 * delta * 60;
        positions[i3 + 2] += Math.cos(fireflyPhases[i] * 0.7) * 0.015 * delta * 60;

        const dx = positions[i3] - playerPos.x;
        const dz = positions[i3 + 2] - playerPos.z;
        if (dx * dx + dz * dz > 45 * 45) {
            positions[i3] = playerPos.x + (Math.random() - 0.5) * 40;
            positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
        }

        if (positions[i3 + 1] < 0.5) positions[i3 + 1] = 0.5;
        if (positions[i3 + 1] > 8) positions[i3 + 1] = 8;
    }

    fireflySystem.geometry.attributes.position.needsUpdate = true;
}
