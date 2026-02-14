/**
 * main.js — Entry point for Stroll: A Peaceful City Walk (Enhanced Edition)
 *
 * Orchestrates initialization and the render loop with all new systems:
 *  - Collectibles, scoring, achievements, discovery journal
 *  - Wildlife (butterflies, birds)
 *  - Post-processing (bloom, color grading)
 *  - Bioluminescent plants, volumetric fog, pollen, footprints
 *  - Overhauled audio with layered ambient soundscape
 *  - Photo mode, meditation mode, cinematic intro
 *  - Beautiful HUD with compass and time indicator
 *
 * @module main
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { THOUGHTS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME, PLAYER_HEIGHT } from './config.js';
import { setupLighting, setupFog, setupSkybox, setupGround, updateDayNight, getNightAmount, getCycleTime } from './lighting.js';
import { generateCity } from './city.js';
import { generateNPCs, updateNPCs } from './npcs.js';
import { detectMobile, setupControls, setupMobileControls, setupResize, updatePlayer, player, isPlayerMoving, getKeys } from './controls.js';
import { setupSoundToggle, updateAudio, playCollectionSound, playAchievementSound, playFootstep } from './audio.js';
import { createParticles, updateParticles } from './particles.js';
import { createCollectibles, updateCollectibles } from './collectibles.js';
import { createWildlife, updateWildlife } from './wildlife.js';
import { setupPostProcessing, getComposer, resizePostProcessing, createBioPlants, createVolumetricFog, createPollen, updateEffects } from './effects.js';
import * as gamestate from './gamestate.js';
import { initUI, runIntro, skipIntro, updateCompass, updateTimeIndicator, updateMeditationTimer, resetMeditationTimer, updateDistanceDisplay, cyclePhotoFilter, takePhoto, resetPhotoFilter } from './ui.js';

// ── Module-level state ───────────────────────────────────────
/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {THREE.Clock} */
let clock;
let elapsed = 0;

// Footstep timing
let footstepTimer = 0;
const FOOTSTEP_INTERVAL = 0.45;

// Meditation camera state
let meditationAngle = 0;
let meditationCamDist = 8;
let meditationCamHeight = 5;

// Previous player position for distance tracking
let prevPlayerX = 0;
let prevPlayerZ = 0;

// Night tracking for achievement
let wasNight = false;

// ── Initialization ───────────────────────────────────────────

function init() {
    detectMobile();
    setupScene();
    
    if (!renderer) return; // WebGL not supported
    
    // Set up lighting, fog, sky, and ground
    setupLighting(scene);
    setupFog(scene);
    setupSkybox(scene);
    setupGround(scene);
    
    updateLoadingProgress(10, 'Generating city...');
    
    // Generate city
    generateCity(scene, (percent) => {
        updateLoadingProgress(percent, 'Building the world...');
    });
    updateLoadingProgress(50, 'Adding life...');
    
    // Generate NPCs
    generateNPCs(scene);
    updateLoadingProgress(60, 'Scattering treasures...');
    
    // Create collectibles
    createCollectibles(scene);
    updateLoadingProgress(70, 'Summoning wildlife...');
    
    // Create wildlife
    createWildlife(scene);
    updateLoadingProgress(75, 'Growing magical plants...');
    
    // Create bioluminescent plants
    createBioPlants(scene);
    updateLoadingProgress(80, 'Adding atmosphere...');
    
    // Create particles, fog, pollen
    createParticles(scene);
    createVolumetricFog(scene);
    createPollen(scene);
    updateLoadingProgress(85, 'Setting up effects...');
    
    // Set up post-processing
    setupPostProcessing(renderer, scene, camera);
    updateLoadingProgress(90, 'Preparing controls...');
    
    // Set up controls
    setupControls(renderer, camera);
    setupMobileControls();
    setupResize(camera, renderer, resizePostProcessing);
    
    // Set up sound toggle
    setupSoundToggle();
    
    // Initialize UI
    initUI(() => {
        // Intro complete callback
    });
    
    // Set up keyboard shortcuts for new features
    setupFeatureKeys();
    
    // Subscribe to achievement events for audio
    gamestate.on('achievement', () => {
        playAchievementSound();
    });
    
    // Start thought cycle
    scheduleThought();
    
    updateLoadingProgress(100, 'Welcome to Stroll');
    
    // Start
    clock = new THREE.Clock();
    requestAnimationFrame(() => {
        const composer = getComposer();
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
        hideLoadingScreen();
        
        // Run cinematic intro after loading
        setTimeout(() => {
            runIntro();
        }, 500);
        
        animate();
    });
}

