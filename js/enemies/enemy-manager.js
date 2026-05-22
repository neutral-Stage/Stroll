/**
 * enemy-manager.js — Enemy spawning, rendering, and lifecycle management
 * @module enemies/enemy-manager
 */

import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, MAX_ENEMIES, ENEMY_CULL_DISTANCE, DISTRICTS } from '../config.js';
import { createEntity, removeEntity, getEntitiesByType, updateEntityPosition, damageEntity, queryNearby } from '../core/entity-manager.js';
import { dist2D, normalize2D, isInsideAnyBuilding } from '../core/physics.js';
import { player } from '../controls.js';
import { getPlayerStats, addCash } from '../player/player.js';
import { showToast } from '../hud.js';

/** @type {THREE.Scene} */
let sceneRef = null;

/** @type {Map<string, EnemyVisual>} entity id -> visual data */
const visuals = new Map();

/** @type {Array<{mesh: THREE.Group, x: number, z: number, amount: number, timer: number}>} */
const cashPickups = [];

/**
 * @typedef {Object} EnemyVisual
 * @property {THREE.Group} mesh
 * @property {THREE.Mesh} healthBar
 * @property {THREE.Mesh} healthBarBg
 * @property {string} state - AI state
 * @property {number} stateTimer
 * @property {number} targetX
 * @property {number} targetZ
 * @property {number} attackTimer
 * @property {number} alertTimer
 * @property {number} hitFlashTimer
 * @property {boolean} dying
 * @property {number} deathTimer
 * @property {number} walkPhase
 */

const ENEMY_STATE = {
    IDLE: 'idle',
    PATROL: 'patrol',
    ALERT: 'alert',
    CHASE: 'chase',
    ATTACK: 'attack',
    FLEE: 'flee',
    DEAD: 'dead',
    FOLLOW_PLAYER: 'follow_player',
};

/**
 * Initialize the enemy system.
 * @param {THREE.Scene} scene
 */
// Shared geometries for performance
const healthBarGeo = new THREE.PlaneGeometry(1.2, 0.15);
const healthBarBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 });
const healthBarMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

const enemyBodyGeo = new THREE.CylinderGeometry(0.4, 0.35, 1.4, 8);
const enemyHeadGeo = new THREE.SphereGeometry(0.25, 8, 8);
const enemyArmGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
const enemyLegGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);

export function initEnemies(scene) {
    sceneRef = scene;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'e' || e.key === 'E') {
            recruitNearbyGangMember();
        }
    });
}

function recruitNearbyGangMember() {
    const cost = 500;
    const stats = getPlayerStats();
    if (stats.cash < cost) return;

    const enemies = getEntitiesByType('enemy');
    for (const entity of enemies) {
        if (entity.data.faction === 'gang' && !entity.data.boss) {
            const dist = dist2D(entity.x, entity.z, player.x, player.z);
            if (dist < 4) {
                // Recruit
                addCash(-cost);
                entity.data.faction = 'player_ally';
                const vis = visuals.get(entity.id);
                if (vis) {
                    vis.state = ENEMY_STATE.FOLLOW_PLAYER;
                    // Change clothing color to distinguish
                    if (vis.mesh.userData.body) {
                        vis.mesh.userData.body.material.color.setHex(0x3498db);
                    }
                }
                showToast('Recruited', 'Gang member recruited for $500!', 'success');
                return;
            }
        }
    }
}

/**
 * Spawn an enemy of a given type at a position.
 * @param {string} type
 * @param {number} x
 * @param {number} z
 * @returns {string|null} entity id
 */
export function spawnEnemy(type, x, z) {
    const cfg = ENEMIES[type];
    if (!cfg) return null;

    const activeCount = getEntitiesByType('enemy').length;
    if (activeCount >= MAX_ENEMIES) return null;

    // Create entity
    const faction = (type === 'police' || type === 'swat' || type === 'military') ? 'police' : 'gang';

    const entity = createEntity('enemy', x, cfg.boss ? 0 : 0, z, {
        health: cfg.health,
        maxHealth: cfg.health,
        enemyType: type,
        faction: faction,
        weapon: cfg.weapon,
        speed: cfg.speed,
        damage: cfg.damage,
        alertRange: cfg.alertRange,
        attackRange: cfg.attackRange,
        usesCover: cfg.usesCover || false,
        flanks: cfg.flanks || false,
        boss: cfg.boss || false,
    });

    // Create visual
    const mesh = createEnemyMesh(type, cfg);
    mesh.position.set(x, 0, z);
    sceneRef.add(mesh);

    // Health bar
    const hbBg = new THREE.Mesh(healthBarGeo, healthBarBgMat);
    const hb = new THREE.Mesh(healthBarGeo, healthBarMat.clone()); // Clone material so we can color it per-enemy if needed, or leave shared if we only scale it
    const hbHeight = cfg.boss ? 4 : 3;
    hbBg.position.set(0, hbHeight, 0);
    hb.position.set(0, hbHeight, 0);
    hbBg.renderOrder = 999;
    hb.renderOrder = 1000;
    mesh.add(hbBg);
    mesh.add(hb);

    visuals.set(entity.id, {
        mesh,
        healthBar: hb,
        healthBarBg: hbBg,
        state: ENEMY_STATE.IDLE,
        stateTimer: 0,
        targetX: x + (Math.random() - 0.5) * 20,
        targetZ: z + (Math.random() - 0.5) * 20,
        attackTimer: 0,
        alertTimer: 0,
        hitFlashTimer: 0,
        dying: false,
        deathTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
    });

    return entity.id;
}

