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

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    CITY_SIZE, BLOCK_SIZE, STREET_WIDTH, CELL_SIZE, HALF_CITY,
    PARK_EXCLUSION, BLOCK_SKIP_CHANCE,
    MIN_BUILDING_HEIGHT, BUILDING_HEIGHT_RANGE,
    WINDOW_SIZE, WINDOW_ASPECT, WINDOW_SPACING_Y, WINDOW_SPACING_X, WINDOW_SKIP_CHANCE,
    ROOFTOP_DETAIL_CHANCE,
    TREE_COUNT, BENCH_COUNT, LAMP_COUNT, MAX_ACTIVE_LIGHTS,
    BUILDING_COLORS, FOLIAGE_COLORS,
} from './config.js';
import { spawnColoredDebris, spawnSmoke } from './destruction/explosions.js';
import { reportDestroy } from './missions/mission-manager.js';

// ── Shared materials (created once, reused everywhere) ───────
// PBR materials. Standard responds to the env map + sun for real specular
// and depth; Lambert was flat and toy-like. Buildings vary roughness slightly
// so a row of them doesn't read as one identical surface.
const buildingMats = BUILDING_COLORS.map((c, i) => new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.72 + (i % 3) * 0.08,
    metalness: 0.05,
}));
// Windows are emissive "glass": they glow and drive the selective bloom pass.
const windowLitMat = new THREE.MeshStandardMaterial({
    color: 0x101015, emissive: 0xFFE082, emissiveIntensity: 1.15,
    roughness: 0.22, metalness: 0.0, transparent: true, opacity: 0.95,
});
const windowDimMat = new THREE.MeshStandardMaterial({
    color: 0x1d212a, emissive: 0x33405a, emissiveIntensity: 0.35,
    roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.85,
});
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xE8DEC8, roughness: 0.85, metalness: 0.02 }); // Warm light stone
const stoneMat = new THREE.MeshStandardMaterial({ color: 0xCBBEB4, roughness: 0.92, metalness: 0.02 }); // Light beige street
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1E90B8, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.72 }); // Reflective water
const woodMat = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.8, metalness: 0.0 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.4, metalness: 0.85 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.5, metalness: 0.6 });
const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xFFD27A, emissiveIntensity: 2.2 }); // bright glow → bloom
const trunkMat = new THREE.MeshStandardMaterial({ color: 0xC4A484, roughness: 0.9, metalness: 0.0 }); // Lighter palm trunk
const foliageMats = FOLIAGE_COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.0 }));
const rooftopMat = new THREE.MeshLambertMaterial({ color: 0xcccccc }); // Lighter rooftops
const parkGrassMat = new THREE.MeshLambertMaterial({ color: 0x81C784 }); // Brighter green
const pathMat = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // Sand/path color

const palmLeafGeo = new THREE.BoxGeometry(0.8, 0.1, 3.0); // Palm leaf shape
palmLeafGeo.translate(0, 0, 1.5); // Pivot at the end
const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 2, 5);

// Shared geometries
const windowGeo = new THREE.PlaneGeometry(WINDOW_SIZE, WINDOW_SIZE * WINDOW_ASPECT);

// Shared geometries for optimization
const sharedBuildingGeo = new THREE.BoxGeometry(1, 1, 1);

/** @type {Array<{x:number, z:number, width:number, depth:number, height:number}>} */
export const buildings = [];
export const trees = [];
export const benches = [];
export const lamps = [];

let sceneRef = null;

/** @type {Array<{x:number, z:number}>} */
export const lampPositions = [];

// ── Collect window transforms for InstancedMesh ──────────────
const windowTransforms = []; // { matrix: THREE.Matrix4, lit: boolean }

// ── Collect sidewalk geometries for merging ──────────────────
const sidewalkGeos = [];

/**
 * Generate the entire city: buildings, sidewalks, park, trees, benches, lamps.
 * Call once during init.
 * @param {THREE.Scene} scene
 * @param {function} onProgress - callback(percent) for loading screen
 */
