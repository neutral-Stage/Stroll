// @ts-check
/**
 * vehicle-system.js — Drivable vehicles with arcade physics
 * @module vehicles/vehicle-system
 */

import * as THREE from 'three';
import { isInsideBuilding, isBlockedByTree } from '../city.js';
import { dist2D } from '../core/physics.js';
import { showToast } from '../hud.js';
import { player } from '../controls.js';
import { getCamera, addCameraShake } from '../camera/camera-controller.js';
import { createExplosion } from '../destruction/explosions.js';

let sceneRef = null;
let cameraRef = null;

const activeVehicles = [];
let drivingVehicle = null;

const keys = { w: false, a: false, s: false, d: false };

// Reuse traffic geometry for our drivable cars
const bodyGeo = new THREE.BoxGeometry(2.5, 0.8, 1.4);
const roofGeo = new THREE.BoxGeometry(1.4, 0.6, 1.2);
const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
const windowMat = new THREE.MeshLambertMaterial({ color: 0x1A237E, transparent: true, opacity: 0.7 });

export function initVehicles(scene, camera) {
    sceneRef = scene;
    cameraRef = camera;

    // Track input
    document.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = true;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = true;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = true;

        // Enter/Exit vehicle
        if (e.key === 'f' || e.key === 'F') {
            if (drivingVehicle) {
                exitVehicle();
            } else {
                tryEnterVehicle();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = false;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = false;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = false;
    });
}

export function spawnVehicle(x, z, colorHex = 0xE53935) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
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

    const wheels = [];
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
        wheels.push(wheel);
    });

    group.position.set(x, 0, z);
    sceneRef.add(group);

    const vehicle = {
        mesh: group,
        wheels,
        speed: 0,
        maxSpeed: 25,
        acceleration: 15,
        friction: 5,
        turnSpeed: 1.5,
        health: 1000
    };
    
    activeVehicles.push(vehicle);
    return vehicle;
}

function tryEnterVehicle() {
    let closest = null;
    let minDist = 4; // Enter radius

    for (const v of activeVehicles) {
        const dist = dist2D(player.x, player.z, v.mesh.position.x, v.mesh.position.z);
        if (dist < minDist) {
            minDist = dist;
            closest = v;
        }
    }

    if (closest) {
        drivingVehicle = closest;
        // Lock player position to vehicle
        player.x = closest.mesh.position.x;
        player.z = closest.mesh.position.z;
        showToast('Vehicle', 'Press F to exit', 'info');
    }
}

function exitVehicle() {
    if (drivingVehicle) {
        // Eject player slightly to the side
        const rightX = Math.cos(drivingVehicle.mesh.rotation.y - Math.PI/2);
        const rightZ = -Math.sin(drivingVehicle.mesh.rotation.y - Math.PI/2);
        player.x += rightX * 2.5;
        player.z += rightZ * 2.5;
        
        drivingVehicle = null;
    }
}

export function isPlayerDriving() {
    return drivingVehicle !== null;
}

export function getPlayerVehicle() {
    return drivingVehicle;
}

export function updateVehicles(delta, elapsed) {
    if (drivingVehicle) {
        updateDrivingPhysics(drivingVehicle, delta);
        
        // Sync player to vehicle
        player.x = drivingVehicle.mesh.position.x;
        player.z = drivingVehicle.mesh.position.z;
        
        // Sync camera (simple follow camera logic)
        if (cameraRef) {
            const camDist = 7;
            const camHeight = 3;
            
            const backwardX = -Math.cos(drivingVehicle.mesh.rotation.y);
            const backwardZ = Math.sin(drivingVehicle.mesh.rotation.y);
            
            const targetCamX = drivingVehicle.mesh.position.x + backwardX * camDist;
            const targetCamZ = drivingVehicle.mesh.position.z + backwardZ * camDist;
            const targetCamY = drivingVehicle.mesh.position.y + camHeight;
            
            // Lerp camera position
            cameraRef.position.x += (targetCamX - cameraRef.position.x) * 5 * delta;
            cameraRef.position.y += (targetCamY - cameraRef.position.y) * 5 * delta;
            cameraRef.position.z += (targetCamZ - cameraRef.position.z) * 5 * delta;
            
            // Look at vehicle
            cameraRef.lookAt(
                drivingVehicle.mesh.position.x,
                drivingVehicle.mesh.position.y + 1,
                drivingVehicle.mesh.position.z
            );
        }
    }

    // Process all vehicles for movement decay or AI
    for (const v of activeVehicles) {
        if (v !== drivingVehicle && Math.abs(v.speed) > 0.1) {
            // Friction slowdown
            v.speed -= Math.sign(v.speed) * v.friction * delta;
            if (Math.abs(v.speed) < 0.1) v.speed = 0;
            applyVehicleVelocity(v, delta);
        }
        
        // Wheel rotation
        if (Math.abs(v.speed) > 0.1) {
            for (const wheel of v.wheels) {
                wheel.rotation.z -= v.speed * delta * 2;
            }
        }
    }
}

