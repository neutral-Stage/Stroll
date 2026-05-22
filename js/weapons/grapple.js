import * as THREE from 'three';
import { player } from '../controls.js';

let isGrappling = false;
let grappleTarget = null;
let lineMesh = null;
let sceneRef = null;

const raycaster = new THREE.Raycaster();

export function initGrapple(scene) {
    sceneRef = scene;
    
    const material = new THREE.LineBasicMaterial({
        color: 0x888888,
        linewidth: 3,
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ]);
    
    lineMesh = new THREE.Line(geometry, material);
    lineMesh.visible = false;
    scene.add(lineMesh);
}

export function fireGrapple(camera) {
    if (isGrappling) {
        stopGrapple();
        return;
    }

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, dir);
    raycaster.far = 150; // Max range

    const intersects = raycaster.intersectObjects(sceneRef.children, true);
    
    for (const hit of intersects) {
        if (hit.object.isMesh && hit.object.material && hit.object.geometry && !hit.object.material.transparent) {
            grappleTarget = hit.point.clone();
            isGrappling = true;
            lineMesh.visible = true;
            
            // Initial vertical boost to help unstick from ground
            player.vy = 10;
            return;
        }
    }
}

export function updateGrapple(delta, camera) {
    if (!isGrappling || !grappleTarget) return;

    const dx = grappleTarget.x - player.x;
    const dy = grappleTarget.y - (player.y + 1.5); // Target relative to player's center
    const dz = grappleTarget.z - player.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist < 4) {
        stopGrapple();
        return;
    }

    const pullSpeed = 45;
    const moveAmount = pullSpeed * delta;

    player.x += (dx / dist) * moveAmount;
    player.y += (dy / dist) * moveAmount;
    player.z += (dz / dist) * moveAmount;

    // Negate gravity while pulling
    player.vy = 0;

    // Update visual line
    const positions = lineMesh.geometry.attributes.position.array;
    // Start of line (slightly below and to the right of camera)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    const startPos = camera.position.clone().add(right.multiplyScalar(0.5)).add(down.multiplyScalar(0.3));

    positions[0] = startPos.x;
    positions[1] = startPos.y;
    positions[2] = startPos.z;
    positions[3] = grappleTarget.x;
    positions[4] = grappleTarget.y;
    positions[5] = grappleTarget.z;
    lineMesh.geometry.attributes.position.needsUpdate = true;
}

export function stopGrapple() {
    isGrappling = false;
    if (lineMesh) lineMesh.visible = false;
    player.vy = 8; // Small boost at the end of the swing
}

export function getIsGrappling() {
    return isGrappling;
}