export function generateCity(scene, onProgress) {
    sceneRef = scene;
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
    const mat = buildingMats[colorIdx];
    const mesh = new THREE.Mesh(sharedBuildingGeo, mat);
    mesh.scale.set(width, height, depth);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    buildings.push({ x, z, width, depth, height, mesh, intact: true, health: 1000, material: mat });

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

export function damageBuildingAtPoint(scene, x, y, z, radius, damage) {
    for (const b of buildings) {
        if (!b.intact) continue;
        const dist = Math.sqrt((b.x - x)**2 + (b.z - z)**2);
        const approxRadius = Math.max(b.width, b.depth) / 2;
        if (dist < radius + approxRadius && y < b.height) {
            b.health -= damage;
            if (b.health <= 0) {
                destroyBuilding(scene, b);
            }
        }
    }
}

const collapsingBuildings = [];

function destroyBuilding(scene, b) {
    b.intact = false;
    b.destroyed = true;
    reportDestroy();

    collapsingBuildings.push({
        mesh: b.mesh,
        x: b.x,
        z: b.z,
        y: b.mesh.position.y,
        height: b.height,
        targetY: -b.height - 2,
        speed: 15.0 + Math.random() * 5.0,
        scaleSpeed: 1.0,
        smokeTimer: 0
    });

    // Shatter into flying chunks at several heights so the whole structure
    // visibly breaks apart, plus dust — not just a sink.
    const tiers = Math.max(2, Math.round(b.height / 6));
    for (let t = 0; t < tiers; t++) {
        const hy = (b.height * (t + 0.5)) / tiers;
        spawnColoredDebris(b.x, hy, b.z, 'concrete', 12, 17);
    }
    spawnSmoke(b.x, b.height * 0.4, b.z, 6);
}

export function updateCity(delta) {
    for (let i = collapsingBuildings.length - 1; i >= 0; i--) {
        const cb = collapsingBuildings[i];
        cb.mesh.position.y -= cb.speed * delta;
        cb.mesh.scale.y -= cb.scaleSpeed * delta;

        cb.smokeTimer += delta;
        if (cb.smokeTimer > 0.1) {
            cb.smokeTimer = 0;
            spawnSmoke(cb.x + (Math.random() - 0.5) * 6, cb.mesh.position.y + cb.height * 0.5, cb.z + (Math.random() - 0.5) * 6, 2);
        }

        if (cb.mesh.scale.y <= 0.05 || cb.mesh.position.y <= cb.targetY) {
            sceneRef.remove(cb.mesh);
            cb.mesh.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                    else c.material.dispose();
                }
            });
            collapsingBuildings.splice(i, 1);
        }
    }
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
        createSingleTree(
            scene,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            true
        );
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

// ── Trees (Individual Meshes for Destruction) ───────────────

export function createSingleTree(scene, x, z, large = false) {
    const trunkHeight = (6 + Math.random() * 4) * (large ? 1.4 : 1.0);
    const trunkRadius = (0.15 + Math.random() * 0.05) * (large ? 1.3 : 1.0);
    const colorIdx = Math.floor(Math.random() * FOLIAGE_COLORS.length);

    const group = new THREE.Group();
    
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(trunkRadius / 0.15, trunkHeight / 2, trunkRadius / 0.15);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Palm leaves
    const numLeaves = 6 + Math.floor(Math.random() * 4);
    for (let l = 0; l < numLeaves; l++) {
        const leaf = new THREE.Mesh(palmLeafGeo, foliageMats[colorIdx]);
        leaf.position.y = trunkHeight - 0.2;
        leaf.rotation.y = (l / numLeaves) * Math.PI * 2;
        leaf.rotation.x = 0.4 + Math.random() * 0.2;
        leaf.castShadow = true;
        group.add(leaf);
    }

    group.position.set(x, 0, z);
    scene.add(group);
    trees.push({ x, z, mesh: group, health: 300, dead: false, type: 'tree' });
}

function generateTrees(scene) {
    for (let i = 0; i < TREE_COUNT; i++) {
        let x, z, attempts = 0;
        do {
            x = (Math.random() - 0.5) * CITY_SIZE;
            z = (Math.random() - 0.5) * CITY_SIZE;
            attempts++;
        } while (isInsideBuilding(x, z) && attempts < 20);

        if (attempts < 20) {
            createSingleTree(scene, x, z, false);
        }
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
    
    benches.push({ x, z, mesh: group, health: 100, dead: false, type: 'bench' });
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
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 2.5, 0);
    pole.castShadow = true;
    group.add(pole);

    // Arm
    const armGeo = new THREE.BoxGeometry(1.2, 0.06, 0.06);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(0.6, 4.8, 0);
    group.add(arm);

    // Lamp head (emissive glow — always visible)
    const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
    const lamp = new THREE.Mesh(lampGeo, lampGlowMat);
    lamp.position.set(1.1, 4.65, 0);
    group.add(lamp);

    // Only a few lamps get actual PointLights (performance)
    if (hasLight) {
        const light = new THREE.PointLight(0xFFE082, 0.25, 15);
        light.position.set(1.1, 4.5, 0);
        group.add(light);
        lampPointLights.push(light);
    }

    scene.add(group);

    lamps.push({ x, z, mesh: group, health: 150, dead: false, type: 'lamp' });
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
        if (!b.intact || b.destroyed) continue;
        if (x > b.x - b.width / 2 - padding && x < b.x + b.width / 2 + padding &&
            z > b.z - b.depth / 2 - padding && z < b.z + b.depth / 2 + padding) {
            return true;
        }
    }
    return false;
}

/**
 * Is (x,z) on a street? Streets run along x = n·CELL_SIZE and z = n·CELL_SIZE
 * (the same grid the traffic uses).
 * @param {number} x @param {number} z @param {number} [margin]
 */
