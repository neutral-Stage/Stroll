/**
 * wanted.js — 5-Star Wanted System (GTA-style police escalation)
 * @module systems/wanted
 */

import {
    WANTED_LEVELS, WANTED_DECAY_TIME, WANTED_SEARCH_RADIUS,
    WANTED_SPAWN_COUNTS, ENEMY_TYPES,
} from '../config.js';

/** Current wanted level (0 = none, 1-5 = escalating) */
let wantedLevel = 0;
/** Time since last crime committed */
let timeSinceLastCrime = 0;
/** Time accumulator for wanted decay */
let decayTimer = 0;
/** Whether player is hidden from search */
let isHidden = false;
/** Player last known position (for search zone) */
let lastKnownX = 0;
let lastKnownZ = 0;
/** Search zone center (drifts from last known position) */
let searchX = 0;
let searchZ = 0;
/** Evasion bonus tracking */
let evadedLevel = 0;
/** Listeners for wanted level changes */
const listeners = [];
/** Spawn request queue */
let pendingSpawnRequest = null;
/** Time until next spawn wave */
let spawnWaveTimer = 0;
const SPAWN_WAVE_INTERVAL_BASE = 15; // seconds between spawn waves

// ── Crime Types & Wanted Level Gains ─────────────────────────
const CRIMES = {
    HIT_NPC: 0.3,
    KILL_NPC: 1.0,
    SHOOT_WEAPON: 0.15,
    DESTROY_VEHICLE: 0.8,
    DESTROY_BUILDING: 1.5,
    KILL_POLICE: 1.2,
    KILL_MILITARY: 1.5,
    STEAL_VEHICLE: 0.5,
    EXPLOSION: 0.6,
};

/** Accumulated crime heat (triggers level-up at thresholds) */
let crimeHeat = 0;
const HEAT_THRESHOLDS = [0, 1.0, 3.0, 6.0, 10.0, 16.0];

/**
 * Report a crime committed by the player.
 * @param {string} crimeType - One of CRIMES keys
 * @param {number} playerX
 * @param {number} playerZ
 */
export function commitCrime(crimeType, playerX, playerZ) {
    const heat = CRIMES[crimeType] || 0.1;
    crimeHeat += heat;
    timeSinceLastCrime = 0;
    lastKnownX = playerX;
    lastKnownZ = playerZ;
    searchX = playerX;
    searchZ = playerZ;
    isHidden = false;

    // Check if we should escalate wanted level
    const newLevel = calculateWantedLevel();
    if (newLevel > wantedLevel) {
        setWantedLevel(newLevel);
    }
}

/**
 * Calculate wanted level from accumulated heat.
 * @returns {number}
 */
function calculateWantedLevel() {
    for (let i = HEAT_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crimeHeat >= HEAT_THRESHOLDS[i]) return Math.min(i, WANTED_LEVELS);
    }
    return 0;
}

/**
 * Set wanted level directly (e.g., for missions).
 * @param {number} level
 */
function setWantedLevel(level) {
    const old = wantedLevel;
    wantedLevel = Math.max(0, Math.min(WANTED_LEVELS, level));
    if (wantedLevel !== old) {
        spawnWaveTimer = 2; // First wave spawns quickly
        listeners.forEach(cb => cb(wantedLevel, old));
    }
}

/**
 * Update the wanted system each frame.
 * @param {number} delta
 * @param {number} playerX
 * @param {number} playerZ
 * @returns {{ spawnRequest: Object|null }}
 */
