// @ts-check
/**
 * main.js — Entry point for STROLL: Open-World Destruction Sandbox
 * @module main
 */

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { setupEnvironment } from './render/env.js';

import {
    PLAYER_QUIPS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME,
    PLAYER_HEIGHT, FEATURE_WEAPON, GAME_STATES, FOG_COLOR, FOG_DENSITY,
} from './config.js';
import { setupLighting, setupFog, setupSkybox, setupGround } from './lighting.js';
import { generateCity, getPlayerSpawn } from './city.js';
import { generateNPCs } from './npcs.js';
import { detectMobile, setupControls, setupMobileControls, setupResize, player } from './controls.js';
import { setupSoundToggle } from './audio.js';
import { createParticles } from './particles.js';
import { createWildlife } from './wildlife.js';
import { createDog } from './dog.js';
import { createTraffic } from './traffic.js';
import { initWeather } from './weather.js';
import { initEconomy } from './shops/economy-system.js';
import { tick, setMovementFlags } from './game-loop.js';
import { resolveQuality, applyRendererQuality, getQuality } from './quality.js';
import { setState, getState, onStateChange } from './core/state-machine.js';
import { createPlayer, getPlayerStats } from './player/player.js';
import { initInventory } from './player/inventory.js';
import { initCamera } from './camera/camera-controller.js';
import { initFeel } from './core/feel.js';
import { createPowersSystem } from './weapons/powers-system.js';
import { initEnemies, spawnEnemy } from './enemies/enemy-manager.js';
import { initLevelSystem } from './systems/level-system.js';
import { initExplosions } from './destruction/explosions.js';
import { initHUD, setupPauseMenu, togglePause, getIsPaused, showToast, showMissionText } from './hud.js';
import { initVehicles, spawnVehicle } from './vehicles/vehicle-system.js';
import { initHelicopters, updateHelicopters, spawnHelicopter } from './vehicles/helicopter-system.js';
import { toggleRadio, nextStation } from './audio/radio.js';
import { initStory } from './missions/story.js';
import { initInteriors } from './interiors/interior-system.js';
import { initSkillsUI } from './ui/skills-ui.js';
import { initPlayerModel } from './player/player-model.js';
import { initWeaponSystem } from './weapons/weapon-system.js';
import { initPickups } from './weapons/pickups.js';

/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {THREE.WebGLRenderer} */
let renderer;
/** @type {EffectComposer} */
let composer;
let bloomPass = null;
let fxaaPass = null;
let ssaoPass = null;
/** @type {THREE.Clock} */
let clock;
let elapsed = 0;
let lastPlayerPos = { x: 0, z: 0 };

// ═══ LOADING TIPS ═══
const LOADING_TIPS = [
    "TIP: Hold Shift to sprint — but watch your stamina!",
    "TIP: Press V to toggle between first and third person camera",
    "TIP: RPG rockets can destroy buildings. Use wisely.",
    "TIP: Higher wanted levels bring SWAT teams and military",
    "TIP: Hide from police to let your wanted level decay",
    "TIP: Scroll wheel or Q/E to switch weapons quickly",
    "TIP: Cash drops from eliminated enemies",
    "TIP: The minimap shows nearby enemies as red dots",
    "TIP: Explosions can chain-react with nearby vehicles",
    "TIP: Right click to aim down sights for better accuracy",
];