/**
 * Create procedural 3D mesh for an enemy.
 */
function createEnemyMesh(type, cfg) {
    const group = new THREE.Group();
    const scale = cfg.boss ? 1.5 : 1;
    const color = cfg.color || 0x8B0000;
    const mat = new THREE.MeshLambertMaterial({ color });

    // Body (cylinder)
    const body = new THREE.Mesh(enemyBodyGeo, mat);
    body.scale.set(scale, scale, scale);
    body.position.y = 1.2 * scale;
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;

    // Head (sphere)
    const head = new THREE.Mesh(enemyHeadGeo, new THREE.MeshLambertMaterial({ color: 0xDEB887 }));
    head.scale.set(scale, scale, scale);
    head.position.y = 2.1 * scale;
    head.castShadow = true;
    group.add(head);

    // Arms
    const armMat = new THREE.MeshLambertMaterial({ color });
    const leftArm = new THREE.Mesh(enemyArmGeo, armMat);
    leftArm.scale.set(scale, scale, scale);
    leftArm.position.set(-0.5 * scale, 1.3 * scale, 0);
    group.add(leftArm);
    group.userData.leftArm = leftArm;

    const rightArm = new THREE.Mesh(enemyArmGeo, armMat);
    rightArm.scale.set(scale, scale, scale);
    rightArm.position.set(0.5 * scale, 1.3 * scale, 0);
    group.add(rightArm);
    group.userData.rightArm = rightArm;

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const leftLeg = new THREE.Mesh(enemyLegGeo, legMat);
    leftLeg.scale.set(scale, scale, scale);
    leftLeg.position.set(-0.2 * scale, 0.4 * scale, 0);
    group.add(leftLeg);
    group.userData.leftLeg = leftLeg;

    const rightLeg = new THREE.Mesh(enemyLegGeo, legMat);
    rightLeg.scale.set(scale, scale, scale);
    rightLeg.position.set(0.2 * scale, 0.4 * scale, 0);
    group.add(rightLeg);
    group.userData.rightLeg = rightLeg;

    // Weapon in hand (small box)
    if (cfg.weapon && cfg.weapon !== WEAPON_TYPES.FISTS) {
        const weaponMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 0.25),
            new THREE.MeshLambertMaterial({ color: 0x222222 })
        );
        weaponMesh.position.set(0, -0.2 * scale, -0.15);
        rightArm.add(weaponMesh);
    }

    return group;
}

/**
 * Update all enemies each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {number} playerX
 * @param {number} playerZ
 * @returns {{ attacks: Array<{damage: number, fromX: number, fromZ: number}> }}
 */
