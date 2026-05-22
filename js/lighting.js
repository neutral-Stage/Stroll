/**
 * lighting.js — Lighting, fog, skybox, and day/night cycle
 * Handles golden-hour atmosphere and optional day/night transitions.
 * @module lighting
 */

import * as THREE from 'three';
import {
    CITY_SIZE, FOG_DENSITY, FOG_COLOR, SHADOW_FRUSTUM,
    SKY_RADIUS, SKY_SEGMENTS, DAY_NIGHT_CYCLE_DURATION, DAY_NIGHT_ENABLED
} from './config.js';
import { getQuality } from './quality.js';

/** @type {THREE.DirectionalLight} */
let sun;
/** @type {THREE.AmbientLight} */
let ambient;
/** @type {THREE.HemisphereLight} */
let hemi;
/** @type {THREE.Mesh} */
let skyMesh;
/** @type {THREE.Points} */
let starField;
/** @type {THREE.Mesh} */
let moon;
/** @type {CanvasRenderingContext2D} */
let skyCtx;
/** @type {THREE.CanvasTexture} */
let skyTexture;

/** Cycle progress 0..1 (0 = golden hour, 0.5 = night, 1 = golden hour) */
let cycleTime = 0;
/** Current night amount 0..1 */
let nightAmount = 0;

/** @type {THREE.DirectionalLight|null} */
let fillLight = null;
/** @type {THREE.DirectionalLight|null} */
let rimLight = null;
/** @type {THREE.PointLight|null} */
let warmGlow = null;

let lastSkyPaintPhase = -1;
let skyPaintCooldown = 0;

/** @type {{x:number, z:number}|null} */
let shadowFocus = null;

/**
 * Set up all scene lighting for golden-hour atmosphere.
 * @param {THREE.Scene} scene
 */
export function setupLighting(scene) {
    // Warm ambient light (slightly brighter for realism)
    ambient = new THREE.AmbientLight(0xFFE0B2, 0.5);
    scene.add(ambient);

    // Hemisphere light for sky/ground color blending (enhanced)
    hemi = new THREE.HemisphereLight(0xFDB813, 0x8B6914, 0.4);
    scene.add(hemi);

    // Main directional light (sun at golden hour — low angle, enhanced shadows)
    sun = new THREE.DirectionalLight(0xFFA726, 1.4);
    sun.position.set(-80, 40, -60);
    sun.castShadow = true;
    const shadowSize = getQuality().shadowMapSize;
    sun.shadow.mapSize.width = shadowSize;
    sun.shadow.mapSize.height = shadowSize;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -SHADOW_FRUSTUM;
    sun.shadow.camera.right = SHADOW_FRUSTUM;
    sun.shadow.camera.top = SHADOW_FRUSTUM;
    sun.shadow.camera.bottom = -SHADOW_FRUSTUM;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 2;
    scene.add(sun);
    scene.add(sun.target);

    fillLight = new THREE.DirectionalLight(0xFF8A65, 0.4);
    fillLight.position.set(60, 25, 40);
    scene.add(fillLight);

    rimLight = new THREE.DirectionalLight(0xFFCC80, 0.2);
    rimLight.position.set(0, 50, 80);
    scene.add(rimLight);

    warmGlow = new THREE.PointLight(0xFFCC80, 0.35, 60);
    warmGlow.position.set(0, 10, 0);
    scene.add(warmGlow);
}

/**
 * Set up exponential fog for atmospheric depth.
 * @param {THREE.Scene} scene
 */
