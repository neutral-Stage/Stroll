/**
 * collectibles.js — Collectible items system (orbs, crystals, flowers)
 * 
 * Spawns glowing collectible items throughout the world that the player
 * can pick up by walking near them. Each collection triggers particle
 * effects and updates the game state.
 *
 * @module collectibles
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CITY_SIZE } from './config.js';
import { isInsideBuilding } from './city.js';

/** @type {Array<CollectibleData>} */
const collectibles = [];

/** Collection particle systems */
const collectionParticles = [];

/** Pickup radius */
const PICKUP_RADIUS = 3.5;

/** Total collectibles to spawn */
const ORB_COUNT = 20;
const CRYSTAL_COUNT = 12;
const FLOWER_COUNT = 15;

/**
 * @typedef {Object} CollectibleData
 * @property {THREE.Group} mesh
 * @property {string} type - 'orb' | 'crystal' | 'flower'
 * @property {string} name - display name
 * @property {boolean} collected
 * @property {number} bobPhase
 * @property {THREE.PointLight} [light]
 */

// Shared materials
const orbMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });
const orbGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3 });
const crystalMat = new THREE.MeshPhongMaterial({ color: 0xce93d8, emissive: 0x7b1fa2, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, shininess: 100 });
const crystalGlowMat = new THREE.MeshBasicMaterial({ color: 0xce93d8, transparent: true, opacity: 0.25 });

const flowerColors = [0xff6b9d, 0xffa726, 0xffee58, 0xef5350, 0xab47bc];
const flowerNames = ['Rose Bloom', 'Sunset Dahlia', 'Golden Lily', 'Crimson Poppy', 'Violet Orchid'];

const orbNames = [
    'Essence of Calm', 'Whisper Light', 'Serenity Spark', 'Twilight Glow',
    'Dawn Fragment', 'Moonbeam Shard', 'Starlight Drop', 'Harmony Orb',
    'Peace Crystal', 'Dream Wisp', 'Gentle Flame', 'Quiet Thunder',
    'Still Water', 'Soft Wind', 'Warm Ember', 'Cool Mist',
    'Silent Song', 'Bright Shadow', 'Deep Breath', 'Kind Thought'
];

const crystalNames = [
    'Amethyst Heart', 'Quartz Whisper', 'Sapphire Dream', 'Emerald Wish',
    'Ruby Memory', 'Topaz Promise', 'Opal Secret', 'Jade Blessing',
    'Pearl Wisdom', 'Diamond Hope', 'Citrine Joy', 'Garnet Courage'
];

/**
 * Create all collectibles and add to scene.
 * @param {THREE.Scene} scene
 */
export function createCollectibles(scene) {
    // Spawn orbs
    for (let i = 0; i < ORB_COUNT; i++) {
        const pos = findValidPosition(60);
        if (pos) createOrb(scene, pos.x, pos.z, orbNames[i % orbNames.length]);
    }
    // Spawn crystals
    for (let i = 0; i < CRYSTAL_COUNT; i++) {
        const pos = findValidPosition(80);
        if (pos) createCrystal(scene, pos.x, pos.z, crystalNames[i % crystalNames.length]);
    }
    // Spawn flowers
    for (let i = 0; i < FLOWER_COUNT; i++) {
        const pos = findValidPosition(50);
        if (pos) createFlower(scene, pos.x, pos.z, i);
    }
}

function findValidPosition(range) {
    for (let attempt = 0; attempt < 30; attempt++) {
        const x = (Math.random() - 0.5) * CITY_SIZE * (range / 100);
        const z = (Math.random() - 0.5) * CITY_SIZE * (range / 100);
        if (!isInsideBuilding(x, z, 2)) return { x, z };
    }
    return null;
}

function createOrb(scene, x, z, name) {
    const group = new THREE.Group();
    
    // Core orb
    const coreGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const core = new THREE.Mesh(coreGeo, orbMat);
    group.add(core);
    
    // Outer glow
    const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const glow = new THREE.Mesh(glowGeo, orbGlowMat);
    group.add(glow);
    
    // Ring
    const ringGeo = new THREE.TorusGeometry(0.4, 0.03, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    
    group.position.set(x, 1.5, z);
    scene.add(group);
    
    collectibles.push({
        mesh: group,
        type: 'orb',
        name: name,
        collected: false,
        bobPhase: Math.random() * Math.PI * 2,
        baseY: 1.5
    });
}

function createCrystal(scene, x, z, name) {
    const group = new THREE.Group();
    
    // Main crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.scale.set(1, 1.5, 1);
    group.add(crystal);
    
    // Glow sphere
    const glowGeo = new THREE.SphereGeometry(0.6, 8, 8);
    const glow = new THREE.Mesh(glowGeo, crystalGlowMat);
    group.add(glow);
    
    // Small orbiting crystals
    for (let i = 0; i < 3; i++) {
        const miniGeo = new THREE.OctahedronGeometry(0.08, 0);
        const mini = new THREE.Mesh(miniGeo, crystalMat);
        const angle = (i / 3) * Math.PI * 2;
        mini.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
        mini.userData.orbitAngle = angle;
        mini.userData.orbitRadius = 0.5;
        group.add(mini);
    }
    
    group.position.set(x, 1.2, z);
    scene.add(group);
    
    collectibles.push({
        mesh: group,
        type: 'crystal',
        name: name,
        collected: false,
        bobPhase: Math.random() * Math.PI * 2,
        baseY: 1.2
    });
}

function createFlower(scene, x, z, index) {
    const group = new THREE.Group();
    const colorIdx = index % flowerColors.length;
    const color = flowerColors[colorIdx];
    const flowerMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
    
    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 4);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.4;
    group.add(stem);
    
    // Petals
    for (let i = 0; i < 6; i++) {
        const petalGeo = new THREE.SphereGeometry(0.12, 6, 6);
        petalGeo.scale(1, 0.3, 1.5);
        const petal = new THREE.Mesh(petalGeo, flowerMat);
        const angle = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.15, 0.85, Math.sin(angle) * 0.15);
        petal.rotation.z = angle;
        group.add(petal);
    }
    
    // Center
    const centerGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.y = 0.85;
    group.add(center);
    
    // Glow indicator
    const glowGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.7;
    group.add(glow);
    
    group.position.set(x, 0, z);
    scene.add(group);
    
    collectibles.push({
        mesh: group,
        type: 'flower',
        name: flowerNames[colorIdx],
        collected: false,
        bobPhase: Math.random() * Math.PI * 2,
        baseY: 0
    });
}

