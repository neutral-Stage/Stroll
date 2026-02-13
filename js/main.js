/**
 * main.js — Entry point for Stroll: A Peaceful City Walk
 *
 * This module orchestrates initialization and the render loop.
 * All game systems are imported from dedicated modules:
 *  - config.js   — constants and tunable parameters
 *  - lighting.js — lights, fog, skybox, ground, day/night cycle
 *  - city.js     — procedural city generation (buildings, sidewalks, park, trees, lamps)
 *  - npcs.js     — NPC creation and AI updates
 *  - controls.js — keyboard, mouse, and mobile touch input
 *  - audio.js    — Web Audio ambient soundscape
 *  - particles.js — atmospheric leaf and firefly particles
 *
 * @module main
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { THOUGHTS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME, PLAYER_HEIGHT } from './config.js';
import { setupLighting, setupFog, setupSkybox, setupGround, updateDayNight } from './lighting.js';
import { generateCity } from './city.js';
import { generateNPCs, updateNPCs } from './npcs.js';
import { detectMobile, setupControls, setupMobileControls, setupResize, updatePlayer, player } from './controls.js';
import { setupSoundToggle } from './audio.js';
import { createParticles, updateParticles } from './particles.js';

// ── Module-level state ───────────────────────────────────────
/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Clock} */
let clock;
/** Total elapsed time for consistent animation timing */
let elapsed = 0;

// ── Initialization ───────────────────────────────────────────

/**
 * Main initialization function. Called on DOMContentLoaded.
 * Sets up the scene, generates the city, and starts the render loop.
 */
function init() {
    // Detect device type
    detectMobile();

    // Set up Three.js scene and renderer
    setupScene();

    // Set up lighting, fog, sky, and ground
    setupLighting(scene);
    setupFog(scene);
    setupSkybox(scene);
    setupGround(scene);

    // Show loading progress
    updateLoadingProgress(10, 'Generating city...');

    // Generate city (buildings, sidewalks, park, trees, lamps)
    generateCity(scene, (percent) => {
        updateLoadingProgress(percent, 'Building the world...');
    });
    updateLoadingProgress(70, 'Adding life...');

    // Generate NPCs
    generateNPCs(scene);
    updateLoadingProgress(85, 'Adding atmosphere...');

    // Create particle effects (leaves, fireflies)
    createParticles(scene);
    updateLoadingProgress(95, 'Almost ready...');

    // Set up controls (keyboard, mouse, mobile)
    setupControls(renderer, camera);
    setupMobileControls();
    setupResize(camera, renderer);

    // Set up sound toggle (safely after DOM is ready)
    setupSoundToggle();

    // Start thought cycle
    scheduleThought();

    // Hide loading screen after first render
    clock = new THREE.Clock();
    requestAnimationFrame(() => {
        renderer.render(scene, camera);
        hideLoadingScreen();
        animate();
    });
}

// ── Scene Setup ──────────────────────────────────────────────

/**
 * Create the Three.js scene, camera, and renderer.
 * Includes WebGL error handling for unsupported browsers.
 */
function setupScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    // Check for WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
        showError('WebGL is not supported by your browser. Please try a modern browser like Chrome or Firefox.');
        return;
    }

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        // Updated from deprecated outputEncoding to outputColorSpace (Three.js r152+)
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);
    } catch (err) {
        showError('Failed to initialize WebGL renderer: ' + err.message);
    }
}

// ── Loading Screen ───────────────────────────────────────────

/**
 * Update the loading screen progress indicator.
 * @param {number} percent - 0..100
 * @param {string} message - status text
 */
function updateLoadingProgress(percent, message) {
    const bar = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = message;
}

/**
 * Hide the loading screen with a fade transition.
 * Triggered after the first render, not on a fixed timer.
 */
function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.classList.add('hidden');
        // Remove from DOM after transition completes
        setTimeout(() => {
            screen.style.display = 'none';
        }, 1500);
    }
}

/**
 * Show an error message to the user (WebGL not supported, etc.).
 * @param {string} message
 */
function showError(message) {
    const screen = document.getElementById('loading-screen');
    const text = document.getElementById('loading-text');
    if (text) {
        text.textContent = message;
        text.style.color = '#ff6b6b';
    }
}

// ── Thoughts ─────────────────────────────────────────────────

/**
 * Schedule the next peaceful thought to appear on screen.
 */
function scheduleThought() {
    const delay = THOUGHT_MIN_DELAY + Math.random() * THOUGHT_EXTRA_DELAY;
    setTimeout(() => {
        showThought();
        scheduleThought();
    }, delay);
}

/**
 * Display a random peaceful thought in the UI bubble.
 */
function showThought() {
    const bubble = document.getElementById('thought-bubble');
    if (!bubble) return;
    const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
    bubble.textContent = '"' + thought + '"';
    bubble.classList.add('visible');

    setTimeout(() => {
        bubble.classList.remove('visible');
    }, THOUGHT_DISPLAY_TIME);
}

// ── Visibility Handling ──────────────────────────────────────

/**
 * Pause the clock when the tab is hidden to prevent large delta jumps.
 */
document.addEventListener('visibilitychange', () => {
    if (clock) {
        if (document.hidden) {
            clock.stop();
        } else {
            clock.start();
        }
    }
});

// ── Animation Loop ───────────────────────────────────────────

/**
 * Main render loop. Updates all game systems each frame.
 */
function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    elapsed += delta;

    // Update player movement and camera
    updatePlayer(delta, camera);

    // Update NPCs (with distance culling)
    updateNPCs(delta, player);

    // Update day/night cycle
    updateDayNight(delta, scene);

    // Update particle effects
    updateParticles(delta, elapsed, player);

    // Render
    renderer.render(scene, camera);
}

// ── Start ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
