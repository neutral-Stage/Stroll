/**
 * powers-system.js — Superpowers replacing standard weapons
 * @module weapons/powers-system
 */

import * as THREE from 'three';
import { queryNearby, getEntitiesByType } from '../core/entity-manager.js';
import { createExplosion, createFirePatch, spawnColoredDebris } from '../destruction/explosions.js';
import { damageEnemyAtPoint, freezeEnemy, igniteEnemy } from '../enemies/enemy-manager.js';
import { getAudioContext, getMasterGain, isSoundOn } from '../audio.js';
import { applyExplosionForce, isInsideAnyBuilding, raycastBuildings } from '../core/physics.js';
import { triggerSkyFlash } from '../lighting.js';
import { damageTrafficAtPoint, cars } from '../traffic.js';
import { damageVehicleAtPoint, activeVehicles } from '../vehicles/vehicle-system.js';
import { damagePropsAtPoint } from '../city.js';
import { damageNPCAtPoint, npcs, alertNPCsToDanger } from '../npcs.js';
import { screenFlash, shake, spawnDamageNumber } from '../core/feel.js';
import { getCameraMode } from '../camera/camera-controller.js';
import { CAMERA_MODES } from '../config.js';
let scene, camera, playerMesh;

const fireGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const sparkGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const dustGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const tornadoDustBoxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const tornadoDustSphereGeo = new THREE.SphereGeometry(0.15, 4, 4);
const blastGeo = new THREE.SphereGeometry(0.4, 8, 8);
const blastHaloGeo = new THREE.SphereGeometry(0.6, 8, 8);
const ringDecalGeo = new THREE.RingGeometry(0.1, 1, 32);
const circleDecalGeo = new THREE.CircleGeometry(1.0, 16);
const freezeMistGeo = new THREE.SphereGeometry(0.3, 5, 5);
const tetraShardGeo = new THREE.TetrahedronGeometry(1.0);
const icoShardGeo = new THREE.IcosahedronGeometry(1.0);

// Shared laser geometries (rotated on X so we can scale dynamically along length axis)
const laserCoreGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
laserCoreGeo.rotateX(Math.PI / 2);
const laserHaloGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
laserHaloGeo.rotateX(Math.PI / 2);

// Pre-create 10 Torus geometries for the Tornado wind rings
const tornadoGeometries = [];
for (let i = 0; i < 10; i++) {
    const radius = 1.5 + i * (5.0 / 9.0);
    const tube = 0.2 + i * 0.05;
    const geo = new THREE.TorusGeometry(radius, tube, 8, 24);
    geo.rotateX(Math.PI / 2);
    tornadoGeometries.push(geo);
}

export const POWERS = {
    FIRE: 1,
    FREEZE: 2,
    BLAST: 3,
    LASER: 4,
    THUNDER: 5,
    WIND: 6
};

export const POWER_NAMES = {
    [POWERS.FIRE]: 'Fire',
    [POWERS.FREEZE]: 'Freeze',
    [POWERS.BLAST]: 'Blast',
    [POWERS.LASER]: 'Laser',
    [POWERS.THUNDER]: 'Thunder',
    [POWERS.WIND]: 'Wind'
};

export const POWER_COLORS = {
    [POWERS.FIRE]: '#ff4400',
    [POWERS.FREEZE]: '#00ffff',
    [POWERS.BLAST]: '#ffaa00',
    [POWERS.LASER]: '#ff0055',
    [POWERS.THUNDER]: '#aa55ff',
    [POWERS.WIND]: '#ffffff'
};

let currentPower = POWERS.FIRE;
let active = false;

const cooldowns = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
const CD_MAX = { 1: 0.1, 2: 0.1, 3: 1.0, 4: 0.1, 5: 2.0, 6: 3.0 };

const P_GROUP = new THREE.Group();

// Particles / Visuals
const projectiles = []; // for blast
const particles = []; // for fire/freeze/sparks/dust
const activeLasers = [];
const thunderEffects = [];
const windRings = []; // for tornado

const iceMat = new THREE.MeshStandardMaterial({
    color: 0xE0F7FA,
    roughness: 0.8,
    metalness: 0.9,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});

const freezeMistMat = new THREE.MeshBasicMaterial({
    color: 0x80D8FF,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
});

