/**
 * main.js — Entry point for Stroll: A Peaceful City Walk (Enhanced Edition)
 *
 * This module orchestrates initialization and the render loop.
 * All game systems are imported from dedicated modules:
 *  - config.js       — constants and tunable parameters
 *  - lighting.js     — lights, fog, skybox, ground, day/night cycle
 *  - city.js         — procedural city generation
 *  - npcs.js         — NPC creation and AI updates
 *  - controls.js     — keyboard, mouse, and mobile touch input
 *  - audio.js        — Web Audio ambient soundscape (overhauled)
 *  - particles.js    — atmospheric leaf and firefly particles
 *  - collectibles.js — glowing orbs/crystals with pickup effects
 *  - wildlife.js     — butterflies and birds
 *  - challenges.js   — waypoints, discoveries, achievements
 *  - photomode.js    — photo mode with filters
 *  - meditation.js   — meditation mode with breathing guide
 *  - interactive.js  — clickable flowers, glowing plants, footprints
 *  - cinematic.js    — cinematic intro flyover
 *  - hud.js          — HUD, compass, pause menu, toasts
 *
 * @module main
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';

import { THOUGHTS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME, PLAYER_HEIGHT } from './config.js';
import { setupLighting, setupFog, setupSkybox, setupGround, updateDayNight, getCycleTime, getNightAmount } from './lighting.js';
import { generateCity } from './city.js';
import { generateNPCs, updateNPCs } from './npcs.js';
import { detectMobile, setupControls, setupMobileControls, setupResize, updatePlayer, player } from './controls.js';
import { setupSoundToggle, updateAudioTimeOfDay, playDiscoverySound, playAchievementSound } from './audio.js';
import { createParticles, updateParticles } from './particles.js';
import { createCollectibles, updateCollectibles, getScore, getCollectedCount, getTotalCollectibles } from './collectibles.js';
import { createWildlife, updateWildlife } from './wildlife.js';
import { createChallenges, updateChallenges, onAchievement, onDiscovery, getDiscoveries, getAchievements, getWaypointsFound, getTotalWaypoints, getAchievementList } from './challenges.js';
import { togglePhotoMode, updatePhotoMode, isPhotoModeActive, photoModeMouseMove, photoModeScroll, cycleFilter, takeScreenshot } from './photomode.js';
import { toggleMeditation, updateMeditation, isMeditationActive } from './meditation.js';
import { createInteractiveElements, updateInteractive, handleClick, getFlowersInteracted } from './interactive.js';
import { startCinematic, updateCinematic, isCinematicPlaying, skipCinematic } from './cinematic.js';
import { updateHUD, togglePause, toggleJournal, showToast, getIsPaused, isJournalOpen, setupPauseMenu } from './hud.js';

// ── Module-level state ───────────────────────────────────────
/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {EffectComposer} */
let composer;
/** @type {THREE.Clock} */
let clock;
/** Total elapsed time */
let elapsed = 0;
/** Distance walked for achievements */
let distanceWalked = 0;
let lastPlayerPos = { x: 0, z: 0 };
/** Night seen flag */
let nightSeen = false;
/** Photos taken */
let photosTaken = 0;
/** Meditated flag */
let meditated = false;
/** Stars collected */
let starsCollected = 0;
/** Cinematic completed */
let cinematicDone = false;

// ── Initialization ───────────────────────────────────────────

