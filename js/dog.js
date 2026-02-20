/**
 * dog.js — Companion dog that follows the player
 *
 * Features:
 *  • Simple box-based dog geometry with brown coloring
 *  • Follows player with slight delay, stays within ~3-5 units
 *  • Idle bobbing animation when stationary
 *  • Walking animation when moving
 *  • Occasional bark sound effect
 *
 * @module dog
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getAudioContext, getMasterGain, isSoundOn } from './audio.js';

/** @type {THREE.Group} */
let dogGroup = null;

/** Dog state */
let dogPos = { x: 3, z: 3 };
let dogTargetPos = { x: 3, z: 3 };
let dogYaw = 0;
let dogIsMoving = false;
let dogBobTime = 0;
let barkTimer = 0;
let nextBarkTime = 10 + Math.random() * 20;
let tailWagTime = 0;

/** Leg references for animation */
let legFL = null, legFR = null, legBL = null, legBR = null;
let tail = null;

/**
 * Create the companion dog and add to scene.
 * @param {THREE.Scene} scene
 */
export function createDog(scene) {
    dogGroup = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // brown
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x5C2E00 }); // dark brown
    const noseMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // black
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const tongueMat = new THREE.MeshLambertMaterial({ color: 0xFF6B6B });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.2), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    dogGroup.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), bodyMat);
    head.position.set(0, 0.9, -0.7);
    head.castShadow = true;
    dogGroup.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), darkMat);
    snout.position.set(0, 0.8, -1.0);
    dogGroup.add(snout);

    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.05), noseMat);
    nose.position.set(0, 0.85, -1.15);
    dogGroup.add(nose);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    eyeL.position.set(-0.15, 0.98, -0.95);
    dogGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    eyeR.position.set(0.15, 0.98, -0.95);
    dogGroup.add(eyeR);

    // Ears
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.1), darkMat);
    earL.position.set(-0.25, 1.1, -0.65);
    earL.rotation.z = -0.3;
    dogGroup.add(earL);

    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.1), darkMat);
    earR.position.set(0.25, 1.1, -0.65);
    earR.rotation.z = 0.3;
    dogGroup.add(earR);

    // Tongue (small, hanging out)
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.12), tongueMat);
    tongue.position.set(0.05, 0.72, -1.05);
    dogGroup.add(tongue);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);

    legFL = new THREE.Mesh(legGeo, darkMat);
    legFL.position.set(-0.25, 0.18, -0.4);
    legFL.castShadow = true;
    dogGroup.add(legFL);

    legFR = new THREE.Mesh(legGeo, darkMat);
    legFR.position.set(0.25, 0.18, -0.4);
    legFR.castShadow = true;
    dogGroup.add(legFR);

    legBL = new THREE.Mesh(legGeo, darkMat);
    legBL.position.set(-0.25, 0.18, 0.4);
    legBL.castShadow = true;
    dogGroup.add(legBL);

    legBR = new THREE.Mesh(legGeo, darkMat);
    legBR.position.set(0.25, 0.18, 0.4);
    legBR.castShadow = true;
    dogGroup.add(legBR);

    // Tail
    tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), bodyMat);
    tail.position.set(0, 0.85, 0.7);
    tail.rotation.x = -0.5;
    dogGroup.add(tail);

    // Position dog near player start
    dogGroup.position.set(dogPos.x, 0, dogPos.z);
    scene.add(dogGroup);
}

/**
 * Update dog behavior each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x: number, z: number}} playerPos
 */
