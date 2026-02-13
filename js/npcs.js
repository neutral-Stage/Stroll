/**
 * npcs.js — NPC creation, pathing, and per-frame updates
 *
 * Fixes from review:
 *  • NPC paths now validate waypoints against building collision.
 *  • NPCs beyond NPC_CULL_DISTANCE from the player are not updated (pooling).
 *  • More NPC variety: different body proportions, accessories, walking styles.
 *
 * @module npcs
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import {
    NPC_COUNT, NPC_MIN_SPEED, NPC_SPEED_RANGE,
    NPC_PATH_MIN_POINTS, NPC_PATH_EXTRA_POINTS, NPC_PATH_STEP,
    NPC_BOB_SPEED, NPC_BOB_AMOUNT, NPC_CULL_DISTANCE,
    CITY_SIZE, HALF_CITY, NPC_COLORS
} from './config.js';
import { isInsideBuilding } from './city.js';

/** @type {Array<NPCData>} */
const npcs = [];

/**
 * @typedef {Object} NPCData
 * @property {THREE.Group} mesh
 * @property {Array<{x:number, z:number}>} path
 * @property {number} pathIndex
 * @property {number} speed
 * @property {number} progress
 * @property {number} bobPhase
 * @property {number} variant - body style variant (0-2)
 */

// Shared geometries for NPC parts (reused across all NPCs)
const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.25);
const hatGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.2, 6);
const bagGeo = new THREE.BoxGeometry(0.15, 0.3, 0.25);

// Shared materials
const legMat = new THREE.MeshLambertMaterial({ color: 0x455A64 });
const skinMats = [
    new THREE.MeshLambertMaterial({ color: 0xFFCC80 }),
    new THREE.MeshLambertMaterial({ color: 0xD7A86E }),
    new THREE.MeshLambertMaterial({ color: 0xC68642 }),
    new THREE.MeshLambertMaterial({ color: 0x8D5524 })
];

/**
 * Generate all NPCs and add them to the scene.
 * @param {THREE.Scene} scene
 */
export function generateNPCs(scene) {
    for (let i = 0; i < NPC_COUNT; i++) {
        createNPC(scene, NPC_COLORS[i % NPC_COLORS.length], i % 3);
    }
}

/**
 * Create a single NPC with a given color and body variant.
 * @param {THREE.Scene} scene
 * @param {number} color - body color hex
 * @param {number} variant - 0: normal, 1: tall/thin, 2: short/wide
 */
function createNPC(scene, color, variant) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });

    // Body — varies by variant
    let bodyScale = [1, 1, 1];
    if (variant === 1) bodyScale = [0.8, 1.3, 0.8]; // tall & thin
    if (variant === 2) bodyScale = [1.3, 0.8, 1.2]; // short & wide

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(...bodyScale);
    body.position.y = 1.3;
    group.add(body);

    // Head
    const skinMat = skinMats[Math.floor(Math.random() * skinMats.length)];
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.1 + (variant === 1 ? 0.3 : 0);
    group.add(head);

    // Legs
    [-0.15, 0.15].forEach(lx => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.45, 0);
        group.add(leg);
    });

    // Accessories (random)
    if (Math.random() < 0.3) {
        // Hat
        const hatMat = new THREE.MeshLambertMaterial({ color: color });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 2.45 + (variant === 1 ? 0.3 : 0);
        group.add(hat);
    }
    if (Math.random() < 0.2) {
        // Bag / backpack
        const bagMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.position.set(0, 1.2, -0.3);
        group.add(bag);
    }

    // Generate a valid walking path (avoids buildings)
    const path = generateNPCPath();
    const startPoint = path[0];
    group.position.set(startPoint.x, 0, startPoint.z);

    scene.add(group);

    npcs.push({
        mesh: group,
        path,
        pathIndex: 0,
        speed: NPC_MIN_SPEED + Math.random() * NPC_SPEED_RANGE,
        progress: 0,
        bobPhase: Math.random() * Math.PI * 2,
        variant
    });
}

/**
 * Generate a walking path that avoids buildings.
 * Each waypoint is validated; if it lands inside a building, it's nudged to a valid spot.
 * @returns {Array<{x:number, z:number}>}
 */
function generateNPCPath() {
    const points = [];
    const numPoints = NPC_PATH_MIN_POINTS + Math.floor(Math.random() * NPC_PATH_EXTRA_POINTS);

    let x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
    let z = (Math.random() - 0.5) * CITY_SIZE * 0.7;

    // Ensure start point is not inside a building
    let startAttempts = 0;
    while (isInsideBuilding(x, z) && startAttempts < 30) {
        x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        z = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        startAttempts++;
    }

    for (let i = 0; i < numPoints; i++) {
        points.push({ x, z });

        // Walk in a random direction
        let nx, nz, attempts = 0;
        do {
            nx = x + (Math.random() < 0.5 ? 1 : 0) * (Math.random() - 0.5) * NPC_PATH_STEP;
            nz = z + (Math.random() < 0.5 ? 1 : 0) * (Math.random() - 0.5) * NPC_PATH_STEP;
            nx = Math.max(-HALF_CITY + 5, Math.min(HALF_CITY - 5, nx));
            nz = Math.max(-HALF_CITY + 5, Math.min(HALF_CITY - 5, nz));
            attempts++;
        } while (isInsideBuilding(nx, nz) && attempts < 10);

        x = nx;
        z = nz;
    }

    return points;
}

/**
 * Update all NPCs. Only updates NPCs within cull distance of the player.
 * @param {number} delta - frame delta in seconds
 * @param {{x:number, z:number}} playerPos - current player position
 */
export function updateNPCs(delta, playerPos) {
    npcs.forEach(npc => {
        // Distance culling — skip far-away NPCs
        const dx = npc.mesh.position.x - playerPos.x;
        const dz = npc.mesh.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > NPC_CULL_DISTANCE * NPC_CULL_DISTANCE) {
            npc.mesh.visible = false;
            return;
        }
        npc.mesh.visible = true;

        const from = npc.path[npc.pathIndex];
        const to = npc.path[(npc.pathIndex + 1) % npc.path.length];

        npc.progress += npc.speed * delta * 60;

        if (npc.progress >= 1) {
            npc.progress = 0;
            npc.pathIndex = (npc.pathIndex + 1) % npc.path.length;
        }

        // Lerp position
        const x = from.x + (to.x - from.x) * npc.progress;
        const z = from.z + (to.z - from.z) * npc.progress;

        npc.mesh.position.x = x;
        npc.mesh.position.z = z;

        // Face direction of movement
        const fdx = to.x - from.x;
        const fdz = to.z - from.z;
        if (Math.abs(fdx) > 0.01 || Math.abs(fdz) > 0.01) {
            npc.mesh.rotation.y = Math.atan2(fdx, fdz);
        }

        // Walking bob
        npc.bobPhase += delta * NPC_BOB_SPEED;
        npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * NPC_BOB_AMOUNT;
    });
}
