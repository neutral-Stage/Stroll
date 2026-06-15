/**
 * explosions.js — Explosion and fire system with object pooling
 * @module destruction/explosions
 */

import * as THREE from 'three';
import { MAX_DEBRIS_PARTICLES, FIRE_DURATION, FIRE_DAMAGE_PER_SECOND, EXPLOSION_CHAIN_RADIUS } from '../config.js';
import { queryNearby, damageEntity } from '../core/entity-manager.js';
import { createBody, integrateBody, dist2D } from '../core/physics.js';
import { damageBuildingAtPoint, damagePropsAtPoint } from '../city.js';
import { damageVehicleAtPoint } from '../vehicles/vehicle-system.js';
import { damageTrafficAtPoint } from '../traffic.js';
import { damageEnemyAtPoint } from '../enemies/enemy-manager.js';
import { damageNPCAtPoint, alertNPCsToDanger } from '../npcs.js';
import { shake, screenFlash } from '../core/feel.js';

/** @type {THREE.Scene} */
let sceneRef = null;

// ── Explosion fireballs ──────────────────────────────────────
const fireballs = [];
const shockwaves = [];
const MAX_FIREBALLS = 10;
const MAX_SHOCKWAVES = 10;

// Shared geometries to prevent GC lag
const fireballGeo = new THREE.SphereGeometry(1, 8, 8);
const fireballMat = new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.9 });
const shockwaveGeo = new THREE.TorusGeometry(1, 0.1, 4, 16);
const shockwaveMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 0.6 });
const craterGeo = new THREE.PlaneGeometry(1, 1);
const craterMat = new THREE.MeshBasicMaterial({ 
    color: 0x111111, 
    transparent: true, 
    opacity: 0.8,
    depthWrite: false
});

// ── Debris pool ──────────────────────────────────────────────
const debrisPool = [];
const activeDebris = [];
const POOL_SIZE = 200;

// ── Spark pool ───────────────────────────────────────────────
const sparkPool = [];
const activeSparks = [];
const SPARK_POOL = 100;

// ── Smoke pool ───────────────────────────────────────────────
const smokePool = [];
const activeSmoke = [];
const SMOKE_POOL = 50;

// ── Fire patches ─────────────────────────────────────────────
const firePatches = [];

// ── Audio ────────────────────────────────────────────────────
let audioCtx = null;
let masterGain = null;

/**
 * Initialize the explosion system.
 * @param {THREE.Scene} scene
 */
export function initExplosions(scene) {
    sceneRef = scene;

    // Pre-allocate debris pool
    const debrisMats = [
        new THREE.MeshLambertMaterial({ color: 0x808080 }), // concrete
        new THREE.MeshLambertMaterial({ color: 0x444444 }), // metal
        new THREE.MeshLambertMaterial({ color: 0x8B6914 }), // wood
        new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.6 }), // glass
    ];

    for (let i = 0; i < POOL_SIZE; i++) {
        const size = 0.1 + Math.random() * 0.4;
        const geo = new THREE.BoxGeometry(size, size * (0.5 + Math.random()), size);
        const mat = debrisMats[i % debrisMats.length].clone();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.castShadow = true;
        scene.add(mesh);

        debrisPool.push({
            mesh,
            body: createBody({ gravity: true, bounce: 0.3, friction: 0.8, mass: 0.5 + Math.random() }),
            rotSpeed: new THREE.Vector3(),
            active: false,
            settledTime: 0,
        });
    }

    // Pre-allocate spark pool
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44, transparent: true });
    for (let i = 0; i < SPARK_POOL; i++) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), sparkMat.clone());
        mesh.visible = false;
        scene.add(mesh);
        sparkPool.push({
            mesh,
            vx: 0, vy: 0, vz: 0,
            lifetime: 0, age: 0,
            active: false,
        });
    }

    // Pre-allocate smoke pool
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
    for (let i = 0; i < SMOKE_POOL; i++) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), smokeMat.clone());
        mesh.visible = false;
        scene.add(mesh);
        smokePool.push({
            mesh,
            vx: 0, vy: 0, vz: 0,
            lifetime: 0, age: 0,
            active: false,
        });
    }
}

/**
 * Create an explosion at a position.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} radius
 * @param {number} damage
 */
