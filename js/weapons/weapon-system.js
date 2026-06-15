/**
 * weapon-system.js — Complete weapon system with full arsenal
 * Handles shooting, recoil, bullets, muzzle flash, procedural audio, and weapon rendering.
 * @module weapons/weapon-system
 */

import * as THREE from 'three';
import { WEAPONS, WEAPON_TYPES } from '../config.js';
import { getCurrentWeaponType, getAmmo, useAmmo, reloadWeapon as doReload, getCurrentWeapon } from '../player/inventory.js';
import { initGrapple, fireGrapple, updateGrapple } from './grapple.js';
import { damageEnemyAtPoint } from '../enemies/enemy-manager.js';
import { damageVehicleAtPoint } from '../vehicles/vehicle-system.js';
import { damageTrafficAtPoint } from '../traffic.js';
import { damagePropsAtPoint } from '../city.js';
import { damageNPCAtPoint, alertNPCsToDanger } from '../npcs.js';
import { createExplosion, createFirePatch, spawnColoredDebris, spawnSmoke, spawnSparks } from '../destruction/explosions.js';
import { queryNearby } from '../core/entity-manager.js';
import { isInsideAnyBuilding, raycastBuildings } from '../core/physics.js';
import { spawnHitMarker, spawnDamageNumber, shake } from '../core/feel.js';
import { scaleCount } from '../quality.js';

let scene = null;
let mainCamera = null;
let weaponScene = null;
let weaponCamera = null;
let weaponGroup = null;
let activeModel = null;

// State
let currentType = WEAPON_TYPES.PISTOL;
let firing = false;
let fireTimer = 0;
let reloading = false;
let reloadTimer = 0;
let recoilTime = 0;
let isRecoiling = false;
let aimingState = false;
let spinUpTime = 0;
let spinUpRequired = 0;

// Muzzle flash
let muzzleFlash = null;
let muzzleFlashTimer = 0;
let muzzleLight = null;       // real light that flashes the world on each shot
let muzzleLightTimer = 0;

// Object Pooling & Shared Variables
const MAX_BULLETS = 50;
const bullets = [];
const _bulletDir = new THREE.Vector3();
const _rocketTarget = new THREE.Vector3();

// Shared geometries for performance
const bulletGeo = new THREE.SphereGeometry(0.06, 4, 4);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
const rocketGeo = new THREE.ConeGeometry(0.1, 0.3, 6);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xFF4400 });

// Audio
let audioCtx = null;
let masterGain = null;

// Raycaster
const raycaster = new THREE.Raycaster();

/**
 * Initialize the weapon rendering system.
 */
export function initWeaponSystem(mainScene, camera, renderer) {
    scene = mainScene;
    mainCamera = camera;

    // Weapon overlay scene
    weaponScene = new THREE.Scene();
    weaponCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10);
    weaponCamera.position.set(0, 0, 0);

    const wLight = new THREE.DirectionalLight(0xffffff, 1.5);
    wLight.position.set(1, 2, 1);
    weaponScene.add(wLight);
    weaponScene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Create weapon group
    weaponGroup = new THREE.Group();
    weaponScene.add(weaponGroup);

    // Create muzzle flash (additive so it reads as bright light, not a sphere)
    const flashGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xFFE08A, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.scale.set(1, 1, 2);
    weaponGroup.add(muzzleFlash);

    // A real point light in the WORLD scene so firing briefly lights surroundings.
    muzzleLight = new THREE.PointLight(0xffcc66, 0, 14, 2);
    scene.add(muzzleLight);

    initGrapple(scene);
    buildWeaponModel(currentType);

    // Mouse events
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) startFiring();
    });
    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) stopFiring();
    });
}

/**
 * Build procedural 3D model for a weapon type in first person.
 */
