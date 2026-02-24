/**
 * traffic.js — Traffic manager for cars driving on city roads
 *
 * Creates and manages a small pool of cars that drive along street lanes.
 * Cars respawn when they go off-screen for a continuous traffic ambiance.
 *
 * @module traffic
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CITY_SIZE, HALF_CITY, CELL_SIZE, STREET_WIDTH, BLOCK_SIZE } from './config.js';

/** @type {Array<CarData>} */
const cars = [];

/** Maximum number of cars active at once */
const MAX_CARS = 4;

/** Car colors for variety */
const CAR_COLORS = [
    0xE53935, // Red
    0x1E88E5, // Blue
    0x43A047, // Green
    0xFDD835, // Yellow
    0xFF9800, // Orange
    0x8E24AA, // Purple
    0x00ACC1, // Cyan
    0x5D4037  // Brown
];

/** Car speed range */
const CAR_MIN_SPEED = 0.08;
const CAR_MAX_SPEED = 0.15;

/** Distance from player before car respawns */
const RESPAWN_DISTANCE = 120;

/**
 * @typedef {Object} CarData
 * @property {THREE.Group} mesh
 * @property {number} speed
 * @property {number} direction - 1 or -1 (driving direction)
 * @property {string} axis - 'x' or 'z' (which axis the car moves along)
 * @property {number} laneOffset - offset from center of street
 */

// Shared geometries (reused across all cars)
const bodyGeo = new THREE.BoxGeometry(2.5, 0.8, 1.4);
const roofGeo = new THREE.BoxGeometry(1.4, 0.6, 1.2);
const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8);

// Shared materials
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
const windowMat = new THREE.MeshLambertMaterial({ color: 0x1A237E, transparent: true, opacity: 0.7 });

/**
 * Create the traffic system and spawn initial cars.
 * @param {THREE.Scene} scene
 */
export function createTraffic(scene) {
    for (let i = 0; i < MAX_CARS; i++) {
        spawnCar(scene);
    }
}

/**
 * Update all cars each frame.
 * @param {number} delta - time since last frame
 * @param {{x: number, z: number}} playerPos - player position for culling
 */
export function updateTraffic(delta, playerPos) {
    cars.forEach(car => {
        if (!car.mesh) return;

        // Move car along its axis
        if (car.axis === 'x') {
            car.mesh.position.x += car.speed * car.direction * delta * 60;
        } else {
            car.mesh.position.z += car.speed * car.direction * delta * 60;
        }

        // Check if car is too far from player or out of city bounds
        const dx = car.mesh.position.x - playerPos.x;
        const dz = car.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > RESPAWN_DISTANCE || 
            Math.abs(car.mesh.position.x) > HALF_CITY + 20 ||
            Math.abs(car.mesh.position.z) > HALF_CITY + 20) {
            respawnCar(car, playerPos);
        }
    });
}

/**
 * Spawn a new car at a random street position.
 * @param {THREE.Scene} scene
 */
function spawnCar(scene) {
    const car = createCarMesh();
    const data = getRandomStreetPosition();
    
    car.mesh.position.set(data.x, 0.5, data.z);
    car.mesh.rotation.y = data.rotation;
    car.speed = CAR_MIN_SPEED + Math.random() * (CAR_MAX_SPEED - CAR_MIN_SPEED);
    car.direction = data.direction;
    car.axis = data.axis;
    car.laneOffset = data.laneOffset;

    scene.add(car.mesh);
    cars.push(car);
}

/**
 * Respawn an existing car at a new position near the player.
 * @param {CarData} car
 * @param {{x: number, z: number}} playerPos
 */