export function createExplosion(x, y, z, radius, damage) {
    // Fireball
    if (fireballs.length < MAX_FIREBALLS) {
        const mesh = new THREE.Mesh(fireballGeo, fireballMat);
        mesh.scale.set(radius * 0.3, radius * 0.3, radius * 0.3);
        mesh.position.set(x, y + 0.5, z);
        sceneRef.add(mesh);

        fireballs.push({
            mesh,
            maxRadius: radius,
            lifetime: 0.6,
            age: 0,
        });
    }

    // Shockwave ring
    const ring = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    ring.scale.set(0.5, 0.5, 0.5);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.3, z);
    sceneRef.add(ring);
    shockwaves.push({ mesh: ring, maxRadius: radius * 2, lifetime: 0.7, age: 0 });

    // Spawn debris
    spawnDebris(x, y, z, 15 + Math.floor(radius * 2), radius * 3);

    // Spawn sparks
    spawnSparks(x, y + 0.5, z, 20, radius * 5);

    // Spawn smoke
    spawnSmoke(x, y + 1, z, 8);

    // Game-feel: camera shake + screen flash scaled by blast size.
    shake(Math.min(0.09, 0.02 + radius * 0.012), 0.2);
    screenFlash('#ff7a1a', Math.min(0.42, radius * 0.045), 5);
    // Civilians scatter from the blast (wider radius than the damage).
    alertNPCsToDanger(x, z, radius * 5, 4.5);

    // Area damage to entities (knockback computed first, applied below).
    const nearby = queryNearby(x, z, radius, 'enemy');
    for (const e of nearby) {
        const dist = dist2D(e.x, e.z, x, z);
        const falloff = Math.max(0, 1 - dist / radius);
        
        // Ragdoll/Knockback hint
        if (dist > 0.1) {
            const pushForce = falloff * 20;
            e.vx = ((e.x - x) / dist) * pushForce;
            e.vz = ((e.z - z) / dist) * pushForce;
        }
    }

    damageEnemyAtPoint(x, y, z, radius, damage);
    damageVehicleAtPoint(x, z, radius, damage);
    damageTrafficAtPoint(x, z, radius, damage);
    damagePropsAtPoint(x, z, radius * 1.5, damage, spawnColoredDebris);
    damageNPCAtPoint(x, z, radius, damage, spawnColoredDebris);

    // Sound
    playExplosionSound(radius);

    // Light flash
    const light = new THREE.PointLight(0xFF6600, 3, radius * 3);
    light.position.set(x, y + 1, z);
    sceneRef.add(light);
    setTimeout(() => sceneRef.remove(light), 300);

    // Scorch mark (Crater)
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.scale.set(radius * 1.5, radius * 1.5, 1);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, 0.05 + Math.random() * 0.02, z); // slightly above ground to prevent Z-fighting
    sceneRef.add(crater);
    
    // Optional: make craters fade out over a long time (e.g. 30 seconds)
    setTimeout(() => {
        sceneRef.remove(crater);
    }, 30000);
}

function spawnDebris(x, y, z, count, force) {
    let spawned = 0;
    for (const d of debrisPool) {
        if (d.active || spawned >= count) continue;

        d.active = true;
        d.mesh.visible = true;
        d.body.x = x + (Math.random() - 0.5) * 2;
        d.body.y = y + Math.random() * 2;
        d.body.z = z + (Math.random() - 0.5) * 2;
        d.body.vx = (Math.random() - 0.5) * force;
        d.body.vy = Math.random() * force * 0.7 + 2;
        d.body.vz = (Math.random() - 0.5) * force;
        d.body.grounded = false;
        d.rotSpeed.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        d.settledTime = 0;
        d.mesh.material.opacity = 1;
        d.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        d.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        spawned++;
    }
}

export function spawnColoredDebris(x, y, z, type, count = 15, force = 10) {
    let spawned = 0;
    
    let color = 0x888888;
    if (type === 'tree') color = Math.random() > 0.5 ? 0x228b22 : 0x8b4513;
    else if (type === 'bench') color = 0x8B6914;
    else if (type === 'lamp') color = 0x444444;
    else if (type === 'npc') color = 0xcc0000;

    for (const d of debrisPool) {
        if (d.active || spawned >= count) continue;

        d.active = true;
        d.mesh.visible = true;
        d.body.x = x + (Math.random() - 0.5) * 2;
        d.body.y = y + Math.random() * 2;
        d.body.z = z + (Math.random() - 0.5) * 2;
        d.body.vx = (Math.random() - 0.5) * force;
        d.body.vy = Math.random() * force * 0.7 + 2;
        d.body.vz = (Math.random() - 0.5) * force;
        d.body.grounded = false;
        d.rotSpeed.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        d.settledTime = 0;
        d.mesh.material.opacity = 1;
        d.mesh.material.color.setHex(color);
        d.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        spawned++;
    }
}

