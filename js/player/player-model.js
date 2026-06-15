/**
 * player-model.js — Third-person player mesh rendering with joint hierarchy
 * @module player/player-model
 */

import * as THREE from 'three';
import { CAMERA_MODES, WEAPON_TYPES } from '../config.js';
import { getIsSuperpowersMode, getCurrentWeaponType } from './inventory.js';
import { getFiringState } from '../weapons/powers-system.js';
import { getIsFiring, getIsAiming, getIsReloading } from '../weapons/weapon-system.js';

let playerGroup = null;
let body = null;
let head = null;

// Pivots
let legLPivot = null;
let legRPivot = null;
let armLPivot = null;
let armRPivot = null;

// Hand attachments
let heldWeaponGroup = null;
let lastHeldItem = null;

// Locomotion animation state
let walkCycle = 0; // advances with distance travelled, not wall-clock time
let lastNow = 0;   // for an internal frame delta

// Materials
let shirtMat, pantsMat, skinMat, metalMat, woodMat, glowMat;

export function initPlayerModel(scene) {
    playerGroup = new THREE.Group();

    // Tommy Vercetti aesthetic materials
    shirtMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, roughness: 0.6 }); // Neon Cyan shirt
    pantsMat = new THREE.MeshStandardMaterial({ color: 0xF0F0F0, roughness: 0.9 }); // White pants
    skinMat = new THREE.MeshStandardMaterial({ color: 0xFFCBA4, roughness: 0.4 });  // Skin
    metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.2 });
    woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.8 });
    glowMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.8 });

    // Torso / Body (local center at y = 0.6, height 1.2)
    body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), shirtMat);
    body.position.y = 1.6;
    body.castShadow = true;
    playerGroup.add(body);

    // Head
    head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 2.45;
    head.castShadow = true;
    playerGroup.add(head);

    // Hip / Leg pivots (hip height is ~1.0)
    legLPivot = new THREE.Group();
    legLPivot.position.set(-0.2, 1.0, 0);
    playerGroup.add(legLPivot);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), pantsMat);
    legL.position.set(0, -0.5, 0); // Offset down so top of leg is at pivot
    legL.castShadow = true;
    legLPivot.add(legL);

    legRPivot = new THREE.Group();
    legRPivot.position.set(0.2, 1.0, 0);
    playerGroup.add(legRPivot);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), pantsMat);
    legR.position.set(0, -0.5, 0);
    legR.castShadow = true;
    legRPivot.add(legR);

    // Shoulder / Arm pivots (shoulder height is ~2.1)
    armLPivot = new THREE.Group();
    armLPivot.position.set(-0.55, 2.1, 0);
    playerGroup.add(armLPivot);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), skinMat);
    armL.position.set(0, -0.55, 0); // Offset down so top of arm is at pivot
    armL.castShadow = true;
    armLPivot.add(armL);

    armRPivot = new THREE.Group();
    armRPivot.position.set(0.55, 2.1, 0);
    playerGroup.add(armRPivot);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), skinMat);
    armR.position.set(0, -0.55, 0);
    armR.castShadow = true;
    armRPivot.add(armR);

    // Held item group (attached to the bottom of the right arm, i.e., hand)
    heldWeaponGroup = new THREE.Group();
    heldWeaponGroup.position.set(0, -1.1, -0.15); // Offset to hand location
    armRPivot.add(heldWeaponGroup);

    scene.add(playerGroup);
}

