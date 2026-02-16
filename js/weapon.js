/**
 * weapon.js — Pistol weapon system with FPS-style rendering
 *
 * Features:
 *  • Visible pistol model in bottom-right of screen (FPS style)
 *  • Left click to shoot
 *  • Crosshair/reticle in center of screen
 *  • Bullets travel forward and can hit/destroy objects
 *  • Muzzle flash effect and impact particles
 *  • Ammo counter on HUD
 *  • Destroyed objects break apart with particle effects
 *  • Ammo pickups scattered in the world
 *
 * @module weapon
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/** @type {THREE.Scene} */
let sceneRef = null;
/** @type {THREE.PerspectiveCamera} */
let cameraRef = null;

/** Weapon state */
let ammo = 100;
let maxAmmo = 100;
let isRecoiling = false;
let recoilTime = 0;
const RECOIL_DURATION = 0.12;

/** Weapon model (rendered in screen space) */
let weaponGroup = null;
let weaponScene = null;
let weaponCamera = null;
let muzzleFlash = null;
let muzzleFlashTime = 0;
const MUZZLE_FLASH_DURATION = 0.06;

/** Bullets */
const bullets = [];
const BULLET_SPEED = 120;
const BULLET_LIFETIME = 2.0;

/** Impact particles */
const impactParticles = [];

/** Ammo pickups */
const ammoPickups = [];

/** Destructible objects tracking */
const destructibles = [];

/** Audio */
let weaponAudioCtx = null;
let weaponMasterGain = null;

/** Raycaster for hit detection */
const raycaster = new THREE.Raycaster();

/**
 * Initialize the weapon system.
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 */
export function initWeapon(scene, camera, renderer) {
    sceneRef = scene;
    cameraRef = camera;

    createWeaponModel();
    createCrosshair();
    createAmmoHUD();
    createAmmoPickups(scene);

    // Shoot on left click
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            shoot();
        }
    });
}

/**
 * Create the FPS pistol model rendered in weapon scene.
 */
function createWeaponModel() {
    weaponScene = new THREE.Scene();
    weaponCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10);
    weaponCamera.position.set(0, 0, 0);

    // Lighting for weapon
    const wLight = new THREE.DirectionalLight(0xffffff, 1.2);
    wLight.position.set(1, 2, 1);
    weaponScene.add(wLight);
    weaponScene.add(new THREE.AmbientLight(0xffffff, 0.5));

    weaponGroup = new THREE.Group();

    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.2, roughness: 0.8 });
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });

    // Slide (top part)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), gunMetal);
    slide.position.set(0, 0.03, -0.04);
    weaponGroup.add(slide);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.22);
    weaponGroup.add(barrel);

    // Frame (lower)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.2), detailMat);
    frame.position.set(0, -0.01, 0.0);
    weaponGroup.add(frame);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gripMat);
    grip.position.set(0, -0.07, 0.06);
    grip.rotation.x = 0.2;
    weaponGroup.add(grip);

    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.06), detailMat);
    triggerGuard.position.set(0, -0.03, 0.02);
    weaponGroup.add(triggerGuard);

    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.015), gunMetal);
    trigger.position.set(0, -0.02, 0.02);
    weaponGroup.add(trigger);

    // Front sight
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.01), detailMat);
    frontSight.position.set(0, 0.068, -0.15);
    weaponGroup.add(frontSight);

    // Rear sight
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), detailMat);
    rearSight.position.set(0, 0.065, 0.05);
    weaponGroup.add(rearSight);

    // Muzzle flash (hidden by default)
    const flashGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xFFAA00,
        transparent: true,
        opacity: 0
    });
    muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.position.set(0, 0.03, -0.28);
    muzzleFlash.scale.set(1, 1, 2);
    weaponGroup.add(muzzleFlash);

    // Position weapon in bottom-right of view
    weaponGroup.position.set(0.25, -0.22, -0.5);
    weaponGroup.rotation.set(0, 0, 0);

    weaponScene.add(weaponGroup);
}

/**
 * Create crosshair element.
 */