function buildWeaponModel(type) {
    if (activeModel) {
        weaponGroup.remove(activeModel);
        activeModel.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    }

    const model = new THREE.Group();
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.2, roughness: 0.8 });
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, metalness: 0.1, roughness: 0.7 });

    switch (type) {
        case WEAPON_TYPES.FISTS: {
            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), gripMat);
            fist.position.set(0.05, -0.05, -0.2);
            model.add(fist);
            const fist2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), gripMat);
            fist2.position.set(-0.05, -0.08, -0.25);
            model.add(fist2);
            break;
        }
        case WEAPON_TYPES.BAT: {
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 6), woodMat);
            handle.rotation.x = -0.3;
            handle.position.set(0, -0.05, -0.2);
            model.add(handle);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.4, 6), woodMat);
            barrel.rotation.x = -0.3;
            barrel.position.set(0, 0.15, -0.35);
            model.add(barrel);
            break;
        }
        case WEAPON_TYPES.SWORD: {
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), gripMat);
            grip.rotation.x = -0.3;
            grip.position.set(0, -0.05, -0.2);
            model.add(grip);
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), detailMat);
            guard.rotation.x = -0.3;
            guard.position.set(0, 0.02, -0.25);
            model.add(guard);
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.5), gunMetal);
            blade.rotation.x = -0.3;
            blade.position.set(0, 0.2, -0.4);
            model.add(blade);
            break;
        }
        case WEAPON_TYPES.KNIFE: {
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), gripMat);
            grip.rotation.x = -0.3;
            grip.position.set(0, -0.05, -0.15);
            model.add(grip);
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.18), gunMetal);
            blade.rotation.x = -0.3;
            blade.position.set(0, 0.05, -0.22);
            model.add(blade);
            break;
        }
        case WEAPON_TYPES.PISTOL: {
            const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), gunMetal);
            slide.position.set(0, 0.03, -0.04);
            model.add(slide);
            const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), gunMetal);
            barrelMesh.rotation.x = Math.PI / 2;
            barrelMesh.position.set(0, 0.03, -0.22);
            model.add(barrelMesh);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gripMat);
            grip.position.set(0, -0.07, 0.06);
            grip.rotation.x = 0.2;
            model.add(grip);
            break;
        }
        case WEAPON_TYPES.SHOTGUN: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.5), gunMetal);
            body.position.set(0, 0.02, -0.1);
            model.add(body);
            const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), gunMetal);
            barrelMesh.rotation.x = Math.PI / 2;
            barrelMesh.position.set(0, 0.03, -0.45);
            model.add(barrelMesh);
            const pump = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), woodMat);
            pump.position.set(0, -0.02, -0.25);
            model.add(pump);
            break;
        }
        case WEAPON_TYPES.SMG: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.3), gunMetal);
            body.position.set(0, 0.02, -0.05);
            model.add(body);
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), detailMat);
            mag.position.set(0, -0.06, 0.0);
            model.add(mag);
            break;
        }
        case WEAPON_TYPES.ASSAULT_RIFLE: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.45), gunMetal);
            body.position.set(0, 0.02, -0.1);
            model.add(body);
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), detailMat);
            mag.position.set(0, -0.06, -0.02);
            model.add(mag);
            break;
        }
        case WEAPON_TYPES.SNIPER: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.55), gunMetal);
            body.position.set(0, 0.02, -0.15);
            model.add(body);
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8), detailMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.07, -0.1);
            model.add(scope);
            break;
        }
        case WEAPON_TYPES.RPG: {
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), gunMetal);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(0, 0.02, -0.15);
            model.add(tube);
            const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xFF4400 }));
            warhead.rotation.x = -Math.PI / 2;
            warhead.position.set(0, 0.02, -0.5);
            model.add(warhead);
            break;
        }
        case WEAPON_TYPES.MINIGUN: {
            const barrels = new THREE.Group();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6), gunMetal);
                b.rotation.x = Math.PI / 2;
                b.position.set(Math.cos(angle) * 0.025, Math.sin(angle) * 0.025 + 0.03, -0.25);
                barrels.add(b);
            }
            model.add(barrels);
            model.userData.barrels = barrels;
            break;
        }
        case WEAPON_TYPES.GRENADE:
        case WEAPON_TYPES.MOLOTOV:
        case WEAPON_TYPES.SMOKE_BOMB: {
            const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gunMetal);
            bomb.position.set(0, -0.03, -0.15);
            model.add(bomb);
            break;
        }
        default: {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), gunMetal);
            model.add(box);
        }
    }

    weaponGroup.add(model);
    activeModel = model;
    muzzleFlash.position.set(0, 0.03, -0.5);

    // Position weapon in bottom-right
    weaponGroup.position.set(0.25, -0.22, -0.5);
    weaponGroup.rotation.set(0, 0, 0);
}

export function startFiring() { firing = true; }
export function stopFiring() { firing = false; }