export function spawnSparks(x, y, z, count, speed) {
    let spawned = 0;
    for (const s of sparkPool) {
        if (s.active || spawned >= count) continue;
        s.active = true;
        s.mesh.visible = true;
        s.mesh.position.set(x, y, z);
        s.vx = (Math.random() - 0.5) * speed;
        s.vy = Math.random() * speed;
        s.vz = (Math.random() - 0.5) * speed;
        s.lifetime = 0.3 + Math.random() * 0.5;
        s.age = 0;
        s.mesh.material.opacity = 1;
        s.mesh.scale.setScalar(1);
        spawned++;
    }
}

export function spawnSmoke(x, y, z, count) {
    let spawned = 0;
    for (const s of smokePool) {
        if (s.active || spawned >= count) continue;
        s.active = true;
        s.mesh.visible = true;
        s.mesh.position.set(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2);
        s.vx = (Math.random() - 0.5) * 2;
        s.vy = 1 + Math.random() * 2;
        s.vz = (Math.random() - 0.5) * 2;
        s.lifetime = 2 + Math.random() * 3;
        s.age = 0;
        s.mesh.material.opacity = 0.5;
        s.mesh.scale.setScalar(1);
        spawned++;
    }
}

/**
 * Create a fire patch on the ground.
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {number} [duration]
 */
export function createFirePatch(x, z, radius, duration = FIRE_DURATION) {
    const particleCount = Math.floor(radius * 5);
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const px = x + Math.cos(angle) * dist;
        const pz = z + Math.sin(angle) * dist;

        const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: Math.random() < 0.5 ? 0xFF4400 : 0xFF8800,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, 0.2 + Math.random() * 0.3, pz);
        sceneRef.add(mesh);
        particles.push({ mesh, baseY: mesh.position.y, phase: Math.random() * Math.PI * 2 });
    }

    // Fire light
    const light = new THREE.PointLight(0xFF4400, 1, radius * 3);
    light.position.set(x, 1, z);
    sceneRef.add(light);

    firePatches.push({
        x, z, radius,
        duration,
        timer: duration,
        particles,
        light,
        damageTimer: 0,
    });
}

/**
 * Update all explosion effects.
 * @param {number} delta
 * @param {number} elapsed
 * @param {number} playerX
 * @param {number} playerZ
 */