export function updatePlayerModel(player, isMoving, cameraMode) {
    if (!playerGroup) return;

    if (cameraMode === CAMERA_MODES.FIRST_PERSON) {
        playerGroup.visible = false;
        return;
    }
    
    playerGroup.visible = true;

    // Position matches player entity coordinates
    playerGroup.position.set(player.x, player.y, player.z);

    // Character faces the camera yaw rotation direction
    playerGroup.rotation.y = player.yaw;

    // Reset joint rotations/offsets for base skeleton state
    legLPivot.rotation.set(0, 0, 0);
    legRPivot.rotation.set(0, 0, 0);
    armLPivot.rotation.set(0, 0, 0);
    armRPivot.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    body.position.set(0, 1.6, 0);
    head.rotation.set(0, 0, 0);
    head.position.set(0, 2.45, 0);

    const nowMs = performance.now();
    const dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0.016;
    lastNow = nowMs;
    const time = nowMs * 0.015;

    // Determine current combat mode & active item
    const isSuperpowers = getIsSuperpowersMode();
    const activeWeapon = getCurrentWeaponType();
    const powerState = getFiringState();
    const activePower = powerState.currentPower;
    const isPowerCasting = powerState.active;

    const currentHeldItemKey = isSuperpowers ? `power_${activePower}` : `weapon_${activeWeapon}`;
    if (currentHeldItemKey !== lastHeldItem) {
        lastHeldItem = currentHeldItemKey;
        rebuildHeldWeaponModel(isSuperpowers, isSuperpowers ? activePower : activeWeapon);
    }

    // ── ANIMATION OVERRIDES ──────────────────────────────────
    
    if (player.pickupActive) {
        // 1. Pickup grab gesture (torso bends forward, arm sweeps down)
        body.rotation.x = Math.PI / 5;
        body.position.y = 1.45;
        body.position.z = 0.15;
        head.rotation.x = -Math.PI / 8; // Look at ground
        armRPivot.rotation.x = Math.PI / 2.5;
        armRPivot.rotation.y = -Math.PI / 10;
        armLPivot.rotation.x = Math.PI / 6;
    } 
    else if (isSuperpowers && isPowerCasting) {
        // 2. Superpowers Casting gestures
        if (activePower === 1 || activePower === 4 || activePower === 3) {
            // Fire, Laser, Blast: Right arm pointed forward, shaking from recoil
            armRPivot.rotation.x = -Math.PI / 2;
            armRPivot.rotation.y = (Math.random() - 0.5) * 0.08;
            armRPivot.rotation.z = (Math.random() - 0.5) * 0.08;
        } 
        else if (activePower === 2) {
            // Freeze: Both arms pointed forward together
            armRPivot.rotation.x = -Math.PI / 2;
            armLPivot.rotation.x = -Math.PI / 2;
        } 
        else if (activePower === 5) {
            // Thunder: Right arm raised straight up to sky
            armRPivot.rotation.x = -Math.PI * 0.95;
            armRPivot.rotation.z = Math.PI / 8;
        } 
        else if (activePower === 6) {
            // Wind: Both arms sweeping outward
            const sweep = Math.sin(time * 2) * 0.3 + 0.5;
            armRPivot.rotation.z = Math.PI / 3 * sweep;
            armRPivot.rotation.x = -Math.PI / 4;
            armLPivot.rotation.z = -Math.PI / 3 * sweep;
            armLPivot.rotation.x = -Math.PI / 4;
        }
    } 
    else if (!isSuperpowers && (getIsAiming() || getIsFiring() || getIsReloading())) {
        // 3. Physical weapons firing / aiming
        const isMelee = activeWeapon === WEAPON_TYPES.BAT || activeWeapon === WEAPON_TYPES.SWORD || activeWeapon === WEAPON_TYPES.KNIFE;
        const isTwoHanded = activeWeapon === WEAPON_TYPES.SHOTGUN || activeWeapon === WEAPON_TYPES.SMG || activeWeapon === WEAPON_TYPES.ASSAULT_RIFLE || activeWeapon === WEAPON_TYPES.SNIPER || activeWeapon === WEAPON_TYPES.RPG || activeWeapon === WEAPON_TYPES.MINIGUN;

        if (isMelee) {
            if (getIsFiring()) {
                // Slash sweep animation
                const swing = Math.sin(time * 3) * 1.2;
                armRPivot.rotation.x = -Math.PI / 3 + swing * 0.2;
                armRPivot.rotation.y = swing;
            } else {
                // Melee stance
                armRPivot.rotation.x = -Math.PI / 4;
                armRPivot.rotation.y = -Math.PI / 8;
            }
        } else {
            // Ranged Weapon stance
            armRPivot.rotation.x = -Math.PI / 2 + (player.pitch || 0);
            
            if (isTwoHanded) {
                // Left arm holds the barrel
                armLPivot.rotation.x = -Math.PI / 2.2 + (player.pitch || 0);
                armLPivot.rotation.y = Math.PI / 6;
                armLPivot.rotation.z = -Math.PI / 10;
            }

            if (getIsFiring()) {
                // Jitter right arm for recoil
                armRPivot.rotation.x += (Math.random() - 0.5) * 0.05;
                armRPivot.rotation.y += (Math.random() - 0.5) * 0.05;
            }

            if (getIsReloading()) {
                // Left hand reloads under body
                armLPivot.rotation.x = -Math.PI / 4;
                armLPivot.rotation.y = Math.PI / 4;
                armLPivot.rotation.z = Math.sin(time * 4) * 0.2;
            }
        }
    }
    
    // ── LOCOMOTION (velocity-driven — no ice-skating, no frozen idle) ──

    const speed = player.speed || 0;
    const maxSpeed = player.maxSpeed || 1;
    const speed01 = Math.min(1, speed / Math.max(0.001, maxSpeed)); // 0 idle → ~0.5 walk → 1 run
    const moving = speed > 0.4;
    const armsFreeR = !isPowerCasting && (isSuperpowers || (!getIsAiming() && !getIsFiring() && !getIsReloading()));
    const armsFreeL = !isPowerCasting && (isSuperpowers || (!getIsAiming() && !getIsFiring() && !getIsReloading()
        && activeWeapon !== WEAPON_TYPES.SHOTGUN && activeWeapon !== WEAPON_TYPES.ASSAULT_RIFLE
        && activeWeapon !== WEAPON_TYPES.SNIPER && activeWeapon !== WEAPON_TYPES.RPG));

    if (moving && !player.pickupActive) {
        // Cadence is proportional to actual ground speed, so footfalls match
        // travel (the old version was tied to wall-clock → ice-skating).
        walkCycle += speed * dt * 2.2;
        const amp = 0.18 + speed01 * 0.5; // walk → run swing
        legLPivot.rotation.x = Math.sin(walkCycle) * amp;
        legRPivot.rotation.x = Math.sin(walkCycle + Math.PI) * amp;

        if (armsFreeR) armRPivot.rotation.x = Math.sin(walkCycle + Math.PI) * amp * 0.8;
        if (armsFreeL) armLPivot.rotation.x = Math.sin(walkCycle) * amp * 0.8;

        // Lean into the run; vertical bob scales with speed.
        body.rotation.x = speed01 * 0.13;
        playerGroup.position.y = player.y + Math.abs(Math.sin(walkCycle)) * 0.06 * (0.5 + speed01);
    } else if (!player.pickupActive) {
        // Idle: breathing + subtle weight shift instead of a rigid statue.
        const breathe = Math.sin(time * 0.6);
        body.position.y = 1.6 + breathe * 0.013;
        body.rotation.z = Math.sin(time * 0.27) * 0.015;
        head.rotation.y = Math.sin(time * 0.19) * 0.08;
        const idleArm = 0.05 + breathe * 0.02;
        if (armsFreeR) { armRPivot.rotation.x = idleArm; armRPivot.rotation.z = -0.05; }
        if (armsFreeL) { armLPivot.rotation.x = idleArm; armLPivot.rotation.z = 0.05; }
        playerGroup.position.y = player.y;
        walkCycle *= 0.92; // settle the stride so we restart cleanly
    }
}