function fireOnce() {
    const type = getCurrentWeaponType();
    const cfg = getCurrentWeapon();
    if (!cfg) return;

    if (reloading) return;

    // Check ammo
    const ammo = getAmmo(type);
    if (ammo.clip <= 0 && cfg.clipSize !== Infinity) {
        const result = doReload(type);
        if (result.reloaded) {
            reloading = true;
            reloadTimer = result.reloadTime;
        }
        return;
    }

    // Use ammo
    if (cfg.clipSize !== Infinity) {
        if (!useAmmo(type)) return;
    }

    isRecoiling = true;
    recoilTime = 0;

    const isGun = cfg.category !== 'melee' && cfg.category !== 'throwables';
    if (muzzleFlash && isGun) {
        // Brighter, larger, randomized flash + a real light + camera recoil kick.
        muzzleFlash.material.opacity = 1;
        const s = 1.6 + Math.random() * 0.9;
        muzzleFlash.scale.set(s, s, s * 1.8);
        muzzleFlash.rotation.z = Math.random() * Math.PI;
        muzzleFlashTimer = 0.12;
        if (muzzleLight && mainCamera) {
            _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
            muzzleLight.position.copy(mainCamera.position).addScaledVector(_bulletDir, 1.0);
            muzzleLight.intensity = 5 + (cfg.recoil || 0.03) * 30;
            muzzleLightTimer = 0.08;
        }
        shake(0.006 + (cfg.recoil || 0.03) * 0.45, 0.07);
        // Gunfire sends nearby civilians running.
        if (mainCamera) alertNPCsToDanger(mainCamera.position.x, mainCamera.position.z, 26, 3);
    }

    if (type === WEAPON_TYPES.GRAPPLE) {
        fireGrapple(mainCamera);
    } else if (cfg.category === 'melee') {
        meleeAttack(cfg);
    } else if (cfg.category === 'throwables') {
        throwProjectile(type, cfg);
    } else if (cfg.explosive) {
        createRocket(cfg);
    } else if (cfg.pellets) {
        for (let i = 0; i < cfg.pellets; i++) {
            createBullet(cfg);
        }
    } else {
        createBullet(cfg);
    }

    playWeaponSound(type);
    fireTimer = 1 / cfg.fireRate;
}

function meleeAttack(cfg) {
    if (!mainCamera) return;
    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    
    // Slash checks in a small cone in front of player
    const origin = mainCamera.position;
    const range = cfg.range || 3.5;
    const damage = cfg.damage || 25;

    const hitPt = origin.clone().add(_bulletDir.clone().multiplyScalar(range * 0.5));

    // Apply damage to enemies, traffic, NPCs, and props
    const nearEnemies = queryNearby(hitPt.x, hitPt.z, range * 0.8, 'enemy');
    const killed = damageEnemyAtPoint(hitPt.x, hitPt.y, hitPt.z, range * 0.7, damage);
    damageVehicleAtPoint(hitPt.x, hitPt.z, range * 0.7, damage);
    damageTrafficAtPoint(hitPt.x, hitPt.z, range * 0.7, damage);
    damagePropsAtPoint(hitPt.x, hitPt.z, range * 0.7, damage, spawnColoredDebris);
    damageNPCAtPoint(hitPt.x, hitPt.z, range * 0.7, damage, spawnColoredDebris);

    // Melee connects with weight: marker, number, sparks, a solid shake.
    if (nearEnemies.length > 0) {
        const e = nearEnemies[0];
        spawnHitMarker({ kill: killed > 0 });
        spawnDamageNumber(e.x, (e.y || 1.2) + 1.1, e.z, damage, {
            crit: killed > 0,
            color: killed > 0 ? '#ff5544' : '#ffffff',
        });
        spawnSparks(hitPt.x, hitPt.y, hitPt.z, scaleCount(5), 6);
        shake(0.022, 0.09);
    }
}

function createBullet(cfg) {
    if (bullets.length >= MAX_BULLETS) {
        const old = bullets.shift();
        if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }

    if (!mainCamera || !scene) return;

    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    _bulletDir.x += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.y += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.z += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.normalize();

    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.copy(mainCamera.position);
    scene.add(mesh);

    bullets.push({
        mesh,
        direction: _bulletDir.clone(),
        speed: cfg.bulletSpeed || 150,
        lifetime: 1.5,
        damage: cfg.damage || 10,
        explosive: false
    });
}