export function setupFog(scene) {
    // Atmospheric fog for depth and realism
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY * 0.8); // Slightly less dense for better visibility
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

    // Create star field
    createStarField(scene);

    // Create moon
    createMoon(scene);
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

    // More realistic sky gradient with sun glow
    const goldenStops = [
        [0, '#0f1638'],   // Deep blue zenith
        [0.15, '#1a2555'], // Upper sky
        [0.3, '#c44e10'],  // Warm orange band
        [0.45, '#e87520'], // Sun glow
        [0.55, '#fb9b34'], // Bright horizon
        [0.65, '#fdb849'], // Golden
        [0.75, '#ffd070'], // Light gold
        [0.85, '#ffe4a0'], // Pale gold
        [1.0, '#fff0d0']   // Horizon haze
    ];
    const nightStops = [
        [0, '#050510'],   // Deep space
        [0.15, '#080818'], // Dark blue
        [0.3, '#0c0c25'],  // Navy
        [0.45, '#101035'], // Deep indigo
        [0.55, '#141440'], // Indigo
        [0.65, '#181850'], // Purple-blue
        [0.75, '#1c1c58'], // Twilight
        [0.85, '#202060'], // Dusk blue
        [1.0, '#252568']   // Horizon night
    ];

    for (let i = 0; i < goldenStops.length; i++) {
        const color = lerpColor(goldenStops[i][1], nightStops[i][1], t);
        gradient.addColorStop(goldenStops[i][0], color);
    }

    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 2, 256);

    // Add sun disc during golden hour
    if (t < 0.5) {
        const sunY = 180 + t * 60; // Sun position moves down as night approaches
        const sunBrightness = 1 - t * 2;
        skyCtx.fillStyle = `rgba(255, 200, 100, ${sunBrightness * 0.4})`;
        skyCtx.beginPath();
        skyCtx.arc(1, sunY, 15, 0, Math.PI * 2);
        skyCtx.fill();

        // Sun glow
        skyCtx.fillStyle = `rgba(255, 180, 80, ${sunBrightness * 0.15})`;
        skyCtx.beginPath();
        skyCtx.arc(1, sunY, 30, 0, Math.PI * 2);
        skyCtx.fill();
    }
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
/**
 * @param {number} delta
 * @param {THREE.Scene} scene
 * @param {{x:number, z:number}} [playerPos]
 */
export function updateDayNight(delta, scene, playerPos) {
    if (!DAY_NIGHT_ENABLED) return;

    cycleTime = (cycleTime + delta / DAY_NIGHT_CYCLE_DURATION) % 1;
    const phase = cycleTime;
    nightAmount = Math.sin(phase * Math.PI);

    if (playerPos) {
        shadowFocus = playerPos;
    }

    if (sun) {
        sun.intensity = 1.2 * (1 - nightAmount * 0.8);
        const angle = phase * Math.PI * 2;
        sun.position.set(-80 * Math.cos(angle), 30 * (1 - nightAmount * 0.5), -60 * Math.sin(angle));

        if (shadowFocus) {
            sun.target.position.set(shadowFocus.x, 0, shadowFocus.z);
            sun.target.updateMatrixWorld();
            sun.shadow.camera.position.set(
                shadowFocus.x - 40,
                50,
                shadowFocus.z - 40,
            );
            sun.shadow.camera.lookAt(shadowFocus.x, 0, shadowFocus.z);
            sun.shadow.camera.updateProjectionMatrix();
        }
    }

    if (ambient) {
        ambient.intensity = 0.4 * (1 - nightAmount * 0.6);
        ambient.color.setHex(lerpColorNum(0xFFE0B2, 0x8899aa, nightAmount * 0.5));
    }

    if (hemi) {
        hemi.intensity = 0.4 * (1 - nightAmount * 0.5);
    }

    if (fillLight) {
        fillLight.intensity = 0.4 * (1 - nightAmount * 0.85);
    }
    if (rimLight) {
        rimLight.intensity = 0.2 * (1 - nightAmount * 0.7);
    }
    if (warmGlow && shadowFocus) {
        warmGlow.intensity = 0.15 + nightAmount * 0.35;
        warmGlow.position.set(shadowFocus.x, 8, shadowFocus.z);
    }

    if (scene.fog) {
        scene.fog.density = FOG_DENSITY * (0.85 + nightAmount * 0.55);
        const fogDay = FOG_COLOR;
        const fogNight = 0x2a3340;
        scene.fog.color.setHex(lerpColorNum(fogDay, fogNight, nightAmount * 0.65));
    }

    // Control star visibility
    if (starField) {
        starField.material.opacity = Math.max(0, nightAmount - 0.3) * 1.3;
        starField.rotation.y += delta * 0.01; // Slow rotation
    }

    // Control moon visibility
    if (moon) {
        moon.material.opacity = Math.max(0, nightAmount - 0.2) * 0.9;
        const moonAngle = phase * Math.PI * 2 + Math.PI;
        moon.position.set(
            -100 * Math.cos(moonAngle),
            60 + 60 * nightAmount,
            -150 * Math.sin(moonAngle)
        );
    }

    skyPaintCooldown -= delta;
    const phaseStep = Math.floor(phase * 120);
    if (skyPaintCooldown <= 0 || phaseStep !== lastSkyPaintPhase) {
        paintSkyGradient(phase);
        if (skyTexture) skyTexture.needsUpdate = true;
        lastSkyPaintPhase = phaseStep;
        skyPaintCooldown = 0.2;
    }
}

