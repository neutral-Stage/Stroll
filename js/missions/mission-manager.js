// @ts-check
/**
 * mission-manager.js — Handles story missions, objectives, and rewards
 * @module missions/mission-manager
 */

import { showMissionText, showToast } from '../hud.js';
import { addXP, addCash } from '../player/player.js';
import { dist2D } from '../core/physics.js';
import { getWantedLevel } from '../systems/wanted.js';

const MISSIONS = [
    {
        id: 'mission_1',
        title: 'Welcome to Stroll',
        description: 'Get a feel for the city. Head to the park.',
        objectives: [
            { type: 'goto', x: 0, z: -50, radius: 10, text: 'Go to the park north of here' }
        ],
        reward: { xp: 50, cash: 100 }
    },
    {
        id: 'mission_2',
        title: 'Trouble in Paradise',
        description: 'Some thugs are hanging around. Take them out.',
        objectives: [
            { type: 'kill', count: 3, current: 0, text: 'Eliminate 3 enemies' }
        ],
        reward: { xp: 200, cash: 500 }
    },
    {
        id: 'mission_3',
        title: 'Heat',
        description: 'You\'ve attracted attention. Survive and lose the heat.',
        objectives: [
            { type: 'wanted', level: 1, text: 'Get a wanted level by causing chaos' },
            { type: 'clear_wanted', text: 'Hide from police and lose your wanted level' }
        ],
        reward: { xp: 500, cash: 1000 }
    },
    {
        id: 'mission_4',
        title: 'The Boss',
        description: 'Take down the local gang leader.',
        objectives: [
            { type: 'goto', x: 100, z: 100, radius: 15, text: 'Find the gang hideout in the East District' },
            { type: 'kill_boss', count: 1, current: 0, text: 'Defeat the Boss' } // Spawns a boss when reaching the area
        ],
        reward: { xp: 1000, cash: 5000 }
    }
];

let currentMissionIndex = -1;
let currentObjectiveIndex = 0;
let isMissionActive = false;
let missionCooldown = 5; // Start first mission after 5 seconds

/**
 * Start a specific mission by index
 */
export function startMission(index) {
    if (index >= MISSIONS.length) {
        showMissionText('All missions completed. Free roam activated.', 5);
        isMissionActive = false;
        return;
    }
    
    currentMissionIndex = index;
    currentObjectiveIndex = 0;
    isMissionActive = true;
    
    const m = MISSIONS[currentMissionIndex];
    
    // Reset objective progress
    for (const obj of m.objectives) {
        if (typeof obj.current !== 'undefined') obj.current = 0;
    }
    
    showToast('MISSION STARTED', m.title, 'mission');
    showMissionText(m.objectives[currentObjectiveIndex].text, 5);
}

/**
 * Notify mission system that an enemy was killed
 */
export function reportKill(isBoss = false) {
    if (!isMissionActive) return;
    
    const m = MISSIONS[currentMissionIndex];
    const obj = m.objectives[currentObjectiveIndex];
    
    if (obj.type === 'kill') {
        obj.current++;
        showMissionText(`Killed ${obj.current} / ${obj.count}`, 3);
        if (obj.current >= obj.count) {
            completeObjective();
        }
    } else if (obj.type === 'kill_boss' && isBoss) {
        obj.current++;
        if (obj.current >= obj.count) {
            completeObjective();
        }
    }
}

/**
 * Complete the current objective and advance
 */
function completeObjective() {
    const m = MISSIONS[currentMissionIndex];
    currentObjectiveIndex++;
    
    if (currentObjectiveIndex >= m.objectives.length) {
        // Mission complete
        showToast('MISSION PASSED', `Reward: $${m.reward.cash} | ${m.reward.xp}XP`, 'mission');
        addCash(m.reward.cash);
        addXP(m.reward.xp);
        isMissionActive = false;
        missionCooldown = 10; // Wait 10 seconds before next mission
    } else {
        // Next objective
        const nextObj = m.objectives[currentObjectiveIndex];
        showToast('OBJECTIVE UPDATED', nextObj.text, 'mission');
        showMissionText(nextObj.text, 5);
        
        // Trigger specific events based on new objective
        if (nextObj.type === 'kill_boss') {
            const { spawnEnemy } = require('../enemies/enemy-manager.js');
            spawnEnemy('boss', 100, 100);
        }
    }
}

/**
 * Update the mission system (check objectives)
 */
export function updateMissions(delta, playerX, playerZ) {
    if (!isMissionActive) {
        if (missionCooldown > 0) {
            missionCooldown -= delta;
            if (missionCooldown <= 0) {
                startMission(currentMissionIndex + 1);
            }
        }
        return;
    }
    
    const m = MISSIONS[currentMissionIndex];
    const obj = m.objectives[currentObjectiveIndex];
    
    if (obj.type === 'goto') {
        if (dist2D(playerX, playerZ, obj.x, obj.z) < obj.radius) {
            completeObjective();
        }
    } else if (obj.type === 'wanted') {
        if (getWantedLevel() >= obj.level) {
            completeObjective();
        }
    } else if (obj.type === 'clear_wanted') {
        if (getWantedLevel() === 0) {
            completeObjective();
        }
    }
}

/**
 * Get current mission marker (for minimap)
 * @returns {{x: number, z: number}|null}
 */
export function getMissionMarker() {
    if (!isMissionActive) return null;
    const m = MISSIONS[currentMissionIndex];
    const obj = m.objectives[currentObjectiveIndex];
    
    if (obj.type === 'goto') {
        return { x: obj.x, z: obj.z };
    }
    return null;
}

/**
 * Get active mission info for HUD
 */
export function getActiveMissionText() {
    if (!isMissionActive) return null;
    const m = MISSIONS[currentMissionIndex];
    return m.objectives[currentObjectiveIndex].text;
}