function createCrosshair() {
    const existing = document.getElementById('weapon-crosshair');
    if (existing) return;

    const crosshair = document.createElement('div');
    crosshair.id = 'weapon-crosshair';
    crosshair.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        pointer-events: none;
        z-index: 100;
    `;

    // Crosshair lines
    const styles = [
        'top:0;left:50%;transform:translateX(-50%);width:2px;height:6px;',
        'bottom:0;left:50%;transform:translateX(-50%);width:2px;height:6px;',
        'left:0;top:50%;transform:translateY(-50%);width:6px;height:2px;',
        'right:0;top:50%;transform:translateY(-50%);width:6px;height:2px;'
    ];

    styles.forEach(style => {
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;${style}background:rgba(255,255,255,0.8);border-radius:1px;`;
        crosshair.appendChild(line);
    });

    // Center dot
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:2px;background:rgba(255,255,255,0.9);border-radius:50%;';
    crosshair.appendChild(dot);

    document.body.appendChild(crosshair);
}

/**
 * Create ammo counter HUD element.
 */
function createAmmoHUD() {
    const existing = document.getElementById('ammo-hud');
    if (existing) return;

    const ammoHud = document.createElement('div');
    ammoHud.id = 'ammo-hud';
    ammoHud.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        color: white;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5);
        z-index: 100;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    ammoHud.innerHTML = `<span style="font-size:14px;">🔫</span> <span id="ammo-count">${ammo}</span>`;
    document.body.appendChild(ammoHud);
}

/**
 * Create ammo pickup boxes scattered in the world.
 * @param {THREE.Scene} scene
 */
function createAmmoPickups(scene) {
    const pickupCount = 15;
    const cityHalf = 80;

    for (let i = 0; i < pickupCount; i++) {
        const group = new THREE.Group();

        // Ammo box
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x556B2F, metalness: 0.3, roughness: 0.7 })
        );
        box.castShadow = true;
        group.add(box);

        // Label
        const label = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.02, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.5, roughness: 0.3 })
        );
        label.position.y = 0.21;
        group.add(label);

        // Glow
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x556B2F, transparent: true, opacity: 0.15 })
        );
        group.add(glow);

        const x = (Math.random() - 0.5) * cityHalf * 2;
        const z = (Math.random() - 0.5) * cityHalf * 2;
        group.position.set(x, 0.3, z);

        scene.add(group);
        ammoPickups.push({
            mesh: group,
            position: { x, z },
            collected: false,
            ammoAmount: 15 + Math.floor(Math.random() * 10)
        });
    }
}

/**
 * Shoot the pistol.
 */
function shoot() {
    if (ammo <= 0 || isRecoiling) return;

    ammo--;
    updateAmmoDisplay();
    isRecoiling = true;
    recoilTime = 0;

    // Muzzle flash
    if (muzzleFlash) {
        muzzleFlash.material.opacity = 1;
        muzzleFlashTime = MUZZLE_FLASH_DURATION;
    }

    // Play gunshot sound
    playGunshotSound();

    // Create bullet
    createBullet();
}

/**
 * Create a bullet projectile.
 */
function createBullet() {
    if (!cameraRef || !sceneRef) return;

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(cameraRef.quaternion);

    const bulletGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);

    bullet.position.copy(cameraRef.position);
    sceneRef.add(bullet);

    bullets.push({
        mesh: bullet,
        direction: direction.clone(),
        lifetime: BULLET_LIFETIME,
        speed: BULLET_SPEED
    });
}

/**
 * Create impact particle effect at position.
 * @param {THREE.Vector3} position
 * @param {number} color
 */
function createImpactEffect(position, color = 0xFFAA00) {
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
        const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: i < particleCount / 2 ? color : 0xFF6600,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(position);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 6,
            (Math.random() - 0.5) * 8
        );

        sceneRef.add(particle);
        impactParticles.push({
            mesh: particle,
            velocity,
            lifetime: 0.5 + Math.random() * 0.5,
            age: 0
        });
    }
}

/**
 * Create explosion effect for destroyed objects.
 * @param {THREE.Vector3} position
 * @param {number} size
 */