export function createPowersSystem(s, c, p) {
    scene = s;
    camera = c;
    playerMesh = p;
    scene.add(P_GROUP);

    document.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '6') {
            const pId = parseInt(e.key);
            currentPower = pId;
        }
    });
    
    window.addEventListener('mousedown', (e) => { if(e.button===0) active = true; });
    window.addEventListener('mouseup', (e) => { if(e.button===0) active = false; });
}

export function cyclePower(dir) {
    currentPower += dir;
    if (currentPower > 6) currentPower = 1;
    if (currentPower < 1) currentPower = 6;
}

export function getCurrentPowerInfo() {
    return {
        name: POWER_NAMES[currentPower],
        color: POWER_COLORS[currentPower],
        cd: cooldowns[currentPower],
        cdMax: CD_MAX[currentPower]
    };
}

export function updatePowersSystem(delta, elapsed, playerPos, aimFlag) {
    for (let i = 1; i <= 6; i++) {
        if (cooldowns[i] > 0) cooldowns[i] -= delta;
        if (cooldowns[i] < 0) cooldowns[i] = 0;
    }

    if (active && cooldowns[currentPower] === 0) {
        firePower(currentPower, playerPos);
    }

    updateVisuals(delta, playerPos);
}

const raycaster = new THREE.Raycaster();
const centerPt = new THREE.Vector2(0,0);

function firePower(power, playerPos) {
    raycaster.setFromCamera(centerPt, camera);
    const dir = raycaster.ray.direction;
    // Powers emit from where the player actually is for the view: the camera
    // in first-person, but the player's chest/hands in third-person (otherwise
    // the effect spawns behind the character, at the camera).
    let origin;
    if (getCameraMode() === CAMERA_MODES.THIRD_PERSON && playerPos) {
        origin = new THREE.Vector3(playerPos.x, 1.3, playerPos.z);
    } else {
        origin = camera.position.clone();
        origin.y -= 0.5;
    }
    origin.add(dir.clone().multiplyScalar(1.0));

    // Universal cast feedback so every power lands with weight.
    const castColor = POWER_COLORS[power] || '#ffffff';
    screenFlash(castColor, 0.18, 6);
    shake(0.014, 0.09);
    if (playerPos) alertNPCsToDanger(playerPos.x, playerPos.z, 30, 3.5);

    switch(power) {
        case POWERS.FIRE:
            cooldowns[power] = CD_MAX[power];
            for (let i = 0; i < 30; i++) spawnFireParticle(origin, dir);
            checkConeDamage(origin, dir, 45, 100, 'fire');
            const rayHit = raycastBuildings(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 20, 0.5);
            const hitX = rayHit.hit ? rayHit.x : origin.x + dir.x * 20;
            const hitZ = rayHit.hit ? rayHit.z : origin.z + dir.z * 20;
            createFirePatch(hitX, hitZ, 2.5, 6.0);
            playNoise(0.2, 0.15, 'lowpass', 400);
            if (Math.random() < 0.3) {
                playTone(800 + Math.random() * 400, 200, 0.05, 0.02, 'triangle');
            }
            break;
        case POWERS.FREEZE:
            cooldowns[power] = CD_MAX[power];
            for (let i = 0; i < 20; i++) spawnFreezeParticle(origin, dir);
            checkConeDamage(origin, dir, 35, 0, 'freeze');
            playNoise(0.25, 0.12, 'highpass', 2000);
            playTone(1800, 2200, 0.2, 0.06, 'sine');
            break;
        case POWERS.BLAST:
            cooldowns[power] = CD_MAX[power];
            spawnProjectile(origin, dir);
            playTone(300, 40, 0.3, 0.35, 'sine');
            break;
        case POWERS.LASER:
            cooldowns[power] = CD_MAX[power];
            fireLaser(origin, dir);
            playTone(1200, 600, 0.15, 0.15, 'sawtooth');
            playNoise(0.1, 0.05, 'bandpass', 1500);
            break;
        case POWERS.THUNDER:
            cooldowns[power] = CD_MAX[power];
            fireThunder();
            playNoise(0.3, 0.8, 'bandpass', 600);
            playNoise(1.5, 0.6, 'lowpass', 100);
            playTone(150, 40, 0.4, 0.4, 'sawtooth');
            break;
        case POWERS.WIND:
            cooldowns[power] = CD_MAX[power];
            fireWind(playerPos);
            playNoise(0.8, 0.25, 'bandpass', 400);
            playTone(90, 40, 0.6, 0.1, 'sine');
            break;
    }
}