export function updateEnemies(delta, elapsed, playerX, playerZ) {
    const attacks = [];
    const enemies = getEntitiesByType('enemy');

    for (const entity of enemies) {
        const vis = visuals.get(entity.id);
        if (!vis) continue;

        const distToPlayer = dist2D(entity.x, entity.z, playerX, playerZ);

        // Culling
        if (distToPlayer > ENEMY_CULL_DISTANCE) continue;

        // Apply physics/knockback
        if (entity.vx || entity.vz) {
            entity.x += (entity.vx || 0) * delta;
            entity.z += (entity.vz || 0) * delta;
            entity.vx = (entity.vx || 0) * Math.pow(0.1, delta);
            entity.vz = (entity.vz || 0) * Math.pow(0.1, delta);
            if (Math.abs(entity.vx) < 0.1) entity.vx = 0;
            if (Math.abs(entity.vz) < 0.1) entity.vz = 0;
            updateEntityPosition(entity.id, entity.x, entity.y, entity.z);
        }

        // Update AI state with faction targeting
        updateAI(entity, vis, delta, playerX, playerZ, enemies, attacks);

        // Update mesh position
        vis.mesh.position.set(entity.x, 0, entity.z);

        // Face movement direction or player
        if (vis.state === ENEMY_STATE.CHASE || vis.state === ENEMY_STATE.ATTACK) {
            const angle = Math.atan2(playerX - entity.x, playerZ - entity.z);
            vis.mesh.rotation.y = angle;
        }

        // Walking animation
        if (vis.state === ENEMY_STATE.CHASE || vis.state === ENEMY_STATE.PATROL || vis.state === ENEMY_STATE.FLEE) {
            vis.walkPhase += delta * 8;
            const bob = Math.sin(vis.walkPhase) * 0.15;
            if (vis.mesh.userData.leftLeg) vis.mesh.userData.leftLeg.rotation.x = bob;
            if (vis.mesh.userData.rightLeg) vis.mesh.userData.rightLeg.rotation.x = -bob;
            if (vis.mesh.userData.leftArm) vis.mesh.userData.leftArm.rotation.x = -bob * 0.5;
            if (vis.mesh.userData.rightArm) vis.mesh.userData.rightArm.rotation.x = bob * 0.5;
        }

        // Attack animation (raise arm)
        if (vis.state === ENEMY_STATE.ATTACK) {
            if (vis.mesh.userData.rightArm) {
                vis.mesh.userData.rightArm.rotation.x = -Math.PI / 3;
            }
        }

        // Hit flash
        if (vis.hitFlashTimer > 0) {
            vis.hitFlashTimer -= delta;
            if (vis.mesh.userData.body) {
                vis.mesh.userData.body.material.emissive?.setHex(vis.hitFlashTimer > 0 ? 0xFF0000 : 0x000000);
            }
        }

        // Health bar
        const healthPct = entity.health / entity.maxHealth;
        vis.healthBar.scale.x = Math.max(0.01, healthPct);
        vis.healthBar.position.x = -(1 - healthPct) * 0.6;
        vis.healthBar.material.color.setHex(healthPct > 0.5 ? 0x00ff00 : healthPct > 0.25 ? 0xffaa00 : 0xff0000);

        // Health bar visibility (only when damaged or close)
        const showBar = healthPct < 1 || distToPlayer < 15;
        vis.healthBar.visible = showBar;
        vis.healthBarBg.visible = showBar;

        // Death
        if (vis.dying) {
            vis.deathTimer += delta;
            vis.mesh.rotation.z = Math.min(Math.PI / 2, vis.deathTimer * 3);
            vis.mesh.position.y = -vis.deathTimer * 0.5;

            if (vis.deathTimer > 8) {
                // Remove
                sceneRef.remove(vis.mesh);
                vis.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
                removeEntity(entity.id);
                visuals.delete(entity.id);
            }
        }
    }

    // Update cash pickups
    updateCashPickups(delta, elapsed, playerX, playerZ);

    return { attacks };
}

/**
 * Simple AI state machine with faction warfare.
 */
