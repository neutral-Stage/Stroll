// @ts-check
/**
 * helicopter-system.js — Drivable helicopters with flight physics
 * @module vehicles/helicopter-system
 */

import * as THREE from 'three';
import { isInsideBuilding } from '../city.js';
import { dist2D } from '../core/physics.js';
import { showToast } from '../hud.js';
import { player } from '../controls.js';
import { getCamera } from '../camera/camera-controller.js';
import { damagePlayer } from '../player/player.js';

let sceneRef = null;
let cameraRef = null;

const activeHelis = [];
let drivingHeli = null;
let gunTimer = 0; // for police chopper firing

// Flight controls
const keys = { w: false, a: false, s: false, d: false, up: false, down: false, q: false, e: false };

export function initHelicopters(scene, camera) {
    sceneRef = scene;
    cameraRef = camera;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = true;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = true;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = true;
        if (e.key === 'q' || e.key === 'Q') keys.q = true;
        if (e.key === 'e' || e.key === 'E') keys.e = true;
        if (e.key === ' ') keys.up = true;
        if (e.key === 'Shift') keys.down = true;

        if (e.key === 'f' || e.key === 'F') {
            if (drivingHeli) {
                exitHeli();
            } else {
                tryEnterHeli();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') keys.w = false;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.s = false;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = false;
        if (e.key === 'q' || e.key === 'Q') keys.q = false;
        if (e.key === 'e' || e.key === 'E') keys.e = false;
        if (e.key === ' ') keys.up = false;
        if (e.key === 'Shift') keys.down = false;
    });
}

export function spawnHelicopter(x, y, z, colorHex = 0x222222) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    // Main Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 3.5), bodyMat);
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);

    // Cockpit Window
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1), windowMat);
    cockpit.position.set(0, 1.2, 1.5);
    group.add(cockpit);

    // Tail boom
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3), bodyMat);
    tail.position.set(0, 1.2, -3);
    tail.castShadow = true;
    group.add(tail);

    // Tail Fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.6), bodyMat);
    fin.position.set(0, 1.5, -4.2);
    group.add(fin);

    // Main Rotor Setup
    const mainRotorGroup = new THREE.Group();
    mainRotorGroup.position.set(0, 1.8, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4), metalMat);
    mast.position.y = 0.2;
    mainRotorGroup.add(mast);

    const bladeGeo = new THREE.BoxGeometry(6, 0.05, 0.4);
    const blade1 = new THREE.Mesh(bladeGeo, metalMat);
    blade1.position.y = 0.4;
    mainRotorGroup.add(blade1);
    const blade2 = new THREE.Mesh(bladeGeo, metalMat);
    blade2.position.y = 0.4;
    blade2.rotation.y = Math.PI / 2;
    mainRotorGroup.add(blade2);
    group.add(mainRotorGroup);

    // Tail Rotor
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.position.set(0.15, 1.6, -4.3);
    const tBladeGeo = new THREE.BoxGeometry(0.05, 1.5, 0.2);
    const tBlade1 = new THREE.Mesh(tBladeGeo, metalMat);
    tailRotorGroup.add(tBlade1);
    const tBlade2 = new THREE.Mesh(tBladeGeo, metalMat);
    tBlade2.rotation.x = Math.PI / 2;
    tailRotorGroup.add(tBlade2);
    group.add(tailRotorGroup);

    // Skids
    const skidGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.5);
    const skid1 = new THREE.Mesh(skidGeo, metalMat);
    skid1.rotation.x = Math.PI / 2;
    skid1.position.set(1, 0.1, 0);
    group.add(skid1);
    const skid2 = new THREE.Mesh(skidGeo, metalMat);
    skid2.rotation.x = Math.PI / 2;
    skid2.position.set(-1, 0.1, 0);
    group.add(skid2);

    const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 1);
    [-1, 1].forEach(zOffset => {
        const s1 = new THREE.Mesh(strutGeo, metalMat);
        s1.rotation.z = Math.PI / 4;
        s1.position.set(0.5, 0.5, zOffset);
        group.add(s1);

        const s2 = new THREE.Mesh(strutGeo, metalMat);
        s2.rotation.z = -Math.PI / 4;
        s2.position.set(-0.5, 0.5, zOffset);
        group.add(s2);
    });

    group.position.set(x, y, z);
    sceneRef.add(group);

    const heli = {
        mesh: group,
        mainRotor: mainRotorGroup,
        tailRotor: tailRotorGroup,
        engineRPM: 0,
        vy: 0,
        vx: 0,
        vz: 0,
        pitch: 0,
        roll: 0,
        yaw: 0,
        health: 2000,
        active: true,
        isPoliceChopper: false,
    };
    
    activeHelis.push(heli);
    return heli;
}