function createRocket(cfg) {
    if (!mainCamera || !scene) return;

    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);

    const mesh = new THREE.Mesh(rocketGeo, rocketMat);
    mesh.position.copy(mainCamera.position);
    _rocketTarget.copy(mainCamera.position).add(_bulletDir);
    mesh.lookAt(_rocketTarget);
    scene.add(mesh);

    bullets.push({
        mesh,
        direction: _bulletDir.clone(),
        speed: cfg.bulletSpeed || 45,
        lifetime: 4.0,
        damage: cfg.damage || 200,
        explosive: true,
        explosionRadius: cfg.explosionRadius || 8,
        isRocket: true
    });
}

function throwProjectile(type, cfg) {
    if (!mainCamera || !scene) return;

    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    
    // Spawn throwable canister mesh
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: type===WEAPON_TYPES.MOLOTOV?0x8b4513:0x444444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mainCamera.position).add(_bulletDir.clone().multiplyScalar(0.5));
    scene.add(mesh);

    // Initial physics velocity
    const speed = cfg.throwForce || 14;
    const velocity = new THREE.Vector3(
        _bulletDir.x * speed,
        _bulletDir.y * speed + 5.0, // lob arc upwards
        _bulletDir.z * speed
    );

    bullets.push({
        mesh,
        velocity,
        lifetime: cfg.fuseTime || 3.0,
        damage: cfg.damage || 150,
        explosive: true,
        explosionRadius: cfg.explosionRadius || 6,
        isThrowable: true,
        throwableType: type,
        fireRadius: cfg.fireRadius || 5,
        fireDuration: cfg.fireDuration || 10,
        smokeRadius: cfg.smokeRadius || 8,
        smokeDuration: cfg.smokeDuration || 10
    });
}

export function updateWeaponSystem(delta, elapsed, playerPos, isAimingInput, renderer) {
    const type = getCurrentWeaponType();
    aimingState = isAimingInput;

    if (type !== currentType) {
        currentType = type;
        buildWeaponModel(type);
        const cfg = WEAPONS[type];
        spinUpRequired = cfg?.spinUpTime || 0;
        spinUpTime = 0;
    }

    if (reloading) {
        reloadTimer -= delta;
        if (reloadTimer <= 0) reloading = false;
    }

    const cfg = getCurrentWeapon();
    if (firing && !reloading && cfg) {
        fireTimer -= delta;
        if (spinUpRequired > 0 && spinUpTime < spinUpRequired) {
            spinUpTime += delta;
        } else if (fireTimer <= 0) {
            if (cfg.auto) fireOnce();
        }
    } else {
        spinUpTime = Math.max(0, spinUpTime - delta * 2);
    }

    if (cfg && !cfg.auto && firing && fireTimer <= 0) {
        fireOnce();
        firing = false;
    }

    // Recoil animations
    if (isRecoiling && weaponGroup) {
        recoilTime += delta;
        const recoilDuration = 0.12;
        const t = recoilTime / recoilDuration;
        if (t >= 1) {
            isRecoiling = false;
            weaponGroup.position.set(0.25, -0.22, -0.5);
        } else {
            const kick = Math.sin(t * Math.PI);
            const recoilAmt = cfg?.recoil || 0.03;
            weaponGroup.position.set(0.25, -0.22 + kick * recoilAmt, -0.5 + kick * recoilAmt * 2);
            weaponGroup.rotation.x = -kick * recoilAmt * 5;
        }
    } else if (weaponGroup && !isRecoiling) {
        const swayMult = aimingState ? 0.3 : 1;
        const swayX = Math.sin(elapsed * 1.5) * 0.003 * swayMult;
        const swayY = Math.cos(elapsed * 1.2) * 0.002 * swayMult;
        const aimOffsetX = aimingState ? -0.15 : 0;
        const aimOffsetY = aimingState ? 0.05 : 0;
        weaponGroup.position.set(0.25 + swayX + aimOffsetX, -0.22 + swayY + aimOffsetY, -0.5);
        weaponGroup.rotation.set(0, 0, 0);
    }

    if (activeModel?.userData?.barrels && spinUpTime > 0) {
        activeModel.userData.barrels.rotation.z += delta * spinUpTime * 30;
    }

    if (muzzleFlashTimer > 0) {
        muzzleFlashTimer -= delta;
        if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleFlashTimer / 0.12);
    }
    if (muzzleLightTimer > 0) {
        muzzleLightTimer -= delta;
        if (muzzleLight) muzzleLight.intensity *= 0.82;
        if (muzzleLightTimer <= 0 && muzzleLight) muzzleLight.intensity = 0;
    }

    updateBullets(delta);
    updateGrapple(delta, mainCamera);

    // Overlay pass
    if (renderer && weaponScene && weaponCamera) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(weaponScene, weaponCamera);
        renderer.autoClear = true;
    }
}

