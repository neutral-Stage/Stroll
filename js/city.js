/**
 * city.js — Procedural city generation with optimised geometry
 *
 * Performance strategy:
 *  • Buildings use individual meshes (needed for collision data) but share materials.
 *  • Windows use InstancedMesh — one draw call for ALL windows in the city.
 *  • Sidewalks are merged into a single BufferGeometry.
 *  • Trees use InstancedMesh for trunks and foliage cones.
 *  • Benches and lamp posts share geometry/materials; lamp glow uses emissive
 *    materials instead of per-lamp PointLights.
 *
 * @module city
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import {
    CITY_SIZE, BLOCK_SIZE, STREET_WIDTH, CELL_SIZE, HALF_CITY,
    PARK_EXCLUSION, BLOCK_SKIP_CHANCE,
    MIN_BUILDING_HEIGHT, BUILDING_HEIGHT_RANGE,
    WINDOW_SIZE, WINDOW_ASPECT, WINDOW_SPACING_Y, WINDOW_SPACING_X, WINDOW_SKIP_CHANCE,
    ROOFTOP_DETAIL_CHANCE,
    TREE_COUNT, BENCH_COUNT, LAMP_COUNT, MAX_ACTIVE_LIGHTS,
    BUILDING_COLORS, FOLIAGE_COLORS
} from './config.js';

// ── Shared materials (created once, reused everywhere) ───────
const buildingMats = BUILDING_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));
const windowLitMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });
const windowDimMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E1 });
const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xC8C0B0 });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0xBDBDBD });
const waterMat = new THREE.MeshLambertMaterial({ color: 0x4FC3F7, transparent: true, opacity: 0.7 });
const woodMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 });
const metalMat = new THREE.MeshLambertMaterial({ color: 0x424242 });
const poleMat = new THREE.MeshLambertMaterial({ color: 0x37474F });
const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 }); // emissive glow — no PointLight needed
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
const rooftopMat = new THREE.MeshLambertMaterial({ color: 0x9E9E9E });
const parkGrassMat = new THREE.MeshLambertMaterial({ color: 0x7CB342 });
const pathMat = new THREE.MeshLambertMaterial({ color: 0xBCAAA4 });

// Shared geometries
const windowGeo = new THREE.PlaneGeometry(WINDOW_SIZE, WINDOW_SIZE * WINDOW_ASPECT);

/** @type {Array<{x:number, z:number, width:number, depth:number, height:number}>} */
export const buildings = [];

/** @type {Array<{x:number, z:number}>} */
export const lampPositions = [];

// ── Collect window transforms for InstancedMesh ──────────────
const windowTransforms = []; // { matrix: THREE.Matrix4, lit: boolean }

// ── Collect sidewalk geometries for merging ──────────────────
const sidewalkGeos = [];

// ── Collect tree data for InstancedMesh ──────────────────────
const treeData = []; // { x, z, large, trunkH, trunkR, foliageColor, layers }

/**
 * Generate the entire city: buildings, sidewalks, park, trees, benches, lamps.
 * Call once during init.
 * @param {THREE.Scene} scene
 * @param {function} onProgress - callback(percent) for loading screen
 */
export function generateCity(scene, onProgress) {
    generateBlocks(scene, onProgress);
    buildSidewalks(scene);
    generatePark(scene);
    generateTrees(scene);
    buildWindowInstances(scene);
    generateBenches(scene);
    generateLampPosts(scene);
}

// ── Buildings ────────────────────────────────────────────────

function generateBlocks(scene, onProgress) {
    const totalCells = Math.ceil(CITY_SIZE / CELL_SIZE) ** 2;
    let processed = 0;

    for (let gx = -HALF_CITY; gx < HALF_CITY; gx += CELL_SIZE) {
        for (let gz = -HALF_CITY; gz < HALF_CITY; gz += CELL_SIZE) {
            processed++;
            if (Math.random() < BLOCK_SKIP_CHANCE) continue;
            if (Math.abs(gx) < PARK_EXCLUSION && Math.abs(gz) < PARK_EXCLUSION) continue;

            generateBlock(scene, gx + STREET_WIDTH / 2, gz + STREET_WIDTH / 2);
        }
    }
    if (onProgress) onProgress(40);
}

