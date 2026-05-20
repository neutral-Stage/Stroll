/**
 * wildlife.js — Butterflies and birds (local, gentle motion)
 * @module wildlife
 */

import * as THREE from 'three';
import { WILDLIFE_CULL_DISTANCE } from './config.js';
import { getQuality } from './quality.js';

const BUTTERFLY_COUNT = 15;
const BIRD_COUNT = 8;

/** @type {Array<ButterflyData>} */
const butterflies = [];
/** @type {Array<BirdData>} */
const birds = [];

const BUTTERFLY_COLORS = [0xFF6B9D, 0xC084FC, 0x67E8F9, 0xFDE047, 0xFB923C, 0xA3E635];

export function createWildlife(scene) {
    createButterflies(scene);
    createBirds(scene);
}

function createButterflies(scene) {
    const wingGeo = new THREE.PlaneGeometry(0.3, 0.2);

    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
        const group = new THREE.Group();
        const color = BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length];
        const wingMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
        });

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.x = -0.12;
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.x = 0.12;
        group.add(rightWing);

        const bodyGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
        const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
        body.rotation.z = Math.PI / 2;
        group.add(body);

        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 20;
        group.position.set(
            Math.cos(angle) * radius,
            1.5 + Math.random() * 2,
            Math.sin(angle) * radius,
        );

        scene.add(group);

        butterflies.push({
            mesh: group,
            leftWing,
            rightWing,
            phase: Math.random() * Math.PI * 2,
            wanderAngle: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            wanderTimer: 0,
            wanderDuration: 3 + Math.random() * 4,
            speed: 0.35 + Math.random() * 0.4,
            baseY: group.position.y,
            wingSpeed: 8 + Math.random() * 4,
        });
    }
}

function createBirds(scene) {
    for (let i = 0; i < BIRD_COUNT; i++) {
        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.5, 4),
            new THREE.MeshLambertMaterial({ color: 0x5D4037 }),
        );
        body.rotation.z = Math.PI / 2;
        group.add(body);

        const wingGeo = new THREE.PlaneGeometry(0.8, 0.2);
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x795548, side: THREE.DoubleSide });

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(0, 0.1, -0.3);
        leftWing.rotation.x = 0.2;
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(0, 0.1, 0.3);
        rightWing.rotation.x = -0.2;
        group.add(rightWing);

        const radius = 12 + Math.random() * 13;
        const angle = Math.random() * Math.PI * 2;

        group.position.set(0, 14 + Math.random() * 8, 0);

        scene.add(group);

        birds.push({
            mesh: group,
            leftWing,
            rightWing,
            circleAngle: angle,
            circleRadius: radius,
            circleSpeed: 0.06 + Math.random() * 0.06,
            centerX: 0,
            centerZ: 0,
            baseY: group.position.y,
            phase: Math.random() * Math.PI * 2,
            wingSpeed: 3 + Math.random() * 1.5,
        });
    }
}

export function updateWildlife(delta, elapsed, playerPos) {
    const cullDist = getQuality().wildlifeCullDistance || WILDLIFE_CULL_DISTANCE;
    for (const b of butterflies) {
        const bdx = b.mesh.position.x - playerPos.x;
        const bdz = b.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(bdx * bdx + bdz * bdz);

        if (dist > cullDist) {
            b.mesh.visible = false;
            continue;
        }
        b.mesh.visible = true;

        b.phase += delta * b.wingSpeed;
        const wingAngle = Math.sin(b.phase) * 0.8;
        b.leftWing.rotation.y = wingAngle;
        b.rightWing.rotation.y = -wingAngle;

        b.wanderTimer += delta;
        if (b.wanderTimer > b.wanderDuration) {
            b.wanderTimer = 0;
            b.wanderDuration = 3 + Math.random() * 4;
            b.targetAngle = b.wanderAngle + (Math.random() - 0.5) * 0.8;
        }

        if (dist > 35) {
            const steer = Math.atan2(playerPos.z - b.mesh.position.z, playerPos.x - b.mesh.position.x);
            b.targetAngle += (steer - b.targetAngle) * Math.min(1, delta * 0.8);
        }

        let angleDiff = b.targetAngle - b.wanderAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        b.wanderAngle += angleDiff * Math.min(1, delta * 2);

        const speed = b.speed * delta;
        b.mesh.position.x += Math.cos(b.wanderAngle) * speed;
        b.mesh.position.z += Math.sin(b.wanderAngle) * speed;
        b.mesh.position.y = b.baseY + Math.sin(elapsed * 0.5 + b.phase * 0.1) * 0.35;
        b.mesh.rotation.y = b.wanderAngle + Math.PI / 2;
    }

    for (const bird of birds) {
        const bdx = bird.mesh.position.x - playerPos.x;
        const bdz = bird.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(bdx * bdx + bdz * bdz);

        if (dist > cullDist) {
            bird.mesh.visible = false;
            continue;
        }
        bird.mesh.visible = true;

        bird.centerX += (playerPos.x - bird.centerX) * Math.min(1, delta * 0.15);
        bird.centerZ += (playerPos.z - bird.centerZ) * Math.min(1, delta * 0.15);

        bird.phase += delta * bird.wingSpeed;
        bird.circleAngle += bird.circleSpeed * delta;

        bird.mesh.position.x = bird.centerX + Math.cos(bird.circleAngle) * bird.circleRadius;
        bird.mesh.position.z = bird.centerZ + Math.sin(bird.circleAngle) * bird.circleRadius;
        bird.mesh.position.y = bird.baseY + Math.sin(elapsed * 0.3 + bird.phase) * 1.2;

        const wingAngle = Math.sin(bird.phase) * 0.35;
        bird.leftWing.rotation.x = 0.2 + wingAngle;
        bird.rightWing.rotation.x = -0.2 - wingAngle;
        bird.mesh.rotation.y = bird.circleAngle + Math.PI / 2;
    }
}