/**
 * Spawn collection particle burst at position.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position
 * @param {number} color
 */
function spawnCollectionParticles(scene, position, color) {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;
        
        // Random burst direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2 + Math.random() * 4;
        velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i3 + 1] = Math.cos(phi) * speed * 0.5 + 2;
        velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
        color,
        size: 0.15,
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: true
    });
    
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    
    collectionParticles.push({
        mesh: points,
        velocities,
        life: 1.5,
        age: 0
    });
}

/**
 * Update collectibles (animation, pickup detection, particles).
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number}} playerPos
 * @param {THREE.Scene} scene
 * @returns {{collected: boolean, item: CollectibleData|null}}
 */
export function updateCollectibles(delta, elapsed, playerPos, scene) {
    let justCollected = null;
    
    collectibles.forEach(c => {
        if (c.collected) return;
        
        // Bob animation
        c.bobPhase += delta * 2;
        const bobY = Math.sin(c.bobPhase) * 0.15;
        c.mesh.position.y = c.baseY + bobY;
        
        // Rotation
        if (c.type === 'orb') {
            c.mesh.rotation.y += delta * 1.5;
            // Rotate ring differently
            if (c.mesh.children[2]) {
                c.mesh.children[2].rotation.x += delta * 0.8;
            }
        } else if (c.type === 'crystal') {
            c.mesh.rotation.y += delta * 0.8;
            // Orbit mini crystals
            c.mesh.children.forEach(child => {
                if (child.userData.orbitAngle !== undefined) {
                    child.userData.orbitAngle += delta * 2;
                    const r = child.userData.orbitRadius;
                    child.position.x = Math.cos(child.userData.orbitAngle) * r;
                    child.position.z = Math.sin(child.userData.orbitAngle) * r;
                }
            });
        } else if (c.type === 'flower') {
            // Gentle sway
            c.mesh.rotation.z = Math.sin(elapsed * 0.5 + c.bobPhase) * 0.05;
        }
        
        // Pulse glow
        const glowChild = c.type === 'flower' ? c.mesh.children[c.mesh.children.length - 1] : c.mesh.children[1];
        if (glowChild && glowChild.material) {
            glowChild.material.opacity = 0.15 + Math.sin(elapsed * 3 + c.bobPhase) * 0.1;
        }
        
        // Pickup detection
        const dx = c.mesh.position.x - playerPos.x;
        const dz = c.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < PICKUP_RADIUS) {
            c.collected = true;
            justCollected = c;
            
            // Spawn particles
            const color = c.type === 'orb' ? 0x00e5ff : c.type === 'crystal' ? 0xce93d8 : flowerColors[flowerNames.indexOf(c.name)];
            spawnCollectionParticles(scene, c.mesh.position, color || 0xffffff);
            
            // Animate out
            animateCollect(c);
        }
    });
    
    // Update collection particles
    for (let i = collectionParticles.length - 1; i >= 0; i--) {
        const p = collectionParticles[i];
        p.age += delta;
        
        if (p.age >= p.life) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            collectionParticles.splice(i, 1);
            continue;
        }
        
        const positions = p.mesh.geometry.attributes.position.array;
        const count = positions.length / 3;
        for (let j = 0; j < count; j++) {
            const j3 = j * 3;
            positions[j3] += p.velocities[j3] * delta;
            positions[j3 + 1] += p.velocities[j3 + 1] * delta;
            positions[j3 + 2] += p.velocities[j3 + 2] * delta;
            // Gravity
            p.velocities[j3 + 1] -= 3 * delta;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        p.mesh.material.opacity = 1.0 - (p.age / p.life);
    }
    
    return justCollected;
}

function animateCollect(c) {
    const mesh = c.mesh;
    const startScale = mesh.scale.x;
    const duration = 400;
    const start = performance.now();
    
    function tick() {
        const t = Math.min((performance.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        mesh.scale.setScalar(startScale * (1 + ease * 0.5));
        mesh.position.y += 0.05;
        mesh.children.forEach(child => {
            if (child.material) {
                child.material.opacity = Math.max(0, 1 - ease);
            }
        });
        if (t < 1) {
            requestAnimationFrame(tick);
        } else {
            mesh.visible = false;
        }
    }
    tick();
}

/**
 * Get all collectibles data for journal/UI.
 * @returns {Array<CollectibleData>}
 */
export function getCollectibles() {
    return collectibles;
}

/**
 * Get collection stats.
 */
export function getCollectionStats() {
    const total = collectibles.length;
    const collected = collectibles.filter(c => c.collected).length;
    const orbs = collectibles.filter(c => c.type === 'orb' && c.collected).length;
    const crystals = collectibles.filter(c => c.type === 'crystal' && c.collected).length;
    const flowers = collectibles.filter(c => c.type === 'flower' && c.collected).length;
    return { total, collected, orbs, crystals, flowers, totalOrbs: ORB_COUNT, totalCrystals: CRYSTAL_COUNT, totalFlowers: FLOWER_COUNT };
}