function updateAI(entity, vis, delta, playerX, playerZ, allEnemies, attacks) {
    if (vis.dying) return;

    const cfg = ENEMIES[entity.data.enemyType] || {};
    vis.stateTimer += delta;

    // Find closest target
    let targetX = playerX;
    let targetZ = playerZ;
    let distToTarget = dist2D(entity.x, entity.z, playerX, playerZ);
    let targetIsPlayer = true;
    let targetEntity = null;

    // Faction targeting
    const myFaction = entity.data.faction;
    for (const other of allEnemies) {
        if (other.id === entity.id) continue;
        const otherFaction = other.data.faction;
        if (myFaction !== otherFaction) {
            if ((myFaction === 'player_ally' && otherFaction === 'police') || (otherFaction === 'player_ally' && myFaction === 'police') || (myFaction === 'gang' && otherFaction === 'police') || (myFaction === 'police' && otherFaction === 'gang')) {
                const d = dist2D(entity.x, entity.z, other.x, other.z);
                if (d < distToTarget && d < 40) {
                    targetX = other.x;
                    targetZ = other.z;
                    distToTarget = d;
                    targetIsPlayer = false;
                    targetEntity = other;
                }
            }
        }
    }
    
    // Ignore player if allied
    if (myFaction === 'player_ally') {
        if (targetIsPlayer) {
            // No enemies nearby, just follow player
            distToTarget = Infinity; 
        }
    }

    switch (vis.state) {
        case ENEMY_STATE.IDLE:
            // Check for target
            if (distToTarget < (cfg.alertRange || 20)) {
                vis.state = ENEMY_STATE.ALERT;
                vis.stateTimer = 0;
                vis.alertTimer = 0.8 + Math.random() * 0.5;
                // Alert nearby enemies
                alertNearby(entity.x, entity.z, 15);
            }
            break;

        case ENEMY_STATE.ALERT:
            vis.alertTimer -= delta;
            if (vis.alertTimer <= 0) {
                vis.state = ENEMY_STATE.CHASE;
                vis.stateTimer = 0;
            }
            break;

        case ENEMY_STATE.CHASE:
            moveToward(entity, targetX, targetZ, (cfg.speed || 2) * delta);
            if (distToTarget < (cfg.attackRange || 15)) {
                vis.state = ENEMY_STATE.ATTACK;
                vis.stateTimer = 0;
                vis.attackTimer = 0.5 + Math.random() * 0.5;
            }
            if (entity.health < (cfg.health || 50) * 0.2) {
                vis.state = ENEMY_STATE.FLEE;
            }
            break;

        case ENEMY_STATE.ATTACK:
            vis.attackTimer -= delta;
            if (vis.attackTimer <= 0) {
                // Fire at target
                const accuracy = cfg.usesCover ? 0.7 : 0.5;
                if (Math.random() < accuracy) {
                    if (targetIsPlayer) {
                        attacks.push({
                            damage: cfg.damage || 10,
                            fromX: entity.x,
                            fromZ: entity.z,
                        });
                    } else if (targetEntity) {
                        // Damage other enemy directly
                        damageEntity(targetEntity.id, cfg.damage || 10);
                    }
                }
                // Reset attack timer based on weapon fire rate
                vis.attackTimer = 1 / (cfg.fireRate || 1.5) + Math.random() * 0.3;
            }
            
            // Turn to face target immediately while attacking
            vis.mesh.rotation.y = Math.atan2(targetX - entity.x, targetZ - entity.z);

            // Move out of range check
            if (distToTarget > (cfg.attackRange || 15) * 1.2) {
                vis.state = ENEMY_STATE.CHASE;
            }
            if (entity.health < (cfg.health || 50) * 0.2) {
                vis.state = ENEMY_STATE.FLEE;
            }
            break;

        case ENEMY_STATE.FLEE:
            // Run away from target
            const fleeDir = normalize2D(entity.x - targetX, entity.z - targetZ);
            moveToward(entity, entity.x + fleeDir.x * 10, entity.z + fleeDir.z * 10, 3 * delta);
            break;

        case ENEMY_STATE.PATROL:
            moveToward(entity, vis.targetX, vis.targetZ, (cfg.speed || 2) * 0.5 * delta);
            if (dist2D(entity.x, entity.z, vis.targetX, vis.targetZ) < 2) {
                vis.targetX = entity.x + (Math.random() - 0.5) * 30;
                vis.targetZ = entity.z + (Math.random() - 0.5) * 30;
            }
            if (distToPlayer < (cfg.alertRange || 20) && entity.data.faction !== 'player_ally') {
                vis.state = ENEMY_STATE.ALERT;
                vis.stateTimer = 0;
                vis.alertTimer = 0.5;
            }
            break;

        case ENEMY_STATE.FOLLOW_PLAYER:
            if (!targetIsPlayer && distToTarget < (cfg.alertRange || 20)) {
                vis.state = ENEMY_STATE.CHASE;
            } else {
                // Follow player
                const d = dist2D(entity.x, entity.z, playerX, playerZ);
                if (d > 5) {
                    moveToward(entity, playerX, playerZ, (cfg.speed || 2) * delta);
                } else if (d < 3) {
                    // Back away slightly to give space
                    const pushDir = normalize2D(entity.x - playerX, entity.z - playerZ);
                    moveToward(entity, entity.x + pushDir.x, entity.z + pushDir.z, (cfg.speed || 2) * 0.5 * delta);
                }
            }
            if (entity.health < (cfg.health || 50) * 0.2) {
                vis.state = ENEMY_STATE.FLEE;
            }
            break;
    }
}

function moveToward(entity, tx, tz, speed) {
    const dx = tx - entity.x;
    const dz = tz - entity.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) return;

    const nx = entity.x + (dx / len) * speed;
    const nz = entity.z + (dz / len) * speed;

    // Simple building avoidance
    if (!isInsideAnyBuilding(nx, nz, 1.5)) {
        updateEntityPosition(entity.id, nx, entity.y, nz);
        entity.x = nx;
        entity.z = nz;
    } else {
        // Try sliding along the axis
        if (!isInsideAnyBuilding(nx, entity.z, 1.5)) {
            updateEntityPosition(entity.id, nx, entity.y, entity.z);
            entity.x = nx;
        } else if (!isInsideAnyBuilding(entity.x, nz, 1.5)) {
            updateEntityPosition(entity.id, entity.x, entity.y, nz);
            entity.z = nz;
        }
    }
}