function generateBlock(scene, bx, bz) {
    const numBuildings = 1 + Math.floor(Math.random() * 3);
    const subSize = BLOCK_SIZE / numBuildings;

    for (let i = 0; i < numBuildings; i++) {
        const height = MIN_BUILDING_HEIGHT + Math.random() * BUILDING_HEIGHT_RANGE;
        const width = subSize * (0.6 + Math.random() * 0.35);
        const depth = BLOCK_SIZE * (0.5 + Math.random() * 0.4);
        const x = bx + i * subSize + subSize / 2;
        const z = bz + BLOCK_SIZE / 2;
        const colorIdx = Math.floor(Math.random() * BUILDING_COLORS.length);

        createBuilding(scene, x, height, z, width, depth, colorIdx);
    }
}

function createBuilding(scene, x, height, z, width, depth, colorIdx) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = buildingMats[colorIdx];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    buildings.push({ x, z, width, depth, height });

    // Collect window transforms (will be batched into InstancedMesh later)
    collectWindows(x, height, z, width, depth);

    // Occasional rooftop detail
    if (Math.random() < ROOFTOP_DETAIL_CHANCE) {
        addRooftopDetail(scene, x, height, z, width, depth);
    }
}

/**
 * Collect window positions as Matrix4 transforms for later InstancedMesh creation.
 * This avoids creating thousands of individual Mesh objects.
 */
function collectWindows(bx, height, bz, width, depth) {
    const numFloors = Math.floor(height / WINDOW_SPACING_Y);
    const numWinX = Math.floor(width / WINDOW_SPACING_X);
    const numWinZ = Math.floor(depth / WINDOW_SPACING_X);
    const lit = Math.random() < 0.4;

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    // Front & back faces
    for (let floor = 0; floor < numFloors; floor++) {
        for (let wx = 0; wx < numWinX; wx++) {
            if (Math.random() < WINDOW_SKIP_CHANCE) continue;
            const localX = -width / 2 + WINDOW_SPACING_X * (wx + 0.5) + (width - numWinX * WINDOW_SPACING_X) / 2;
            const localY = -height / 2 + WINDOW_SPACING_Y * (floor + 0.5) + 1;

            // Front
            pos.set(bx + localX, height / 2 + localY, bz + depth / 2 + 0.01);
            quat.setFromEuler(new THREE.Euler(0, 0, 0));
            m.compose(pos, quat, scale);
            windowTransforms.push({ matrix: m.clone(), lit });

            // Back
            pos.set(bx + localX, height / 2 + localY, bz - depth / 2 - 0.01);
            quat.setFromEuler(new THREE.Euler(0, Math.PI, 0));
            m.compose(pos, quat, scale);
            windowTransforms.push({ matrix: m.clone(), lit });
        }
    }

    // Side faces
    for (let floor = 0; floor < numFloors; floor++) {
        for (let wz = 0; wz < numWinZ; wz++) {
            if (Math.random() < WINDOW_SKIP_CHANCE) continue;
            const localZ = -depth / 2 + WINDOW_SPACING_X * (wz + 0.5) + (depth - numWinZ * WINDOW_SPACING_X) / 2;
            const localY = -height / 2 + WINDOW_SPACING_Y * (floor + 0.5) + 1;

            // Left
            pos.set(bx - width / 2 - 0.01, height / 2 + localY, bz + localZ);
            quat.setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
            m.compose(pos, quat, scale);
            windowTransforms.push({ matrix: m.clone(), lit });

            // Right
            pos.set(bx + width / 2 + 0.01, height / 2 + localY, bz + localZ);
            quat.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
            m.compose(pos, quat, scale);
            windowTransforms.push({ matrix: m.clone(), lit });
        }
    }
}

/**
 * Build a single InstancedMesh for ALL windows in the city.
 * Dramatically reduces draw calls from thousands to 2 (lit + dim).
 */
function buildWindowInstances(scene) {
    const litTransforms = windowTransforms.filter(w => w.lit);
    const dimTransforms = windowTransforms.filter(w => !w.lit);

    if (litTransforms.length > 0) {
        const litMesh = new THREE.InstancedMesh(windowGeo, windowLitMat, litTransforms.length);
        litTransforms.forEach((w, i) => litMesh.setMatrixAt(i, w.matrix));
        litMesh.instanceMatrix.needsUpdate = true;
        scene.add(litMesh);
    }

    if (dimTransforms.length > 0) {
        const dimMesh = new THREE.InstancedMesh(windowGeo, windowDimMat, dimTransforms.length);
        dimTransforms.forEach((w, i) => dimMesh.setMatrixAt(i, w.matrix));
        dimMesh.instanceMatrix.needsUpdate = true;
        scene.add(dimMesh);
    }
}