function lerpColorNum(a, b, t) {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}

/**
 * Set up the ground plane.
 * @param {THREE.Scene} scene
 */
export function setupGround(scene) {
    // City ground
    const groundGeo = new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE, 64, 64);
    
    // Create a canvas texture for more realistic ground
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gCtx = groundCanvas.getContext('2d');
    
    // Base color - warm asphalt/stone
    gCtx.fillStyle = '#7a7a6e';
    gCtx.fillRect(0, 0, 512, 512);
    
    // Add noise texture for realism
    for (let i = 0; i < 20000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const brightness = 100 + Math.random() * 60;
        const alpha = 0.1 + Math.random() * 0.15;
        gCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness - 10}, ${alpha})`;
        gCtx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    
    // Add subtle grid lines (sidewalk/road texture)
    gCtx.strokeStyle = 'rgba(100, 100, 90, 0.15)';
    gCtx.lineWidth = 1;
    for (let i = 0; i < 512; i += 32) {
        gCtx.beginPath();
        gCtx.moveTo(i, 0);
        gCtx.lineTo(i, 512);
        gCtx.stroke();
        gCtx.beginPath();
        gCtx.moveTo(0, i);
        gCtx.lineTo(512, i);
        gCtx.stroke();
    }
    
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(40, 40);
    
    const groundMat = new THREE.MeshStandardMaterial({
        map: groundTexture,
        color: 0x8B8B7A,
        roughness: 0.9,
        metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ocean water
    const oceanGeo = new THREE.PlaneGeometry(2000, 2000, 16, 16);
    const oceanMat = new THREE.MeshLambertMaterial({
        color: 0x0044aa,
        transparent: true,
        opacity: 0.8
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -2; // water level is slightly below ground
    scene.add(ocean);
}

/**
 * Create a star field for nighttime.
 * @param {THREE.Scene} scene
 */
function createStarField(scene) {
    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];

    for (let i = 0; i < starCount; i++) {
        // Random position on sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const r = SKY_RADIUS * 0.95;

        positions.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        // Random star size
        sizes.push(0.5 + Math.random() * 1.5);

        // Star colors (white to blue-white)
        const warm = Math.random() > 0.7 ? 1 : 0.9 + Math.random() * 0.1;
        colors.push(warm, warm, 1);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        vertexColors: true,
        blending: THREE.AdditiveBlending
    });

    starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
}

/**
 * Create moon for nighttime.
 * @param {THREE.Scene} scene
 */
function createMoon(scene) {
    const moonGeo = new THREE.SphereGeometry(15, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({
        color: 0xF0E0D0,
        transparent: true,
        opacity: 0
    });
    moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-100, 120, -150);
    scene.add(moon);
}

export function getCycleTime() { return cycleTime; }
export function getNightAmount() { return nightAmount; }


