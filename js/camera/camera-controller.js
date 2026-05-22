/**
 * camera-controller.js — Switchable 1st/3rd person camera
 * @module camera/camera-controller
 */

import * as THREE from 'three';
import {
    CAMERA_MODES, THIRD_PERSON_OFFSET, THIRD_PERSON_AIM_OFFSET,
    CAMERA_LERP_SPEED, PLAYER_HEIGHT,
} from '../config.js';

/** @type {THREE.PerspectiveCamera} */
let camera = null;
let mode = CAMERA_MODES.FIRST_PERSON;

// Shake system
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;

// FOV interpolation
let targetFOV = 65;
let currentFOV = 65;

// Third person smooth follow
const currentOffset = new THREE.Vector3();
const targetOffset = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

// Raycaster for camera collision
const raycaster = new THREE.Raycaster();

/**
 * Initialize the camera controller.
 * @param {THREE.PerspectiveCamera} cam
 */
export function initCamera(cam) {
    camera = cam;
    mode = CAMERA_MODES.FIRST_PERSON;
    currentFOV = cam.fov;
    targetFOV = cam.fov;
    currentOffset.set(THIRD_PERSON_OFFSET.x, THIRD_PERSON_OFFSET.y, THIRD_PERSON_OFFSET.z);
}

/**
 * Update camera position and effects each frame.
 * @param {number} delta
 * @param {number} px - Player world X
 * @param {number} py - Player world Y (ground level)
 * @param {number} pz - Player world Z
 * @param {number} yaw - Player yaw (radians)
 * @param {number} pitch - Player pitch (radians)
 * @param {boolean} sprinting
 * @param {boolean} aiming
 * @param {number} headBob - Head bob offset (0 when stationary)
 */
export function updateCamera(delta, px, py, pz, yaw, pitch, sprinting, aiming, headBob = 0) {
    if (!camera) return;

    // FOV changes
    targetFOV = sprinting ? 75 : (aiming && mode === CAMERA_MODES.FIRST_PERSON ? 55 : 65);
    currentFOV += (targetFOV - currentFOV) * Math.min(1, delta * 6);
    camera.fov = currentFOV;
    camera.updateProjectionMatrix();

    if (mode === CAMERA_MODES.FIRST_PERSON) {
        updateFirstPerson(delta, px, py, pz, yaw, pitch, headBob);
    } else {
        updateThirdPerson(delta, px, py, pz, yaw, pitch, aiming);
    }

    // Apply camera shake
    if (shakeTimer > 0) {
        shakeTimer -= delta;
        const t = shakeTimer / shakeDuration;
        const decay = t * shakeIntensity;
        shakeOffsetX = (Math.random() - 0.5) * decay * 2;
        shakeOffsetY = (Math.random() - 0.5) * decay * 2;
        camera.position.x += shakeOffsetX;
        camera.position.y += shakeOffsetY;
    }
}

function updateFirstPerson(delta, px, py, pz, yaw, pitch, headBob) {
    camera.position.set(px, py + PLAYER_HEIGHT + headBob, pz);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

function updateThirdPerson(delta, px, py, pz, yaw, pitch, aiming) {
    const offset = aiming ? THIRD_PERSON_AIM_OFFSET : THIRD_PERSON_OFFSET;
    targetOffset.set(offset.x, offset.y, offset.z);

    // Smoothly interpolate to target offset
    const lerpFactor = Math.min(1, delta * CAMERA_LERP_SPEED);
    currentOffset.lerp(targetOffset, lerpFactor);

    // Rotate offset by player yaw
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const rotatedX = currentOffset.x * cosY + currentOffset.z * sinY;
    const rotatedZ = -currentOffset.x * sinY + currentOffset.z * cosY;

    const targetX = px + rotatedX;
    const targetY = py + currentOffset.y;
    const targetZ = pz + rotatedZ;

    // Simple collision avoidance: if camera is inside a building, move it closer
    camera.position.set(targetX, targetY, targetZ);

    // Look at player's upper body
    lookTarget.set(px, py + PLAYER_HEIGHT * 0.8, pz);
    camera.lookAt(lookTarget);

    // Apply pitch adjustment for looking up/down
    camera.rotation.x += pitch * 0.5;
}

/**
 * Toggle between first and third person.
 * @returns {number} new camera mode
 */
export function toggleCameraMode() {
    mode = mode === CAMERA_MODES.FIRST_PERSON
        ? CAMERA_MODES.THIRD_PERSON
        : CAMERA_MODES.FIRST_PERSON;
    return mode;
}

/**
 * Add camera shake effect.
 * @param {number} intensity - Shake magnitude (0.01 = subtle, 0.1 = heavy)
 * @param {number} duration - Duration in seconds
 */
export function addCameraShake(intensity, duration) {
    // Stack with existing shake (take the larger)
    if (intensity > shakeIntensity * (shakeTimer / shakeDuration || 0)) {
        shakeIntensity = intensity;
        shakeDuration = duration;
        shakeTimer = duration;
    }
}

/**
 * Get current camera mode.
 * @returns {number}
 */
export function getCameraMode() {
    return mode;
}

/**
 * Get the camera reference.
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() {
    return camera;
}

/**
 * Set camera mode directly.
 * @param {number} newMode
 */
export function setCameraMode(newMode) {
    mode = newMode;
}