function alertNearby(x, z, radius) {
    const nearby = queryNearby(x, z, radius, 'enemy');
    for (const e of nearby) {
        const vis = visuals.get(e.id);
        if (vis && (vis.state === ENEMY_STATE.IDLE || vis.state === ENEMY_STATE.PATROL)) {
            vis.state = ENEMY_STATE.ALERT;
            vis.alertTimer = 0.3 + Math.random() * 0.5;
        }
    }
}

/**
 * Apply damage to enemies at a point (for explosions, bullets).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} radius
 * @param {number} damage
 * @returns {number} enemies killed
 */
export function damageEnemyAtPoint(x, y, z, radius, damage) {
    let killed = 0;
    const nearby = queryNearby(x, z, radius, 'enemy');

    for (const entity of nearby) {
        const dist = dist2D(entity.x, entity.z, x, z);
        const falloff = 1 - (dist / radius);
        const actualDamage = Math.max(1, Math.floor(damage * falloff));

        const result = damageEntity(entity.id, actualDamage);
        const vis = visuals.get(entity.id);

        if (vis) {
            vis.hitFlashTimer = 0.15;

            if (result.killed && !vis.dying) {
                vis.dying = true;
                vis.deathTimer = 0;
                vis.state = ENEMY_STATE.DEAD;
                killed++;

                // Drop cash
                const cfg = ENEMIES[entity.data.enemyType] || {};
                const [minCash, maxCash] = cfg.cashDrop || [10, 50];
                const cashAmount = minCash + Math.floor(Math.random() * (maxCash - minCash));
                if (cashAmount > 0) {
                    spawnCashPickup(entity.x, entity.z, cashAmount);
                }
            } else if (!result.killed) {
                // Alert on damage
                if (vis.state === ENEMY_STATE.IDLE || vis.state === ENEMY_STATE.PATROL) {
                    vis.state = ENEMY_STATE.ALERT;
                    vis.alertTimer = 0.2;
                }
            }
        }
    }

    return killed;
}

function spawnCashPickup(x, z, amount) {
    const geo = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.3, z);
    sceneRef.add(mesh);
    cashPickups.push({ mesh, x, z, amount, timer: 30 });
}

function updateCashPickups(delta, elapsed, playerX, playerZ) {
    for (let i = cashPickups.length - 1; i >= 0; i--) {
        const p = cashPickups[i];
        p.timer -= delta;
        p.mesh.position.y = 0.3 + Math.sin(elapsed * 3 + p.x) * 0.1;
        p.mesh.rotation.y = elapsed;

        const dist = dist2D(playerX, playerZ, p.x, p.z);
        if (dist < 2 || p.timer <= 0) {
            sceneRef.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();

            if (dist < 2) {
                // Collected — signal to game loop
                p.collected = true;
                p.collectedAmount = p.amount;
            }
            cashPickups.splice(i, 1);
        }
    }
}

/**
 * Get collected cash from pickups this frame.
 * @returns {number}
 */
export function getCollectedCash() {
    return cashPickups.filter(p => p.collected).reduce((sum, p) => sum + (p.collectedAmount || 0), 0);
}

/**
 * Spawn enemies for wanted level response.
 * @param {number} wantedLevel
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} count
 * @param {string} type
 */
export function spawnWantedEnemies(wantedLevel, playerX, playerZ, count, type) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + wantedLevel * 10 + Math.random() * 20;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;

        if (!isInsideAnyBuilding(sx, sz, 2)) {
            const id = spawnEnemy(type, sx, sz);
            if (id) {
                const vis = visuals.get(id);
                if (vis) {
                    vis.state = ENEMY_STATE.CHASE; // Wanted enemies start chasing
                }
            }
        }
    }
}

/**
 * Get active enemy count.
 * @returns {number}
 */
export function getActiveEnemyCount() {
    return getEntitiesByType('enemy').length;
}

/**
 * Remove all enemies.
 */
export function removeAllEnemies() {
    const enemies = getEntitiesByType('enemy');
    for (const e of enemies) {
        const vis = visuals.get(e.id);
        if (vis) {
            sceneRef.remove(vis.mesh);
            vis.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
        }
        removeEntity(e.id);
        visuals.delete(e.id);
    }
}

/**
 * Alert all enemies near a position (e.g., gunfire).
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 */
export function alertEnemiesNear(x, z, radius) {
    alertNearby(x, z, radius);
}
