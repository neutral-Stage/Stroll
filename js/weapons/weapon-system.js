/**
 * weapon-system.js — Complete weapon system with full arsenal
 * Handles shooting, recoil, bullets, muzzle flash, procedural audio, and weapon rendering.
 * @module weapons/weapon-system
 */

import * as THREE from 'three';
import { WEAPONS, WEAPON_TYPES } from '../config.js';
import { getCurrentWeaponType, getAmmo, useAmmo, reloadWeapon as doReload, getCurrentWeapon } from '../player/inventory.js';
import { initGrapple, fireGrapple, updateGrapple } from './grapple.js';

let scene = null;
let mainCamera = null;
let weaponScene = null;
let weaponCamera = null;
let weaponGroup = null;
let activeModel = null;

// State
let currentType = WEAPON_TYPES.FISTS;
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

// Object Pooling & Shared Variables
const MAX_BULLETS = 50;
const bullets = [];
const _bulletDir = new THREE.Vector3();
const _rocketTarget = new THREE.Vector3();

// Shared geometries for performance
const bulletGeo = new THREE.SphereGeometry(0.05, 4, 4);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
const rocketGeo = new THREE.ConeGeometry(0.1, 0.3, 6);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xFF4400 });

// Shell casings
const shellCasings = [];
const MAX_SHELLS = 40;

// Audio
let audioCtx = null;
let masterGain = null;

// Raycaster for melee/hit detection
const raycaster = new THREE.Raycaster();

/**
 * Initialize the weapon rendering system.
 * @param {THREE.Scene} mainScene
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
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

    // Create muzzle flash
    const flashGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 0 });
    muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.scale.set(1, 1, 2);
    weaponGroup.add(muzzleFlash);

    initGrapple(scene);

    // Build initial weapon model
    buildWeaponModel(currentType);

    // Input handlers
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) startFiring();
    });
    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) stopFiring();
    });
}

/**
 * Build procedural 3D model for a weapon type.
 */
function buildWeaponModel(type) {
    // Clear old model
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
        case WEAPON_TYPES.PISTOL: {
            const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), gunMetal);
            slide.position.set(0, 0.03, -0.04);
            model.add(slide);
            const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), gunMetal);
            barrelMesh.rotation.x = Math.PI / 2;
            barrelMesh.position.set(0, 0.03, -0.22);
            model.add(barrelMesh);
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.2), detailMat);
            frame.position.set(0, -0.01, 0.0);
            model.add(frame);
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
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), woodMat);
            stock.position.set(0, -0.01, 0.2);
            stock.rotation.x = 0.1;
            model.add(stock);
            break;
        }
        case WEAPON_TYPES.SMG: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.3), gunMetal);
            body.position.set(0, 0.02, -0.05);
            model.add(body);
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), detailMat);
            mag.position.set(0, -0.06, 0.0);
            model.add(mag);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05), gripMat);
            grip.position.set(0, -0.06, 0.08);
            grip.rotation.x = 0.15;
            model.add(grip);
            break;
        }
        case WEAPON_TYPES.ASSAULT_RIFLE: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.45), gunMetal);
            body.position.set(0, 0.02, -0.1);
            model.add(body);
            const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), gunMetal);
            barrelMesh.rotation.x = Math.PI / 2;
            barrelMesh.position.set(0, 0.03, -0.42);
            model.add(barrelMesh);
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), detailMat);
            mag.position.set(0, -0.06, -0.02);
            mag.rotation.x = -0.1;
            model.add(mag);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.15), gripMat);
            stock.position.set(0, 0.0, 0.2);
            model.add(stock);
            break;
        }
        case WEAPON_TYPES.SNIPER: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.55), gunMetal);
            body.position.set(0, 0.02, -0.15);
            model.add(body);
            const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), detailMat);
            barrelMesh.rotation.x = Math.PI / 2;
            barrelMesh.position.set(0, 0.03, -0.55);
            model.add(barrelMesh);
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8), detailMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.07, -0.1);
            model.add(scope);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.2), woodMat);
            stock.position.set(0, -0.01, 0.2);
            model.add(stock);
            break;
        }
        case WEAPON_TYPES.RPG: {
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x556B2F, metalness: 0.3, roughness: 0.6 }));
            tube.rotation.x = Math.PI / 2;
            tube.position.set(0, 0.02, -0.15);
            model.add(tube);
            const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x8B4513, metalness: 0.5, roughness: 0.4 }));
            warhead.rotation.x = -Math.PI / 2;
            warhead.position.set(0, 0.02, -0.5);
            model.add(warhead);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), gripMat);
            grip.position.set(0, -0.06, 0.05);
            model.add(grip);
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
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), detailMat);
            body.position.set(0, 0.02, 0.0);
            model.add(body);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), gripMat);
            grip.position.set(0, -0.06, 0.05);
            model.add(grip);
            break;
        }
        case WEAPON_TYPES.GRAPPLE: {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.2), gunMetal);
            body.position.set(0, 0.02, -0.05);
            model.add(body);
            const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.1), new THREE.MeshStandardMaterial({color: 0x888888}));
            hook.rotation.x = Math.PI/2;
            hook.position.set(0, 0.02, -0.2);
            model.add(hook);
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