// ── Scene Setup ──────────────────────────────────────────────

function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
        showError('WebGL is not supported by your browser.');
        return;
    }

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);
    } catch (err) {
        showError('Failed to initialize WebGL renderer: ' + err.message);
    }
}

// ── Feature Keybindings ──────────────────────────────────────

function setupFeatureKeys() {
    document.addEventListener('keydown', (e) => {
        const state = gamestate.getState();
        
        // Escape — toggle pause
        if (e.key === 'Escape') {
            if (state.isPhotoMode) {
                gamestate.setPhotoMode(false);
                resetPhotoFilter();
            } else if (state.isMeditating) {
                gamestate.setMeditating(false);
                resetMeditationTimer();
            } else {
                gamestate.togglePause();
            }
        }
        
        // P — photo mode
        if (e.key === 'p' || e.key === 'P') {
            if (!state.isPaused && !state.isMeditating) {
                if (state.isPhotoMode) {
                    gamestate.setPhotoMode(false);
                    resetPhotoFilter();
                } else {
                    gamestate.setPhotoMode(true);
                }
            }
        }
        
        // F — cycle photo filter (in photo mode)
        if ((e.key === 'f' || e.key === 'F') && state.isPhotoMode) {
            cyclePhotoFilter();
        }
        
        // Space — take photo (in photo mode)
        if (e.key === ' ' && state.isPhotoMode) {
            e.preventDefault();
            takePhoto(renderer, scene, camera);
        }
        
        // Z — meditation mode
        if (e.key === 'z' || e.key === 'Z') {
            if (!state.isPaused && !state.isPhotoMode) {
                if (state.isMeditating) {
                    gamestate.setMeditating(false);
                    resetMeditationTimer();
                } else {
                    gamestate.setMeditating(true);
                    meditationAngle = player.yaw;
                }
            }
        }
        
        // J — toggle journal
        if (e.key === 'j' || e.key === 'J') {
            const panel = document.getElementById('journal-panel');
            if (panel) {
                if (panel.classList.contains('open')) {
                    panel.classList.remove('open');
                } else {
                    const btn = document.getElementById('journal-toggle');
                    if (btn) btn.click();
                }
            }
        }
        
        // Tab — toggle journal tabs
        if (e.key === 'Tab' && document.getElementById('journal-panel')?.classList.contains('open')) {
            e.preventDefault();
            const tabs = document.querySelectorAll('.journal-tab');
            const contents = document.querySelectorAll('.journal-tab-content');
            let activeIdx = 0;
            tabs.forEach((tab, i) => {
                if (tab.classList.contains('active')) activeIdx = i;
            });
            const nextIdx = (activeIdx + 1) % tabs.length;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tabs[nextIdx].classList.add('active');
            contents[nextIdx].classList.add('active');
        }
    });
    
    // Journal tab clicks
    document.querySelectorAll('.journal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.journal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.journal-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) target.classList.add('active');
        });
    });
    
    // Click to skip intro
    document.getElementById('cinematic-intro')?.addEventListener('click', skipIntro);
}

// ── Loading Screen ───────────────────────────────────────────

function updateLoadingProgress(percent, message) {
    const bar = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = message;
    
    // Update loading tip
    const tip = document.getElementById('loading-tip');
    if (tip && percent > 50 && !tip.dataset.shown) {
        tip.dataset.shown = 'true';
        const tips = [
            'Tip: Press P to enter Photo Mode',
            'Tip: Press Z to meditate',
            'Tip: Collect glowing items for points',
            'Tip: Press J to open your journal',
            'Tip: Look for bioluminescent plants at night'
        ];
        tip.textContent = tips[Math.floor(Math.random() * tips.length)];
        tip.style.opacity = '1';
    }
}

