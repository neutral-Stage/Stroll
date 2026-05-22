import * as THREE from 'three';
import { getPlayerStats, addCash, addXP } from '../player/player.js';
import { showMissionText, showToast } from '../hud.js';
import { dist2D } from '../core/physics.js';
import { spawnEnemy } from '../enemies/enemy-manager.js';
import { getEntitiesByType } from '../core/entity-manager.js';

let sceneRef = null;
const questGivers = [];
let activeMission = null;
let nearbyGiver = null;

const MISSIONS = {
    HEIST: {
        id: 'HEIST',
        name: 'The Big Bank Job',
        giverName: 'Vinny',
        dialogue: "Hey kid, I need you to break into the bank downtown. Grab the cash and get out. It's heavily guarded.",
        startX: 30, startZ: -30,
        targetX: 80, targetZ: 80,
        reward: 5000,
        xpReward: 1000,
        setup: () => {
            // Spawn guards
            for(let i=0; i<5; i++) {
                spawnEnemy('swat', 80 + (Math.random()-0.5)*10, 80 + (Math.random()-0.5)*10);
            }
            showMissionText('Go to the Bank (Yellow Marker)', 5);
        },
        update: (playerPos) => {
            if (dist2D(playerPos.x, playerPos.z, 80, 80) < 5) {
                showMissionText('Grab the package and escape!', 5);
                completeMission();
            }
        }
    },
    ASSASSINATION: {
        id: 'ASSASSINATION',
        name: 'The Hit',
        giverName: 'The Cleaner',
        dialogue: "A rival gang boss is hiding out in the park. Make it look like an accident... or don't. Just get it done.",
        startX: -40, startZ: 20,
        targetX: 0, targetZ: 0,
        reward: 3000,
        xpReward: 800,
        bossId: null,
        setup: () => {
            const id = spawnEnemy('boss', 0, 0); // Spawn boss at park
            activeMission.bossId = id;
            showMissionText('Eliminate the Gang Boss in the Park', 5);
        },
        update: (playerPos) => {
            const enemies = getEntitiesByType('enemy');
            let bossAlive = false;
            for (const e of enemies) {
                if (e.data.boss) bossAlive = true;
            }
            if (!bossAlive) {
                completeMission();
            }
        }
    }
};

export function initStory(scene) {
    sceneRef = scene;

    createQuestGiver(MISSIONS.HEIST);
    createQuestGiver(MISSIONS.ASSASSINATION);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'e' || e.key === 'E') {
            handleInteraction();
        }
    });
}

function createQuestGiver(mission) {
    const group = new THREE.Group();

    // NPC Mesh
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9b59b6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.9;
    group.add(mesh);

    // Floating question mark or marker
    const markerGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.y = 2.5;
    group.add(marker);

    group.position.set(mission.startX, 0, mission.startZ);
    sceneRef.add(group);

    questGivers.push({
        mesh: group,
        marker: marker,
        mission: mission,
        x: mission.startX,
        z: mission.startZ
    });
}

export function updateStory(delta, elapsed, playerPos) {
    // Update active mission
    if (activeMission) {
        activeMission.update(playerPos);
    }

    // Check proximity to quest givers
    let closest = null;
    let minDist = Infinity;

    for (const qg of questGivers) {
        // Spin marker
        qg.marker.rotation.y += delta * 2;
        qg.marker.position.y = 2.5 + Math.sin(elapsed * 4) * 0.2;

        const dist = dist2D(playerPos.x, playerPos.z, qg.x, qg.z);
        if (dist < 3) {
            if (dist < minDist) {
                minDist = dist;
                closest = qg;
            }
        }
    }

    if (closest !== nearbyGiver) {
        nearbyGiver = closest;
        updateDialogueUI(nearbyGiver !== null);
    }
}

function updateDialogueUI(show) {
    let el = document.getElementById('dialogue-ui');
    if (!el) {
        el = document.createElement('div');
        el.id = 'dialogue-ui';
        document.body.appendChild(el);
    }

    if (!show) {
        el.style.display = 'none';
        return;
    }

    if (activeMission) {
        el.innerHTML = `<div style="color: #ffaa00; font-weight: bold;">${nearbyGiver.mission.giverName}</div>
                        <div style="margin-top:5px;">"You already got a job to do. Finish it first."</div>`;
    } else {
        el.innerHTML = `<div style="color: #ffaa00; font-weight: bold;">${nearbyGiver.mission.giverName}</div>
                        <div style="margin-top:5px;">"${nearbyGiver.mission.dialogue}"</div>
                        <div style="margin-top:10px; font-size:14px; color:#aaa;">Press E to Accept Mission: ${nearbyGiver.mission.name}</div>`;
    }

    el.style.display = 'block';
    el.style.position = 'absolute';
    el.style.bottom = '20%';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    el.style.color = '#fff';
    el.style.padding = '20px';
    el.style.borderRadius = '8px';
    el.style.borderLeft = '4px solid #ffaa00';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '16px';
    el.style.zIndex = '1000';
    el.style.width = '500px';
    el.style.textAlign = 'left';
}

function handleInteraction() {
    if (!nearbyGiver) return;
    if (activeMission) return;

    activeMission = nearbyGiver.mission;
    updateDialogueUI(false);
    activeMission.setup();
    showToast('Mission Accepted', activeMission.name, 'info');
}

function completeMission() {
    if (!activeMission) return;

    showMissionText('Mission Passed!', 5);
    addCash(activeMission.reward);
    addXP(activeMission.xpReward);
    showToast('Reward', `+$${activeMission.reward}  +${activeMission.xpReward} XP`, 'success');
    
    // Remove the quest giver (or mark as done)
    const qgIndex = questGivers.findIndex(q => q.mission === activeMission);
    if (qgIndex > -1) {
        const qg = questGivers[qgIndex];
        sceneRef.remove(qg.mesh);
        questGivers.splice(qgIndex, 1);
    }

    activeMission = null;
    nearbyGiver = null;
    updateDialogueUI(false);
}