export function isOnRoad(x, z, margin = 0) {
    const dx = Math.abs(x - Math.round(x / CELL_SIZE) * CELL_SIZE);
    const dz = Math.abs(z - Math.round(z / CELL_SIZE) * CELL_SIZE);
    const half = STREET_WIDTH / 2 + margin;
    return dx <= half || dz <= half;
}

/** Snap a point onto the nearest road, returning {x, z, axis}. */
export function snapToRoad(x, z) {
    const nx = Math.round(x / CELL_SIZE) * CELL_SIZE;
    const nz = Math.round(z / CELL_SIZE) * CELL_SIZE;
    // Whichever centerline is closer wins; keep the other coordinate free.
    if (Math.abs(x - nx) <= Math.abs(z - nz)) {
        return { x: nx, z, axis: 'x' }; // vertical road (varies along z)
    }
    return { x, z: nz, axis: 'z' };     // horizontal road (varies along x)
}

/**
 * A spawn on a sidewalk beside a road, a couple of blocks out from the central
 * park, never inside a building. Faces the road so traffic is in view.
 * @returns {{x:number, z:number, yaw:number}}
 */
export function getPlayerSpawn() {
    const half = STREET_WIDTH / 2;
    for (let ring = 2; ring <= 6; ring++) {
        const line = ring * CELL_SIZE; // a vertical street centerline
        for (const along of [0, CELL_SIZE, -CELL_SIZE, 2 * CELL_SIZE, -2 * CELL_SIZE]) {
            const cx = line - half - 2; // just inside the block, beside the road
            const cz = along + half + 2;
            if (!isInsideBuilding(cx, cz, 1)) {
                return { x: cx, z: cz, yaw: -Math.PI / 2 }; // look toward the road (+x)
            }
        }
    }
    return { x: 2 * CELL_SIZE - half - 2, z: half + 2, yaw: -Math.PI / 2 };
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} [padding=0]
 */
export function isBlockedByTree(x, z, padding = 0) {
    for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        if (t.dead) continue;
        const r = 1.1 + padding;
        const dx = x - t.x;
        const dz = z - t.z;
        if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
}

/** @type {THREE.PointLight[]} */
const lampPointLights = [];

/**
 * Adjust street and window lighting for time of day.
 * @param {number} nightAmount 0..1
 */
export function updateCityLighting(nightAmount) {
    const warm = 0xFFE082;
    const cool = 0xFFE8CC;
    const n = Math.max(0, Math.min(1, nightAmount));
    const t = Math.max(0, (n - 0.2) / 0.8);

    lampGlowMat.color.setHex(lerpHex(cool, warm, t));
    windowLitMat.color.setHex(lerpHex(0xFFF3D0, 0xFFE082, t));
    windowLitMat.opacity = 0.35 + t * 0.55;
    windowDimMat.opacity = 0.15 + t * 0.1;

    const lightIntensity = 0.08 + t * 0.45;
    for (const light of lampPointLights) {
        light.intensity = lightIntensity;
    }
}

function lerpHex(hex1, hex2, t) {
    const r1 = (hex1 >> 16) & 255;
    const g1 = (hex1 >> 8) & 255;
    const b1 = hex1 & 255;
    const r2 = (hex2 >> 16) & 255;
    const g2 = (hex2 >> 8) & 255;
    const b2 = hex2 & 255;
    const r = r1 + (r2 - r1) * t;
    const g = g1 + (g2 - g1) * t;
    const b = b1 + (b2 - b1) * t;
    return (r << 16) | (g << 8) | b;
}

/**
 * Apply damage to static props and buildings.
 */
export function damagePropsAtPoint(x, z, radius, damage, spawnDebrisCallback) {
    if (!sceneRef) return;
    const rSq = radius * radius;
    
    const processArray = (arr) => {
        for (let i = 0; i < arr.length; i++) {
            const p = arr[i];
            if (p.dead || !p.mesh) continue;
            const dx = p.x - x;
            const dz = p.z - z;
            if (dx * dx + dz * dz < rSq) {
                p.health -= damage;
                if (p.health <= 0) {
                    p.dead = true;
                    reportDestroy();
                    sceneRef.remove(p.mesh);
                    if (spawnDebrisCallback) spawnDebrisCallback(p.x, 0, p.z, p.type);
                }
            }
        }
    };
    processArray(trees);
    processArray(benches);
    processArray(lamps);

    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (!b.intact || b.destroyed) continue;
        const dx = b.x - x;
        const dz = b.z - z;
        if (Math.abs(dx) < b.width/2 + radius && Math.abs(dz) < b.depth/2 + radius) {
            b.health -= damage;
            if (b.health <= 0) {
                destroyBuilding(sceneRef, b);
                if (spawnDebrisCallback) spawnDebrisCallback(b.x, b.height/2, b.z, 'building', b.width, b.height, b.depth);
            }
        }
    }
}
