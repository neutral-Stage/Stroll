/**
 * npcs.js — NPC creation, pathing, and per-frame updates
 * @module npcs
 */

import * as THREE from 'three';
import {
    NPC_WALK_SPEED_MIN, NPC_WALK_SPEED_MAX,
    NPC_PATH_MIN_POINTS, NPC_PATH_EXTRA_POINTS, NPC_PATH_STEP, NPC_MIN_SEGMENT_LEN,
    NPC_BOB_SPEED, NPC_BOB_AMOUNT, NPC_CULL_DISTANCE,
    CITY_SIZE, HALF_CITY, NPC_COLORS,
    NPC_FLEE_SPEED, NPC_ALERT_RADIUS,
    CELL_SIZE, STREET_WIDTH,
} from './config.js';
import { isInsideBuilding, snapToRoad } from './city.js';
import { getQuality } from './quality.js';

/** @type {Array<NPCData>} */
export const npcs = [];

/**
 * @typedef {Object} NPCData
 * @property {THREE.Group} mesh
 * @property {Array<{x:number, z:number}>} path
 * @property {number} pathIndex
 * @property {number} speed - units per second
 * @property {number} progress - 0..1 along current segment
 * @property {number} bobPhase
 * @property {number} variant
 * @property {number} health
 * @property {boolean} dead
 */

const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.25);
const hatGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.2, 6);
const bagGeo = new THREE.BoxGeometry(0.15, 0.3, 0.25);

const legMat = new THREE.MeshLambertMaterial({ color: 0x455A64 });
const skinMats = [
    new THREE.MeshLambertMaterial({ color: 0xFFCC80 }),
    new THREE.MeshLambertMaterial({ color: 0xD7A86E }),
    new THREE.MeshLambertMaterial({ color: 0xC68642 }),
    new THREE.MeshLambertMaterial({ color: 0x8D5524 }),
];

export function generateNPCs(scene) {
    const count = getQuality().npcCount;
    for (let i = 0; i < count; i++) {
        createNPC(scene, NPC_COLORS[i % NPC_COLORS.length], i % 3);
    }
}

function createNPC(scene, color, variant) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });

    let bodyScale = [1, 1, 1];
    if (variant === 1) bodyScale = [0.8, 1.3, 0.8];
    if (variant === 2) bodyScale = [1.3, 0.8, 1.2];

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(...bodyScale);
    body.position.y = 1.3;
    group.add(body);

    const skinMat = skinMats[Math.floor(Math.random() * skinMats.length)];
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.1 + (variant === 1 ? 0.3 : 0);
    group.add(head);

    [-0.15, 0.15].forEach((lx) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.45, 0);
        group.add(leg);
    });

    if (Math.random() < 0.3) {
        const hat = new THREE.Mesh(hatGeo, new THREE.MeshLambertMaterial({ color }));
        hat.position.y = 2.45 + (variant === 1 ? 0.3 : 0);
        group.add(hat);
    }
    if (Math.random() < 0.2) {
        const bag = new THREE.Mesh(bagGeo, new THREE.MeshLambertMaterial({ color: 0x795548 }));
        bag.position.set(0, 1.2, -0.3);
        group.add(bag);
    }

    const path = generateNPCPath();
    const startPoint = path[0];
    group.position.set(startPoint.x, 0, startPoint.z);

    scene.add(group);

    npcs.push({
        mesh: group,
        path,
        pathIndex: 0,
        speed: NPC_WALK_SPEED_MIN + Math.random() * (NPC_WALK_SPEED_MAX - NPC_WALK_SPEED_MIN),
        progress: 0,
        bobPhase: Math.random() * Math.PI * 2,
        variant,
        health: 100,
        dead: false
    });
}

/**
 * @param {number} [startX]
 * @param {number} [startZ]
 */
