/**
 * enemy-manager.js — Enemy spawning, rendering, and lifecycle management
 * @module enemies/enemy-manager
 */

import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, MAX_ENEMIES, ENEMY_CULL_DISTANCE, DISTRICTS, WEAPON_TYPES } from '../config.js';
import { createEntity, removeEntity, getEntitiesByType, updateEntityPosition, damageEntity, queryNearby } from '../core/entity-manager.js';
import { dist2D, normalize2D, isInsideAnyBuilding } from '../core/physics.js';
import { player } from '../controls.js';
import { getPlayerStats, addCash, damagePlayer } from '../player/player.js';
import { showToast } from '../hud.js';
import { onEnemyKilled } from '../systems/level-system.js';
import { reportKill, reportUFOKill } from '../missions/mission-manager.js';
import { spawnPickup } from '../weapons/pickups.js';

/** @type {THREE.Scene} */
let sceneRef = null;

/** @type {Map<string, EnemyVisual>} entity id -> visual data */
const visuals = new Map();

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
                addCash(-cost);
                entity.data.faction = 'player_ally';
                const vis = visuals.get(entity.id);
                if (vis) {
                    vis.state = ENEMY_STATE.FOLLOW_PLAYER;
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
 * Spawn an enemy at a position.
 */
export function spawnEnemy(type, x, z) {
    const cfg = ENEMIES[type];
    if (!cfg) return null;

    const activeCount = getEntitiesByType('enemy').length;
    if (activeCount >= MAX_ENEMIES) return null;

    const faction = (type === 'police' || type === 'swat' || type === 'military') ? 'police' : 'gang';

    // Set initial Y based on enemy type
    let startY = 0;
    if (type === ENEMY_TYPES.FLYING_MONSTER) startY = 8;
    else if (type === ENEMY_TYPES.UFO) startY = 18;

    const entity = createEntity('enemy', x, startY, z, {
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

    const mesh = createEnemyMesh(type, cfg);
    mesh.position.set(x, startY, z);
    sceneRef.add(mesh);

    // Health bar setup
    const hbBg = new THREE.Mesh(healthBarGeo, healthBarBgMat);
    const hb = new THREE.Mesh(healthBarGeo, healthBarMat.clone());
    const hbHeight = type === ENEMY_TYPES.UFO ? 6 : cfg.boss ? 4 : 3;
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
        attackTimer: Math.random() * 2,
        alertTimer: 0,
        hitFlashTimer: 0,
        frozenTimer: 0,
        burnTimer: 0,
        dying: false,
        deathTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
    });

    return entity.id;
}

/**
 * Create procedural 3D mesh for the different enemy types.
 */
function createEnemyMesh(type, cfg) {
    const group = new THREE.Group();
    const scale = cfg.boss ? 1.5 : 1;
    const color = cfg.color || 0x8B0000;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

    if (type === ENEMY_TYPES.MONSTER) {
        // 1. Beast Monster: Purple behemoth
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), mat);
        body.position.y = 0.9;
        body.castShadow = true;
        group.add(body);
        group.userData.body = body;

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0x4B0082 }));
        head.position.y = 2.0;
        group.add(head);

        // Glowing red eyes
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xFF0000 }));
        eyeL.position.set(-0.2, 2.1, -0.36);
        group.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.2;
        group.add(eyeR);

        // Long arms
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), mat);
        leftArm.position.set(-0.75, 1.0, 0);
        group.add(leftArm);
        group.userData.leftArm = leftArm;

        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), mat);
        rightArm.position.set(0.75, 1.0, 0);
        group.add(rightArm);
        group.userData.rightArm = rightArm;

        return group;
    }
    else if (type === ENEMY_TYPES.FLYING_MONSTER) {
        // 2. Gargoyle: Flying green gargoyle
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), mat);
        body.position.y = 0.7;
        body.castShadow = true;
        group.add(body);
        group.userData.body = body;

        const head = new THREE.Mesh(enemyHeadGeo, new THREE.MeshStandardMaterial({ color: 0x1E5B37 }));
        head.position.y = 1.6;
        group.add(head);

        // Flapping wings
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x1E5B37 }));
        wingL.position.set(-0.7, 1.0, 0);
        group.add(wingL);
        group.userData.wingL = wingL;

        const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x1E5B37 }));
        wingR.position.set(0.7, 1.0, 0);
        group.add(wingR);
        group.userData.wingR = wingR;

        return group;
    }
    else if (type === ENEMY_TYPES.UFO) {
        // 3. UFO: Floating flying saucer
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.1 }));
        disc.position.y = 0.5;
        group.add(disc);
        group.userData.body = disc;

        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(1.0, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x00FF00, transparent: true, opacity: 0.7 })
        );
        dome.position.y = 0.7;
        group.add(dome);

        // Pulsing green glow point light
        const light = new THREE.PointLight(0x00FF00, 3, 20);
        light.position.y = 0.2;
        group.add(light);

        return group;
    }
    else {
        // 4. Default character meshes (thugs, SWAT, police)
        const body = new THREE.Mesh(enemyBodyGeo, mat);
        body.scale.set(scale, scale, scale);
        body.position.y = 1.2 * scale;
        body.castShadow = true;
        group.add(body);
        group.userData.body = body;

        const head = new THREE.Mesh(enemyHeadGeo, new THREE.MeshLambertMaterial({ color: 0xDEB887 }));
        head.scale.set(scale, scale, scale);
        head.position.y = 2.1 * scale;
        head.castShadow = true;
        group.add(head);

        const leftArm = new THREE.Mesh(enemyArmGeo, mat);
        leftArm.scale.set(scale, scale, scale);
        leftArm.position.set(-0.5 * scale, 1.3 * scale, 0);
        group.add(leftArm);
        group.userData.leftArm = leftArm;

        const rightArm = new THREE.Mesh(enemyArmGeo, mat);
        rightArm.scale.set(scale, scale, scale);
        rightArm.position.set(0.5 * scale, 1.3 * scale, 0);
        group.add(rightArm);
        group.userData.rightArm = rightArm;

        const leftLeg = new THREE.Mesh(enemyLegGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
        leftLeg.scale.set(scale, scale, scale);
        leftLeg.position.set(-0.2 * scale, 0.4 * scale, 0);
        group.add(leftLeg);
        group.userData.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(enemyLegGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
        rightLeg.scale.set(scale, scale, scale);
        rightLeg.position.set(0.2 * scale, 0.4 * scale, 0);
        group.add(rightLeg);
        group.userData.rightLeg = rightLeg;

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
}

/**
 * Update all enemies.
 */
export function updateEnemies(delta, elapsed, playerX, playerZ) {
    const attacks = [];
    const enemies = getEntitiesByType('enemy');

    for (const entity of enemies) {
        const vis = visuals.get(entity.id);
        if (!vis) continue;

        const distToPlayer = dist2D(entity.x, entity.z, playerX, playerZ);
        if (distToPlayer > ENEMY_CULL_DISTANCE) continue;

        // Apply physics, gravity (only for ground enemies)
        const isFlying = entity.data.enemyType === ENEMY_TYPES.FLYING_MONSTER || entity.data.enemyType === ENEMY_TYPES.UFO;

        if (!isFlying && (entity.y > 0 || entity.vy || entity.vx || entity.vz)) {
            entity.vy = (entity.vy || 0) - 20 * delta;
            entity.x += (entity.vx || 0) * delta;
            entity.y = (entity.y || 0) + entity.vy * delta;
            entity.z += (entity.vz || 0) * delta;
            
            if (entity.y <= 0) {
                entity.y = 0;
                entity.vy = 0;
                entity.vx = (entity.vx || 0) * Math.pow(0.1, delta);
                entity.vz = (entity.vz || 0) * Math.pow(0.1, delta);
            }
            updateEntityPosition(entity.id, entity.x, entity.y, entity.z);
        } else if (isFlying) {
            // Smoothly slide horizontal physical forces for flying units
            entity.x += (entity.vx || 0) * delta;
            entity.z += (entity.vz || 0) * delta;
            entity.vx = (entity.vx || 0) * Math.pow(0.1, delta);
            entity.vz = (entity.vz || 0) * Math.pow(0.1, delta);
            updateEntityPosition(entity.id, entity.x, entity.y, entity.z);
        }

        if (vis.burnTimer > 0) {
            vis.burnTimer -= delta;
            vis.burnDamageTimer = (vis.burnDamageTimer || 0) + delta;
            if (vis.burnDamageTimer > 0.5) {
                vis.burnDamageTimer = 0;
                const result = damageEntity(entity.id, 6);
                vis.hitFlashTimer = 0.15;
                if (result.killed && !vis.dying) {
                    vis.dying = true;
                    vis.deathTimer = 0;
                    vis.state = ENEMY_STATE.DEAD;
                    triggerEnemyDeath(entity);
                }
            }
            if (vis.frozenTimer <= 0 && vis.mesh.userData.body) {
                vis.mesh.userData.body.material.emissive?.setHex(0xFF4500);
            }
        }

        if (vis.frozenTimer > 0) {
            vis.frozenTimer -= delta;
            if (vis.frozenTimer <= 0) {
                vis.mesh.traverse(child => {
                    if (child.material && child.userData.originalColor !== undefined) {
                        child.material.color.setHex(child.userData.originalColor);
                        child.material.emissive?.setHex(0x000000);
                    }
                });
            }
        } else {
            updateAI(entity, vis, delta, playerX, playerZ, enemies, attacks, elapsed);
        }

        vis.mesh.position.set(entity.x, entity.y || 0, entity.z);

        // Flapping wings for gargoyles, saucer rotation for UFO
        if (vis.frozenTimer <= 0) {
            if (entity.data.enemyType === ENEMY_TYPES.FLYING_MONSTER) {
                if (vis.mesh.userData.wingL) vis.mesh.userData.wingL.rotation.z = Math.sin(elapsed * 10) * 0.4;
                if (vis.mesh.userData.wingR) vis.mesh.userData.wingR.rotation.z = -Math.sin(elapsed * 10) * 0.4;
            } else if (entity.data.enemyType === ENEMY_TYPES.UFO) {
                if (vis.mesh.userData.body) vis.mesh.userData.body.rotation.y += delta * 2;
            }

            if (vis.state === ENEMY_STATE.CHASE || vis.state === ENEMY_STATE.ATTACK) {
                const angle = Math.atan2(playerX - entity.x, playerZ - entity.z);
                vis.mesh.rotation.y = angle;
            }

            // Normal walk leg bob
            if (!isFlying && (vis.state === ENEMY_STATE.CHASE || vis.state === ENEMY_STATE.PATROL || vis.state === ENEMY_STATE.FLEE)) {
                vis.walkPhase += delta * 8;
                const bob = Math.sin(vis.walkPhase) * 0.15;
                if (vis.mesh.userData.leftLeg) vis.mesh.userData.leftLeg.rotation.x = bob;
                if (vis.mesh.userData.rightLeg) vis.mesh.userData.rightLeg.rotation.x = -bob;
                if (vis.mesh.userData.leftArm) vis.mesh.userData.leftArm.rotation.x = -bob * 0.5;
                if (vis.mesh.userData.rightArm) vis.mesh.userData.rightArm.rotation.x = bob * 0.5;
            }

            if (vis.state === ENEMY_STATE.ATTACK && entity.data.enemyType !== ENEMY_TYPES.MONSTER && !isFlying) {
                if (vis.mesh.userData.rightArm) vis.mesh.userData.rightArm.rotation.x = -Math.PI / 3;
            }
        }

        if (vis.hitFlashTimer > 0) {
            vis.hitFlashTimer -= delta;
            if (vis.mesh.userData.body) {
                vis.mesh.userData.body.material.emissive?.setHex(vis.hitFlashTimer > 0 ? 0xFF0000 : 0x000000);
            }
        }

        const healthPct = entity.health / entity.maxHealth;
        vis.healthBar.scale.x = Math.max(0.01, healthPct);
        vis.healthBar.position.x = -(1 - healthPct) * 0.6;
        vis.healthBar.material.color.setHex(healthPct > 0.5 ? 0x00ff00 : healthPct > 0.25 ? 0xffaa00 : 0xff0000);

        const showBar = healthPct < 1 || distToPlayer < 15;
        vis.healthBar.visible = showBar;
        vis.healthBarBg.visible = showBar;

        if (vis.dying) {
            vis.deathTimer += delta;
            vis.mesh.rotation.z = Math.min(Math.PI / 2, vis.deathTimer * 3);
            vis.mesh.position.y = (isFlying ? entity.y : 0) - vis.deathTimer * 0.8;

            if (vis.deathTimer > 7) {
                sceneRef.remove(vis.mesh);
                vis.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
                removeEntity(entity.id);
                visuals.delete(entity.id);
            }
        }
    }

    return { attacks };
}

function triggerEnemyDeath(entity) {
    onEnemyKilled();
    reportKill(entity.data.boss);
    if (entity.data.enemyType === ENEMY_TYPES.UFO) {
        reportUFOKill();
    }

    // Spawn cash pickup drops on the street
    const cfg = ENEMIES[entity.data.enemyType] || {};
    const [minCash, maxCash] = cfg.cashDrop || [10, 50];
    const cashAmount = minCash + Math.floor(Math.random() * (maxCash - minCash));
    if (cashAmount > 0) {
        spawnPickup('cash', entity.x, entity.z, cashAmount);
    }

    // 25% chance to drop weapons or ammo on enemy death
    if (Math.random() < 0.25) {
        const dropList = [
            WEAPON_TYPES.PISTOL, WEAPON_TYPES.SHOTGUN, WEAPON_TYPES.SMG,
            WEAPON_TYPES.ASSAULT_RIFLE, WEAPON_TYPES.GRENADE, WEAPON_TYPES.MOLOTOV,
            WEAPON_TYPES.SMOKE_BOMB, WEAPON_TYPES.SWORD, WEAPON_TYPES.KNIFE, WEAPON_TYPES.RPG
        ];
        const randomWep = dropList[Math.floor(Math.random() * dropList.length)];
        const qty = randomWep === WEAPON_TYPES.RPG ? 1 : 
                    (randomWep === WEAPON_TYPES.GRENADE || randomWep === WEAPON_TYPES.MOLOTOV || randomWep === WEAPON_TYPES.SMOKE_BOMB || randomWep === WEAPON_TYPES.SWORD || randomWep === WEAPON_TYPES.KNIFE) ? 1 : 24;
        spawnPickup(randomWep, entity.x, entity.z, qty);
    }
}

/**
 * AI state machine updating the custom monster/flying behaviors.
 */
function updateAI(entity, vis, delta, playerX, playerZ, allEnemies, attacks, elapsed) {
    if (vis.dying) return;

    const cfg = ENEMIES[entity.data.enemyType] || {};
    vis.stateTimer += delta;

    let targetX = playerX;
    let targetZ = playerZ;
    let distToTarget = dist2D(entity.x, entity.z, playerX, playerZ);
    let targetIsPlayer = true;
    let targetEntity = null;

    const myFaction = entity.data.faction;
    for (const other of allEnemies) {
        if (other.id === entity.id) continue;
        const otherFaction = other.data.faction;
        if (myFaction !== otherFaction) {
            if ((myFaction === 'player_ally' && otherFaction === 'police') || 
                (otherFaction === 'player_ally' && myFaction === 'police') || 
                (myFaction === 'gang' && otherFaction === 'police') || 
                (myFaction === 'police' && otherFaction === 'gang')) {
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
    
    if (myFaction === 'player_ally' && targetIsPlayer) {
        distToTarget = Infinity; 
    }

    // Custom floating UFO / Flying Gargoyle behavior overrides
    const isUFO = entity.data.enemyType === ENEMY_TYPES.UFO;
    const isGargoyle = entity.data.enemyType === ENEMY_TYPES.FLYING_MONSTER;

    if (isUFO) {
        const desiredY = 18 + Math.sin(elapsed * 2) * 1.5;
        entity.y += (desiredY - entity.y) * delta * 2;
    } else if (isGargoyle) {
        const desiredY = 8 + Math.sin(elapsed * 3.5) * 1.2;
        entity.y += (desiredY - entity.y) * delta * 2.5;
    }

    switch (vis.state) {
        case ENEMY_STATE.IDLE:
            if (distToTarget < (cfg.alertRange || 20)) {
                vis.state = ENEMY_STATE.ALERT;
                vis.stateTimer = 0;
                vis.alertTimer = 0.5 + Math.random() * 0.5;
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
                vis.attackTimer = 0.3 + Math.random() * 0.4;
            }
            if (entity.health < (cfg.health || 50) * 0.15) {
                vis.state = ENEMY_STATE.FLEE;
            }
            break;

        case ENEMY_STATE.ATTACK:
            vis.attackTimer -= delta;
            if (vis.attackTimer <= 0) {
                if (isUFO) {
                    // UFO shoots tractor laser beam downward at target
                    vis.attackTimer = 1.8 + Math.random() * 1.5;
                    const laserGeo = new THREE.CylinderGeometry(0.15, 0.15, 30, 8);
                    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.8 });
                    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
                    laserMesh.position.set(entity.x, entity.y - 15, entity.z);
                    sceneRef.add(laserMesh);
                    
                    setTimeout(() => {
                        sceneRef.remove(laserMesh);
                        laserGeo.dispose();
                        laserMat.dispose();
                    }, 450);

                    // Deal splash damage at impact point
                    if (targetIsPlayer && distToTarget < 5.0) {
                        damagePlayer(35, entity.x, entity.z, player.x, player.z, 0);
                        showToast('UFO Tractor Ray', 'Struck by alien plasma ray!', 'danger');
                    } else if (targetEntity && distToTarget < 5.0) {
                        damageEntity(targetEntity.id, 40);
                    }

                    // UFO drops monster units
                    if (Math.random() < 0.35) {
                        spawnEnemy(ENEMY_TYPES.MONSTER, entity.x + (Math.random() - 0.5) * 4, entity.z + (Math.random() - 0.5) * 4);
                        showToast('Invasion Spawn', 'UFO spawned a beast!', 'warning');
                    }
                } 
                else if (isGargoyle) {
                    // Flying Gargoyle shoots fireballs
                    vis.attackTimer = 2.0 + Math.random() * 1.5;
                    const fbGeo = new THREE.SphereGeometry(0.2, 4, 4);
                    const fbMat = new THREE.MeshBasicMaterial({ color: 0xFF5500 });
                    const fbMesh = new THREE.Mesh(fbGeo, fbMat);
                    fbMesh.position.set(entity.x, entity.y - 0.3, entity.z);
                    sceneRef.add(fbMesh);

                    const dirX = targetX - entity.x;
                    const dirZ = targetZ - entity.z;
                    const len = Math.sqrt(dirX*dirX + dirZ*dirZ) || 1;
                    const normDir = { x: dirX / len, z: dirZ / len };

                    let fbLife = 2.0;
                    const fbInterval = setInterval(() => {
                        if (!sceneRef) { clearInterval(fbInterval); return; }
                        fbMesh.position.x += normDir.x * 0.45;
                        fbMesh.position.z += normDir.z * 0.45;

                        // Check collision
                        if (targetIsPlayer) {
                            const dSq = (player.x - fbMesh.position.x)**2 + (player.z - fbMesh.position.z)**2;
                            if (dSq < 4.0) {
                                damagePlayer(15, entity.x, entity.z, player.x, player.z, 0);
                                sceneRef.remove(fbMesh);
                                fbGeo.dispose();
                                fbMat.dispose();
                                clearInterval(fbInterval);
                                return;
                            }
                        }

                        fbLife -= 0.05;
                        if (fbLife <= 0) {
                            sceneRef.remove(fbMesh);
                            fbGeo.dispose();
                            fbMat.dispose();
                            clearInterval(fbInterval);
                        }
                    }, 50);
                } 
                else {
                    // Standard physical gun/melee attacks
                    const accuracy = cfg.usesCover ? 0.7 : 0.5;
                    if (Math.random() < accuracy) {
                        if (targetIsPlayer) {
                            attacks.push({
                                damage: cfg.damage || 10,
                                fromX: entity.x,
                                fromZ: entity.z,
                            });
                        } else if (targetEntity) {
                            damageEntity(targetEntity.id, cfg.damage || 10);
                        }
                    }
                    vis.attackTimer = 1 / (cfg.fireRate || 1.5) + Math.random() * 0.3;
                }
            }

            // Face target direction
            vis.mesh.rotation.y = Math.atan2(targetX - entity.x, targetZ - entity.z);

            if (distToTarget > (cfg.attackRange || 15) * 1.2) {
                vis.state = ENEMY_STATE.CHASE;
            }
            if (entity.health < (cfg.health || 50) * 0.15 && !isUFO) {
                vis.state = ENEMY_STATE.FLEE;
            }
            break;

        case ENEMY_STATE.FLEE:
            const fleeDir = normalize2D(entity.x - targetX, entity.z - targetZ);
            moveToward(entity, entity.x + fleeDir.x * 10, entity.z + fleeDir.z * 10, 3.5 * delta);
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
                const d = dist2D(entity.x, entity.z, playerX, playerZ);
                if (d > 5) {
                    moveToward(entity, playerX, playerZ, (cfg.speed || 2) * delta);
                } else if (d < 3) {
                    const pushDir = normalize2D(entity.x - playerX, entity.z - playerZ);
                    moveToward(entity, entity.x + pushDir.x, entity.z + pushDir.z, (cfg.speed || 2) * 0.5 * delta);
                }
            }
            if (entity.health < (cfg.health || 50) * 0.15) {
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

    if (!isInsideAnyBuilding(nx, nz, 1.5)) {
        updateEntityPosition(entity.id, nx, entity.y, nz);
        entity.x = nx;
        entity.z = nz;
    } else {
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

export function damageEnemyAtPoint(x, y, z, radius, damage) {
    let killed = 0;
    const nearby = queryNearby(x, z, radius, 'enemy');

    for (const entity of nearby) {
        const dist = dist2D(entity.x, entity.z, x, z);
        const falloff = 1 - (dist / radius);
        let actualDamage = Math.max(1, Math.floor(damage * falloff));

        const vis = visuals.get(entity.id);
        if (vis && vis.frozenTimer > 0) {
            actualDamage *= 2;
        }

        const result = damageEntity(entity.id, actualDamage);

        if (vis) {
            vis.hitFlashTimer = 0.15;

            if (result.killed && !vis.dying) {
                vis.dying = true;
                vis.deathTimer = 0;
                vis.state = ENEMY_STATE.DEAD;
                killed++;
                triggerEnemyDeath(entity);
            } else if (!result.killed) {
                if (vis.state === ENEMY_STATE.IDLE || vis.state === ENEMY_STATE.PATROL) {
                    vis.state = ENEMY_STATE.ALERT;
                    vis.alertTimer = 0.2;
                }
            }
        }
    }

    return killed;
}

export function spawnWantedEnemies(wantedLevel, playerX, playerZ, count, type) {
    // Modify spawn request for higher wanted levels
    let finalType = type;
    if (wantedLevel >= 4 && Math.random() < 0.35) finalType = ENEMY_TYPES.MONSTER;
    if (wantedLevel === 5 && Math.random() < 0.2) finalType = ENEMY_TYPES.UFO;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + wantedLevel * 10 + Math.random() * 20;
        const sx = playerX + Math.cos(angle) * dist;
        const sz = playerZ + Math.sin(angle) * dist;

        if (!isInsideAnyBuilding(sx, sz, 2)) {
            const id = spawnEnemy(finalType, sx, sz);
            if (id) {
                const vis = visuals.get(id);
                if (vis) vis.state = ENEMY_STATE.CHASE;
            }
        }
    }
}

export function getActiveEnemyCount() {
    return getEntitiesByType('enemy').length;
}

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

export function alertEnemiesNear(x, z, radius) {
    alertNearby(x, z, radius);
}

export function freezeEnemy(entity) {
    const vis = visuals.get(entity.id);
    if (vis && !vis.dying) {
        vis.frozenTimer = 5;
        vis.burnTimer = 0;
        vis.mesh.traverse(child => {
            if (child.material && child.material.color) {
                if (child.userData.originalColor === undefined) {
                    child.userData.originalColor = child.material.color.getHex();
                }
                child.material.color.setHex(0x00FFFF);
                child.material.emissive?.setHex(0x0055AA);
            }
        });
    }
}

export function igniteEnemy(entity) {
    const vis = visuals.get(entity.id);
    if (vis && !vis.dying) {
        if (vis.frozenTimer > 0) {
            vis.frozenTimer = 0;
            vis.mesh.traverse(child => {
                if (child.material && child.userData.originalColor !== undefined) {
                    child.material.color.setHex(child.userData.originalColor);
                    child.material.emissive?.setHex(0x000000);
                }
            });
        }
        vis.burnTimer = 5;
        vis.burnDamageTimer = 0;
    }
}
