/**
 * game-state.js — Session stats shared by HUD, pause menu, and achievements
 *
 * Keeps one source of truth for progress flags so main.js does not scatter
 * duplicate counters across modules.
 *
 * @module game-state
 */

/** @typedef {object} ChallengeStats
 * @property {boolean} strollBegun
 * @property {boolean} usedPhotoMode
 * @property {number} collected
 * @property {number} totalCollectibles
 * @property {number} waypointsFound
 * @property {boolean} nightSeen
 * @property {number} photosTaken
 * @property {boolean} meditated
 * @property {number} flowersInteracted
 * @property {number} distanceWalked
 * @property {number} starsCollected
 */

export const session = {
    strollBegun: false,
    usedPhotoMode: false,
    nightSeen: false,
    photosTaken: 0,
    meditated: false,
    starsCollected: 0,
    distanceWalked: 0,
};

export function markStrollBegun() {
    session.strollBegun = true;
}

export function markPhotoModeUsed() {
    session.usedPhotoMode = true;
}

/**
 * Build the stats object passed to challenges each frame.
 * @param {object} pickup - collectible counts from main loop
 * @param {number} pickup.collected
 * @param {number} pickup.totalCollectibles
 * @param {number} pickup.waypointsFound
 * @param {number} pickup.flowersInteracted
 * @returns {ChallengeStats}
 */
export function buildChallengeStats(pickup) {
    return {
        strollBegun: session.strollBegun,
        usedPhotoMode: session.usedPhotoMode,
        collected: pickup.collected,
        totalCollectibles: pickup.totalCollectibles,
        waypointsFound: pickup.waypointsFound,
        nightSeen: session.nightSeen,
        photosTaken: session.photosTaken,
        meditated: session.meditated,
        flowersInteracted: pickup.flowersInteracted,
        distanceWalked: session.distanceWalked,
        starsCollected: session.starsCollected,
    };
}

/**
 * Snapshot for pause menu / debug.
 * @param {object} hud
 * @param {number} hud.score
 * @param {number} hud.collected
 * @param {number} hud.totalCollectibles
 * @param {number} hud.waypointsFound
 * @param {number} hud.totalWaypoints
 * @param {number} hud.achievementsUnlocked
 */
export function buildPauseSnapshot(hud) {
    return {
        score: hud.score ?? 0,
        collected: hud.collected ?? 0,
        totalCollectibles: hud.totalCollectibles ?? 0,
        waypointsFound: hud.waypointsFound ?? 0,
        totalWaypoints: hud.totalWaypoints ?? 0,
        distanceWalked: Math.floor(session.distanceWalked),
        photosTaken: session.photosTaken,
        achievementsUnlocked: hud.achievementsUnlocked ?? 0,
        achievementsTotal: hud.achievementsTotal ?? 0,
    };
}