function addRooftopDetail(scene, x, height, z, width, depth) {
    const detailSize = 1 + Math.random() * 2;
    const geo = new THREE.BoxGeometry(detailSize, detailSize, detailSize);
    const detail = new THREE.Mesh(geo, rooftopMat);
    detail.position.set(
        x + (Math.random() - 0.5) * width * 0.5,
        height + detailSize / 2,
        z + (Math.random() - 0.5) * depth * 0.5
    );
    detail.castShadow = true;
    scene.add(detail);
}

// ── Sidewalks (merged into single mesh) ──────────────────────

function buildSidewalks(scene) {
    for (let gx = -HALF_CITY; gx < HALF_CITY; gx += CELL_SIZE) {
        for (let gz = -HALF_CITY; gz < HALF_CITY; gz += CELL_SIZE) {
            const sx = gx + STREET_WIDTH / 2;
            const sz = gz + STREET_WIDTH / 2;

            const strips = [
                { x: sx + BLOCK_SIZE / 2, z: sz - 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                { x: sx + BLOCK_SIZE / 2, z: sz + BLOCK_SIZE + 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                { x: sx - 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE },
                { x: sx + BLOCK_SIZE + 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE }
            ];

            strips.forEach(s => {
                const geo = new THREE.BoxGeometry(s.w, 0.15, s.d);
                geo.translate(s.x, 0.075, s.z);
                sidewalkGeos.push(geo);
            });
        }
    }

    if (sidewalkGeos.length > 0) {
        const merged = mergeGeometries(sidewalkGeos, false);
        const mesh = new THREE.Mesh(merged, sidewalkMat);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
}

// ── Park ─────────────────────────────────────────────────────

function generatePark(scene) {
    // Grass area
    const parkGeo = new THREE.PlaneGeometry(45, 45);
    const park = new THREE.Mesh(parkGeo, parkGrassMat);
    park.rotation.x = -Math.PI / 2;
    park.position.set(0, 0.02, 0);
    park.receiveShadow = true;
    scene.add(park);

    // Crossing paths
    const pathGeo = new THREE.PlaneGeometry(3, 40);
    const path1 = new THREE.Mesh(pathGeo, pathMat);
    path1.rotation.x = -Math.PI / 2;
    path1.position.set(0, 0.03, 0);
    path1.receiveShadow = true;
    scene.add(path1);

    const path2 = new THREE.Mesh(pathGeo, pathMat);
    path2.rotation.x = -Math.PI / 2;
    path2.rotation.z = Math.PI / 2;
    path2.position.set(0, 0.03, 0);
    path2.receiveShadow = true;
    scene.add(path2);

    // Park trees (ring around center)
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 12 + Math.random() * 6;
        treeData.push({
            x: Math.cos(angle) * radius,
            z: Math.sin(angle) * radius,
            large: true
        });
    }

    // Central fountain
    createFountain(scene, 0, 0);

    // Park benches
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        createBench(scene, Math.cos(angle) * 8, Math.sin(angle) * 8, angle + Math.PI);
    }
}

function createFountain(scene, x, z) {
    const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.8, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.set(x, 0.4, z);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    const waterGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 8);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(x, 0.85, z);
    scene.add(water);

    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(x, 1.8, z);
    pillar.castShadow = true;
    scene.add(pillar);

    const topGeo = new THREE.CylinderGeometry(1.2, 0.5, 0.5, 8);
    const top = new THREE.Mesh(topGeo, stoneMat);
    top.position.set(x, 2.8, z);
    top.castShadow = true;
    scene.add(top);
}

// ── Trees (InstancedMesh for trunks + foliage) ───────────────

function generateTrees(scene) {
    // Collect street trees
    for (let i = 0; i < TREE_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * CITY_SIZE;
            z = (Math.random() - 0.5) * CITY_SIZE;
            attempts++;
        } while (isInsideBuilding(x, z) && attempts < 20);

        if (attempts < 20) {
            treeData.push({ x, z, large: Math.random() < 0.3 });
        }
    }

    // Build instanced meshes for all trees
    buildTreeInstances(scene);
}

