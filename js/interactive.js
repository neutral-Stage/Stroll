/**
 * interactive.js — Interactive elements: click flowers to bloom, glowing plants at night
 *
 * Features:
 *  • Flowers scattered around the park and city
 *  • Click to make them bloom with particle effects
 *  • Glowing plants that illuminate at night
 *  • Footprint trail that fades behind the player
 *
 * @module interactive
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { isInsideBuilding } from './city.js';

/** @type {Array<FlowerData>} */
const flowers = [];
/** @type {Array<GlowPlantData>} */
const glowPlants = [];
/** @type {THREE.Points|null} */
let footprintSystem = null;
/** @type {Float32Array} */
let footprintAlphas = null;
let footprintIndex = 0;
let lastFootprintPos = { x: 0, z: 0 };
let flowersInteracted = 0;

const FLOWER_COUNT = 40;
const GLOW_PLANT_COUNT = 20;
const MAX_FOOTPRINTS = 200;
const FOOTPRINT_INTERVAL = 1.5; // distance between footprints

const FLOWER_COLORS = [0xFF6B9D, 0xFFA726, 0xE040FB, 0xFF5252, 0xFFEB3B, 0xE91E63];

/** @type {THREE.Raycaster} */
const raycaster = new THREE.Raycaster();

/**
 * Create interactive elements.
 * @param {THREE.Scene} scene
 */
export function createInteractiveElements(scene) {
    createFlowers(scene);
    createGlowPlants(scene);
    createFootprintSystem(scene);
}

function createFlowers(scene) {
    for (let i = 0; i < FLOWER_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * 80;
            z = (Math.random() - 0.5) * 80;
            attempts++;
        } while (isInsideBuilding(x, z, 2) && attempts < 20);

        if (attempts >= 20) continue;

        const group = new THREE.Group();
        const color = FLOWER_COLORS[i % FLOWER_COLORS.length];

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.25;
        group.add(stem);

        // Bud (closed state)
        const budGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const budMat = new THREE.MeshLambertMaterial({ color });
        const bud = new THREE.Mesh(budGeo, budMat);
        bud.position.y = 0.5;
        group.add(bud);

        // Petals (hidden initially, shown on bloom)
        const petals = [];
        for (let p = 0; p < 5; p++) {
            const petalGeo = new THREE.PlaneGeometry(0.12, 0.08);
            const petalMat = new THREE.MeshLambertMaterial({
                color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0
            });
            const petal = new THREE.Mesh(petalGeo, petalMat);
            const angle = (p / 5) * Math.PI * 2;
            petal.position.set(Math.cos(angle) * 0.1, 0.52, Math.sin(angle) * 0.1);
            petal.rotation.x = -Math.PI / 4;
            petal.rotation.y = angle;
            petal.scale.setScalar(0);
            group.add(petal);
            petals.push(petal);
        }

        group.position.set(x, 0, z);
        scene.add(group);

        flowers.push({
            mesh: group,
            bud,
            petals,
            bloomed: false,
            bloomProgress: 0,
            x, z,
            color
        });
    }
}

