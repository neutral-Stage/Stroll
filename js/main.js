// @ts-check
/**
 * main.js — Entry point for Stroll
 * @module main
 */

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import {
    THOUGHTS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME,
    PLAYER_HEIGHT, FEATURE_WEAPON, FEATURE_MINIGAMES,
} from './config.js';
import { setupLighting, setupFog, setupSkybox, setupGround } from './lighting.js';
import { generateCity } from './city.js';
import { generateNPCs } from './npcs.js';
import { detectMobile, setupControls, setupMobileControls, setupResize, player } from './controls.js';
import { setupSoundToggle, playDiscoverySound, playAchievementSound } from './audio.js';
import { createParticles } from './particles.js';
import { createCollectibles } from './collectibles.js';
import { createEnhancedCollectibles } from './enhanced-collectibles.js';
import { createWildlife } from './wildlife.js';
import { createChallenges, onAchievement, onDiscovery, getDiscoveries, getAchievements, getWaypointsFound, getTotalWaypoints, getAchievementList } from './challenges.js';
import { isPhotoModeActive } from './photomode.js';
import { isMeditationActive } from './meditation.js';
import { createInteractiveElements } from './interactive.js';
import { startCinematic } from './cinematic.js';
import { updateHUD, toggleJournal, showToast, getIsPaused, setupPauseMenu, setPauseStatsProvider } from './hud.js';
import { session, markStrollBegun, buildPauseSnapshot } from './game-state.js';
import { createDog } from './dog.js';
import { initWeapon, resizeWeapon } from './weapon.js';
import { createTraffic } from './traffic.js';
import { initWeather } from './weather.js';
import { setupGameInput, setupJournalTabListeners } from './input.js';
import { tick } from './game-loop.js';
import { resolveQuality, applyRendererQuality, getQuality } from './quality.js';
import { getScore, getCollectedCount, getTotalCollectibles } from './collectibles.js';
import { getTotalEnhancedCollectibles, getCollectedEnhancedCount } from './enhanced-collectibles.js';

/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {EffectComposer} */
let composer;
/** @type {import('three/addons/postprocessing/UnrealBloomPass.js').UnrealBloomPass | null} */
let bloomPass = null;
/** @type {import('three/addons/postprocessing/ShaderPass.js').ShaderPass | null} */
let fxaaPass = null;
/** @type {THREE.Clock} */
let clock;
let elapsed = 0;
let lastPlayerPos = { x: 0, z: 0 };

function init() {
    try {
        initCore();
    } catch (err) {
        console.error('Stroll init failed:', err);
        showError('Failed to start: ' + (err && err.message ? err.message : String(err)));
    }
}

function initCore() {
    const isMobile = detectMobile();
    resolveQuality(isMobile);
    setupScene();

    if (!scene || !renderer || !composer) {
        showError('Failed to initialize WebGL. Try another browser or enable hardware acceleration.');
        return;
    }

    applyRendererQuality(renderer);
    updateUiForFeatureFlags();

    setupLighting(scene);
    setupFog(scene);
    setupSkybox(scene);
    setupGround(scene);

    updateLoadingProgress(10, 'Generating city...');
    generateCity(scene, (percent) => updateLoadingProgress(percent, 'Building the world...'));
    updateLoadingProgress(50, 'Adding life...');

    generateNPCs(scene);
    createCollectibles(scene);
    createEnhancedCollectibles(scene);
    createWildlife(scene);
    createChallenges(scene);
    createInteractiveElements(scene);
    createParticles(scene);
    createDog(scene);
    createTraffic(scene);

    if (FEATURE_WEAPON) {
        initWeapon(scene, camera, renderer);
    }

    initWeather(scene);
    updateLoadingProgress(92, 'Setting up controls...');

    setupControls(renderer, camera);
    setupMobileControls();
    setupResize(camera, renderer, composer, () => {
        resizeWeapon();
        updateFxaaResolution();
    });
    setupSoundToggle();
    setupPauseMenu();
    setPauseStatsProvider(() => buildPauseSnapshot({
        score: getScore(),
        collected: getCollectedCount() + getCollectedEnhancedCount(),
        totalCollectibles: getTotalCollectibles() + getTotalEnhancedCollectibles(),
        waypointsFound: getWaypointsFound(),
        totalWaypoints: getTotalWaypoints(),
        achievementsUnlocked: getAchievements().length,
        achievementsTotal: getAchievementList().length,
    }));
    setupJournalTabListeners();
    setupGameInput({ camera, player, renderer, scene });
    setupLoadingRetry();

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
        startCinematic(() => markStrollBegun());
        animate();
    });
}

function updateUiForFeatureFlags() {
    const weaponHints = document.querySelectorAll('.weapon-hint');
    weaponHints.forEach((el) => {
        el.style.display = FEATURE_WEAPON ? '' : 'none';
    });
    const interactHint = document.getElementById('interact-hint');
    if (interactHint) {
        interactHint.textContent = 'interact with flowers';
    }

    const minigameHints = document.querySelectorAll('.minigame-hint');
    minigameHints.forEach((el) => {
        el.style.display = FEATURE_MINIGAMES ? '' : 'none';
    });
}

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
        const q = getQuality();
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        applyRendererQuality(renderer);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);

        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        if (q.bloom) {
            bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.4, 0.6, 0.8
            );
            composer.addPass(bloomPass);
        }

        if (q.fxaa) {
            fxaaPass = new ShaderPass(FXAAShader);
            updateFxaaResolution();
            composer.addPass(fxaaPass);
        }
    } catch (err) {
        showError('Failed to initialize WebGL renderer: ' + err.message);
    }
}

function updateFxaaResolution() {
    if (!renderer || !fxaaPass?.material?.uniforms?.['resolution']) return;
    const pr = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pr);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pr);
}

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

function setupLoadingRetry() {
    const retry = document.getElementById('loading-retry');
    if (!retry || retry.dataset.bound) return;
    retry.dataset.bound = '1';
    retry.addEventListener('click', () => window.location.reload());
}

function showError(message) {
    const screen = document.getElementById('loading-screen');
    const text = document.getElementById('loading-text');
    const bar = document.getElementById('loading-bar');
    if (screen) {
        screen.classList.remove('hidden');
        screen.style.display = 'flex';
        screen.classList.add('is-error');
    }
    if (text) text.textContent = message;
    if (bar) bar.style.display = 'none';
}

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
    bubble.textContent = '"' + THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)] + '"';
    bubble.classList.add('visible');
    setTimeout(() => bubble.classList.remove('visible'), THOUGHT_DISPLAY_TIME);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    elapsed += delta;
    const result = tick({
        scene, camera, renderer, composer, delta, elapsed, lastPlayerPos,
    });
    lastPlayerPos = result.lastPlayerPos;
}

document.addEventListener('visibilitychange', () => {
    if (clock) {
        if (document.hidden) clock.stop();
        else clock.start();
    }
});

function startWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}
startWhenReady();