function respawnCar(car, playerPos) {
    const data = getRandomStreetPosition(playerPos);
    
    car.mesh.position.set(data.x, 0.5, data.z);
    car.mesh.rotation.y = data.rotation;
    car.speed = CAR_MIN_SPEED + Math.random() * (CAR_MAX_SPEED - CAR_MIN_SPEED);
    car.direction = data.direction;
    car.axis = data.axis;
    car.laneOffset = data.laneOffset;

    // Randomize color on respawn
    const bodyMat = new THREE.MeshLambertMaterial({ 
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] 
    });
    car.mesh.children[0].material = bodyMat;
}

/**
 * Get a random position on a street, optionally near the player.
 * @param {{x: number, z: number}} [playerPos]
 * @returns {{x: number, z: number, rotation: number, direction: number, axis: string, laneOffset: number}}
 */
function getRandomStreetPosition(playerPos) {
    // Choose a random street (grid-aligned)
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const direction = Math.random() < 0.5 ? 1 : -1;
    
    // Lane offset from center of street (half the street width, minus a margin)
    const laneOffset = (STREET_WIDTH / 2 - 1.5) * (Math.random() < 0.5 ? 1 : -1);
    
    let x, z, rotation;
    
    if (playerPos) {
        // Spawn near player but outside view
        const spawnDistance = RESPAWN_DISTANCE * 0.8;
        const angle = Math.random() * Math.PI * 2;
        
        if (axis === 'x') {
            // Car moves along X axis
            x = playerPos.x + Math.cos(angle) * spawnDistance;
            // Snap to nearest street Z
            z = Math.round(playerPos.z / CELL_SIZE) * CELL_SIZE + laneOffset;
            rotation = direction > 0 ? 0 : Math.PI;
        } else {
            // Car moves along Z axis
            z = playerPos.z + Math.sin(angle) * spawnDistance;
            // Snap to nearest street X
            x = Math.round(playerPos.x / CELL_SIZE) * CELL_SIZE + laneOffset;
            rotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
    } else {
        // Initial spawn - anywhere in the city
        if (axis === 'x') {
            x = (Math.random() - 0.5) * CITY_SIZE;
            z = Math.floor((Math.random() - 0.5) * CITY_SIZE / CELL_SIZE) * CELL_SIZE + laneOffset;
            rotation = direction > 0 ? 0 : Math.PI;
        } else {
            z = (Math.random() - 0.5) * CITY_SIZE;
            x = Math.floor((Math.random() - 0.5) * CITY_SIZE / CELL_SIZE) * CELL_SIZE + laneOffset;
            rotation = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
    }
    
    return { x, z, rotation, direction, axis, laneOffset };
}

/**
 * Create a car mesh with body, roof, wheels, and windows.
 * @returns {CarData}
 */
function createCarMesh() {
    const group = new THREE.Group();
    
    // Car body
    const bodyColor = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);
    
    // Roof
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(-0.2, 0.9, 0);
    roof.castShadow = true;
    group.add(roof);
    
    // Windows
    const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), windowMat);
    frontWindow.position.set(0.7, 0.9, 0);
    frontWindow.rotation.y = Math.PI / 2;
    group.add(frontWindow);
    
    const backWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), windowMat);
    backWindow.position.set(-1.1, 0.9, 0);
    backWindow.rotation.y = -Math.PI / 2;
    group.add(backWindow);
    
    // Wheels
    const wheelPositions = [
        { x: 0.8, z: 0.7 },
        { x: 0.8, z: -0.7 },
        { x: -0.8, z: 0.7 },
        { x: -0.8, z: -0.7 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(pos.x, 0.25, pos.z);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
    });
    
    // Headlights
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFE0 });
    const headlightGeo = new THREE.CircleGeometry(0.12, 8);
    
    [0.5, -0.5].forEach(zOffset => {
        const headlight = new THREE.Mesh(headlightGeo, headlightMat);
        headlight.position.set(1.26, 0.4, zOffset);
        headlight.rotation.y = Math.PI / 2;
        group.add(headlight);
    });
    
    // Taillights
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    
    [0.5, -0.5].forEach(zOffset => {
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
        laneOffset: 0
    };
}