function spawnFireParticle(origin, dir) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(fireGeo, mat);
    mesh.position.copy(origin);
    
    const spread = 0.4;
    const v = dir.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*spread,
        (Math.random()-0.5)*spread,
        (Math.random()-0.5)*spread
    )).normalize().multiplyScalar(20 + Math.random()*20);

    P_GROUP.add(mesh);
    particles.push({ mesh, vel: v, life: 1.0 + Math.random()*0.5, maxLife: 1.5, type: 'fire' });
}

function spawnFrostDecal(x, z) {
    const mat = new THREE.MeshBasicMaterial({
        color: 0x80D8FF,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(ringDecalGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.05, z);
    P_GROUP.add(mesh);
    particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 1.5,
        maxLife: 1.5,
        type: 'frost_decal'
    });
}

function spawnFreezeParticle(origin, dir) {
    const isShard = Math.random() > 0.4;
    
    let mesh, mat;
    const size = 0.1 + Math.random() * 0.15;
    if (isShard) {
        const isTetra = Math.random() > 0.5;
        mesh = new THREE.Mesh(isTetra ? tetraShardGeo : icoShardGeo, iceMat);
        mesh.scale.setScalar(size);
    } else {
        mat = freezeMistMat.clone();
        mesh = new THREE.Mesh(freezeMistGeo, mat);
        mesh.scale.setScalar(1.0 + Math.random() * (2/3));
    }
    
    mesh.position.copy(origin);
    
    const spread = 0.3;
    const spreadDir = dir.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*spread,
        (Math.random()-0.5)*spread,
        (Math.random()-0.5)*spread
    )).normalize();
    const v = spreadDir.multiplyScalar(25 + Math.random()*15); 
    
    if (!isShard) {
        v.add(new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10));
    }

    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
    if (right.lengthSq() < 0.01) right.set(1,0,0);
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();

    P_GROUP.add(mesh);
    particles.push({ 
        mesh, vel: v, life: 0.8 + Math.random()*0.5, maxLife: 1.3, type: isShard ? 'freeze_shard' : 'freeze_mist', 
        size,
        angle: Math.random() * Math.PI * 2, 
        radius: Math.random() * 1.5,
        right, up, originPos: origin.clone(),
        rotSpeed: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(15)
    });
}

function spawnProjectile(origin, dir) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(blastGeo, mat);
    
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(blastHaloGeo, haloMat);
    mesh.add(halo);

    mesh.position.copy(origin);
    const v = dir.clone().multiplyScalar(40); 
    P_GROUP.add(mesh);
    projectiles.push({ mesh, vel: v });
}

function spawnShockwave(pos) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(ringDecalGeo, mat);
    mesh.position.copy(pos);
    if (mesh.position.y < 0.1) mesh.position.y = 0.1;
    mesh.rotation.x = -Math.PI / 2;
    P_GROUP.add(mesh);
    particles.push({ mesh, vel: new THREE.Vector3(), life: 0.5, maxLife: 0.5, type: 'shockwave' });
}

function fireLaser(origin, dir) {
    const rayHit = raycastBuildings(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 150, 0.5);
    const hitPoint = rayHit.hit ? new THREE.Vector3(rayHit.x, rayHit.y, rayHit.z) : origin.clone().add(dir.clone().multiplyScalar(150));
    const distance = origin.distanceTo(hitPoint);
    
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(laserCoreGeo, mat);
    core.scale.set(1, 1, distance);
    
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(laserHaloGeo, haloMat);
    core.add(halo);

    const midPoint = origin.clone().lerp(hitPoint, 0.5);
    core.position.copy(midPoint);
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), dir);

    P_GROUP.add(core);
    activeLasers.push({ mesh: core, life: 0.3, maxLife: 0.3 });

    // Add a PointLight to the hit position
    const light = new THREE.PointLight(0xff0055, 3, 15);
    light.position.copy(hitPoint);
    scene.add(light);
    activeLasers.push({ isLight: true, light: light, life: 0.2, maxLife: 0.2 });

    // Spawn intense sparks at the hit point
    const sparkNormal = rayHit.building ? new THREE.Vector3(0,1,0) : dir.clone().multiplyScalar(-1);
    for(let i=0; i<35; i++) {
        spawnSpark(hitPoint, sparkNormal); 
    }

    // Hit-scan damage to enemies
    const enemies = getEntitiesByType('enemy');
    const line = new THREE.Line3(origin, hitPoint);
    enemies.forEach(e => {
        const ePos = new THREE.Vector3(e.x, e.y || 1, e.z);
        const closest = new THREE.Vector3();
        line.closestPointToPoint(ePos, true, closest);
        const distSq = closest.distanceToSquared(ePos);
        if (distSq < 12) { // 3.5m radius
            damageEnemyAtPoint(e.x, e.y||1, e.z, 4, 120);
        }
    });

    // Localized explosion damage at laser hit point
    createExplosion(hitPoint.x, hitPoint.y, hitPoint.z, 6, 80);
    damageVehicleAtPoint(hitPoint.x, hitPoint.z, 6, 80);
    damageTrafficAtPoint(hitPoint.x, hitPoint.z, 6, 80);
    damagePropsAtPoint(hitPoint.x, hitPoint.z, 6, 80, spawnColoredDebris);
    damageNPCAtPoint(hitPoint.x, hitPoint.z, 6, 80, spawnColoredDebris);
}