export function spawnPoliceChopper(x, z) {
    const heli = spawnHelicopter(x + (Math.random() - 0.5) * 100, 40, z + (Math.random() - 0.5) * 100, 0x000033);
    heli.isPoliceChopper = true;
    heli.engineRPM = 1.0;
    
    // Add a spotlight
    const spotLight = new THREE.SpotLight(0xffffff, 2, 80, Math.PI / 6, 0.5, 1);
    spotLight.position.set(0, -1, 0);
    spotLight.target.position.set(0, -40, 0);
    heli.mesh.add(spotLight);
    heli.mesh.add(spotLight.target);
    heli.spotLight = spotLight;
    
    return heli;
}

function tryEnterHeli() {
    let closest = null;
    let minDist = 5; 

    for (const h of activeHelis) {
        const dist = Math.sqrt(
            Math.pow(player.x - h.mesh.position.x, 2) +
            Math.pow(player.y - h.mesh.position.y, 2) +
            Math.pow(player.z - h.mesh.position.z, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            closest = h;
        }
    }

    if (closest) {
        drivingHeli = closest;
        // The camera should follow the heli
        player.x = closest.mesh.position.x;
        player.y = closest.mesh.position.y;
        player.z = closest.mesh.position.z;
        showToast('Helicopter', 'SPACE to ascend, SHIFT to descend, WASD to tilt, QE to yaw.', 'info');
    }
}

function exitHeli() {
    if (drivingHeli) {
        // Drop player out
        const rightX = Math.cos(drivingHeli.yaw - Math.PI/2);
        const rightZ = -Math.sin(drivingHeli.yaw - Math.PI/2);
        player.x = drivingHeli.mesh.position.x + rightX * 3;
        player.y = drivingHeli.mesh.position.y;
        player.z = drivingHeli.mesh.position.z + rightZ * 3;
        
        drivingHeli = null;
    }
}

export function isPlayerInHeli() {
    return drivingHeli !== null;
}

export function getPlayerHeli() {
    return drivingHeli;
}

export function updateHelicopters(delta, elapsed) {
    if (drivingHeli) {
        updateHeliPhysics(drivingHeli, delta, true);
        
        player.x = drivingHeli.mesh.position.x;
        player.y = drivingHeli.mesh.position.y;
        player.z = drivingHeli.mesh.position.z;
        
        if (cameraRef) {
            const camDist = 12;
            const camHeight = 4;
            
            const backwardX = -Math.sin(drivingHeli.yaw);
            const backwardZ = -Math.cos(drivingHeli.yaw);
            
            const targetCamX = drivingHeli.mesh.position.x + backwardX * camDist;
            const targetCamZ = drivingHeli.mesh.position.z + backwardZ * camDist;
            const targetCamY = drivingHeli.mesh.position.y + camHeight;
            
            cameraRef.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 5 * delta);
            cameraRef.lookAt(
                drivingHeli.mesh.position.x,
                drivingHeli.mesh.position.y + 1,
                drivingHeli.mesh.position.z
            );
        }
    }

    for (const h of activeHelis) {
        if (!h.active) continue;

        if (h !== drivingHeli) {
            if (h.isPoliceChopper) {
                updatePoliceChopperAI(h, delta);
            }
            updateHeliPhysics(h, delta, false);
        }
        
        // Spin rotors
        h.mainRotor.rotation.y -= h.engineRPM * delta * 20;
        h.tailRotor.rotation.x -= h.engineRPM * delta * 25;
    }
}