function init() {
    detectMobile();
    setupScene();

    setupLighting(scene);
    setupFog(scene);
    setupSkybox(scene);
    setupGround(scene);

    updateLoadingProgress(10, 'Generating city...');

    generateCity(scene, (percent) => {
        updateLoadingProgress(percent, 'Building the world...');
    });
    updateLoadingProgress(50, 'Adding life...');

    generateNPCs(scene);
    updateLoadingProgress(60, 'Scattering treasures...');

    createCollectibles(scene);
    updateLoadingProgress(70, 'Adding wildlife...');

    createWildlife(scene);
    updateLoadingProgress(75, 'Placing waypoints...');

    createChallenges(scene);
    updateLoadingProgress(80, 'Growing flowers...');

    createInteractiveElements(scene);
    updateLoadingProgress(85, 'Adding atmosphere...');

    createParticles(scene);
    updateLoadingProgress(90, 'Setting up controls...');

    setupControls(renderer, camera);
    setupMobileControls();
    setupResize(camera, renderer, composer);
    setupSoundToggle();
    setupPauseMenu();
    setupJournalTabs();
    setupExtraKeyBindings();

    // Achievement & discovery callbacks
    onAchievement((ach) => {
        showToast(ach.icon, 'Achievement Unlocked!', ach.name + ' — ' + ach.desc, 'achievement');
        playAchievementSound();
    });

    onDiscovery((name, desc) => {
        showToast('📍', 'Discovery!', name + ' — ' + desc, 'discovery');
        playDiscoverySound();
    });

    updateLoadingProgress(95, 'Almost ready...');

    scheduleThought();

    clock = new THREE.Clock();
    requestAnimationFrame(() => {
        renderer.render(scene, camera);
        hideLoadingScreen();

        // Start cinematic intro
        startCinematic(() => {
            cinematicDone = true;
            // Trigger first steps achievement
            showToast('👣', 'Achievement Unlocked!', 'First Steps — Start your stroll', 'achievement');
        });

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

        // Post-processing: bloom
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,   // strength (subtle)
            0.4,   // radius
            0.85   // threshold
        );
        composer.addPass(bloomPass);
    } catch (err) {
        showError('Failed to initialize WebGL renderer: ' + err.message);
    }
}

// ── Loading Screen ───────────────────────────────────────────

function updateLoadingProgress(percent, message) {
    const bar = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = message;
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
    if (isPhotoModeActive() || isMeditationActive() || getIsPaused()) return;
    const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
    bubble.textContent = '"' + thought + '"';
    bubble.classList.add('visible');
    setTimeout(() => { bubble.classList.remove('visible'); }, THOUGHT_DISPLAY_TIME);
}

// ── Extra Key Bindings ───────────────────────────────────────

function setupExtraKeyBindings() {
    document.addEventListener('keydown', (e) => {
        // Skip cinematic
        if (isCinematicPlaying()) {
            skipCinematic();
            return;
        }

        // Pause
        if (e.key === 'Escape') {
            if (isJournalOpen()) {
                toggleJournal([], [], []);
            } else {
                togglePause();
            }
            return;
        }

        // Don't process other keys when paused or journal open
        if (getIsPaused() || isJournalOpen()) return;

        // Photo mode
        if (e.key === 'p' || e.key === 'P') {
            if (isMeditationActive()) return;
            const active = togglePhotoMode(camera, player, renderer);
            if (active) {
                showToast('📸', 'Photo Mode', 'Orbit with mouse, scroll to zoom', 'info');
            }
        }

        // Meditation mode
        if (e.key === 'n' || e.key === 'N') {
            if (isPhotoModeActive()) return;
            const active = toggleMeditation(camera, player);
            if (active) {
                meditated = true;
                showToast('🧘', 'Meditation', 'Relax and breathe...', 'info');
            }
        }

        // Journal
        if (e.key === 'j' || e.key === 'J') {
            toggleJournal(getDiscoveries(), getAchievements(), getAchievementList());
        }

        // Photo mode controls
        if (isPhotoModeActive()) {
            if (e.key === 'f' || e.key === 'F') {
                cycleFilter(renderer);
            }
            if (e.key === ' ') {
                takeScreenshot(renderer, scene, camera);
                photosTaken++;
                showToast('📸', 'Photo Saved!', 'Screenshot downloaded', 'info');
            }
        }
    });

    // Photo mode mouse/scroll
    document.addEventListener('mousemove', (e) => {
        if (isPhotoModeActive()) {
            photoModeMouseMove(e.movementX, e.movementY);
        }
    });

    document.addEventListener('wheel', (e) => {
        if (isPhotoModeActive()) {
            photoModeScroll(e.deltaY);
        }
    });

    // Click interaction for flowers
    renderer.domElement.addEventListener('click', (e) => {
        if (isPhotoModeActive() || isMeditationActive() || getIsPaused()) return;
        if (isCinematicPlaying()) return;

        const mouseNDC = {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1
        };
        const interacted = handleClick(camera, mouseNDC, scene);
        if (interacted) {
            showToast('🌸', 'Bloom!', 'A flower opens for you', 'info');
        }
    });
}