function init() {
    try {
        initCore();
    } catch (err) {
        console.error('Stroll init failed:', err);
        showError('Failed to start: ' + (err?.message || String(err)));
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

    // ── World setup ──────────────────────────────────────────
    setupLighting(scene);
    setupFog(scene);
    setupSkybox(scene);
    setupEnvironment(scene, renderer);
    setupGround(scene);

    updateLoadingProgress(10, 'Generating city...');
    showLoadingTip();
    generateCity(scene, (percent) => updateLoadingProgress(percent, 'Building geometry...'));
    updateLoadingProgress(50, 'Populating world...');

    generateNPCs(scene);
    createWildlife(scene);
    createParticles(scene);
    createDog(scene);
    createTraffic(scene);
    initWeather(scene);

    updateLoadingProgress(70, 'Initializing combat systems...');

    // ── Game systems ─────────────────────────────────────────
    createPlayer();
    initInventory();
    initCamera(camera);
    initFeel(camera);
    initPlayerModel(scene);
    initEnemies(scene);
    initExplosions(scene);
    createPowersSystem(scene, camera, null);
    initWeaponSystem(scene, camera, renderer);
    initPickups(scene);
    initVehicles(scene, camera);
    initHelicopters(scene, camera);
    initEconomy(scene);
    initStory(scene);
    initInteriors(scene);

    updateLoadingProgress(85, 'Binding input...');

    // ── Controls & Input ─────────────────────────────────────
    setupControls(renderer, camera);
    setupMobileControls();
    setupResize(camera, renderer, composer, () => {
        updateFxaaResolution();
    });
    setupSoundToggle();
    setupPauseMenu();
    initHUD();
    initSkillsUI();
    setupGameInput();
    setupLoadingRetry();

    updateLoadingProgress(95, 'Ready...');

    // ── State machine listeners ──────────────────────────────
    onStateChange(GAME_STATES.PLAYING, () => {
        const gameHud = document.getElementById('game-hud');
        if (gameHud) gameHud.style.display = '';
        showMissionText('Welcome to the Stroll.', 3);

        // Start wave system instead of initial ambient enemies
        initLevelSystem();

        // Spawn some initial vehicles
        spawnVehicle(15, -15, 0x1E88E5);
        spawnVehicle(-20, 30, 0xE53935);
        spawnVehicle(40, -40, 0x43A047);
        spawnHelicopter(20, 0, -20, 0x111111);
    });

    // ── Schedule thought/quip ────────────────────────────────
    scheduleThought();

    // ── Start ────────────────────────────────────────────────
    clock = new THREE.Clock();

    requestAnimationFrame(() => {
        renderer.render(scene, camera);
        hideLoadingScreen();

        // Show main menu
        setState(GAME_STATES.MENU, true);
        const menuEl = document.getElementById('main-menu');
        if (menuEl) menuEl.classList.add('active');

        animate();
    });
}


function setupGameInput() {
    // Keyboard input
    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'Escape':
                if (getState() === GAME_STATES.PLAYING) {
                    togglePause();
                    if (getIsPaused()) {
                        setState(GAME_STATES.PAUSED, true);
                    } else {
                        setState(GAME_STATES.PLAYING, true);
                    }
                } else if (getState() === GAME_STATES.PAUSED) {
                    togglePause();
                    setState(GAME_STATES.PLAYING, true);
                }
                break;
            case 'KeyR':
                if (getState() === GAME_STATES.PLAYING) toggleRadio();
                break;
            case 'KeyT':
                if (getState() === GAME_STATES.PLAYING) nextStation();
                break;
        }
    });

    // Mouse wheel for power switching
    document.addEventListener('wheel', (e) => {
        if (getState() !== GAME_STATES.PLAYING) return;
        const dir = Math.sign(e.deltaY);
        import('./weapons/powers-system.js').then(m => m.cyclePower(dir));
    });

    // Start game button
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const menuEl = document.getElementById('main-menu');
            if (menuEl) menuEl.classList.remove('active');
            // Start the player on a sidewalk beside a road, not on the fountain.
            const spawn = getPlayerSpawn();
            player.x = spawn.x; player.z = spawn.z; player.y = 0;
            player.yaw = spawn.yaw; player.viewYaw = spawn.yaw;
            player.pitch = 0; player.viewPitch = 0;
            player.velX = 0; player.velZ = 0;
            setState(GAME_STATES.PLAYING);
        });
    }
}

function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(0, PLAYER_HEIGHT, 0);

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
        showError('WebGL is not supported by your browser.');
        return;
    }

    try {
        const q = getQuality();
        renderer = new THREE.WebGLRenderer({
            antialias: !q.fxaa,
            alpha: false,
            preserveDrawingBuffer: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        applyRendererQuality(renderer);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);

        composer = new EffectComposer(renderer);

        // Screen-space ambient occlusion (tier-gated). SSAOPass renders the
        // scene itself, so it replaces the plain RenderPass when enabled.
        if (q.ssao) {
            ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
            ssaoPass.kernelRadius = 10;
            ssaoPass.minDistance = 0.0015;
            ssaoPass.maxDistance = 0.12;
            composer.addPass(ssaoPass);
        } else {
            composer.addPass(new RenderPass(scene, camera));
        }

        if (q.bloom) {
            // Selective bloom: high threshold so only emissive windows/lamps/
            // muzzle flashes glow, not the whole mid-tone scene.
            bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.75, 0.6, 0.82
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

function showLoadingTip() {
    const tipEl = document.getElementById('loading-tip');
    if (tipEl) {
        tipEl.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    }
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
        showQuip();
        scheduleThought();
    }, delay);
}

function showQuip() {
    const bubble = document.getElementById('thought-bubble');
    if (!bubble || getIsPaused() || getState() !== GAME_STATES.PLAYING) return;
    bubble.textContent = PLAYER_QUIPS[Math.floor(Math.random() * PLAYER_QUIPS.length)];
    bubble.style.opacity = '1';
    setTimeout(() => { bubble.style.opacity = '0'; }, THOUGHT_DISPLAY_TIME);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    elapsed += delta;

    // Pass player state to game loop
    setMovementFlags({
        sprinting: player.sprinting || false,
        aiming: player.aiming || false,
        yaw: player.viewYaw || player.yaw || 0,
        pitch: player.viewPitch || player.pitch || 0,
        headBob: player.headBob || 0,
    });

    const result = tick({
        scene, camera, renderer, composer, delta, elapsed, lastPlayerPos,
        player
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