/**
 * Rebuild the 3D model attached to the hand pivot.
 */
function rebuildHeldWeaponModel(isSuperpowers, itemId) {
    // Clear old elements
    while (heldWeaponGroup.children.length > 0) {
        const child = heldWeaponGroup.children[0];
        heldWeaponGroup.remove(child);
        child.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    }

    if (isSuperpowers) {
        // Draw glowing superpower crystal/fire orb in hand
        let color = 0xFF4400;
        if (itemId === 2) color = 0x00FFFF;      // Freeze
        else if (itemId === 3) color = 0xFFAA00; // Blast
        else if (itemId === 4) color = 0xFF0055; // Laser
        else if (itemId === 5) color = 0xaa55ff; // Thunder
        else if (itemId === 6) color = 0xffffff; // Wind

        const sphere = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.15, 1),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        );
        heldWeaponGroup.add(sphere);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending })
        );
        heldWeaponGroup.add(glow);
    } 
    else {
        // Draw physical weapons
        switch (itemId) {
            case WEAPON_TYPES.BAT: {
                const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.9, 8), woodMat);
                bat.rotation.x = Math.PI / 2;
                bat.position.set(0, 0, -0.3);
                heldWeaponGroup.add(bat);
                break;
            }
            case WEAPON_TYPES.SWORD: {
                // Blade
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 1.0), metalMat);
                blade.rotation.x = Math.PI / 2;
                blade.position.set(0, 0, -0.4);
                heldWeaponGroup.add(blade);
                // Guard
                const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), woodMat);
                guard.position.set(0, 0, -0.05);
                heldWeaponGroup.add(guard);
                break;
            }
            case WEAPON_TYPES.KNIFE: {
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.35), metalMat);
                blade.rotation.x = Math.PI / 2;
                blade.position.set(0, 0, -0.15);
                heldWeaponGroup.add(blade);
                break;
            }
            case WEAPON_TYPES.PISTOL: {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.25), metalMat);
                body.position.set(0, 0, -0.05);
                heldWeaponGroup.add(body);
                break;
            }
            case WEAPON_TYPES.SHOTGUN:
            case WEAPON_TYPES.ASSAULT_RIFLE:
            case WEAPON_TYPES.SNIPER: {
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), metalMat);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set(0, 0, -0.45);
                heldWeaponGroup.add(barrel);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), woodMat);
                stock.position.set(0, 0, 0.1);
                heldWeaponGroup.add(stock);
                break;
            }
            case WEAPON_TYPES.SMG: {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.45), metalMat);
                body.position.set(0, 0, -0.1);
                heldWeaponGroup.add(body);
                break;
            }
            case WEAPON_TYPES.RPG: {
                const launcher = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), metalMat);
                launcher.rotation.x = Math.PI / 2;
                launcher.position.set(0, 0.05, -0.2);
                heldWeaponGroup.add(launcher);
                const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 8), woodMat);
                warhead.rotation.x = -Math.PI / 2;
                warhead.position.set(0, 0.05, -0.9);
                heldWeaponGroup.add(warhead);
                break;
            }
            case WEAPON_TYPES.GRENADE:
            case WEAPON_TYPES.SMOKE_BOMB: {
                const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), metalMat);
                heldWeaponGroup.add(bomb);
                break;
            }
            case WEAPON_TYPES.MOLOTOV: {
                const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), woodMat);
                heldWeaponGroup.add(bottle);
                break;
            }
            case WEAPON_TYPES.MINIGUN: {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), metalMat);
                body.position.set(0, -0.05, -0.1);
                heldWeaponGroup.add(body);
                break;
            }
        }
    }
}