function spawnSpark(pos, normal) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(sparkGeo, mat);
    mesh.position.copy(pos);
    
    const v = normal.clone().add(new THREE.Vector3(
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2,
        (Math.random()-0.5)*2
    )).normalize().multiplyScalar(10 + Math.random()*20);

    P_GROUP.add(mesh);
    particles.push({ mesh, vel: v, life: 0.5, maxLife: 0.5, type: 'spark' });
}

function generateJaggedPoints(pStart, pEnd, segments = 10, offsetScale = 3.0) {
    const pts = [pStart.clone()];
    const deltaVec = pEnd.clone().sub(pStart);
    for (let i = 1; i < segments; i++) {
        const ratio = i / segments;
        const p = pStart.clone().addScaledVector(deltaVec, ratio);
        p.x += (Math.random() - 0.5) * offsetScale;
        p.y += (Math.random() - 0.5) * (offsetScale * 0.5);
        p.z += (Math.random() - 0.5) * offsetScale;
        pts.push(p);
    }
    pts.push(pEnd.clone());
    return pts;
}

function fireThunder() {
    raycaster.setFromCamera(centerPt, camera);
    const floor = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(floor, hit);
    if (!hit.x && hit.x !== 0) hit.copy(camera.position).add(raycaster.ray.direction.clone().multiplyScalar(30));

    triggerSkyFlash(5.0, 0.25); // Blinding flash

    const start = hit.clone();
    start.y += 100;

    // Jagged main lightning bolt
    const points = generateJaggedPoints(start, hit, 15, 8.0);

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const mesh = new THREE.Line(geo, mat);
    
    const haloMat = new THREE.LineBasicMaterial({ color: 0xaa55ff, transparent: true, opacity: 0.5 });
    const halo = new THREE.Line(geo, haloMat);
    mesh.add(halo);

    P_GROUP.add(mesh);
    thunderEffects.push({ mesh, life: 0.3, maxLife: 0.3 });

    // Thick glowing core — WebGL ignores line width, so the bolt is otherwise 1px.
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.55, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    P_GROUP.add(tube);
    thunderEffects.push({ mesh: tube, life: 0.3, maxLife: 0.3 });

    // 2-3 smaller, random branching sub-bolts
    const numBranches = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < numBranches; b++) {
        const idx = Math.floor(1 + Math.random() * (points.length - 3));
        const branchStart = points[idx];
        const branchEnd = hit.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            0,
            (Math.random() - 0.5) * 30
        ));
        
        const subPoints = generateJaggedPoints(branchStart, branchEnd, 6, 3.0);
        const subGeo = new THREE.BufferGeometry().setFromPoints(subPoints);
        const subMat = new THREE.LineBasicMaterial({ color: 0xddccff, transparent: true, opacity: 0.9 });
        const subMesh = new THREE.Line(subGeo, subMat);
        
        const subHaloMat = new THREE.LineBasicMaterial({ color: 0xaa55ff, transparent: true, opacity: 0.4 });
        const subHalo = new THREE.Line(subGeo, subHaloMat);
        subMesh.add(subHalo);
        
        P_GROUP.add(subMesh);
        thunderEffects.push({ mesh: subMesh, life: 0.25, maxLife: 0.25 });
    }

    // Black charred scorch decal on ground
    const scorchMat = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const scorchMesh = new THREE.Mesh(circleDecalGeo, scorchMat);
    scorchMesh.scale.setScalar(2.0);
    scorchMesh.rotation.x = -Math.PI / 2;
    scorchMesh.position.set(hit.x, 0.02, hit.z); // slightly above ground to prevent z-fighting
    P_GROUP.add(scorchMesh);

    particles.push({
        mesh: scorchMesh,
        vel: new THREE.Vector3(),
        life: 10.0,
        maxLife: 10.0,
        type: 'scorch_decal'
    });

    const light = new THREE.PointLight(0xcc88ff, 10, 200);
    light.position.copy(hit);
    light.position.y += 10;
    scene.add(light);
    thunderEffects.push({ isLight: true, light: light, life: 0.3, maxLife: 0.3 });

    createExplosion(hit.x, 0, hit.z, 20, 150);
    damageTrafficAtPoint(hit.x, hit.z, 20, 150);
    damageVehicleAtPoint(hit.x, hit.z, 20, 150);
    damagePropsAtPoint(hit.x, hit.z, 20, 150, spawnColoredDebris);
    damageNPCAtPoint(hit.x, hit.z, 20, 150, spawnColoredDebris);
}

