/**
 * spawn-utils.js — Shared walkable placement for pickups and props
 * @module spawn-utils
 */

import { isInsideBuilding } from './city.js';
import { CITY_SIZE, PARK_EXCLUSION } from './config.js';

/**
 * @typedef {object} SpawnOptions
 * @property {number} [padding=1.2]
 * @property {boolean} [avoidBuildings=true]
 * @property {boolean} [avoidParkCenter=false]
 * @property {number} [span] - world span (defaults CITY_SIZE - 40)
 * @property {number} [maxAttempts=48]
 */

/**
 * @param {number} x
 * @param {number} z
 * @param {SpawnOptions} options
 */
export function isWalkablePosition(x, z, options = {}) {
    const { padding = 1.2, avoidBuildings = true, avoidParkCenter = false } = options;
    if (avoidBuildings && isInsideBuilding(x, z, padding)) return false;
    if (avoidParkCenter && Math.abs(x) < PARK_EXCLUSION && Math.abs(z) < PARK_EXCLUSION) {
        return false;
    }
    const bound = CITY_SIZE / 2 - 8;
    if (Math.abs(x) > bound || Math.abs(z) > bound) return false;
    return true;
}

/**
 * Pick a random walkable point in the city.
 * @param {SpawnOptions} [options]
 * @returns {{ x: number, z: number } | null}
 */
export function pickWalkablePosition(options = {}) {
    const span = options.span ?? (CITY_SIZE - 40);
    const maxAttempts = options.maxAttempts ?? 48;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = (Math.random() - 0.5) * span;
        const z = (Math.random() - 0.5) * span;
        if (isWalkablePosition(x, z, options)) {
            return { x, z };
        }
    }
    return null;
}

/**
 * @param {SpawnOptions} [options]
 * @returns {{ x: number, z: number }}
 */
export function pickWalkablePositionOrOrigin(options = {}) {
    return pickWalkablePosition(options) ?? { x: 0, z: 0 };
}