function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.lifetime -= delta;

        if (b.lifetime <= 0) {
            detonateBullet(b);
            bullets.splice(i, 1);
            continue;
        }

        const oldPos = b.mesh.position.clone();

        if (b.isThrowable) {
            // Apply gravity & velocity physics to throwables
            b.velocity.y -= 20 * delta; // Gravity
            b.mesh.position.addScaledVector(b.velocity, delta);

            // Bouncing collision physics
            if (isInsideAnyBuilding(b.mesh.position.x, b.mesh.position.z, 0.5)) {
                // Bounce back off building footprint
                b.velocity.x *= -0.5;
                b.velocity.z *= -0.5;
                b.mesh.position.copy(oldPos);
            }

            if (b.mesh.position.y <= 0.1) {
                b.mesh.position.y = 0.1;
                
                // Shatter instantly on ground
                if (b.throwableType === WEAPON_TYPES.MOLOTOV || b.throwableType === WEAPON_TYPES.SMOKE_BOMB) {
                    detonateBullet(b);
                    bullets.splice(i, 1);
                    continue;
                }
                
                // Bouncing dampening
                b.velocity.y = Math.abs(b.velocity.y) * 0.4;
                b.velocity.x *= 0.8;
                b.velocity.z *= 0.8;
            }
        } else {
            // Straight line bullets & rockets
            const move = b.speed * delta;
            b.mesh.position.addScaledVector(b.direction, move);

            if (b.isRocket) {
                b.direction.y -= delta * 0.2; // slight rocket drop
                b.mesh.lookAt(b.mesh.position.clone().add(b.direction));
            }

            // Raycast buildings to hit walls
            const ray = raycastBuildings(oldPos.x, oldPos.y, oldPos.z, b.direction.x, b.direction.y, b.direction.z, move, 0.1);
            
            // Query nearby units to check direct hits
            const hitEntities = queryNearby(b.mesh.position.x, b.mesh.position.z, 2.0);
            let hitUnit = false;
            for (const ent of hitEntities) {
                if (ent.type === 'enemy') {
                    const dy = Math.abs((ent.y || 1) - b.mesh.position.y);
                    if (dy < 2.0) {
                        hitUnit = true;
                        break;
                    }
                }
            }

            if (ray.hit || hitUnit || b.mesh.position.y <= 0) {
                const hitX = ray.hit ? ray.x : b.mesh.position.x;
                const hitY = ray.hit ? ray.y : Math.max(0.2, b.mesh.position.y);
                const hitZ = ray.hit ? ray.z : b.mesh.position.z;
                
                b.mesh.position.set(hitX, hitY, hitZ);
                detonateBullet(b);
                bullets.splice(i, 1);
                continue;
            }
        }
    }
}

