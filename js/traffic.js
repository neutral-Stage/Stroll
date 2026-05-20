/**
 * traffic.js — Slow ambient traffic on street lanes
 * @module traffic
 */

import * as THREE from 'three';
import { CITY_SIZE, HALF_CITY, CELL_SIZE, STREET_WIDTH, TRAFFIC_CULL_DISTANCE } from './config.js';
import { getQuality } from './quality.js';

/** @type {Array<CarData>} */
const cars = [];

const MAX_CARS = 4;

const CAR_COLORS = [
    0xE53935, 0x1E88E5, 0x43A047, 0xFDD835,
    0xFF9800, 0x8E24AA, 0x00ACC1, 0x5D4037,
];

/** Frame-normalized speeds → ~1.2–2.2 u/s at 60fps */
const CAR_MIN_SPEED = 0.02;
const CAR_MAX_SPEED = 0.037;

const RESPAWN_DISTANCE = 140;
const RESPAWN_MIN_PLAYER_DIST = 55;

/**
 * @typedef {Object} CarData
 * @property {THREE.Group} mesh
 * @property {number} speed
 * @property {number} direction
 * @property {string} axis
 * @property {number} laneOffset
 * @property {boolean} culled
 */

const bodyGeo = new THREE.BoxGeometry(2.5, 0.8, 1.4);
const roofGeo = new THREE.BoxGeometry(1.4, 0.6, 1.2);
const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
const windowMat = new THREE.MeshLambertMaterial({ color: 0x1A237E, transparent: true, opacity: 0.7 });

export function createTraffic(scene) {
    for (let i = 0; i < MAX_CARS; i++) {
        spawnCar(scene);
    }
}

export function updateTraffic(delta, playerPos) {
    const cullDist = getQuality().trafficCullDistance || TRAFFIC_CULL_DISTANCE;

    cars.forEach((car) => {
        if (!car.mesh) return;

        const dx = car.mesh.position.x - playerPos.x;
        const dz = car.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > cullDist) {
            car.mesh.visible = false;
            car.culled = true;
            return;
        }

        car.mesh.visible = true;

        if (car.culled) {
            car.culled = false;
            respawnCar(car, playerPos);
            return;
        }

        const move = car.speed * car.direction * delta * 60;
        if (car.axis === 'x') {
            car.mesh.position.x += move;
        } else {
            car.mesh.position.z += move;
        }

        const outOfCity =
            Math.abs(car.mesh.position.x) > HALF_CITY + 20 ||
            Math.abs(car.mesh.position.z) > HALF_CITY + 20;

        if (dist > RESPAWN_DISTANCE || outOfCity) {
            respawnCar(car, playerPos, false);
        }
    });
}

function spawnCar(scene) {
    const car = createCarMesh();
    const data = getRandomStreetPosition();

    car.mesh.position.set(data.x, 0.5, data.z);
    car.mesh.rotation.y = data.rotation;
    car.speed = CAR_MIN_SPEED + Math.random() * (CAR_MAX_SPEED - CAR_MIN_SPEED);
    car.direction = data.direction;
    car.axis = data.axis;
    car.laneOffset = data.laneOffset;
    car.culled = false;

    scene.add(car.mesh);
    cars.push(car);
}

/**
 * @param {CarData} car
 * @param {{x: number, z: number}} playerPos
 * @param {boolean} fromCull
 */
function respawnCar(car, playerPos) {
    const data = getRandomStreetPosition(playerPos);

    car.mesh.position.set(data.x, 0.5, data.z);
    car.mesh.rotation.y = data.rotation;
    car.speed = CAR_MIN_SPEED + Math.random() * (CAR_MAX_SPEED - CAR_MIN_SPEED);
    car.direction = data.direction;
    car.axis = data.axis;
    car.laneOffset = data.laneOffset;

    const bodyMat = new THREE.MeshLambertMaterial({
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    });
    car.mesh.children[0].material = bodyMat;
}

/**
 * @param {{x: number, z: number}} [playerPos]
 * @param {boolean} [behindPlayer]
 */
function getRandomStreetPosition(playerPos) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const direction = Math.random() < 0.5 ? 1 : -1;
    const laneOffset = (STREET_WIDTH / 2 - 1.5) * (Math.random() < 0.5 ? 1 : -1);

    let x;
    let z;
    let rotation;

    if (playerPos) {
        const spawnDistance = RESPAWN_MIN_PLAYER_DIST + Math.random() * 25;

        if (axis === 'x') {
            z = Math.round(playerPos.z / CELL_SIZE) * CELL_SIZE + laneOffset;
            x = playerPos.x - direction * spawnDistance;
            rotation = direction > 0 ? 0 : Math.PI;
        } else {
            x = Math.round(playerPos.x / CELL_SIZE) * CELL_SIZE + laneOffset;
            z = playerPos.z - direction * spawnDistance;
            rotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }

        const pdx = x - playerPos.x;
        const pdz = z - playerPos.z;
        if (pdx * pdx + pdz * pdz < RESPAWN_MIN_PLAYER_DIST * RESPAWN_MIN_PLAYER_DIST) {
            const push = RESPAWN_MIN_PLAYER_DIST + 10;
            const len = Math.hypot(pdx, pdz) || 1;
            x = playerPos.x + (pdx / len) * push;
            z = playerPos.z + (pdz / len) * push;
        }
    } else if (axis === 'x') {
        x = (Math.random() - 0.5) * CITY_SIZE;
        z = Math.floor((Math.random() - 0.5) * CITY_SIZE / CELL_SIZE) * CELL_SIZE + laneOffset;
        rotation = direction > 0 ? 0 : Math.PI;
    } else {
        z = (Math.random() - 0.5) * CITY_SIZE;
        x = Math.floor((Math.random() - 0.5) * CITY_SIZE / CELL_SIZE) * CELL_SIZE + laneOffset;
        rotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    return { x, z, rotation, direction, axis, laneOffset };
}

function createCarMesh() {
    const group = new THREE.Group();

    const bodyColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(-0.2, 0.9, 0);
    roof.castShadow = true;
    group.add(roof);

    const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), windowMat);
    frontWindow.position.set(0.7, 0.9, 0);
    frontWindow.rotation.y = Math.PI / 2;
    group.add(frontWindow);

    const backWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), windowMat);
    backWindow.position.set(-1.1, 0.9, 0);
    backWindow.rotation.y = -Math.PI / 2;
    group.add(backWindow);

    [
        { x: 0.8, z: 0.7 },
        { x: 0.8, z: -0.7 },
        { x: -0.8, z: 0.7 },
        { x: -0.8, z: -0.7 },
    ].forEach((pos) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(pos.x, 0.25, pos.z);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
    });

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFE0 });
    const headlightGeo = new THREE.CircleGeometry(0.12, 8);

    [0.5, -0.5].forEach((zOffset) => {
        const headlight = new THREE.Mesh(headlightGeo, headlightMat);
        headlight.position.set(1.26, 0.4, zOffset);
        headlight.rotation.y = Math.PI / 2;
        group.add(headlight);
    });

    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    [0.5, -0.5].forEach((zOffset) => {
        const taillight = new THREE.Mesh(headlightGeo, taillightMat);
        taillight.position.set(-1.26, 0.4, zOffset);
        taillight.rotation.y = -Math.PI / 2;
        group.add(taillight);
    });

    return {
        mesh: group,
        speed: CAR_MIN_SPEED,
        direction: 1,
        axis: 'x',
        laneOffset: 0,
        culled: false,
    };
}
