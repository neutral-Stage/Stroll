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
} from './config.js';
import { isInsideBuilding } from './city.js';
import { getQuality } from './quality.js';

/** @type {Array<NPCData>} */
const npcs = [];

/**
 * @typedef {Object} NPCData
 * @property {THREE.Group} mesh
 * @property {Array<{x:number, z:number}>} path
 * @property {number} pathIndex
 * @property {number} speed - units per second
 * @property {number} progress - 0..1 along current segment
 * @property {number} bobPhase
 * @property {number} variant
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
    });
}

/**
 * @param {number} [startX]
 * @param {number} [startZ]
 */
function generateNPCPath(startX, startZ) {
    const points = [];
    const numPoints = NPC_PATH_MIN_POINTS + Math.floor(Math.random() * NPC_PATH_EXTRA_POINTS);
    const bound = HALF_CITY - 5;

    let x = startX ?? (Math.random() - 0.5) * CITY_SIZE * 0.7;
    let z = startZ ?? (Math.random() - 0.5) * CITY_SIZE * 0.7;

    let startAttempts = 0;
    while (isInsideBuilding(x, z) && startAttempts < 30) {
        x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        z = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        startAttempts++;
    }
    points.push({ x, z });

    for (let i = 0; i < numPoints; i++) {
        let nx = x;
        let nz = z;
        let attempts = 0;

        while (attempts < 16) {
            const angle = Math.random() * Math.PI * 2;
            const step = NPC_PATH_STEP * (0.6 + Math.random() * 0.4);
            nx = x + Math.cos(angle) * step;
            nz = z + Math.sin(angle) * step;
            nx = Math.max(-bound, Math.min(bound, nx));
            nz = Math.max(-bound, Math.min(bound, nz));

            const segLen = Math.hypot(nx - x, nz - z);
            if (segLen >= NPC_MIN_SEGMENT_LEN && !isInsideBuilding(nx, nz)) {
                break;
            }
            attempts++;
        }

        if (Math.hypot(nx - x, nz - z) >= NPC_MIN_SEGMENT_LEN) {
            points.push({ x: nx, z: nz });
            x = nx;
            z = nz;
        }
    }

    if (points.length < 2) {
        points.push({ x: x + 3, z });
    }

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

    npcs.forEach((npc) => {
        const dx = npc.mesh.position.x - playerPos.x;
        const dz = npc.mesh.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > cullDistSq) {
            npc.mesh.visible = false;
            return;
        }

        if (!npc.mesh.visible) {
            syncNpcProgressFromPosition(npc);
        }
        npc.mesh.visible = true;

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

        npc.bobPhase += delta * NPC_BOB_SPEED;
        npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * NPC_BOB_AMOUNT;
    });
}
