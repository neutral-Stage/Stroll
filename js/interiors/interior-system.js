import * as THREE from 'three';
import { player } from '../controls.js';
import { getCamera } from '../camera/camera-controller.js';
import { dist2D } from '../core/physics.js';
import { showToast } from '../hud.js';

let sceneRef = null;
const doors = [];
let nearbyDoor = null;
let insideInterior = false;
let savedOutsidePos = { x: 0, y: 0, z: 0 };
let interiorGroup = null;

export function initInteriors(scene) {
    sceneRef = scene;

    // Create a few interior doors around the city
    createDoor(10, 0, 10, 'Bank', 0x3498db);
    createDoor(-20, 0, 20, 'Warehouse', 0xe67e22);
    createDoor(40, 0, -30, 'Police Station', 0x34495e);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'e' || e.key === 'E') {
            handleDoorInteraction();
        }
    });
}

function createDoor(x, y, z, name, colorHex) {
    const group = new THREE.Group();

    // Door frame
    const frameGeo = new THREE.BoxGeometry(1.4, 2.2, 0.2);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.1;
    group.add(frame);

    // Door glow marker
    const markerGeo = new THREE.PlaneGeometry(1.2, 2.0);
    const markerMat = new THREE.MeshBasicMaterial({ 
        color: colorHex, 
        transparent: true, 
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.y = 1.1;
    marker.position.z = 0.11;
    group.add(marker);

    group.position.set(x, y, z);
    sceneRef.add(group);

    doors.push({
        mesh: group,
        marker: marker,
        x: x,
        y: y,
        z: z,
        name: name,
        colorHex: colorHex
    });
}

export function updateInteriors(delta, elapsed, playerPos) {
    let closest = null;
    let minDist = Infinity;

    // If inside, we only check the exit door
    if (insideInterior) {
        // Exit door is always placed at (0, -100, -10) relative to the interior center
        // Let's just say if player approaches (0, -100, -9) they can exit
        const distToExit = dist2D(playerPos.x, playerPos.z, 0, -9);
        if (distToExit < 3) {
            nearbyDoor = { name: 'Exit', isExit: true };
            updateDoorUI(true);
        } else {
            nearbyDoor = null;
            updateDoorUI(false);
        }
        return;
    }

    for (const door of doors) {
        const dist = dist2D(playerPos.x, playerPos.z, door.x, door.z);
        if (dist < 2.5) {
            if (dist < minDist) {
                minDist = dist;
                closest = door;
            }
        }
        
        // Pulse marker
        door.marker.material.opacity = 0.5 + Math.sin(elapsed * 5) * 0.2;
    }

    if (closest !== nearbyDoor) {
        nearbyDoor = closest;
        updateDoorUI(nearbyDoor !== null);
    }
}

function updateDoorUI(show) {
    let el = document.getElementById('door-ui');
    if (!el) {
        el = document.createElement('div');
        el.id = 'door-ui';
        document.body.appendChild(el);
    }

    if (!show) {
        el.style.display = 'none';
        return;
    }

    el.style.display = 'block';
    el.style.position = 'absolute';
    el.style.bottom = '20%';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    el.style.color = '#fff';
    el.style.padding = '15px 25px';
    el.style.borderRadius = '8px';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '18px';
    el.style.zIndex = '1000';
    el.style.textAlign = 'center';

    if (nearbyDoor.isExit) {
        el.innerHTML = `<div>🚪 Exit Interior</div><div style="font-size:14px; margin-top:5px; color:#aaa;">Press E to leave</div>`;
    } else {
        el.innerHTML = `<div>🚪 ${nearbyDoor.name}</div><div style="font-size:14px; margin-top:5px; color:#aaa;">Press E to enter</div>`;
    }
}

function handleDoorInteraction() {
    if (!nearbyDoor) return;

    if (nearbyDoor.isExit) {
        // Exit
        player.x = savedOutsidePos.x;
        player.y = savedOutsidePos.y;
        player.z = savedOutsidePos.z;
        insideInterior = false;
        
        if (interiorGroup) {
            sceneRef.remove(interiorGroup);
            // Deep dispose could go here
        }
        showToast('Exit', 'Returned to city', 'info');
    } else {
        // Enter
        savedOutsidePos.x = player.x;
        savedOutsidePos.y = player.y;
        savedOutsidePos.z = player.z;
        
        // Teleport to underground
        player.x = 0;
        player.y = -100;
        player.z = 0;
        insideInterior = true;
        
        generateInterior(nearbyDoor.name, nearbyDoor.colorHex);
        showToast('Entered', nearbyDoor.name, 'info');
    }
    
    nearbyDoor = null;
    updateDoorUI(false);
}

function generateInterior(name, colorHex) {
    if (interiorGroup) sceneRef.remove(interiorGroup);
    interiorGroup = new THREE.Group();
    interiorGroup.position.set(0, -100, 0);

    // Simple room layout
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    interiorGroup.add(floor);
    
    // Ceiling
    const ceiling = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    interiorGroup.add(ceiling);

    // Walls
    const wallGeo = new THREE.BoxGeometry(30, 4, 1);
    const wallMat = new THREE.MeshLambertMaterial({ color: colorHex });
    
    const wallN = new THREE.Mesh(wallGeo, wallMat);
    wallN.position.set(0, 2, -15);
    interiorGroup.add(wallN);
    
    const wallS = new THREE.Mesh(wallGeo, wallMat);
    wallS.position.set(0, 2, 15);
    interiorGroup.add(wallS);
    
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 30), wallMat);
    wallE.position.set(15, 2, 0);
    interiorGroup.add(wallE);
    
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 30), wallMat);
    wallW.position.set(-15, 2, 0);
    interiorGroup.add(wallW);
    
    // Exit door marker
    const exitMarkerGeo = new THREE.BoxGeometry(1.4, 2.2, 0.2);
    const exitMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent:true, opacity: 0.5 });
    const exitMarker = new THREE.Mesh(exitMarkerGeo, exitMarkerMat);
    exitMarker.position.set(0, 1.1, -14.8);
    interiorGroup.add(exitMarker);
    
    // Some props
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.5), new THREE.MeshLambertMaterial({color: 0x8B4513}));
    desk.position.set(0, 0.5, 0);
    interiorGroup.add(desk);
    
    // Interior Lighting
    const light = new THREE.PointLight(0xffffff, 1, 25);
    light.position.set(0, 3, 0);
    interiorGroup.add(light);
    
    sceneRef.add(interiorGroup);
}