function fireWind(playerPos) {
    raycaster.setFromCamera(centerPt, camera);
    const dir = raycaster.ray.direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0,0,-1);
    dir.normalize();

    const tornadoGroup = new THREE.Group();
    tornadoGroup.position.copy(playerPos);
    
    for(let i=0; i<10; i++) {
        const geo = tornadoGeometries[i];
        const mat = new THREE.MeshBasicMaterial({ color: 0xeedddd, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = i * 2.0;
        tornadoGroup.add(mesh);
    }
    
    P_GROUP.add(tornadoGroup);
    windRings.push({ group: tornadoGroup, life: 3.0, maxLife: 3.0, dir: dir, speed: 20 });
}

function spawnTornadoParticle(basePos, dir, speed, fade) {
    const isBox = Math.random() < 0.5;
    const mat = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.5 * fade,
        blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(isBox ? tornadoDustBoxGeo : tornadoDustSphereGeo, mat);
    
    const angle = Math.random() * Math.PI * 2;
    const height = Math.random() * 10;
    const radius = 1 + height * 0.3;
    
    mesh.position.set(
        basePos.x + Math.cos(angle) * radius,
        height,
        basePos.z + Math.sin(angle) * radius
    );
    
    P_GROUP.add(mesh);
    particles.push({
        mesh,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        type: 'tornado_dust',
        angle,
        radius,
        height,
        basePos: basePos.clone(),
        vel: dir.clone().multiplyScalar(speed),
        speed: 6 + Math.random() * 4,
        upSpeed: 3 + Math.random() * 3
    });
}

function spawnDustParticle(basePos, height) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(dustGeo, mat);
    mesh.position.copy(basePos);
    mesh.position.x += (Math.random()-0.5)*5;
    mesh.position.y += Math.random()*height;
    mesh.position.z += (Math.random()-0.5)*5;
    
    P_GROUP.add(mesh);
    particles.push({ mesh, vel: new THREE.Vector3((Math.random()-0.5)*2, 5 + Math.random()*5, (Math.random()-0.5)*2), life: 0.5, maxLife: 0.5, type: 'dust' });
}

function checkConeDamage(origin, dir, range, damage, type) {
    const enemies = getEntitiesByType('enemy');
    enemies.forEach(e => {
        const ePos = new THREE.Vector3(e.x, e.y || 1, e.z);
        const toEnemy = ePos.clone().sub(origin);
        const dist = toEnemy.length();
        if (dist < range) {
            toEnemy.normalize();
            if (dir.dot(toEnemy) > 0.8) { 
                if (type === 'fire') {
                    const dmg = Math.round(damage * 0.5);
                    damageEnemyAtPoint(e.x, e.y||1, e.z, 1, dmg);
                    igniteEnemy(e);
                    spawnDamageNumber(e.x, (e.y || 1) + 1.1, e.z, dmg, { color: '#ff7733' });
                } else if (type === 'freeze') {
                    freezeEnemy(e);
                }
            }
        }
    });

    const pt1 = origin.clone().add(dir.clone().multiplyScalar(range * 0.33));
    const pt2 = origin.clone().add(dir.clone().multiplyScalar(range * 0.66));
    const pt3 = origin.clone().add(dir.clone().multiplyScalar(range));
    
    const damageFunc = (pt, r, d) => {
        damageVehicleAtPoint(pt.x, pt.z, r, d);
        damageTrafficAtPoint(pt.x, pt.z, r, d);
        damagePropsAtPoint(pt.x, pt.z, r, d, spawnColoredDebris);
        damageNPCAtPoint(pt.x, pt.z, r, d, spawnColoredDebris);
    };
    damageFunc(pt1, range * 0.4, damage * 0.5);
    damageFunc(pt2, range * 0.7, damage * 0.5);
    damageFunc(pt3, range, damage * 0.5);
}