export function updateExplosions(delta, elapsed, playerX, playerZ) {
    // Fireballs
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const fb = fireballs[i];
        fb.age += delta;
        const t = fb.age / fb.lifetime;
        if (t >= 1) {
            sceneRef.remove(fb.mesh);
            fb.mesh.geometry.dispose();
            fb.mesh.material.dispose();
            fireballs.splice(i, 1);
        } else {
            fb.mesh.scale.setScalar(1 + t * 3);
            fb.mesh.material.opacity = 0.9 * (1 - t);
            fb.mesh.material.color.setHex(t < 0.5 ? 0xFF4400 : 0xFF8800);
        }
    }

    // Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.age += delta;
        const t = sw.age / sw.lifetime;
        if (t >= 1) {
            sceneRef.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
            shockwaves.splice(i, 1);
        } else {
            sw.mesh.scale.setScalar(1 + t * sw.maxRadius);
            sw.mesh.material.opacity = 0.6 * (1 - t);
        }
    }

    // Debris
    for (const d of debrisPool) {
        if (!d.active) continue;
        integrateBody(d.body, delta);
        d.mesh.position.set(d.body.x, d.body.y, d.body.z);
        d.mesh.rotation.x += d.rotSpeed.x * delta;
        d.mesh.rotation.y += d.rotSpeed.y * delta;
        d.mesh.rotation.z += d.rotSpeed.z * delta;

        if (d.body.grounded) {
            d.settledTime += delta;
            d.rotSpeed.multiplyScalar(0.95);
            if (d.settledTime > 3) {
                d.mesh.material.opacity -= delta * 0.5;
                if (d.mesh.material.opacity <= 0) {
                    d.active = false;
                    d.mesh.visible = false;
                }
            }
        }
    }

    // Sparks
    for (const s of sparkPool) {
        if (!s.active) continue;
        s.age += delta;
        if (s.age >= s.lifetime) {
            s.active = false;
            s.mesh.visible = false;
            continue;
        }
        s.vy -= 20 * delta;
        s.mesh.position.x += s.vx * delta;
        s.mesh.position.y += s.vy * delta;
        s.mesh.position.z += s.vz * delta;
        const t = s.age / s.lifetime;
        s.mesh.material.opacity = 1 - t;
        s.mesh.scale.setScalar(1 - t * 0.5);
        if (s.mesh.position.y < 0) { s.active = false; s.mesh.visible = false; }
    }

    // Smoke
    for (const s of smokePool) {
        if (!s.active) continue;
        s.age += delta;
        if (s.age >= s.lifetime) {
            s.active = false;
            s.mesh.visible = false;
            continue;
        }
        s.mesh.position.x += s.vx * delta;
        s.mesh.position.y += s.vy * delta;
        s.mesh.position.z += s.vz * delta;
        s.vy *= 0.98;
        const t = s.age / s.lifetime;
        s.mesh.material.opacity = 0.4 * (1 - t);
        s.mesh.scale.setScalar(1 + t * 3);
    }

    // Fire patches
    for (let i = firePatches.length - 1; i >= 0; i--) {
        const fp = firePatches[i];
        fp.timer -= delta;

        // Animate flames
        for (const p of fp.particles) {
            p.mesh.position.y = p.baseY + Math.sin(elapsed * 8 + p.phase) * 0.2 + Math.random() * 0.05;
            const flickerScale = 0.8 + Math.sin(elapsed * 12 + p.phase) * 0.3;
            p.mesh.scale.setScalar(flickerScale);
        }

        // Flicker light
        fp.light.intensity = 0.8 + Math.sin(elapsed * 10) * 0.3;

        // Damage entities in fire
        fp.damageTimer -= delta;
        if (fp.damageTimer <= 0) {
            fp.damageTimer = 0.5;
            damageEnemyAtPoint(fp.x, 0, fp.z, fp.radius, Math.floor(FIRE_DAMAGE_PER_SECOND * 0.5));
        }

        // Expire
        if (fp.timer <= 0) {
            for (const p of fp.particles) {
                sceneRef.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
            }
            sceneRef.remove(fp.light);
            firePatches.splice(i, 1);
        } else if (fp.timer < 3) {
            // Fade out
            const fade = fp.timer / 3;
            for (const p of fp.particles) {
                p.mesh.material.opacity = 0.8 * fade;
            }
            fp.light.intensity *= fade;
        }
    }
}

/**
 * Get active fire patches.
 * @returns {Array<{x: number, z: number, radius: number}>}
 */
export function getActiveFirePatches() {
    return firePatches.map(fp => ({ x: fp.x, z: fp.z, radius: fp.radius }));
}

/**
 * Clear all explosion effects.
 */
export function clearAllExplosions() {
    for (const fb of fireballs) {
        sceneRef.remove(fb.mesh);
        fb.mesh.geometry.dispose();
        fb.mesh.material.dispose();
    }
    fireballs.length = 0;

    for (const d of debrisPool) {
        d.active = false;
        d.mesh.visible = false;
    }

    for (const s of sparkPool) {
        s.active = false;
        s.mesh.visible = false;
    }

    for (const s of smokePool) {
        s.active = false;
        s.mesh.visible = false;
    }

    for (const sw of shockwaves) {
        sceneRef.remove(sw.mesh);
    }
    shockwaves.length = 0;

    for (const fp of firePatches) {
        for (const p of fp.particles) {
            sceneRef.remove(p.mesh);
        }
        sceneRef.remove(fp.light);
    }
    firePatches.length = 0;
}

function playExplosionSound(radius) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.4;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const ctx = audioCtx;
        const now = ctx.currentTime;
        const vol = Math.min(1, radius / 10);

        // Low boom
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(vol * 0.6, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(g1).connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);

        // Noise crunch
        const nBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const nData = nBuf.getChannelData(0);
        for (let i = 0; i < nData.length; i++) {
            nData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
        }
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = nBuf;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.value = 1000;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(vol * 0.5, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        nSrc.connect(nFilter).connect(g2).connect(masterGain);
        nSrc.start(now);
        nSrc.stop(now + 0.3);

        // Debris rattle
        const rBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const rData = rBuf.getChannelData(0);
        for (let i = 0; i < rData.length; i++) {
            rData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.2)) * (Math.random() < 0.1 ? 1 : 0.1);
        }
        const rSrc = ctx.createBufferSource();
        rSrc.buffer = rBuf;
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(vol * 0.2, now + 0.15);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        rSrc.connect(g3).connect(masterGain);
        rSrc.start(now + 0.1);
        rSrc.stop(now + 0.7);
    } catch (e) { /* silent */ }
}
