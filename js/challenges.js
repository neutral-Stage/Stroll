/**
 * challenges.js — Discovery journal, waypoints, hidden items, achievements
 *
 * Features:
 *  • Waypoints to discover (scenic viewpoints)
 *  • Hidden items scattered in hard-to-find spots
 *  • Discovery journal tracking all progress
 *  • Achievement system with toast notifications
 *
 * @module challenges
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { isInsideBuilding } from './city.js';
import { CITY_SIZE } from './config.js';

/** @type {Array<WaypointData>} */
const waypoints = [];
/** @type {Array<string>} */
const discoveries = [];
/** @type {Array<AchievementDef>} */
const achievementDefs = [];
/** @type {Array<string>} */
const unlockedAchievements = [];
/** @type {function|null} */
let onAchievementCallback = null;
/** @type {function|null} */
let onDiscoveryCallback = null;

const WAYPOINT_DISCOVER_DISTANCE = 5;

// Waypoint definitions — scenic spots
const WAYPOINT_DEFS = [
    { name: 'Central Fountain', x: 0, z: 0, description: 'The heart of the park' },
    { name: 'Northern Overlook', x: 0, z: -70, description: 'A quiet corner of the city' },
    { name: 'Southern Gardens', x: 0, z: 70, description: 'Where the trees grow tall' },
    { name: 'Eastern Alley', x: 70, z: 0, description: 'A narrow passage between buildings' },
    { name: 'Western Promenade', x: -70, z: 0, description: 'The golden light falls here' },
    { name: 'Sunset Corner', x: -50, z: -50, description: 'Best view of the sunset' },
    { name: 'Dawn\'s Edge', x: 50, z: 50, description: 'Where morning light first touches' },
    { name: 'The Quiet Bench', x: -30, z: 40, description: 'A place to sit and think' },
    { name: 'Lamplight Lane', x: 40, z: -30, description: 'Warm glow in the evening' },
    { name: 'Hidden Garden', x: -60, z: -60, description: 'A secret green space' },
];

// Achievement definitions
const ACHIEVEMENT_LIST = [
    { id: 'first_steps', name: 'First Steps', desc: 'Start your stroll', icon: '👣', condition: () => true },
    { id: 'collector_10', name: 'Curious Collector', desc: 'Collect 10 items', icon: '✨', condition: (stats) => stats.collected >= 10 },
    { id: 'collector_25', name: 'Treasure Hunter', desc: 'Collect 25 items', icon: '💎', condition: (stats) => stats.collected >= 25 },
    { id: 'collector_all', name: 'Completionist', desc: 'Collect all items', icon: '🏆', condition: (stats) => stats.collected >= stats.totalCollectibles },
    { id: 'explorer_3', name: 'Wanderer', desc: 'Discover 3 waypoints', icon: '🗺️', condition: (stats) => stats.waypointsFound >= 3 },
    { id: 'explorer_all', name: 'Cartographer', desc: 'Discover all waypoints', icon: '🧭', condition: (stats) => stats.waypointsFound >= WAYPOINT_DEFS.length },
    { id: 'night_owl', name: 'Night Owl', desc: 'Experience nighttime', icon: '🦉', condition: (stats) => stats.nightSeen },
    { id: 'photographer', name: 'Photographer', desc: 'Use photo mode', icon: '📸', condition: (stats) => stats.photosTaken > 0 },
    { id: 'zen_master', name: 'Zen Master', desc: 'Use meditation mode', icon: '🧘', condition: (stats) => stats.meditated },
    { id: 'flower_power', name: 'Flower Power', desc: 'Interact with 5 flowers', icon: '🌸', condition: (stats) => stats.flowersInteracted >= 5 },
    { id: 'marathon', name: 'Marathon Walker', desc: 'Walk 1000 units', icon: '🏃', condition: (stats) => stats.distanceWalked >= 1000 },
    { id: 'stargazer', name: 'Stargazer', desc: 'Collect all stars', icon: '⭐', condition: (stats) => stats.starsCollected >= 5 },
];

