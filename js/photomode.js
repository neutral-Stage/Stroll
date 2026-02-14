/**
 * photomode.js — Photo mode: freeze game, orbit camera, apply filters
 *
 * Features:
 *  • Freeze all game updates
 *  • Free orbit camera around player position
 *  • Visual filters (warm, cool, noir, dreamy)
 *  • Screenshot capture
 *
 * @module photomode
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let isActive = false;
let orbitAngle = 0;
let orbitPitch = 0.3;
let orbitDistance = 8;
let currentFilter = 0;
let playerFrozenPos = { x: 0, y: 3.5, z: 0 };

/** @type {THREE.PerspectiveCamera} */
let cameraRef = null;

const FILTERS = [
    { name: 'None', exposure: 0.9, saturation: 1.0 },
    { name: 'Golden', exposure: 1.1, saturation: 1.2 },
    { name: 'Cool', exposure: 0.85, saturation: 0.8 },
    { name: 'Dreamy', exposure: 1.2, saturation: 0.9 },
    { name: 'Noir', exposure: 0.7, saturation: 0.0 },
];

/**
 * Toggle photo mode on/off.
 * @param {THREE.PerspectiveCamera} camera
 * @param {{x:number, z:number}} playerPos
 * @param {THREE.WebGLRenderer} renderer
 * @returns {boolean} new active state
 */
export function togglePhotoMode(camera, playerPos, renderer) {
    isActive = !isActive;
    cameraRef = camera;

    if (isActive) {
        playerFrozenPos = { x: playerPos.x, y: 3.5, z: playerPos.z };
        orbitAngle = 0;
        orbitPitch = 0.3;
        orbitDistance = 8;
        currentFilter = 0;
        applyFilter(renderer);
    } else {
        // Reset filter
        currentFilter = 0;
        applyFilter(renderer);
    }

    updatePhotoUI();
    return isActive;
}

/**
 * Handle mouse movement in photo mode for orbit.
 * @param {number} dx
 * @param {number} dy
 */
export function photoModeMouseMove(dx, dy) {
    if (!isActive) return;
    orbitAngle += dx * 0.005;
    orbitPitch = Math.max(-0.5, Math.min(1.2, orbitPitch + dy * 0.005));
}

/**
 * Handle scroll in photo mode for zoom.
 * @param {number} deltaY
 */
export function photoModeScroll(deltaY) {
    if (!isActive) return;
    orbitDistance = Math.max(3, Math.min(20, orbitDistance + deltaY * 0.01));
}

/**
 * Cycle through filters.
 * @param {THREE.WebGLRenderer} renderer
 */
export function cycleFilter(renderer) {
    if (!isActive) return;
    currentFilter = (currentFilter + 1) % FILTERS.length;
    applyFilter(renderer);
    updatePhotoUI();
}

function applyFilter(renderer) {
    const filter = FILTERS[currentFilter];
    renderer.toneMappingExposure = filter.exposure;
    // Saturation would need a post-processing pass; we simulate with exposure
}

/**
 * Update photo mode camera each frame.
 * @param {THREE.PerspectiveCamera} camera
 */
export function updatePhotoMode(camera) {
    if (!isActive) return;

    const x = playerFrozenPos.x + Math.cos(orbitAngle) * orbitDistance * Math.cos(orbitPitch);
    const y = playerFrozenPos.y + Math.sin(orbitPitch) * orbitDistance;
    const z = playerFrozenPos.z + Math.sin(orbitAngle) * orbitDistance * Math.cos(orbitPitch);

    camera.position.set(x, y, z);
    camera.lookAt(playerFrozenPos.x, playerFrozenPos.y, playerFrozenPos.z);
}

/**
 * Take a screenshot.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 */
export function takeScreenshot(renderer, scene, camera) {
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `stroll-photo-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
}

function updatePhotoUI() {
    const ui = document.getElementById('photo-mode-ui');
    if (!ui) return;

    if (isActive) {
        ui.style.display = 'block';
        const filterName = document.getElementById('filter-name');
        if (filterName) filterName.textContent = FILTERS[currentFilter].name;
    } else {
        ui.style.display = 'none';
    }
}

export function isPhotoModeActive() { return isActive; }
export function getCurrentFilterName() { return FILTERS[currentFilter].name; }