/**
 * Start firing (called on mousedown).
 */
export function startFiring() {
    firing = true;
}

/**
 * Stop firing (called on mouseup).
 */
export function stopFiring() {
    firing = false;
}

/**
 * Fire the current weapon once.
 */
function fireOnce() {
    const type = getCurrentWeaponType();
    const cfg = getCurrentWeapon();
    if (!cfg) return;

    if (reloading) return;

    // Check ammo
    const ammo = getAmmo(type);
    if (ammo.clip <= 0 && cfg.clipSize !== Infinity) {
        // Auto-reload
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

    // Recoil
    isRecoiling = true;
    recoilTime = 0;

    // Muzzle flash
    if (muzzleFlash && cfg.category !== 'melee' && cfg.category !== 'throwables') {
        muzzleFlash.material.opacity = 1;
        muzzleFlashTimer = 0.06;
    }

    // Create projectile
    if (type === WEAPON_TYPES.GRAPPLE) {
        fireGrapple(mainCamera);
    } else if (cfg.category === 'melee') {
        meleeAttack(cfg);
    } else if (cfg.explosive) {
        createRocket(cfg);
    } else if (cfg.pellets) {
        for (let i = 0; i < cfg.pellets; i++) {
            createBullet(cfg);
        }
    } else if (cfg.category !== 'throwables') {
        createBullet(cfg);
    }

    // Play sound
    playWeaponSound(type);

    fireTimer = 1 / cfg.fireRate;
}

function meleeAttack(cfg) {
    // Melee hit detection via short raycast
    if (!mainCamera) return;
    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    raycaster.set(mainCamera.position, _bulletDir);
    raycaster.far = cfg.range || 3;
    // Hit detection handled by game loop checking against enemies
}

function createBullet(cfg) {
    if (bullets.length >= MAX_BULLETS) {
        const old = bullets.shift();
        if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
        // Do not dispose geometry here because it is shared
    }

    if (!mainCamera || !scene) return;

    _bulletDir.set(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    // Apply spread
    _bulletDir.x += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.y += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.z += (Math.random() - 0.5) * (cfg.spread || 0);
    _bulletDir.normalize();

    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.copy(mainCamera.position);
    scene.add(mesh);

    bullets.push({
        mesh,
        direction: _bulletDir.clone(), // Still need distinct vector for storage
        speed: cfg.bulletSpeed || 150,
        lifetime: 2,
        damage: cfg.damage || 10,
        headshotMult: cfg.headshotMult || 2,
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
        speed: cfg.bulletSpeed || 40,
        lifetime: 5,
        damage: cfg.damage || 200,
        explosive: true,
        explosionRadius: cfg.explosionRadius || 8,
        isRocket: true,
    });
}

/**
 * Update the weapon system each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{ x: number, z: number }} playerPos
 * @param {boolean} isAimingInput
 * @param {THREE.WebGLRenderer} renderer
 */
export function updateWeaponSystem(delta, elapsed, playerPos, isAimingInput, renderer) {
    const type = getCurrentWeaponType();
    aimingState = isAimingInput;

    // Handle weapon type change
    if (type !== currentType) {
        currentType = type;
        buildWeaponModel(type);
        const cfg = WEAPONS[type];
        spinUpRequired = cfg?.spinUpTime || 0;
        spinUpTime = 0;
    }

    // Reload timer
    if (reloading) {
        reloadTimer -= delta;
        if (reloadTimer <= 0) {
            reloading = false;
        }
    }

    // Firing
    const cfg = getCurrentWeapon();
    if (firing && !reloading && cfg) {
        fireTimer -= delta;

        // Minigun spin-up
        if (spinUpRequired > 0 && spinUpTime < spinUpRequired) {
            spinUpTime += delta;
        } else if (fireTimer <= 0) {
            if (cfg.auto) {
                fireOnce();
            }
        }
    } else {
        spinUpTime = Math.max(0, spinUpTime - delta * 2);
    }

    // Non-auto weapons fire on initial press
    if (!cfg?.auto && firing && fireTimer <= 0) {
        fireOnce();
        firing = false; // Reset for semi-auto
    }

    // Recoil animation
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
        // Idle sway
        const swayMult = aimingState ? 0.3 : 1;
        const swayX = Math.sin(elapsed * 1.5) * 0.003 * swayMult;
        const swayY = Math.cos(elapsed * 1.2) * 0.002 * swayMult;
        const aimOffsetX = aimingState ? -0.15 : 0;
        const aimOffsetY = aimingState ? 0.05 : 0;
        weaponGroup.position.set(0.25 + swayX + aimOffsetX, -0.22 + swayY + aimOffsetY, -0.5);
        weaponGroup.rotation.set(0, 0, 0);
    }

    // Minigun barrel spin
    if (activeModel?.userData?.barrels && spinUpTime > 0) {
        activeModel.userData.barrels.rotation.z += delta * spinUpTime * 30;
    }

    // Muzzle flash fade
    if (muzzleFlashTimer > 0) {
        muzzleFlashTimer -= delta;
        if (muzzleFlashTimer <= 0 && muzzleFlash) {
            muzzleFlash.material.opacity = 0;
        }
    }

    // Update bullets
    updateBullets(delta);

    // Update grapple
    updateGrapple(delta, mainCamera);

    // Render weapon overlay
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
            if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
            b.mesh.geometry?.dispose();
            b.mesh.material?.dispose();
            bullets.splice(i, 1);
            continue;
        }

        const move = b.speed * delta;
        b.mesh.position.x += b.direction.x * move;
        b.mesh.position.y += b.direction.y * move;
        b.mesh.position.z += b.direction.z * move;

        // Rockets drop slightly (gravity)
        if (b.isRocket) {
            b.direction.y -= delta * 0.5;
            b.mesh.lookAt(b.mesh.position.clone().add(b.direction));
        }

        // Ground hit
        if (b.mesh.position.y <= 0) {
            if (b.explosive) {
                b.hitExplosion = true;
            }
            if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
            b.mesh.geometry?.dispose();
            b.mesh.material?.dispose();
            bullets.splice(i, 1);
        }
    }
}