/**
 * Create waypoint markers in the scene.
 * @param {THREE.Scene} scene
 */
export function createChallenges(scene) {
    for (const def of WAYPOINT_DEFS) {
        const group = new THREE.Group();

        // Pillar of light
        const pillarGeo = new THREE.CylinderGeometry(0.1, 0.3, 8, 6);
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0x80DEEA,
            transparent: true,
            opacity: 0.15
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = 4;
        group.add(pillar);

        // Base ring
        const ringGeo = new THREE.TorusGeometry(1.5, 0.05, 8, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x80DEEA,
            transparent: true,
            opacity: 0.3
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);

        // Floating diamond marker
        const diamondGeo = new THREE.OctahedronGeometry(0.3, 0);
        const diamondMat = new THREE.MeshStandardMaterial({
            color: 0x80DEEA,
            emissive: 0x00ACC1,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        const diamond = new THREE.Mesh(diamondGeo, diamondMat);
        diamond.position.y = 3;
        group.add(diamond);

        group.position.set(def.x, 0, def.z);
        scene.add(group);

        waypoints.push({
            ...def,
            mesh: group,
            diamond,
            pillar,
            ring,
            discovered: false,
            phase: Math.random() * Math.PI * 2
        });
    }
}

/**
 * Update challenges — check waypoint proximity, check achievements.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number}} playerPos
 * @param {object} stats - game stats for achievement checking
 * @returns {{waypointsFound: number, totalWaypoints: number, justDiscovered: string|null}}
 */
export function updateChallenges(delta, elapsed, playerPos, stats) {
    let justDiscovered = null;

    for (const wp of waypoints) {
        if (wp.discovered) continue;

        // Animate
        wp.phase += delta * 2;
        wp.diamond.position.y = 3 + Math.sin(wp.phase) * 0.3;
        wp.diamond.rotation.y += delta;
        wp.ring.scale.setScalar(1 + Math.sin(wp.phase * 0.5) * 0.1);
        wp.pillar.material.opacity = 0.1 + Math.sin(wp.phase * 0.3) * 0.05;

        // Check proximity
        const dx = wp.x - playerPos.x;
        const dz = wp.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < WAYPOINT_DISCOVER_DISTANCE) {
            wp.discovered = true;
            justDiscovered = wp.name;
            discoveries.push(wp.name);

            // Fade out marker
            fadeOutWaypoint(wp);

            if (onDiscoveryCallback) {
                onDiscoveryCallback(wp.name, wp.description);
            }
        }
    }

    // Check achievements
    checkAchievements(stats);

    const waypointsFound = waypoints.filter(w => w.discovered).length;
    return {
        waypointsFound,
        totalWaypoints: waypoints.length,
        justDiscovered
    };
}

function fadeOutWaypoint(wp) {
    // Simple fade — set opacity low
    wp.pillar.material.opacity = 0.03;
    wp.ring.material.opacity = 0.05;
    wp.diamond.material.opacity = 0.2;
    wp.diamond.material.emissiveIntensity = 0.1;
}

function checkAchievements(stats) {
    for (const ach of ACHIEVEMENT_LIST) {
        if (unlockedAchievements.includes(ach.id)) continue;
        if (ach.condition(stats)) {
            unlockedAchievements.push(ach.id);
            if (onAchievementCallback) {
                onAchievementCallback(ach);
            }
        }
    }
}

/**
 * Set callback for achievement unlocks.
 * @param {function} cb
 */
export function onAchievement(cb) {
    onAchievementCallback = cb;
}

/**
 * Set callback for waypoint discoveries.
 * @param {function} cb
 */
export function onDiscovery(cb) {
    onDiscoveryCallback = cb;
}

export function getDiscoveries() { return [...discoveries]; }
export function getAchievements() { return [...unlockedAchievements]; }
export function getWaypointsFound() { return waypoints.filter(w => w.discovered).length; }
export function getTotalWaypoints() { return waypoints.length; }
export function getAchievementList() { return ACHIEVEMENT_LIST; }
