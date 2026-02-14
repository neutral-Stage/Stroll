/**
 * wildlife.js — Butterflies and birds with simple wandering AI
 *
 * Features:
 *  • Butterflies with fluttering wing animation near flowers/park
 *  • Birds that circle overhead and occasionally swoop
 *  • Simple wandering behavior with smooth movement
 *
 * @module wildlife
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const BUTTERFLY_COUNT = 15;
const BIRD_COUNT = 8;

/** @type {Array<ButterflyData>} */
const butterflies = [];
/** @type {Array<BirdData>} */
const birds = [];

// Butterfly colors
const BUTTERFLY_COLORS = [0xFF6B9D, 0xC084FC, 0x67E8F9, 0xFDE047, 0xFB923C, 0xA3E635];

/**
 * Create all wildlife and add to scene.
 * @param {THREE.Scene} scene
 */
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
            side: THREE.DoubleSide
        });

        // Left wing
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.x = -0.12;
        group.add(leftWing);

        // Right wing
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.x = 0.12;
        group.add(rightWing);

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        group.add(body);

        // Position near park area or randomly
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 30;
        group.position.set(
            Math.cos(angle) * radius,
            1.5 + Math.random() * 3,
            Math.sin(angle) * radius
        );

        scene.add(group);

        butterflies.push({
            mesh: group,
            leftWing,
            rightWing,
            phase: Math.random() * Math.PI * 2,
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTimer: 0,
            wanderDuration: 2 + Math.random() * 4,
            speed: 0.5 + Math.random() * 1.0,
            baseY: group.position.y,
            wingSpeed: 8 + Math.random() * 6
        });
    }
}

function createBirds(scene) {
    for (let i = 0; i < BIRD_COUNT; i++) {
        const group = new THREE.Group();

        // Simple bird shape
        const bodyGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5D4037 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        group.add(body);

        // Wings
        const wingGeo = new THREE.PlaneGeometry(0.8, 0.2);
        const wingMat = new THREE.MeshLambertMaterial({
            color: 0x795548,
            side: THREE.DoubleSide
        });

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(0, 0.1, -0.3);
        leftWing.rotation.x = 0.2;
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(0, 0.1, 0.3);
        rightWing.rotation.x = -0.2;
        group.add(rightWing);

        // Position high up
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 50;
        group.position.set(
            Math.cos(angle) * radius,
            15 + Math.random() * 20,
            Math.sin(angle) * radius
        );

        scene.add(group);

        birds.push({
            mesh: group,
            leftWing,
            rightWing,
            circleAngle: angle,
            circleRadius: radius,
            circleSpeed: 0.1 + Math.random() * 0.15,
            baseY: group.position.y,
            phase: Math.random() * Math.PI * 2,
            wingSpeed: 3 + Math.random() * 2
        });
    }
}

/**
 * Update all wildlife each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x:number, z:number}} playerPos
 */
export function updateWildlife(delta, elapsed, playerPos) {
    // Update butterflies
    for (const b of butterflies) {
        b.phase += delta * b.wingSpeed;

        // Wing flapping
        const wingAngle = Math.sin(b.phase) * 0.8;
        b.leftWing.rotation.y = wingAngle;
        b.rightWing.rotation.y = -wingAngle;

        // Wandering
        b.wanderTimer += delta;
        if (b.wanderTimer > b.wanderDuration) {
            b.wanderTimer = 0;
            b.wanderDuration = 2 + Math.random() * 4;
            b.wanderAngle += (Math.random() - 0.5) * Math.PI;
        }

        // Move
        const speed = b.speed * delta;
        b.mesh.position.x += Math.cos(b.wanderAngle) * speed;
        b.mesh.position.z += Math.sin(b.wanderAngle) * speed;
        b.mesh.position.y = b.baseY + Math.sin(elapsed * 0.5 + b.phase * 0.1) * 0.5;

        // Face direction
        b.mesh.rotation.y = b.wanderAngle + Math.PI / 2;

        // Keep near player area
        const dx = b.mesh.position.x - playerPos.x;
        const dz = b.mesh.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 40) {
            b.wanderAngle = Math.atan2(playerPos.z - b.mesh.position.z, playerPos.x - b.mesh.position.x);
        }
    }

    // Update birds
    for (const bird of birds) {
        bird.phase += delta * bird.wingSpeed;
        bird.circleAngle += bird.circleSpeed * delta;

        // Circular flight path
        bird.mesh.position.x = Math.cos(bird.circleAngle) * bird.circleRadius;
        bird.mesh.position.z = Math.sin(bird.circleAngle) * bird.circleRadius;
        bird.mesh.position.y = bird.baseY + Math.sin(elapsed * 0.3 + bird.phase) * 2;

        // Wing flapping
        const wingAngle = Math.sin(bird.phase) * 0.4;
        bird.leftWing.rotation.x = 0.2 + wingAngle;
        bird.rightWing.rotation.x = -0.2 - wingAngle;

        // Face direction of travel
        bird.mesh.rotation.y = bird.circleAngle + Math.PI / 2;
    }
}