function updateDrivingPhysics(v, delta) {
    // Accelerate / Brake
    if (keys.w) {
        v.speed += v.acceleration * delta;
    } else if (keys.s) {
        v.speed -= v.acceleration * delta;
    } else {
        // Friction
        v.speed -= Math.sign(v.speed) * v.friction * delta;
        if (Math.abs(v.speed) < 0.1) v.speed = 0;
    }

    // Clamp speed
    v.speed = Math.max(-v.maxSpeed / 2, Math.min(v.maxSpeed, v.speed));

    // Steering (only if moving)
    if (Math.abs(v.speed) > 0.5) {
        const turnDir = v.speed > 0 ? 1 : -1;
        if (keys.a) v.mesh.rotation.y += v.turnSpeed * turnDir * delta;
        if (keys.d) v.mesh.rotation.y -= v.turnSpeed * turnDir * delta;
    }

    applyVehicleVelocity(v, delta);
}

function applyVehicleVelocity(v, delta) {
    const moveX = Math.cos(v.mesh.rotation.y) * v.speed * delta;
    const moveZ = -Math.sin(v.mesh.rotation.y) * v.speed * delta; // -sin because of THREE.js coords

    const nextX = v.mesh.position.x + moveX;
    const nextZ = v.mesh.position.z + moveZ;

    // Very simple collision check
    if (!isInsideBuilding(nextX, nextZ, 2)) {
        v.mesh.position.x = nextX;
        v.mesh.position.z = nextZ;
    } else {
        // Hit a building
        v.speed = -v.speed * 0.3; // Bounce back slightly
        // Add camera shake if driving and fast
        if (v === drivingVehicle && Math.abs(v.speed) > 5) {
            addCameraShake(0.1, 0.3);
            v.health -= Math.abs(v.speed) * 2; // Damage on impact
            checkVehicleDeath(v);
        }
    }
}

function checkVehicleDeath(v) {
    if (v.health <= 0) {
        const px = v.mesh.position.x;
        const py = v.mesh.position.y;
        const pz = v.mesh.position.z;
        
        if (v === drivingVehicle) {
            exitVehicle();
            // Just apply an arbitrary 50 damage and let it shake
            addCameraShake(0.5, 0.5);
            // Assuming player takes massive damage if inside exploding car
        }
        
        const idx = activeVehicles.indexOf(v);
        if (idx > -1) {
            sceneRef.remove(v.mesh);
            v.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
            activeVehicles.splice(idx, 1);
            
            // Explode slightly after to avoid deep recursion if many vehicles
            setTimeout(() => {
                createExplosion(px, py, pz, 8, 200);
            }, 50);
        }
    }
}

export function damageVehicleAtPoint(x, z, radius, damage) {
    let destroyed = 0;
    for (let i = activeVehicles.length - 1; i >= 0; i--) {
        const v = activeVehicles[i];
        const dist = dist2D(v.mesh.position.x, v.mesh.position.z, x, z);
        if (dist <= radius + 2) {
            v.health -= damage;
            if (v.health <= 0) {
                checkVehicleDeath(v);
                destroyed++;
            }
        }
    }
    return destroyed;
}