function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; }, 1500);
    }
}

function showError(message) {
    const text = document.getElementById('loading-text');
    if (text) {
        text.textContent = message;
        text.style.color = '#ff6b6b';
    }
}

// ── Thoughts ─────────────────────────────────────────────────

function scheduleThought() {
    const delay = THOUGHT_MIN_DELAY + Math.random() * THOUGHT_EXTRA_DELAY;
    setTimeout(() => {
        showThought();
        scheduleThought();
    }, delay);
}

function showThought() {
    const bubble = document.getElementById('thought-bubble');
    if (!bubble) return;
    const state = gamestate.getState();
    if (state.isPaused || state.isPhotoMode) return;
    
    const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
    bubble.textContent = '"' + thought + '"';
    bubble.classList.add('visible');
    setTimeout(() => { bubble.classList.remove('visible'); }, THOUGHT_DISPLAY_TIME);
}

// ── Visibility Handling ──────────────────────────────────────

document.addEventListener('visibilitychange', () => {
    if (clock) {
        if (document.hidden) clock.stop();
        else clock.start();
    }
});

// ── Animation Loop ───────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);
    
    const state = gamestate.getState();
    if (state.isPaused) return;
    
    const delta = Math.min(clock.getDelta(), 0.1);
    elapsed += delta;
    gamestate.addTime(delta);
    
    const nightAmount = getNightAmount();
    const cycleTime = getCycleTime();
    
    // Track night for achievement
    if (nightAmount > 0.7 && !wasNight) {
        wasNight = true;
        gamestate.recordNight();
    }
    if (nightAmount < 0.3) wasNight = false;
    
    // Update cycle time for UI
    gamestate.setCycleTime(cycleTime);
    
    if (state.isMeditating) {
        // Meditation mode — orbiting camera
        meditationAngle += delta * 0.2;
        gamestate.addMeditationTime(delta);
        updateMeditationTimer(delta);
        
        camera.position.set(
            player.x + Math.cos(meditationAngle) * meditationCamDist,
            PLAYER_HEIGHT + meditationCamHeight,
            player.z + Math.sin(meditationAngle) * meditationCamDist
        );
        camera.lookAt(player.x, PLAYER_HEIGHT, player.z);
    } else {
        // Normal player movement
        updatePlayer(delta, camera);
        
        // Track distance
        const dx = player.x - prevPlayerX;
        const dz = player.z - prevPlayerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.01) {
            gamestate.addDistance(dist);
        }
        prevPlayerX = player.x;
        prevPlayerZ = player.z;
        
        // Footstep sounds
        if (isPlayerMoving()) {
            footstepTimer += delta;
            if (footstepTimer >= FOOTSTEP_INTERVAL) {
                footstepTimer = 0;
                playFootstep();
            }
        } else {
            footstepTimer = FOOTSTEP_INTERVAL * 0.8; // Almost ready for next step
        }
    }
    
    // Update NPCs
    updateNPCs(delta, player);
    
    // Update day/night cycle
    updateDayNight(delta, scene);
    
    // Update particles
    updateParticles(delta, elapsed, player);
    
    // Update collectibles
    const collected = updateCollectibles(delta, elapsed, player, scene);
    if (collected) {
        gamestate.recordCollection(collected);
        playCollectionSound(collected.type);
    }
    
    // Update wildlife
    updateWildlife(delta, elapsed, player);
    
    // Update visual effects
    const moving = isPlayerMoving();
    updateEffects(delta, elapsed, { x: player.x, z: player.z, yaw: player.yaw }, nightAmount, scene, moving);
    
    // Update audio layers
    updateAudio(delta, nightAmount, player);
    
    // Update UI
    updateCompass(player.yaw);
    updateTimeIndicator(cycleTime);
    updateDistanceDisplay(gamestate.getState().distanceWalked);
    
    // Render with post-processing
    const composer = getComposer();
    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// ── Start ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