function createExplosionEffect(position, size = 1) {
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const s = 0.1 + Math.random() * 0.2 * size;
        const geo = new THREE.BoxGeometry(s, s, s);
        const colors = [0xFF4400, 0xFF8800, 0xFFCC00, 0x888888, 0x444444];
        const mat = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(position);
        particle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 12 * size,
            Math.random() * 10 * size,
            (Math.random() - 0.5) * 12 * size
        );

        sceneRef.add(particle);
        impactParticles.push({
            mesh: particle,
            velocity,
            lifetime: 0.8 + Math.random() * 0.8,
            age: 0,
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            )
        });
    }

    // Flash
    const flashGeo = new THREE.SphereGeometry(size * 1.5, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xFFFF00,
        transparent: true,
        opacity: 0.8
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    sceneRef.add(flash);
    impactParticles.push({
        mesh: flash,
        velocity: new THREE.Vector3(0, 0, 0),
        lifetime: 0.2,
        age: 0,
        isFlash: true
    });
}

/**
 * Update weapon system each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x: number, z: number}} playerPos
 * @param {THREE.WebGLRenderer} renderer
 */
export function updateWeapon(delta, elapsed, playerPos, renderer) {
    // Update recoil animation
    if (isRecoiling) {
        recoilTime += delta;
        const t = recoilTime / RECOIL_DURATION;
        if (t >= 1) {
            isRecoiling = false;
            if (weaponGroup) {
                weaponGroup.position.set(0.25, -0.22, -0.5);
                weaponGroup.rotation.set(0, 0, 0);
            }
        } else {
            // Recoil: kick back and up
            const recoilAmount = Math.sin(t * Math.PI);
            if (weaponGroup) {
                weaponGroup.position.set(0.25, -0.22 + recoilAmount * 0.03, -0.5 + recoilAmount * 0.05);
                weaponGroup.rotation.x = -recoilAmount * 0.15;
            }
        }
    } else if (weaponGroup) {
        // Idle sway
        const swayX = Math.sin(elapsed * 1.5) * 0.003;
        const swayY = Math.cos(elapsed * 1.2) * 0.002;
        weaponGroup.position.set(0.25 + swayX, -0.22 + swayY, -0.5);
    }

    // Update muzzle flash
    if (muzzleFlashTime > 0) {
        muzzleFlashTime -= delta;
        if (muzzleFlashTime <= 0 && muzzleFlash) {
            muzzleFlash.material.opacity = 0;
        }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.lifetime -= delta;

        if (bullet.lifetime <= 0) {
            sceneRef.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
            bullets.splice(i, 1);
            continue;
        }

        // Move bullet
        const moveAmount = bullet.speed * delta;
        bullet.mesh.position.add(bullet.direction.clone().multiplyScalar(moveAmount));

        // Check hits against scene objects
        checkBulletHits(bullet, i);
    }

    // Update impact particles
    for (let i = impactParticles.length - 1; i >= 0; i--) {
        const p = impactParticles[i];
        p.age += delta;

        if (p.age >= p.lifetime) {
            sceneRef.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            impactParticles.splice(i, 1);
            continue;
        }

        const t = p.age / p.lifetime;
        p.mesh.material.opacity = 1 - t;

        if (p.isFlash) {
            p.mesh.scale.setScalar(1 + t * 3);
        } else {
            p.velocity.y -= 15 * delta; // gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));

            if (p.rotSpeed) {
                p.mesh.rotation.x += p.rotSpeed.x * delta;
                p.mesh.rotation.y += p.rotSpeed.y * delta;
                p.mesh.rotation.z += p.rotSpeed.z * delta;
            }

            p.mesh.scale.setScalar(1 - t * 0.5);
        }
    }

    // Check ammo pickups
    for (const pickup of ammoPickups) {
        if (pickup.collected) continue;

        const dx = playerPos.x - pickup.position.x;
        const dz = playerPos.z - pickup.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2) {
            pickup.collected = true;
            sceneRef.remove(pickup.mesh);
            ammo = Math.min(ammo + pickup.ammoAmount, maxAmmo + 50);
            updateAmmoDisplay();
            playPickupAmmoSound();
        } else {
            // Bob animation
            pickup.mesh.position.y = 0.3 + Math.sin(elapsed * 2 + pickup.position.x) * 0.1;
            pickup.mesh.rotation.y = elapsed * 0.5;
        }
    }

    // Render weapon overlay
    if (renderer && weaponScene && weaponCamera) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(weaponScene, weaponCamera);
        renderer.autoClear = true;
    }
}

