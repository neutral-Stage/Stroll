/**
 * wildlife.js — Ambient wildlife (butterflies, birds) with simple AI
 *
 * Adds life to the world with butterflies that flutter around flowers/park
 * and birds that soar overhead in gentle patterns.
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
const butterflyColors = [0xff9800, 0x2196f3, 0xe91e63, 0x9c27b0, 0xffeb3b, 0x4caf50, 0xff5722];

/**
 * Create all wildlife and add to scene.
 * @param {THREE.Scene} scene
 */
export function createWildlife(scene) {
    createButterflies(scene);
    createBirds(scene);
}

function createButterflies(scene) {
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
        const group = new THREE.Group();
        const color = butterflyColors[i % butterflyColors.length];
        const wingMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        
        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 4);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Wings (two triangular shapes)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(0.08, 0.12, 0.15, 0.05);
        wingShape.quadraticCurveTo(0.1, -0.05, 0, 0);
        
        const wingGeo = new THREE.ShapeGeometry(wingShape);
        
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(0, 0, 0);
        leftWing.rotation.y = 0;
        group.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(0, 0, 0);
        rightWing.scale.x = -1;
        group.add(rightWing);
        
        // Random starting position near park/center
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 40;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        group.position.set(x, 1 + Math.random() * 3, z);
        group.scale.setScalar(0.5 + Math.random() * 0.3);
        scene.add(group);
        
        butterflies.push({
            mesh: group,
            leftWing,
            rightWing,
            phase: Math.random() * Math.PI * 2,
            wingSpeed: 8 + Math.random() * 6,
            targetX: x + (Math.random() - 0.5) * 20,
            targetZ: z + (Math.random() - 0.5) * 20,
            targetY: 1.5 + Math.random() * 3,
            speed: 1 + Math.random() * 2,
            changeTimer: Math.random() * 5,
            flutterAmplitude: 0.3 + Math.random() * 0.4
        });
    }
}

function createBirds(scene) {
    for (let i = 0; i < BIRD_COUNT; i++) {
        const group = new THREE.Group();
        const birdMat = new THREE.MeshLambertMaterial({ color: 0x37474f, side: THREE.DoubleSide });
        
        // Body
        const bodyGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, birdMat);
        group.add(body);
        
        // Wings
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(0.4, 0.1);
        wingShape.lineTo(0.35, -0.02);
        wingShape.lineTo(0, 0);
        
        const wingGeo = new THREE.ShapeGeometry(wingShape);
        
        const leftWing = new THREE.Mesh(wingGeo, birdMat);
        leftWing.position.set(0.05, 0, 0);
        group.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeo, birdMat);
        rightWing.position.set(-0.05, 0, 0);
        rightWing.scale.x = -1;
        group.add(rightWing);
        
        // Start high up
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 60;
        group.position.set(
            Math.cos(angle) * radius,
            15 + Math.random() * 20,
            Math.sin(angle) * radius
        );
        group.scale.setScalar(0.8 + Math.random() * 0.4);
        scene.add(group);
        
        birds.push({
            mesh: group,
            leftWing,
            rightWing,
            phase: Math.random() * Math.PI * 2,
            wingSpeed: 3 + Math.random() * 2,
            circleAngle: angle,
            circleRadius: radius,
            circleSpeed: 0.1 + Math.random() * 0.15,
            baseHeight: 15 + Math.random() * 20,
            heightOscSpeed: 0.2 + Math.random() * 0.3
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
    butterflies.forEach(b => {
        b.phase += delta * b.wingSpeed;
        
        // Wing flapping
        const wingAngle = Math.sin(b.phase) * b.flutterAmplitude;
        b.leftWing.rotation.y = wingAngle;
        b.rightWing.rotation.y = -wingAngle;
        
        // Move toward target
        const dx = b.targetX - b.mesh.position.x;
        const dy = b.targetY - b.mesh.position.y;
        const dz = b.targetZ - b.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist > 0.5) {
            const moveSpeed = b.speed * delta;
            b.mesh.position.x += (dx / dist) * moveSpeed;
            b.mesh.position.y += (dy / dist) * moveSpeed;
            b.mesh.position.z += (dz / dist) * moveSpeed;
            
            // Face direction of movement
            b.mesh.rotation.y = Math.atan2(dx, dz);
        }
        
        // Add flutter to height
        b.mesh.position.y += Math.sin(b.phase * 0.3) * 0.01;
        
        // Change target periodically
        b.changeTimer -= delta;
        if (b.changeTimer <= 0 || dist < 1) {
            b.changeTimer = 3 + Math.random() * 8;
            // Stay somewhat near player but wander
            const wanderAngle = Math.random() * Math.PI * 2;
            const wanderDist = 5 + Math.random() * 30;
            b.targetX = playerPos.x + Math.cos(wanderAngle) * wanderDist;
            b.targetZ = playerPos.z + Math.sin(wanderAngle) * wanderDist;
            b.targetY = 1 + Math.random() * 4;
            
            // Clamp to world bounds
            b.targetX = Math.max(-90, Math.min(90, b.targetX));
            b.targetZ = Math.max(-90, Math.min(90, b.targetZ));
        }
    });
    
    // Update birds
    birds.forEach(b => {
        b.phase += delta * b.wingSpeed;
        
        // Wing flapping (slower, more graceful)
        const wingAngle = Math.sin(b.phase) * 0.5;
        b.leftWing.rotation.y = wingAngle;
        b.rightWing.rotation.y = -wingAngle;
        
        // Circular soaring pattern
        b.circleAngle += b.circleSpeed * delta;
        b.mesh.position.x = Math.cos(b.circleAngle) * b.circleRadius;
        b.mesh.position.z = Math.sin(b.circleAngle) * b.circleRadius;
        b.mesh.position.y = b.baseHeight + Math.sin(elapsed * b.heightOscSpeed) * 3;
        
        // Face direction of movement
        b.mesh.rotation.y = b.circleAngle + Math.PI / 2;
        
        // Gentle banking
        b.mesh.rotation.z = Math.sin(b.circleAngle) * 0.15;
    });
}
