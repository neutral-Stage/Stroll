/**
 * lighting.js — Lighting, fog, skybox, and day/night cycle
 * Handles golden-hour atmosphere and optional day/night transitions.
 * @module lighting
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import {
    CITY_SIZE, FOG_DENSITY, FOG_COLOR, SHADOW_MAP_SIZE, SHADOW_FRUSTUM,
    SKY_RADIUS, SKY_SEGMENTS, DAY_NIGHT_CYCLE_DURATION, DAY_NIGHT_ENABLED
} from './config.js';

/** @type {THREE.DirectionalLight} */
let sun;
/** @type {THREE.AmbientLight} */
let ambient;
/** @type {THREE.HemisphereLight} */
let hemi;
/** @type {THREE.Mesh} */
let skyMesh;
/** @type {CanvasRenderingContext2D} */
let skyCtx;
/** @type {THREE.CanvasTexture} */
let skyTexture;

/** Cycle progress 0..1 (0 = golden hour, 0.5 = night, 1 = golden hour) */
let cycleTime = 0;

/**
 * Set up all scene lighting for golden-hour atmosphere.
 * @param {THREE.Scene} scene
 */
export function setupLighting(scene) {
    // Warm ambient light
    ambient = new THREE.AmbientLight(0xFFE0B2, 0.4);
    scene.add(ambient);

    // Hemisphere light for sky/ground color blending
    hemi = new THREE.HemisphereLight(0xFDB813, 0x8B6914, 0.3);
    scene.add(hemi);

    // Main directional light (sun at golden hour — low angle)
    sun = new THREE.DirectionalLight(0xFFA726, 1.2);
    sun.position.set(-80, 30, -60);
    sun.castShadow = true;
    sun.shadow.mapSize.width = SHADOW_MAP_SIZE;
    sun.shadow.mapSize.height = SHADOW_MAP_SIZE;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -SHADOW_FRUSTUM;
    sun.shadow.camera.right = SHADOW_FRUSTUM;
    sun.shadow.camera.top = SHADOW_FRUSTUM;
    sun.shadow.camera.bottom = -SHADOW_FRUSTUM;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    // Secondary warm fill light
    const fill = new THREE.DirectionalLight(0xFF8A65, 0.3);
    fill.position.set(60, 20, 40);
    scene.add(fill);

    // Subtle warm point light near player start
    const warmGlow = new THREE.PointLight(0xFFCC80, 0.5, 50);
    warmGlow.position.set(0, 8, 0);
    scene.add(warmGlow);
}

/**
 * Set up exponential fog for atmospheric depth.
 * @param {THREE.Scene} scene
 */
export function setupFog(scene) {
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
}

/**
 * Create a gradient skybox sphere.
 * Uses a small canvas texture on a low-poly sphere (16 segments).
 * @param {THREE.Scene} scene
 */
export function setupSkybox(scene) {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    skyCtx = canvas.getContext('2d');

    paintSkyGradient(0); // golden hour default

    skyTexture = new THREE.CanvasTexture(canvas);
    skyTexture.magFilter = THREE.LinearFilter;

    const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, SKY_SEGMENTS, SKY_SEGMENTS);
    const skyMat = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        fog: false
    });
    skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
}

/**
 * Paint the sky gradient canvas for a given cycle phase.
 * @param {number} phase 0 = golden hour, 0.5 = night
 */
function paintSkyGradient(phase) {
    if (!skyCtx) return;
    const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);

    // Interpolate between golden-hour and night palettes
    const t = Math.sin(phase * Math.PI); // 0 at golden hour, 1 at night

    const goldenStops = [
        [0, '#1a1a3e'], [0.2, '#2d1b69'], [0.4, '#e85d04'],
        [0.55, '#fb8b24'], [0.7, '#fca311'], [0.85, '#ffba49'], [1.0, '#ffe8cc']
    ];
    const nightStops = [
        [0, '#0a0a1a'], [0.2, '#0d0d2b'], [0.4, '#141432'],
        [0.55, '#1a1a3e'], [0.7, '#1e1e4a'], [0.85, '#252555'], [1.0, '#2a2a5e']
    ];

    for (let i = 0; i < goldenStops.length; i++) {
        const color = lerpColor(goldenStops[i][1], nightStops[i][1], t);
        gradient.addColorStop(goldenStops[i][0], color);
    }

    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 2, 256);
}

/**
 * Linearly interpolate between two hex color strings.
 * @param {string} a - e.g. '#ff0000'
 * @param {string} b - e.g. '#0000ff'
 * @param {number} t - 0..1
 * @returns {string} interpolated hex color
 */
function lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Update day/night cycle. Call each frame.
 * @param {number} delta - frame delta in seconds
 * @param {THREE.Scene} scene
 */
export function updateDayNight(delta, scene) {
    if (!DAY_NIGHT_ENABLED) return;

    cycleTime = (cycleTime + delta / DAY_NIGHT_CYCLE_DURATION) % 1;
    const phase = cycleTime;
    const nightAmount = Math.sin(phase * Math.PI); // 0 at golden hour, 1 at midnight

    // Adjust sun intensity and position
    if (sun) {
        sun.intensity = 1.2 * (1 - nightAmount * 0.8);
        const angle = phase * Math.PI * 2;
        sun.position.set(-80 * Math.cos(angle), 30 * (1 - nightAmount * 0.5), -60 * Math.sin(angle));
    }

    // Adjust ambient
    if (ambient) {
        ambient.intensity = 0.4 * (1 - nightAmount * 0.6);
    }

    // Adjust fog density
    if (scene.fog) {
        scene.fog.density = FOG_DENSITY * (1 + nightAmount * 0.5);
    }

    // Repaint sky gradient
    paintSkyGradient(phase);
    if (skyTexture) {
        skyTexture.needsUpdate = true;
    }
}

/**
 * Set up the ground plane.
 * @param {THREE.Scene} scene
 */
export function setupGround(scene) {
    const groundGeo = new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x8B8B7A });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);
}