function playWeaponSound(type) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.3;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const ctx = audioCtx;
        const now = ctx.currentTime;

        switch (type) {
            case WEAPON_TYPES.PISTOL:
                playNoiseBurst(ctx, now, 0.1, 2000, 0.4);
                playTone(ctx, now, 150, 50, 0.1, 0.3);
                break;
            case WEAPON_TYPES.SHOTGUN:
                playNoiseBurst(ctx, now, 0.15, 800, 0.6);
                playTone(ctx, now, 80, 30, 0.15, 0.5);
                break;
            case WEAPON_TYPES.SMG:
                playNoiseBurst(ctx, now, 0.06, 3000, 0.25);
                playTone(ctx, now, 200, 80, 0.06, 0.2);
                break;
            case WEAPON_TYPES.ASSAULT_RIFLE:
                playNoiseBurst(ctx, now, 0.08, 2500, 0.35);
                playTone(ctx, now, 120, 50, 0.1, 0.3);
                break;
            case WEAPON_TYPES.SNIPER:
                playNoiseBurst(ctx, now, 0.2, 1500, 0.5);
                playTone(ctx, now, 100, 30, 0.2, 0.4);
                break;
            case WEAPON_TYPES.RPG:
                playTone(ctx, now, 200, 800, 0.3, 0.4);
                playNoiseBurst(ctx, now, 0.3, 500, 0.3);
                break;
            case WEAPON_TYPES.MINIGUN:
                playNoiseBurst(ctx, now, 0.04, 4000, 0.15);
                break;
            case WEAPON_TYPES.BAT:
                playNoiseBurst(ctx, now, 0.1, 600, 0.3);
                break;
            case WEAPON_TYPES.FISTS:
                playNoiseBurst(ctx, now, 0.08, 400, 0.2);
                break;
        }
    } catch (e) { /* silent */ }
}

function playNoiseBurst(ctx, now, duration, freq, volume) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * duration * 0.3));
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

/**
 * Switch to a different weapon (rebuilds model).
 * @param {string} weaponType
 */
export function switchWeapon(weaponType) {
    currentType = weaponType;
    buildWeaponModel(weaponType);
    reloading = false;
    firing = false;
    spinUpTime = 0;
}

/** @returns {boolean} */
export function getIsReloading() { return reloading; }
/** @returns {boolean} */
export function getIsAiming() { return aimingState; }
/** @returns {string} */
export function getActiveWeaponType() { return currentType; }
/** @returns {Array} */
export function getBullets() { return bullets; }
/** Clear all active bullets */
export function clearBullets() {
    for (const b of bullets) {
        if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
    }
    bullets.length = 0;
}

/** Resize weapon camera on window resize */
export function resizeWeaponView() {
    if (weaponCamera) {
        weaponCamera.aspect = window.innerWidth / window.innerHeight;
        weaponCamera.updateProjectionMatrix();
    }
}