function detonateBullet(b) {
    const pos = b.mesh.position;
    
    if (b.explosive) {
        if (b.throwableType === WEAPON_TYPES.MOLOTOV) {
            // Incendiary patch
            createFirePatch(pos.x, pos.z, b.fireRadius || 5, b.fireDuration || 10);
            createExplosion(pos.x, pos.y, pos.z, b.explosionRadius || 4, b.damage || 80);
        } 
        else if (b.throwableType === WEAPON_TYPES.SMOKE_BOMB) {
            // Spawn expanding cluster of dark smoke
            spawnSmoke(pos.x, pos.y, pos.z, 25);
            // Non-lethal disorienting splash
            damageEnemyAtPoint(pos.x, pos.y, pos.z, b.smokeRadius || 8, 10);
            damageNPCAtPoint(pos.x, pos.z, b.smokeRadius || 8, 10, spawnColoredDebris);
        } 
        else {
            // General explosive grenade/rocket detonation
            createExplosion(pos.x, pos.y, pos.z, b.explosionRadius || 8, b.damage || 150);
        }
    } else {
        // Bullet impact — query victims first so feedback lands on the body.
        const nearEnemies = queryNearby(pos.x, pos.z, 1.5, 'enemy');
        const killed = damageEnemyAtPoint(pos.x, pos.y, pos.z, 1.2, b.damage);
        damageVehicleAtPoint(pos.x, pos.z, 1.2, b.damage);
        damageTrafficAtPoint(pos.x, pos.z, 1.2, b.damage);
        damagePropsAtPoint(pos.x, pos.z, 1.2, b.damage, spawnColoredDebris);
        damageNPCAtPoint(pos.x, pos.z, 1.2, b.damage, spawnColoredDebris);

        // Always spark on impact; hit-marker + damage number when a body is hit.
        if (nearEnemies.length > 0) {
            const e = nearEnemies[0];
            spawnHitMarker({ kill: killed > 0 });
            spawnDamageNumber(e.x, (e.y || 1.2) + 1.1, e.z, b.damage, {
                crit: killed > 0,
                color: killed > 0 ? '#ff5544' : '#ffffff',
            });
            spawnSparks(pos.x, pos.y, pos.z, scaleCount(7), 9);
        } else {
            spawnSparks(pos.x, pos.y, pos.z, scaleCount(4), 7);
        }
    }

    if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
    b.mesh.geometry?.dispose();
    b.mesh.material?.dispose();
}

function playWeaponSound(type) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.35;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const ctx = audioCtx;
        const now = ctx.currentTime;

        switch (type) {
            case WEAPON_TYPES.PISTOL:
                playNoiseBurst(ctx, now, 0.1, 2200, 0.45);
                playTone(ctx, now, 150, 50, 0.1, 0.3);
                break;
            case WEAPON_TYPES.SHOTGUN:
                playNoiseBurst(ctx, now, 0.15, 800, 0.7);
                playTone(ctx, now, 80, 30, 0.15, 0.5);
                break;
            case WEAPON_TYPES.SMG:
                playNoiseBurst(ctx, now, 0.06, 3200, 0.3);
                playTone(ctx, now, 220, 90, 0.06, 0.2);
                break;
            case WEAPON_TYPES.ASSAULT_RIFLE:
                playNoiseBurst(ctx, now, 0.08, 2500, 0.4);
                playTone(ctx, now, 130, 60, 0.1, 0.3);
                break;
            case WEAPON_TYPES.SNIPER:
                playNoiseBurst(ctx, now, 0.22, 1600, 0.6);
                playTone(ctx, now, 100, 30, 0.2, 0.4);
                break;
            case WEAPON_TYPES.RPG:
                playTone(ctx, now, 180, 700, 0.35, 0.45);
                playNoiseBurst(ctx, now, 0.35, 600, 0.45);
                break;
            case WEAPON_TYPES.MINIGUN:
                playNoiseBurst(ctx, now, 0.05, 3800, 0.2);
                break;
            case WEAPON_TYPES.BAT:
            case WEAPON_TYPES.SWORD:
                playNoiseBurst(ctx, now, 0.12, 700, 0.35);
                break;
            case WEAPON_TYPES.KNIFE:
                playNoiseBurst(ctx, now, 0.06, 1500, 0.25);
                break;
            case WEAPON_TYPES.GRENADE:
            case WEAPON_TYPES.MOLOTOV:
            case WEAPON_TYPES.SMOKE_BOMB:
                playNoiseBurst(ctx, now, 0.15, 500, 0.2);
                break;
        }
    } catch (e) { /* silent */ }
}

function playNoiseBurst(ctx, now, duration, freq, volume) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * duration * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter).connect(gain).connect(masterGain);
    src.start(now);
    src.stop(now + duration);
}

function playTone(ctx, now, startFreq, endFreq, duration, volume) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
}

export function switchWeapon(weaponType) {
    currentType = weaponType;
    buildWeaponModel(weaponType);
    reloading = false;
    firing = false;
    spinUpTime = 0;
}

export function getIsReloading() { return reloading; }
export function getIsAiming() { return aimingState; }
export function getIsFiring() { return firing; }
export function getActiveWeaponType() { return currentType; }
export function getBullets() { return bullets; }
export function clearBullets() {
    for (const b of bullets) {
        if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
    }
    bullets.length = 0;
}

export function resizeWeaponView() {
    if (weaponCamera) {
        weaponCamera.aspect = window.innerWidth / window.innerHeight;
        weaponCamera.updateProjectionMatrix();
    }
}