function buildTreeInstances(scene) {
    if (treeData.length === 0) return;

    // Prepare trunk instances
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 2, 5);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeData.length);

    // Prepare foliage — up to 3 layers per tree
    const foliageLayers = [];
    const foliageMats = FOLIAGE_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c }));

    // Collect all foliage cone transforms grouped by color
    const foliageByColor = {}; // colorIdx -> [{matrix}]

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    treeData.forEach((tree, idx) => {
        const large = tree.large;
        const trunkHeight = large ? 3 + Math.random() * 2 : 1.5 + Math.random() * 1.5;
        const trunkRadius = large ? 0.3 : 0.15;

        // Trunk transform
        pos.set(tree.x, trunkHeight / 2, tree.z);
        quat.identity();
        scl.set(trunkRadius / 0.15, trunkHeight / 2, trunkRadius / 0.15);
        m.compose(pos, quat, scl);
        trunkMesh.setMatrixAt(idx, m);

        // Foliage layers
        const colorIdx = Math.floor(Math.random() * FOLIAGE_COLORS.length);
        if (!foliageByColor[colorIdx]) foliageByColor[colorIdx] = [];

        const layers = large ? 3 : 2;
        for (let l = 0; l < layers; l++) {
            const radius = (large ? 2.5 : 1.5) - l * 0.4;
            const height = (large ? 2.5 : 1.8) - l * 0.3;
            pos.set(tree.x, trunkHeight + l * (height * 0.5) + height / 2, tree.z);
            scl.set(radius / 1.5, height / 1.8, radius / 1.5);
            m.compose(pos, quat, scl);
            foliageByColor[colorIdx].push(m.clone());
        }
    });

    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    scene.add(trunkMesh);

    // Build one InstancedMesh per foliage color
    const coneGeo = new THREE.ConeGeometry(1.5, 1.8, 6);
    for (const [colorIdx, transforms] of Object.entries(foliageByColor)) {
        const mat = foliageMats[parseInt(colorIdx)];
        const mesh = new THREE.InstancedMesh(coneGeo, mat, transforms.length);
        transforms.forEach((mtx, i) => mesh.setMatrixAt(i, mtx));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        scene.add(mesh);
    }
}

// ── Benches ──────────────────────────────────────────────────

function generateBenches(scene) {
    for (let i = 0; i < BENCH_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * CITY_SIZE * 0.8;
            z = (Math.random() - 0.5) * CITY_SIZE * 0.8;
            attempts++;
        } while (isInsideBuilding(x, z) && attempts < 20);

        if (attempts < 20) {
            createBench(scene, x, z, Math.random() * Math.PI * 2);
        }
    }
}

function createBench(scene, x, z, rotation) {
    const group = new THREE.Group();

    const seatGeo = new THREE.BoxGeometry(1.8, 0.1, 0.6);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.7;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(1.8, 0.6, 0.08);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 1.1, -0.25);
    back.rotation.x = -0.15;
    group.add(back);

    const legGeo = new THREE.BoxGeometry(0.08, 0.7, 0.5);
    [-0.7, 0.7].forEach(lx => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(lx, 0.35, 0);
        group.add(leg);
    });

    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    scene.add(group);
}

// ── Lamp Posts ────────────────────────────────────────────────
// Only MAX_ACTIVE_LIGHTS lamps get actual PointLights; the rest use emissive material only.

function generateLampPosts(scene) {
    let count = 0;
    const positions = [];

    for (let gx = -HALF_CITY; gx < HALF_CITY && count < LAMP_COUNT; gx += CELL_SIZE) {
        for (let gz = -HALF_CITY; gz < HALF_CITY && count < LAMP_COUNT; gz += CELL_SIZE) {
            if (Math.random() < 0.5) continue;
            positions.push({ x: gx + 2, z: gz + 2 });
            count++;
        }
    }

    // Sort by distance to origin so the closest lamps get real lights
    positions.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));

    positions.forEach((p, i) => {
        createLampPost(scene, p.x, p.z, i < MAX_ACTIVE_LIGHTS);
        lampPositions.push(p);
    });
}

function createLampPost(scene, x, z, hasLight) {
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.5, z);
    pole.castShadow = true;
    scene.add(pole);

    // Arm
    const armGeo = new THREE.BoxGeometry(1.2, 0.06, 0.06);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + 0.6, 4.8, z);
    scene.add(arm);

    // Lamp head (emissive glow — always visible)
    const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
    const lamp = new THREE.Mesh(lampGeo, lampGlowMat);
    lamp.position.set(x + 1.1, 4.65, z);
    scene.add(lamp);

    // Only a few lamps get actual PointLights (performance)
    if (hasLight) {
        const light = new THREE.PointLight(0xFFE082, 0.4, 15);
        light.position.set(x + 1.1, 4.5, z);
        scene.add(light);
    }
}

// ── Collision helper ─────────────────────────────────────────

/**
 * Check if a point is inside any building (with optional padding).
 * @param {number} x
 * @param {number} z
 * @param {number} [padding=1]
 * @returns {boolean}
 */
export function isInsideBuilding(x, z, padding = 1) {
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (x > b.x - b.width / 2 - padding && x < b.x + b.width / 2 + padding &&
            z > b.z - b.depth / 2 - padding && z < b.z + b.depth / 2 + padding) {
            return true;
        }
    }
    return false;
}