function updatePoliceChopperAI(h, delta) {
    // Basic AI to follow player
    const distToPlayerX = player.x - h.mesh.position.x;
    const distToPlayerZ = player.z - h.mesh.position.z;
    const dist = Math.sqrt(distToPlayerX ** 2 + distToPlayerZ ** 2);
    
    // Desired altitude = 25
    const altitudeDiff = 25 - h.mesh.position.y;
    
    h.engineRPM = 1.0; // keep engine running
    
    // Lift control
    if (altitudeDiff > 2) h.liftControl = 10;
    else if (altitudeDiff < -2) h.liftControl = -6;
    else h.liftControl = 0;
    
    // Steer towards player
    const angleToPlayer = Math.atan2(-distToPlayerZ, distToPlayerX);
    
    // Simplify yaw turning
    let yawDiff = angleToPlayer - h.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    
    h.yaw += yawDiff * delta;
    
    // Move towards player if far, stay back if close
    if (dist > 30) {
        h.pitchControl = -0.3; // pitch down to move forward
    } else if (dist < 15) {
        h.pitchControl = 0.2; // back up
    } else {
        h.pitchControl = 0;
    }
    
    // Spotlight look at player
    if (h.spotLight) {
        h.spotLight.target.position.set(player.x - h.mesh.position.x, player.y - h.mesh.position.y, player.z - h.mesh.position.z);
    }
    
    // Occasional firing (simplified)
    gunTimer -= delta;
    if (dist < 40 && gunTimer <= 0) {
        gunTimer = 0.5 + Math.random() * 0.5;
        damagePlayer(5, h.mesh.position.x, h.mesh.position.z, player.x, player.z, 0);
        showToast('Sniper', 'Chopper is firing at you!', 'danger');
    }
}

function updateHeliPhysics(h, delta, isDriven) {
    if (isDriven) {
        // Engine startup/spindown
        if (h.engineRPM < 1) h.engineRPM += delta * 0.2;
    } else {
        if (h.engineRPM > 0) h.engineRPM -= delta * 0.1;
        if (h.engineRPM < 0) h.engineRPM = 0;
    }

    // Input handling
    let lift = 0;
    let targetPitch = 0;
    let targetRoll = 0;
    let yawSpeed = 0;

    if (isDriven && h.engineRPM > 0.8) {
        if (keys.up) lift = 12;
        if (keys.down) lift = -8;
        
        if (keys.w) targetPitch = -0.4;
        if (keys.s) targetPitch = 0.4;
        if (keys.a) targetRoll = -0.4;
        if (keys.d) targetRoll = 0.4;

        if (keys.q) yawSpeed = 1.5;
        if (keys.e) yawSpeed = -1.5;
    } else if (h.isPoliceChopper) {
        lift = h.liftControl || 0;
        targetPitch = h.pitchControl || 0;
    }

    // Gravity & Lift
    const gravity = -9.8;
    h.vy += (gravity + lift * h.engineRPM) * delta;
    
    // Tilt interpolation
    h.pitch += (targetPitch - h.pitch) * delta * 2;
    h.roll += (targetRoll - h.roll) * delta * 2;
    h.yaw += yawSpeed * delta;

    // Movement derived from tilt
    const forwardSpeed = -h.pitch * 30 * h.engineRPM;
    const sideSpeed = h.roll * 30 * h.engineRPM;

    const moveX = Math.sin(h.yaw) * forwardSpeed + Math.cos(h.yaw) * sideSpeed;
    const moveZ = Math.cos(h.yaw) * forwardSpeed - Math.sin(h.yaw) * sideSpeed;

    h.vx += (moveX - h.vx) * delta;
    h.vz += (moveZ - h.vz) * delta;

    // Apply movement
    h.mesh.position.x += h.vx * delta;
    h.mesh.position.y += h.vy * delta;
    h.mesh.position.z += h.vz * delta;

    // Ground collision
    if (h.mesh.position.y < 0) {
        h.mesh.position.y = 0;
        if (h.vy < -5) {
            // Hard landing damage
            h.health += h.vy * 10;
        }
        h.vy = 0;
        h.vx *= 0.9;
        h.vz *= 0.9;
        h.pitch *= 0.9;
        h.roll *= 0.9;
    }

    // Building collision (simple raycast or bounding box)
    if (isInsideBuilding(h.mesh.position.x, h.mesh.position.z, 2)) {
        // Actually we need to check building height too, but for now just bump back
        h.vx = -h.vx * 0.5;
        h.vz = -h.vz * 0.5;
        h.health -= 50;
    }

    // Apply rotations
    h.mesh.rotation.order = 'YXZ';
    h.mesh.rotation.y = h.yaw;
    h.mesh.rotation.x = h.pitch;
    h.mesh.rotation.z = -h.roll;
}