// ── Journal Tabs ─────────────────────────────────────────────

function setupJournalTabs() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('journal-tab')) {
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.journal-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            document.getElementById('journal-discoveries').style.display = tab === 'discoveries' ? 'block' : 'none';
            document.getElementById('journal-achievements').style.display = tab === 'achievements' ? 'block' : 'none';
        }

        if (e.target.id === 'journal-close') {
            toggleJournal([], [], []);
        }
    });
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

    const delta = Math.min(clock.getDelta(), 0.1);
    elapsed += delta;

    // Cinematic intro
    if (isCinematicPlaying()) {
        updateCinematic(delta, camera);
        updateDayNight(delta, scene);
        composer ? composer.render() : renderer.render(scene, camera);
        return;
    }

    // Paused
    if (getIsPaused() || isJournalOpen()) {
        composer ? composer.render() : renderer.render(scene, camera);
        return;
    }

    // Photo mode
    if (isPhotoModeActive()) {
        updatePhotoMode(camera);
        updateDayNight(delta, scene);
        updateParticles(delta, elapsed, player);
        composer ? composer.render() : renderer.render(scene, camera);
        return;
    }

    // Meditation mode
    if (isMeditationActive()) {
        updateMeditation(delta, camera);
        updateDayNight(delta, scene);
        updateParticles(delta, elapsed, player);
        updateWildlife(delta, elapsed, player);
        composer ? composer.render() : renderer.render(scene, camera);
        return;
    }

    // Normal gameplay
    updatePlayer(delta, camera);

    // Track distance walked
    const dx = player.x - lastPlayerPos.x;
    const dz = player.z - lastPlayerPos.z;
    distanceWalked += Math.sqrt(dx * dx + dz * dz);
    lastPlayerPos = { x: player.x, z: player.z };

    updateNPCs(delta, player);
    updateDayNight(delta, scene);
    updateParticles(delta, elapsed, player);

    // Get night amount for systems that need it
    const nightAmount = getNightAmount();
    const cycleTime = getCycleTime();

    // Track night seen
    if (nightAmount > 0.7) nightSeen = true;

    // Update audio layers
    updateAudioTimeOfDay(nightAmount);

    // Update collectibles
    const collectResult = updateCollectibles(delta, elapsed, player, scene);
    if (collectResult.justCollected === 'star') starsCollected++;

    // Update wildlife
    updateWildlife(delta, elapsed, player);

    // Update challenges
    const gameStats = {
        collected: getCollectedCount(),
        totalCollectibles: getTotalCollectibles(),
        waypointsFound: getWaypointsFound(),
        nightSeen,
        photosTaken,
        meditated,
        flowersInteracted: getFlowersInteracted(),
        distanceWalked,
        starsCollected
    };
    updateChallenges(delta, elapsed, player, gameStats);

    // Update interactive elements
    updateInteractive(delta, elapsed, player, nightAmount);

    // Update HUD
    updateHUD({
        score: collectResult.score,
        collected: getCollectedCount(),
        totalCollectibles: getTotalCollectibles(),
        waypointsFound: getWaypointsFound(),
        totalWaypoints: getTotalWaypoints(),
        cycleTime,
        playerYaw: player.yaw
    });

    // Render with post-processing
    composer ? composer.render() : renderer.render(scene, camera);
}

// ── Start ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