/**
 * Check if a bullet hits any scene objects.
 */
function checkBulletHits(bullet, bulletIndex) {
    // Simple distance-based hit detection against scene children
    const bulletPos = bullet.mesh.position;

    sceneRef.traverse((child) => {
        if (!child.isMesh) return;
        if (child === bullet.mesh) return;
        if (!child.geometry) return;

        // Skip ground, sky, and weapon-related meshes
        if (child.geometry.type === 'PlaneGeometry' && child.rotation.x === -Math.PI / 2) return;
        if (child.geometry.type === 'SphereGeometry' && child.material && child.material.side === THREE.BackSide) return;

        // Get world position of the object
        const objPos = new THREE.Vector3();
        child.getWorldPosition(objPos);

        const dist = bulletPos.distanceTo(objPos);

        // Check if bullet is close enough to hit
        if (dist < 1.5) {
            // Hit! Create impact effect
            createImpactEffect(bulletPos.clone(), child.material ? child.material.color.getHex() : 0xFFAA00);

            // Remove bullet
            sceneRef.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
            bullets.splice(bulletIndex, 1);

            // Small objects can be destroyed
            if (child.geometry.boundingSphere) {
                child.geometry.computeBoundingSphere();
                if (child.geometry.boundingSphere.radius < 2) {
                    createExplosionEffect(objPos, child.geometry.boundingSphere.radius);
                    // Remove the hit object
                    if (child.parent) {
                        child.parent.remove(child);
                    }
                }
            }

            return;
        }
    });
}

/**
 * Update ammo display.
 */
function updateAmmoDisplay() {
    const el = document.getElementById('ammo-count');
    if (el) {
        el.textContent = ammo;
        if (ammo <= 10) {
            el.style.color = '#ff4444';
        } else if (ammo <= 25) {
            el.style.color = '#ffaa44';
        } else {
            el.style.color = 'white';
        }
    }
}

/**
 * Play gunshot sound.
 */
function playGunshotSound() {
    try {
        if (!weaponAudioCtx) {
            weaponAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            weaponMasterGain = weaponAudioCtx.createGain();
            weaponMasterGain.gain.setValueAtTime(0.3, weaponAudioCtx.currentTime);
            weaponMasterGain.connect(weaponAudioCtx.destination);
        }

        if (weaponAudioCtx.state === 'suspended') {
            weaponAudioCtx.resume();
        }

        const ctx = weaponAudioCtx;
        const now = ctx.currentTime;

        // Gunshot = noise burst + low thump
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2000, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(weaponMasterGain);
        noise.start(now);
        noise.stop(now + 0.15);

        // Low thump
        const thump = ctx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(150, now);
        thump.frequency.exponentialRampToValueAtTime(50, now + 0.1);

        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.4, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        thump.connect(thumpGain);
        thumpGain.connect(weaponMasterGain);
        thump.start(now);
        thump.stop(now + 0.2);
    } catch (e) {
        // Silently fail
    }
}

/**
 * Play ammo pickup sound.
 */
function playPickupAmmoSound() {
    try {
        if (!weaponAudioCtx) return;
        const ctx = weaponAudioCtx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(g);
        g.connect(weaponMasterGain);
        osc.start(now);
        osc.stop(now + 0.35);
    } catch (e) {
        // Silently fail
    }
}

/**
 * Get current ammo count.
 * @returns {number}
 */
export function getAmmo() {
    return ammo;
}

/**
 * Handle window resize for weapon camera.
 */
export function resizeWeapon() {
    if (weaponCamera) {
        weaponCamera.aspect = window.innerWidth / window.innerHeight;
        weaponCamera.updateProjectionMatrix();
    }
}