function generateNPCPath(startX, startZ) {
    // Pedestrians walk ALONG streets (snapped to a road lane), turning at
    // intersections — they never cut across grass, parks, or building lots.
    const points = [];
    const numPoints = NPC_PATH_MIN_POINTS + Math.floor(Math.random() * NPC_PATH_EXTRA_POINTS);
    const bound = HALF_CITY - 8;
    const lane = STREET_WIDTH / 2 - 2; // keep to one side of the road

    let sx = startX ?? (Math.random() - 0.5) * CITY_SIZE * 0.6;
    let sz = startZ ?? (Math.random() - 0.5) * CITY_SIZE * 0.6;

    let snapped = snapToRoad(sx, sz);
    let x = snapped.x, z = snapped.z, axis = snapped.axis;
    const side = Math.random() < 0.5 ? 1 : -1;
    if (axis === 'x') x += lane * side; else z += lane * side;
    if (isInsideBuilding(x, z)) { x = snapped.x; z = snapped.z; }
    points.push({ x, z });

    let dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < numPoints; i++) {
        const step = NPC_PATH_STEP * (0.7 + Math.random() * 0.6);
        if (axis === 'x') z += dir * step; else x += dir * step; // walk along the road
        if (x > bound || x < -bound) { x = Math.max(-bound, Math.min(bound, x)); dir *= -1; }
        if (z > bound || z < -bound) { z = Math.max(-bound, Math.min(bound, z)); dir *= -1; }

        // Occasionally turn onto the cross street at an intersection.
        if (Math.random() < 0.22) {
            const s = snapToRoad(x, z);
            x = s.x; z = s.z;
            axis = axis === 'x' ? 'z' : 'x';
            const side2 = Math.random() < 0.5 ? 1 : -1;
            if (axis === 'x') x += lane * side2; else z += lane * side2;
            dir = Math.random() < 0.5 ? 1 : -1;
        }
        points.push({ x, z });
    }

    if (points.length < 2) points.push({ x: x + 4, z });
    return points;
}

function syncNpcProgressFromPosition(npc) {
    const from = npc.path[npc.pathIndex];
    const to = npc.path[(npc.pathIndex + 1) % npc.path.length];
    const segLen = Math.hypot(to.x - from.x, to.z - from.z);
    if (segLen < 0.001) {
        npc.progress = 0;
        return;
    }
    const px = npc.mesh.position.x - from.x;
    const pz = npc.mesh.position.z - from.z;
    npc.progress = Math.max(0, Math.min(1, (px * (to.x - from.x) + pz * (to.z - from.z)) / (segLen * segLen)));
}