export function updateWanted(delta, playerX, playerZ) {
    pendingSpawnRequest = null;

    if (wantedLevel === 0) {
        // Decay heat over time when not wanted
        crimeHeat = Math.max(0, crimeHeat - delta * 0.1);
        return { spawnRequest: null };
    }

    timeSinceLastCrime += delta;

    // Check if player is hidden
    const distFromSearch = Math.sqrt(
        (playerX - searchX) ** 2 + (playerZ - searchZ) ** 2
    );
    const searchRadius = WANTED_SEARCH_RADIUS[wantedLevel - 1] || 40;
    isHidden = distFromSearch > searchRadius;

    // Drift search zone slowly (simulates searching)
    if (!isHidden) {
        // Update last known position
        lastKnownX = playerX;
        lastKnownZ = playerZ;
        searchX += (playerX - searchX) * delta * 0.5;
        searchZ += (playerZ - searchZ) * delta * 0.5;
        decayTimer = 0;
    } else {
        // Search zone drifts randomly
        searchX += (Math.random() - 0.5) * delta * 10;
        searchZ += (Math.random() - 0.5) * delta * 10;

        // Decay timer
        decayTimer += delta;
        const decayThreshold = WANTED_DECAY_TIME[wantedLevel - 1] || 30;

        if (decayTimer >= decayThreshold) {
            // Reduce wanted level
            const newLevel = wantedLevel - 1;
            crimeHeat = Math.max(0, HEAT_THRESHOLDS[newLevel] || 0);
            setWantedLevel(newLevel);
            decayTimer = 0;

            if (newLevel === 0) {
                // Evasion bonus
                evadedLevel = wantedLevel;
            }
        }
    }

    // Spawn waves
    spawnWaveTimer -= delta;
    if (spawnWaveTimer <= 0 && !isHidden) {
        const spawnCount = WANTED_SPAWN_COUNTS[wantedLevel - 1] || 2;
        const enemyType = getEnemyTypeForWanted(wantedLevel);

        pendingSpawnRequest = {
            count: spawnCount,
            type: enemyType,
            nearX: playerX,
            nearZ: playerZ,
            radius: 30 + wantedLevel * 10,
            spawnChopper: wantedLevel >= 4,
        };

        // Longer intervals at lower wanted levels
        spawnWaveTimer = SPAWN_WAVE_INTERVAL_BASE - wantedLevel * 2;
    }

    return { spawnRequest: pendingSpawnRequest };
}

/**
 * Get enemy type to spawn based on wanted level.
 * @param {number} level
 * @returns {string}
 */
function getEnemyTypeForWanted(level) {
    switch (level) {
        case 1: return ENEMY_TYPES.POLICE;
        case 2: return ENEMY_TYPES.POLICE;
        case 3: return ENEMY_TYPES.SWAT;
        case 4: return Math.random() < 0.5 ? ENEMY_TYPES.SWAT : ENEMY_TYPES.MILITARY;
        case 5: return ENEMY_TYPES.MILITARY;
        default: return ENEMY_TYPES.POLICE;
    }
}

/**
 * Get current wanted level (0-5).
 * @returns {number}
 */
export function getWantedLevel() {
    return wantedLevel;
}

/**
 * Check if player is currently hidden from search.
 * @returns {boolean}
 */
export function isPlayerHidden() {
    return isHidden;
}

/**
 * Get the search zone center for minimap display.
 * @returns {{ x: number, z: number, radius: number }}
 */
export function getSearchZone() {
    if (wantedLevel === 0) return { x: 0, z: 0, radius: 0 };
    return {
        x: searchX,
        z: searchZ,
        radius: WANTED_SEARCH_RADIUS[wantedLevel - 1] || 40,
    };
}

/**
 * Get last known player position (for enemy pathfinding).
 * @returns {{ x: number, z: number }}
 */
export function getLastKnownPosition() {
    return { x: lastKnownX, z: lastKnownZ };
}

/**
 * Register a listener for wanted level changes.
 * @param {function} callback - (newLevel, oldLevel) => void
 */
export function onWantedChange(callback) {
    listeners.push(callback);
}

/**
 * Clear wanted level (e.g., entering safe house).
 */
export function clearWanted() {
    crimeHeat = 0;
    decayTimer = 0;
    timeSinceLastCrime = 0;
    isHidden = false;
    setWantedLevel(0);
}

/**
 * Force a specific wanted level (for missions).
 * @param {number} level
 */
export function forceWantedLevel(level) {
    crimeHeat = HEAT_THRESHOLDS[level] || 0;
    setWantedLevel(level);
}

/**
 * Check and clear evasion bonus.
 * @returns {number} The level that was evaded (0 if none)
 */
export function checkEvasionBonus() {
    const bonus = evadedLevel;
    evadedLevel = 0;
    return bonus;
}

/**
 * Get crime heat value (for debug/HUD).
 * @returns {number}
 */
export function getCrimeHeat() {
    return crimeHeat;
}

/** Crime type constants for external use */
export { CRIMES };