function updateVisuals(delta, playerPos) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= delta;
        if (p.life <= 0) {
            P_GROUP.remove(p.mesh);
            if (p.type !== 'freeze_shard') {
                p.mesh.material.dispose();
            }
            particles.splice(i, 1);
        } else {
            if (p.type === 'fire') {
                const ratio = p.life / p.maxLife;
                if (ratio > 0.7) {
                    p.mesh.material.color.setHex(0xffffff);
                } else if (ratio > 0.4) {
                    p.mesh.material.color.setHex(0xffaa00);
                } else if (ratio > 0.15) {
                    p.mesh.material.color.setHex(0xff3300);
                    p.mesh.material.blending = THREE.NormalBlending;
                } else {
                    // Fade to dark gray smoke
                    p.mesh.material.color.setHex(0x555555);
                    p.mesh.material.opacity = ratio / 0.15; // smooth fade to 0
                }
                // Expanding particle clusters
                p.mesh.scale.setScalar((2.5 - ratio) * 3.0);
                p.vel.multiplyScalar(0.92); // slow down as they expand
                p.mesh.position.addScaledVector(p.vel, delta);
            } else if (p.type === 'freeze_shard' || p.type === 'freeze_mist') {
                if (p.type === 'freeze_shard') {
                    p.angle += delta * 15;
                    p.radius += delta * 1.5;
                    p.mesh.rotation.x += p.rotSpeed.x * delta;
                    p.mesh.rotation.y += p.rotSpeed.y * delta;
                    p.mesh.rotation.z += p.rotSpeed.z * delta;
                    p.originPos.addScaledVector(p.vel, delta);
                    const offset = p.right.clone().multiplyScalar(Math.cos(p.angle) * p.radius)
                        .add(p.up.clone().multiplyScalar(Math.sin(p.angle) * p.radius));
                    p.mesh.position.copy(p.originPos).add(offset);
                    p.mesh.scale.setScalar((p.life / p.maxLife) * p.size);
                } else {
                    p.mesh.position.addScaledVector(p.vel, delta);
                    p.mesh.scale.addScalar(delta * 2);
                    p.mesh.material.opacity = (p.life / p.maxLife) * 0.4;
                }

                // Ground impact check
                if (p.mesh.position.y <= 0.1) {
                    spawnFrostDecal(p.mesh.position.x, p.mesh.position.z);
                    p.life = 0; // Trigger removal and cleanup
                }
            } else if (p.type === 'frost_decal') {
                const ratio = (p.maxLife - p.life) / p.maxLife; // 0 to 1
                const scaleVal = 0.5 + ratio * 3.0; // 0.5 to 3.5
                p.mesh.scale.set(scaleVal, scaleVal, scaleVal);
                p.mesh.material.opacity = (1 - ratio) * 0.6; // fade out
            } else if (p.type === 'scorch_decal') {
                p.mesh.material.opacity = (p.life / p.maxLife) * 0.8;
            } else if (p.type === 'tornado_dust') {
                p.basePos.addScaledVector(p.vel, delta);
                p.angle += p.speed * delta;
                p.height += p.upSpeed * delta;
                p.radius = 1 + p.height * 0.3;
                p.mesh.position.set(
                     p.basePos.x + Math.cos(p.angle) * p.radius,
                     p.height,
                     p.basePos.z + Math.sin(p.angle) * p.radius
                );
                p.mesh.rotation.x += delta * 5;
                p.mesh.rotation.y += delta * 5;
                p.mesh.scale.setScalar(p.life / p.maxLife);
                p.mesh.material.opacity = (p.life / p.maxLife) * 0.5;
            } else if (p.type === 'shockwave') {
                p.mesh.scale.addScalar(delta * 40);
                p.mesh.material.opacity = (p.life / p.maxLife) * 0.8;
            } else if (p.type === 'spark' || p.type === 'dust') {
                if (p.type === 'spark') {
                    p.mesh.material.color.setHex(p.life > 0.25 ? 0xffffff : 0xff0055);
                }
                p.vel.y -= delta * 20;
                p.mesh.position.addScaledVector(p.vel, delta);
                p.mesh.scale.setScalar(p.life / p.maxLife);
            }
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.addScaledVector(p.vel, delta);
        p.vel.y -= 10 * delta; 
        
        const hitBuilding = isInsideAnyBuilding(p.mesh.position.x, p.mesh.position.z, 0);
        let hitEnemy = false;
        const enemies = getEntitiesByType('enemy');
        for (const e of enemies) {
            const dx = e.x - p.mesh.position.x;
            const dz = e.z - p.mesh.position.z;
            const dy = (e.y||1) - p.mesh.position.y;
            if (dx*dx + dy*dy + dz*dz < 9) {
                hitEnemy = true;
                break;
            }
        }

        if (p.mesh.position.y <= 0 || hitBuilding || hitEnemy) {
            createExplosion(p.mesh.position.x, Math.max(0, p.mesh.position.y), p.mesh.position.z, 15, 100);
            damageTrafficAtPoint(p.mesh.position.x, p.mesh.position.z, 15, 100);
            damageVehicleAtPoint(p.mesh.position.x, p.mesh.position.z, 15, 100);
            damagePropsAtPoint(p.mesh.position.x, p.mesh.position.z, 15, 100, spawnColoredDebris);
            damageNPCAtPoint(p.mesh.position.x, p.mesh.position.z, 15, 100, spawnColoredDebris);
            spawnShockwave(p.mesh.position);
            
            P_GROUP.remove(p.mesh);
            p.mesh.material.dispose();
            p.mesh.children[0].material.dispose();
            projectiles.splice(i, 1);
        }
    }

    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const l = activeLasers[i];
        l.life -= delta;
        if (l.life <= 0) {
            if (l.isLight) {
                scene.remove(l.light);
            } else {
                P_GROUP.remove(l.mesh);
                l.mesh.material.dispose();
                l.mesh.children[0].material.dispose();
            }
            activeLasers.splice(i, 1);
        } else {
            if (l.isLight) {
                l.light.intensity = (l.life / l.maxLife) * 3;
            } else {
                const ratio = l.life / l.maxLife;
                l.mesh.material.opacity = ratio;
                l.mesh.children[0].material.opacity = ratio * 0.5;
            }
        }
    }

    for (let i = thunderEffects.length - 1; i >= 0; i--) {
        const t = thunderEffects[i];
        t.life -= delta;
        if (t.life <= 0) {
            if (t.isLight) {
                scene.remove(t.light);
            } else {
                P_GROUP.remove(t.mesh);
                t.mesh.geometry.dispose();
                t.mesh.material.dispose();
                if (t.mesh.children && t.mesh.children[0]) {
                    t.mesh.children[0].material.dispose();
                }
            }
            thunderEffects.splice(i, 1);
        } else {
            const ratio = t.life / t.maxLife;
            if (t.isLight) {
                t.light.intensity = ratio * 10;
            } else {
                t.mesh.material.opacity = ratio;
                if (t.mesh.children && t.mesh.children[0]) {
                    t.mesh.children[0].material.opacity = ratio * 0.5;
                }
                if (t.life > 0.1) {
                    const posAttrs = t.mesh.geometry.attributes.position;
                    for (let j=1; j<posAttrs.count-1; j++) {
                        posAttrs.setX(j, posAttrs.getX(j) + (Math.random()-0.5)*2);
                        posAttrs.setZ(j, posAttrs.getZ(j) + (Math.random()-0.5)*2);
                    }
                    posAttrs.needsUpdate = true;
                }
            }
        }
    }

    for (let i = windRings.length - 1; i >= 0; i--) {
        const w = windRings[i];
        w.life -= delta;
        if (w.life <= 0) {
            P_GROUP.remove(w.group);
            w.group.children.forEach(c => {
                c.material.dispose();
            });
            windRings.splice(i, 1);
        } else {
            w.group.position.addScaledVector(w.dir, w.speed * delta);
            
            w.group.children.forEach((c, idx) => {
                c.rotation.y += delta * (10 - idx); 
                c.material.opacity = (w.life / w.maxLife) * 0.5;
            });

            if (Math.random() < 0.7) {
                spawnTornadoParticle(w.group.position, w.dir, w.speed, w.life / w.maxLife);
            }

            if (Math.random() < 0.5) {
                spawnDustParticle(w.group.position, w.group.children.length * 2);
            }

            const pos = w.group.position;
            const radius = 12;

            // 1. Enemies: Apply upward/radial force and lift/toss
            const enemies = queryNearby(pos.x, pos.z, radius, 'enemy');
            enemies.forEach(e => {
                const dx = e.x - pos.x;
                const dz = e.z - pos.z;
                const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                const force = 45 / dist;
                if (e.body) {
                    applyExplosionForce(e.body, pos.x, 0, pos.z, 60, 25);
                }
                e.vy = (e.vy || 0) + 18 * delta + (Math.random() * 4) * delta * 60;
                e.vx = (e.vx || 0) + (-dx / dist) * force * delta * 2.5 + (Math.random() - 0.5) * 5 * delta;
                e.vz = (e.vz || 0) + (-dz / dist) * force * delta * 2.5 + (Math.random() - 0.5) * 5 * delta;
                damageEnemyAtPoint(e.x, e.y||0, e.z, 5, 20);
            });

            // 2. NPCs: Lift/toss
            npcs.forEach(n => {
                const dx = n.mesh.position.x - pos.x;
                const dz = n.mesh.position.z - pos.z;
                const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                if (dist < radius) {
                    n.vy = (n.vy || 0) + 15 * delta + (Math.random() * 3) * delta * 60;
                    n.mesh.position.x += (-dx / dist) * 6 * delta + (Math.random() - 0.5) * 4 * delta;
                    n.mesh.position.z += (-dz / dist) * 6 * delta + (Math.random() - 0.5) * 4 * delta;
                }
            });

            // 3. Drivable vehicles: Lift/toss
            activeVehicles.forEach(v => {
                const dx = v.mesh.position.x - pos.x;
                const dz = v.mesh.position.z - pos.z;
                const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                if (dist < radius) {
                    v.vy = (v.vy || 0) + 12 * delta + (Math.random() * 3) * delta * 60;
                    v.mesh.position.x += (-dx / dist) * 5 * delta + (Math.random() - 0.5) * 3 * delta;
                    v.mesh.position.z += (-dz / dist) * 5 * delta + (Math.random() - 0.5) * 3 * delta;
                }
            });

            // 4. Traffic cars: Lift/toss
            cars.forEach(c => {
                const dx = c.mesh.position.x - pos.x;
                const dz = c.mesh.position.z - pos.z;
                const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                if (dist < radius) {
                    c.vy = (c.vy || 0) + 12 * delta + (Math.random() * 3) * delta * 60;
                    c.mesh.position.x += (-dx / dist) * 5 * delta + (Math.random() - 0.5) * 3 * delta;
                    c.mesh.position.z += (-dz / dist) * 5 * delta + (Math.random() - 0.5) * 3 * delta;
                }
            });
            
            damageVehicleAtPoint(pos.x, pos.z, radius, 10);
            damageTrafficAtPoint(pos.x, pos.z, radius, 10);
            damagePropsAtPoint(pos.x, pos.z, radius, 10, spawnColoredDebris);
            damageNPCAtPoint(pos.x, pos.z, radius, 10, spawnColoredDebris);
        }
    }
}
// Procedural audio
function playNoise(duration, volume, passType = 'lowpass', passFreq = 1000) {
    if (!isSoundOn()) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = passType;
    filter.frequency.setValueAtTime(passFreq, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(getMasterGain());

    noiseNode.start(now);
    noiseNode.stop(now + duration);
}

function playTone(startFreq, endFreq, duration, volume, type = 'sawtooth') {
    if (!isSoundOn()) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now);
    osc.stop(now + duration);
}

export function getFiringState() {
    return { active, currentPower };
}

export function setCurrentPower(power) {
    if (power >= 1 && power <= 6) {
        currentPower = power;
    }
}