export function updateDog(delta, elapsed, playerPos) {
    if (!dogGroup) return;

    // Calculate distance to player
    const dx = playerPos.x - dogPos.x;
    const dz = playerPos.z - dogPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Follow player if too far away (> 4 units)
    if (dist > 4) {
        // Move toward player but stop at ~2.5 units
        const targetDist = 2.5;
        const angle = Math.atan2(dz, dx);
        dogTargetPos.x = playerPos.x - Math.cos(angle) * targetDist;
        dogTargetPos.z = playerPos.z - Math.sin(angle) * targetDist;
        dogIsMoving = true;
    } else if (dist < 2) {
        // Too close, back off slightly
        const targetDist = 2.5;
        const angle = Math.atan2(dz, dx);
        dogTargetPos.x = playerPos.x - Math.cos(angle) * targetDist;
        dogTargetPos.z = playerPos.z - Math.sin(angle) * targetDist;
        dogIsMoving = true;
    } else {
        dogIsMoving = false;
    }

    // Smooth movement toward target
    const moveSpeed = 3.0 * delta;
    const tdx = dogTargetPos.x - dogPos.x;
    const tdz = dogTargetPos.z - dogPos.z;
    const tDist = Math.sqrt(tdx * tdx + tdz * tdz);

    if (tDist > 0.1) {
        dogPos.x += (tdx / tDist) * Math.min(moveSpeed, tDist);
        dogPos.z += (tdz / tDist) * Math.min(moveSpeed, tDist);
        dogIsMoving = true;

        // Face movement direction
        const targetYaw = Math.atan2(tdx, tdz) + Math.PI;
        // Smooth rotation
        let yawDiff = targetYaw - dogYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        dogYaw += yawDiff * Math.min(1, 5 * delta);
    } else {
        dogIsMoving = false;
    }

    // Update position
    dogGroup.position.x = dogPos.x;
    dogGroup.position.z = dogPos.z;
    dogGroup.rotation.y = dogYaw;

    // Animations
    if (dogIsMoving) {
        // Walking animation - leg movement
        dogBobTime += delta * 10;
        const legSwing = Math.sin(dogBobTime) * 0.4;
        if (legFL) legFL.rotation.x = legSwing;
        if (legBR) legBR.rotation.x = legSwing;
        if (legFR) legFR.rotation.x = -legSwing;
        if (legBL) legBL.rotation.x = -legSwing;

        // Slight body bob
        dogGroup.position.y = Math.abs(Math.sin(dogBobTime * 2)) * 0.05;
    } else {
        // Idle animation - gentle breathing bob
        dogBobTime += delta * 2;
        dogGroup.position.y = Math.sin(dogBobTime) * 0.03;

        // Reset legs
        if (legFL) legFL.rotation.x *= 0.9;
        if (legFR) legFR.rotation.x *= 0.9;
        if (legBL) legBL.rotation.x *= 0.9;
        if (legBR) legBR.rotation.x *= 0.9;
    }

    // Tail wagging
    tailWagTime += delta * (dogIsMoving ? 12 : 6);
    if (tail) {
        tail.rotation.y = Math.sin(tailWagTime) * 0.5;
    }

    // Bark timer
    barkTimer += delta;
    if (barkTimer >= nextBarkTime) {
        barkTimer = 0;
        nextBarkTime = 15 + Math.random() * 30;
        playBark();
    }
}

/**
 * Play a bark sound effect using Web Audio API.
 */
function playBark() {
    try {
        if (!isSoundOn()) return;
        const audioCtx = getAudioContext();
        const masterGain = getMasterGain();
        if (!audioCtx || !masterGain) return;

        if (audioCtx.state === 'suspended') return;

        const now = audioCtx.currentTime;

        // Bark = short noise burst with pitch envelope
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300 + Math.random() * 100, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3, now + 0.02);
        g.gain.linearRampToValueAtTime(0.15, now + 0.06);
        g.gain.linearRampToValueAtTime(0.25, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(2, now);

        osc.connect(g);
        g.connect(filter);
        filter.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.25);

        // Second bark (double bark)
        if (Math.random() > 0.5) {
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(320 + Math.random() * 80, now + 0.25);
            osc2.frequency.exponentialRampToValueAtTime(160, now + 0.35);

            const g2 = audioCtx.createGain();
            g2.gain.setValueAtTime(0, now + 0.25);
            g2.gain.linearRampToValueAtTime(0.25, now + 0.27);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc2.connect(g2);
            g2.connect(filter);
            osc2.start(now + 0.25);
            osc2.stop(now + 0.5);
        }
    } catch (e) {
        // Silently fail if audio not available
    }
}

/**
 * Get the dog's current position.
 * @returns {{x: number, z: number}}
 */
export function getDogPosition() {
    return { x: dogPos.x, z: dogPos.z };
}
