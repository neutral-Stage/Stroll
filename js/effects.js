/**
 * effects.js — Visual effects system
 *
 * Post-processing (bloom, color grading), volumetric fog/mist,
 * bioluminescent plants, glowing footprints, floating pollen/dust motes.
 *
 * @module effects
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { isInsideBuilding } from './city.js';
import { CITY_SIZE } from './config.js';

/** @type {EffectComposer} */
let composer = null;
/** @type {UnrealBloomPass} */
let bloomPass = null;
/** @type {ShaderPass} */
let colorGradingPass = null;

// Bioluminescent plants
const bioPlants = [];
const BIO_PLANT_COUNT = 25;

// Glowing footprints
const footprints = [];
const MAX_FOOTPRINTS = 60;
const FOOTPRINT_INTERVAL = 0.35; // seconds between footprints
let footprintTimer = 0;
let lastPlayerPos = { x: 0, z: 0 };

// Pollen/dust motes
let pollenSystem = null;
let pollenVelocities = null;
const POLLEN_COUNT = 100;

// Volumetric fog planes
const fogPlanes = [];
const FOG_PLANE_COUNT = 8;

// Color grading shader
const ColorGradingShader = {
    uniforms: {
        tDiffuse: { value: null },
        brightness: { value: 0.02 },
        contrast: { value: 1.05 },
        saturation: { value: 1.1 },
        warmth: { value: 0.08 },
        vignette: { value: 0.3 },
        nightAmount: { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float contrast;
        uniform float saturation;
        uniform float warmth;
        uniform float vignette;
        uniform float nightAmount;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            // Brightness
            color.rgb += brightness;
            
            // Contrast
            color.rgb = (color.rgb - 0.5) * contrast + 0.5;
            
            // Saturation
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(gray), color.rgb, saturation);
            
            // Warmth (shift toward orange during day, blue at night)
            float dayWarmth = warmth * (1.0 - nightAmount);
            float nightCool = warmth * nightAmount * 0.5;
            color.r += dayWarmth;
            color.g += dayWarmth * 0.4;
            color.b -= dayWarmth * 0.3;
            color.b += nightCool;
            color.r -= nightCool * 0.3;
            
            // Vignette
            vec2 center = vUv - 0.5;
            float dist = length(center);
            float vig = smoothstep(0.5, 0.2, dist * vignette * 2.0);
            color.rgb *= mix(1.0, vig, vignette);
            
            gl_FragColor = color;
        }
    `
};

/**
 * Set up post-processing pipeline.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @returns {EffectComposer}
 */
export function setupPostProcessing(renderer, scene, camera) {
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Bloom
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.4,   // strength
        0.6,   // radius
        0.85   // threshold
    );
    composer.addPass(bloomPass);
    
    // Color grading
    colorGradingPass = new ShaderPass(ColorGradingShader);
    composer.addPass(colorGradingPass);
    
    return composer;
}

/**
 * Get the composer for rendering.
 */
export function getComposer() {
    return composer;
}

/**
 * Update post-processing for resize.
 */
export function resizePostProcessing(width, height) {
    if (composer) {
        composer.setSize(width, height);
    }
}

/**
 * Create bioluminescent plants scattered around the world.
 * @param {THREE.Scene} scene
 */
export function createBioPlants(scene) {
    const glowColors = [0x00e676, 0x00bcd4, 0x7c4dff, 0x18ffff, 0x69f0ae];
    
    for (let i = 0; i < BIO_PLANT_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
            z = (Math.random() - 0.5) * CITY_SIZE * 0.7;
            attempts++;
        } while (isInsideBuilding(x, z, 2) && attempts < 20);
        
        if (attempts >= 20) continue;
        
        const group = new THREE.Group();
        const color = glowColors[i % glowColors.length];
        
        // Stem cluster
        const stemCount = 2 + Math.floor(Math.random() * 3);
        for (let s = 0; s < stemCount; s++) {
            const height = 0.3 + Math.random() * 0.5;
            const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, height, 4);
            const stemMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.set((Math.random() - 0.5) * 0.2, height / 2, (Math.random() - 0.5) * 0.2);
            stem.rotation.z = (Math.random() - 0.5) * 0.3;
            group.add(stem);
            
            // Glowing tip
            const tipGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 6, 6);
            const tipMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.set(stem.position.x, height + 0.05, stem.position.z);
            group.add(tip);
        }
        
        // Glow sphere (visible at night)
        const glowGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 0.3;
        group.add(glow);
        
        group.position.set(x, 0, z);
        scene.add(group);
        
        bioPlants.push({
            mesh: group,
            glow,
            color,
            phase: Math.random() * Math.PI * 2
        });
    }
}

/**
 * Create volumetric fog planes.
 * @param {THREE.Scene} scene
 */
export function createVolumetricFog(scene) {
    for (let i = 0; i < FOG_PLANE_COUNT; i++) {
        const width = 30 + Math.random() * 40;
        const height = 2 + Math.random() * 3;
        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const mesh = new THREE.Mesh(geo, mat);
        const angle = (i / FOG_PLANE_COUNT) * Math.PI * 2;
        const radius = 15 + Math.random() * 40;
        mesh.position.set(
            Math.cos(angle) * radius,
            0.5 + Math.random() * 1.5,
            Math.sin(angle) * radius
        );
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.renderOrder = -1;
        scene.add(mesh);
        
        fogPlanes.push({
            mesh,
            baseOpacity: 0.03 + Math.random() * 0.04,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: 0.1 + Math.random() * 0.2
        });
    }
}

/**
 * Create floating pollen/dust mote particles.
 * @param {THREE.Scene} scene
 */
export function createPollen(scene) {
    const positions = new Float32Array(POLLEN_COUNT * 3);
    pollenVelocities = new Float32Array(POLLEN_COUNT * 3);
    
    for (let i = 0; i < POLLEN_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 60;
        positions[i3 + 1] = 0.5 + Math.random() * 8;
        positions[i3 + 2] = (Math.random() - 0.5) * 60;
        
        pollenVelocities[i3] = (Math.random() - 0.5) * 0.1;
        pollenVelocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
        pollenVelocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
        color: 0xfff9c4,
        size: 0.06,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        fog: true
    });
    
    pollenSystem = new THREE.Points(geo, mat);
    scene.add(pollenSystem);
}

/**
 * Create a glowing footprint at position.
 * @param {THREE.Scene} scene
 * @param {number} x
 * @param {number} z
 * @param {number} rotation
 */
function createFootprint(scene, x, z, rotation) {
    // Simple ellipse for footprint
    const geo = new THREE.CircleGeometry(0.15, 8);
    geo.scale(1, 1.5, 1);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x80deea,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    mesh.position.set(x, 0.02, z);
    scene.add(mesh);
    
    footprints.push({
        mesh,
        life: 4.0, // seconds to fade
        age: 0
    });
    
    // Remove oldest if too many
    while (footprints.length > MAX_FOOTPRINTS) {
        const old = footprints.shift();
        scene.remove(old.mesh);
        old.mesh.geometry.dispose();
        old.mesh.material.dispose();
    }
}

/**
 * Update all visual effects.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number, yaw:number}} playerPos
 * @param {number} nightAmount - 0..1
 * @param {THREE.Scene} scene
 * @param {boolean} isMoving
 */
export function updateEffects(delta, elapsed, playerPos, nightAmount, scene, isMoving) {
    // Update bloom based on time of day
    if (bloomPass) {
        bloomPass.strength = 0.3 + nightAmount * 0.5;
    }
    
    // Update color grading
    if (colorGradingPass) {
        colorGradingPass.uniforms.nightAmount.value = nightAmount;
        colorGradingPass.uniforms.warmth.value = 0.08 * (1 - nightAmount) + 0.02;
    }
    
    // Update bioluminescent plants
    bioPlants.forEach(p => {
        p.phase += delta * 2;
        const glowIntensity = nightAmount * (0.4 + Math.sin(p.phase) * 0.2);
        p.glow.material.opacity = glowIntensity;
        
        // Make tips pulse
        p.mesh.children.forEach(child => {
            if (child.material && child.material.color && child !== p.glow) {
                if (child.geometry.type === 'SphereGeometry') {
                    child.material.opacity = 0.3 + nightAmount * 0.6 + Math.sin(p.phase + child.position.x * 10) * 0.1;
                }
            }
        });
    });
    
    // Update volumetric fog
    fogPlanes.forEach(f => {
        f.phase += delta * f.driftSpeed;
        f.mesh.position.x += Math.sin(f.phase) * 0.01;
        f.mesh.position.z += Math.cos(f.phase * 0.7) * 0.01;
        
        // More visible at night and dawn
        const timeOpacity = 0.5 + nightAmount * 0.5;
        f.mesh.material.opacity = f.baseOpacity * timeOpacity * (0.8 + Math.sin(f.phase * 0.5) * 0.2);
    });
    
    // Update pollen
    if (pollenSystem) {
        const positions = pollenSystem.geometry.attributes.position.array;
        for (let i = 0; i < POLLEN_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] += pollenVelocities[i3] * delta + Math.sin(elapsed * 0.3 + i) * 0.002;
            positions[i3 + 1] += pollenVelocities[i3 + 1] * delta + Math.sin(elapsed * 0.5 + i * 0.5) * 0.003;
            positions[i3 + 2] += pollenVelocities[i3 + 2] * delta + Math.cos(elapsed * 0.4 + i) * 0.002;
            
            // Respawn near player if too far
            const dx = positions[i3] - playerPos.x;
            const dz = positions[i3 + 2] - playerPos.z;
            if (dx * dx + dz * dz > 900 || positions[i3 + 1] < 0 || positions[i3 + 1] > 12) {
                positions[i3] = playerPos.x + (Math.random() - 0.5) * 40;
                positions[i3 + 1] = 0.5 + Math.random() * 6;
                positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
            }
        }
        pollenSystem.geometry.attributes.position.needsUpdate = true;
        // Pollen more visible during day
        pollenSystem.material.opacity = 0.4 * (1 - nightAmount * 0.6);
    }
    
    // Update footprints
    footprintTimer += delta;
    const dx = playerPos.x - lastPlayerPos.x;
    const dz = playerPos.z - lastPlayerPos.z;
    const moved = Math.sqrt(dx * dx + dz * dz);
    
    if (isMoving && moved > 0.05 && footprintTimer >= FOOTPRINT_INTERVAL) {
        footprintTimer = 0;
        createFootprint(scene, playerPos.x, playerPos.z, playerPos.yaw || 0);
    }
    lastPlayerPos.x = playerPos.x;
    lastPlayerPos.z = playerPos.z;
    
    // Fade footprints
    for (let i = footprints.length - 1; i >= 0; i--) {
        const fp = footprints[i];
        fp.age += delta;
        if (fp.age >= fp.life) {
            scene.remove(fp.mesh);
            fp.mesh.geometry.dispose();
            fp.mesh.material.dispose();
            footprints.splice(i, 1);
        } else {
            fp.mesh.material.opacity = 0.6 * (1 - fp.age / fp.life);
            // Slight color shift as it fades
            const t = fp.age / fp.life;
            fp.mesh.material.color.setHex(t < 0.5 ? 0x80deea : 0x4dd0e1);
        }
    }
}
