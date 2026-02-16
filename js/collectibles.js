/**
 * collectibles.js — Glowing orbs/crystals scattered around the world
 *
 * Features:
 *  • Glowing collectible orbs with pulsing animation
 *  • Particle burst effect on pickup
 *  • Score tracking
 *  • Different types: orbs (common), crystals (rare), stars (legendary)
 *
 * @module collectibles
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CITY_SIZE } from './config.js';
import { isInsideBuilding } from './city.js';
import { playPickupSound } from './audio.js';

/** @type {Array<CollectibleData>} */
const collectibles = [];

/** @type {Array<ParticleBurst>} */
const particleBursts = [];

/** Score state */
let score = 0;
let totalCollectibles = 0;

/** Collectible types */
const TYPES = {
    orb: { color: 0x64FFDA, emissive: 0x00BFA5, size: 0.4, points: 10, glow: 1.5 },
    crystal: { color: 0xE040FB, emissive: 0xAA00FF, size: 0.5, points: 25, glow: 2.0 },
    star: { color: 0xFFD740, emissive: 0xFFA000, size: 0.6, points: 50, glow: 2.5 }
};

const ORB_COUNT = 30;
const CRYSTAL_COUNT = 10;
const STAR_COUNT = 5;
const PICKUP_DISTANCE = 3.0;

// Shared geometries
const orbGeo = new THREE.IcosahedronGeometry(1, 1);
const crystalGeo = new THREE.OctahedronGeometry(1, 0);
const starGeo = new THREE.IcosahedronGeometry(1, 2);

/**
 * Create all collectibles and add to scene.
 * @param {THREE.Scene} scene
 */
export function createCollectibles(scene) {
    spawnCollectibles(scene, 'orb', ORB_COUNT, orbGeo);
    spawnCollectibles(scene, 'crystal', CRYSTAL_COUNT, crystalGeo);
    spawnCollectibles(scene, 'star', STAR_COUNT, starGeo);
    totalCollectibles = ORB_COUNT + CRYSTAL_COUNT + STAR_COUNT;
}

function spawnCollectibles(scene, type, count, geo) {
    const typeData = TYPES[type];

    for (let i = 0; i < count; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * CITY_SIZE * 0.85;
            z = (Math.random() - 0.5) * CITY_SIZE * 0.85;
            attempts++;
        } while (isInsideBuilding(x, z, 2) && attempts < 30);

        if (attempts >= 30) continue;

        const mat = new THREE.MeshStandardMaterial({
            color: typeData.color,
            emissive: typeData.emissive,
            emissiveIntensity: 0.8,
            metalness: 0.3,
            roughness: 0.2,
            transparent: true,
            opacity: 0.9
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(typeData.size);
        mesh.position.set(x, 1.5 + Math.random() * 0.5, z);
        mesh.castShadow = false;
        scene.add(mesh);

        // Glow ring
        const ringGeo = new THREE.RingGeometry(typeData.size * 1.2, typeData.size * 1.8, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: typeData.color,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.05, z);
        scene.add(ring);

        collectibles.push({
            mesh,
            ring,
            type,
            typeData,
            baseY: mesh.position.y,
            collected: false,
            phase: Math.random() * Math.PI * 2
        });
    }
}

/**
 * Update collectibles — bob, rotate, check pickup, update particle bursts.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number}} playerPos
 * @param {THREE.Scene} scene
 * @returns {{score: number, total: number, justCollected: string|null}}
 */
export function updateCollectibles(delta, elapsed, playerPos, scene) {
    let justCollected = null;

    for (const c of collectibles) {
        if (c.collected) continue;

        // Floating bob
        c.phase += delta * 2;
        c.mesh.position.y = c.baseY + Math.sin(c.phase) * 0.3;
        c.mesh.rotation.y += delta * 1.5;
        c.mesh.rotation.x += delta * 0.5;

        // Pulse emissive
        const pulse = 0.5 + Math.sin(elapsed * 3 + c.phase) * 0.5;
        c.mesh.material.emissiveIntensity = 0.5 + pulse * 0.8;

        // Ring pulse
        c.ring.material.opacity = 0.05 + pulse * 0.15;
        c.ring.scale.setScalar(1 + pulse * 0.3);

        // Check pickup
        const dx = c.mesh.position.x - playerPos.x;
        const dz = c.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < PICKUP_DISTANCE) {
            c.collected = true;
            score += c.typeData.points;
            justCollected = c.type;

            // Spawn particle burst
            spawnParticleBurst(scene, c.mesh.position.clone(), c.typeData.color);

            // Remove mesh
            scene.remove(c.mesh);
            scene.remove(c.ring);
            c.mesh.geometry.dispose();
            c.mesh.material.dispose();
            c.ring.geometry.dispose();
            c.ring.material.dispose();

            // Play sound
            playPickupSound(c.type);
        }
    }

    // Update particle bursts
    updateParticleBursts(delta, scene);

    return { score, total: totalCollectibles, justCollected };
}

function spawnParticleBurst(scene, position, color) {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;

        // Random outward velocity
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

    particleBursts.push({
        points,
        velocities,
        life: 1.5,
        maxLife: 1.5
    });
}

function updateParticleBursts(delta, scene) {
    for (let i = particleBursts.length - 1; i >= 0; i--) {
        const burst = particleBursts[i];
        burst.life -= delta;

        if (burst.life <= 0) {
            scene.remove(burst.points);
            burst.points.geometry.dispose();
            burst.points.material.dispose();
            particleBursts.splice(i, 1);
            continue;
        }

        const positions = burst.points.geometry.attributes.position.array;
        const t = burst.life / burst.maxLife;
        burst.points.material.opacity = t;

        for (let j = 0; j < positions.length / 3; j++) {
            const j3 = j * 3;
            positions[j3] += burst.velocities[j3] * delta;
            positions[j3 + 1] += burst.velocities[j3 + 1] * delta;
            positions[j3 + 2] += burst.velocities[j3 + 2] * delta;
            // Gravity
            burst.velocities[j3 + 1] -= 5 * delta;
        }

        burst.points.geometry.attributes.position.needsUpdate = true;
    }
}

export function getScore() { return score; }
export function getTotalCollectibles() { return totalCollectibles; }
export function getCollectedCount() { return collectibles.filter(c => c.collected).length; }