function createGlowPlants(scene) {
    for (let i = 0; i < GLOW_PLANT_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * 100;
            z = (Math.random() - 0.5) * 100;
            attempts++;
        } while (isInsideBuilding(x, z, 2) && attempts < 20);

        if (attempts >= 20) continue;

        const group = new THREE.Group();

        // Mushroom-like glowing plant
        const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 5);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x4DB6AC });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.15;
        group.add(stem);

        const capGeo = new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const capMat = new THREE.MeshStandardMaterial({
            color: 0x00E5FF,
            emissive: 0x00BCD4,
            emissiveIntensity: 0,
            transparent: true,
            opacity: 0.8
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 0.3;
        group.add(cap);

        group.position.set(x, 0, z);
        scene.add(group);

        glowPlants.push({
            mesh: group,
            cap,
            capMat,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function createFootprintSystem(scene) {
    const positions = new Float32Array(MAX_FOOTPRINTS * 3);
    footprintAlphas = new Float32Array(MAX_FOOTPRINTS);

    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -10; // hidden below ground
        positions[i * 3 + 2] = 0;
        footprintAlphas[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: 0xBCAAA4,
        size: 0.3,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true
    });

    footprintSystem = new THREE.Points(geo, mat);
    scene.add(footprintSystem);
}

/**
 * Handle click interaction — check if a flower was clicked.
 * @param {THREE.PerspectiveCamera} camera
 * @param {{x:number, y:number}} mouseNDC - normalized device coordinates
 * @param {THREE.Scene} scene
 * @returns {boolean} whether a flower was interacted with
 */
export function handleClick(camera, mouseNDC, scene) {
    raycaster.setFromCamera(new THREE.Vector2(mouseNDC.x, mouseNDC.y), camera);

    const meshes = flowers.filter(f => !f.bloomed).map(f => f.bud);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const flower = flowers.find(f => f.bud === hitMesh || f.mesh.children.includes(hitMesh));
        if (flower && !flower.bloomed) {
            flower.bloomed = true;
            flowersInteracted++;
            return true;
        }
    }

    // Also check by proximity to flower positions (more forgiving)
    // Use the raycaster's ray to find closest flower
    const ray = raycaster.ray;
    for (const flower of flowers) {
        if (flower.bloomed) continue;
        const flowerPos = new THREE.Vector3(flower.x, 0.5, flower.z);
        const dist = ray.distanceToPoint(flowerPos);
        if (dist < 1.5) {
            const camDist = camera.position.distanceTo(flowerPos);
            if (camDist < 8) {
                flower.bloomed = true;
                flowersInteracted++;
                return true;
            }
        }
    }

    return false;
}

/**
 * Update interactive elements.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number}} playerPos
 * @param {number} nightAmount - 0..1 how dark it is
 */
export function updateInteractive(delta, elapsed, playerPos, nightAmount) {
    // Update blooming flowers
    for (const flower of flowers) {
        if (flower.bloomed && flower.bloomProgress < 1) {
            flower.bloomProgress = Math.min(1, flower.bloomProgress + delta * 2);
            const t = flower.bloomProgress;

            // Expand petals
            for (const petal of flower.petals) {
                petal.scale.setScalar(t);
                petal.material.opacity = t * 0.9;
            }

            // Shrink bud slightly
            flower.bud.scale.setScalar(1 - t * 0.3);
        }

        // Gentle sway
        if (flower.mesh) {
            flower.mesh.rotation.z = Math.sin(elapsed * 0.5 + flower.x) * 0.05;
        }
    }

    // Update glow plants — glow at night
    for (const plant of glowPlants) {
        plant.phase += delta;
        const glowIntensity = nightAmount * (0.5 + Math.sin(plant.phase * 2) * 0.3);
        plant.capMat.emissiveIntensity = glowIntensity;
    }

    // Update footprints
    updateFootprints(playerPos, delta);
}

function updateFootprints(playerPos, delta) {
    if (!footprintSystem) return;

    const dx = playerPos.x - lastFootprintPos.x;
    const dz = playerPos.z - lastFootprintPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > FOOTPRINT_INTERVAL) {
        const positions = footprintSystem.geometry.attributes.position.array;
        const i3 = footprintIndex * 3;
        positions[i3] = playerPos.x;
        positions[i3 + 1] = 0.02;
        positions[i3 + 2] = playerPos.z;
        footprintAlphas[footprintIndex] = 1.0;

        footprintIndex = (footprintIndex + 1) % MAX_FOOTPRINTS;
        lastFootprintPos = { x: playerPos.x, z: playerPos.z };
        footprintSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Fade footprints
    let maxAlpha = 0;
    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
        if (footprintAlphas[i] > 0) {
            footprintAlphas[i] -= delta * 0.05;
            if (footprintAlphas[i] < 0) {
                footprintAlphas[i] = 0;
                // Move below ground
                const positions = footprintSystem.geometry.attributes.position.array;
                positions[i * 3 + 1] = -10;
                footprintSystem.geometry.attributes.position.needsUpdate = true;
            }
            maxAlpha = Math.max(maxAlpha, footprintAlphas[i]);
        }
    }

    footprintSystem.material.opacity = Math.min(0.4, maxAlpha);
}

export function getFlowersInteracted() { return flowersInteracted; }