export function updateNPCs(delta, playerPos) {
    const cullDistSq = NPC_CULL_DISTANCE * NPC_CULL_DISTANCE;

    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];
        if (npc.dead) {
            npcs.splice(i, 1);
            continue;
        }

        const dx = npc.mesh.position.x - playerPos.x;
        const dz = npc.mesh.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > cullDistSq) {
            npc.mesh.visible = false;
            continue; // (was `return` — that skipped every remaining NPC)
        }

        if (!npc.mesh.visible) {
            syncNpcProgressFromPosition(npc);
        }
        npc.mesh.visible = true;

        // ── PANIC: flee from recent gunfire/explosions ───────────
        if (npc.panicTimer > 0) {
            npc.panicTimer -= delta;
            let nx = npc.mesh.position.x + npc.fleeX * NPC_FLEE_SPEED * delta;
            let nz = npc.mesh.position.z + npc.fleeZ * NPC_FLEE_SPEED * delta;
            if (isInsideBuilding(nx, nz)) {
                // Deflect sideways along the wall instead of stopping dead.
                const tx = -npc.fleeZ, tz = npc.fleeX;
                nx = npc.mesh.position.x + tx * NPC_FLEE_SPEED * delta;
                nz = npc.mesh.position.z + tz * NPC_FLEE_SPEED * delta;
                if (isInsideBuilding(nx, nz)) { nx = npc.mesh.position.x; nz = npc.mesh.position.z; }
            }
            npc.mesh.position.x = nx;
            npc.mesh.position.z = nz;
            npc.mesh.rotation.y = Math.atan2(npc.fleeX, npc.fleeZ);
            // Frantic run bob.
            npc.bobPhase += delta * NPC_BOB_SPEED * 2.6;
            npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * NPC_BOB_AMOUNT * 1.9;
            if (npc.panicTimer <= 0) {
                // Calm down: build a fresh path from where they ended up.
                npc.path = generateNPCPath(npc.mesh.position.x, npc.mesh.position.z);
                npc.pathIndex = 0;
                npc.progress = 0;
            }
            continue;
        }

        const from = npc.path[npc.pathIndex];
        const to = npc.path[(npc.pathIndex + 1) % npc.path.length];
        const segLen = Math.hypot(to.x - from.x, to.z - from.z) || 0.001;

        npc.progress += (npc.speed * delta) / segLen;

        if (npc.progress >= 1) {
            npc.progress = 0;
            const nextIndex = (npc.pathIndex + 1) % npc.path.length;
            if (nextIndex === 0) {
                const end = npc.path[npc.path.length - 1];
                npc.path = generateNPCPath(end.x, end.z);
                npc.pathIndex = 0;
            } else {
                npc.pathIndex = nextIndex;
            }
        }

        const curFrom = npc.path[npc.pathIndex];
        const curTo = npc.path[(npc.pathIndex + 1) % npc.path.length];
        const x = curFrom.x + (curTo.x - curFrom.x) * npc.progress;
        const z = curFrom.z + (curTo.z - curFrom.z) * npc.progress;

        npc.mesh.position.x = x;
        npc.mesh.position.z = z;

        const fdx = curTo.x - curFrom.x;
        const fdz = curTo.z - curFrom.z;
        if (Math.abs(fdx) > 0.01 || Math.abs(fdz) > 0.01) {
            npc.mesh.rotation.y = Math.atan2(fdx, fdz);
        }

        if (npc.mesh.position.y > 0.5 || npc.vy) {
            npc.vy = (npc.vy || 0) - 20 * delta;
            npc.mesh.position.y += npc.vy * delta;
            if (npc.mesh.position.y <= 0) {
                npc.mesh.position.y = 0;
                npc.vy = 0;
            }
        } else {
            npc.bobPhase += delta * NPC_BOB_SPEED;
            npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * NPC_BOB_AMOUNT;
        }
    }
}

/**
 * Make nearby civilians panic and flee away from a danger point
 * (gunfire, explosions, the player going on a rampage).
 * @param {number} x @param {number} z
 * @param {number} [radius] alert radius
 * @param {number} [duration] base panic seconds
 */
export function alertNPCsToDanger(x, z, radius = NPC_ALERT_RADIUS, duration = 3.5) {
    const rSq = radius * radius;
    for (const npc of npcs) {
        if (npc.dead) continue;
        const dx = npc.mesh.position.x - x;
        const dz = npc.mesh.position.z - z;
        const dSq = dx * dx + dz * dz;
        if (dSq < rSq) {
            const d = Math.sqrt(dSq) || 0.001;
            npc.fleeX = dx / d;
            npc.fleeZ = dz / d;
            // Closer NPCs panic a little longer.
            const closeness = 1 - Math.min(1, d / radius);
            npc.panicTimer = Math.max(npc.panicTimer || 0, duration + closeness * 1.5);
        }
    }
}

export function damageNPCAtPoint(x, z, radius, damage, spawnDebrisCallback) {
    const rSq = radius * radius;
    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (npc.dead) continue;
        const dx = npc.mesh.position.x - x;
        const dz = npc.mesh.position.z - z;
        if (dx * dx + dz * dz < rSq) {
            npc.health -= damage;
            if (npc.health <= 0) {
                npc.dead = true;
                npc.mesh.parent.remove(npc.mesh);
                if (npc.mesh.geometry) npc.mesh.geometry.dispose();
                if (spawnDebrisCallback) spawnDebrisCallback(npc.mesh.position.x, 1, npc.mesh.position.z, 'npc');
            }
        }
    }
}
