/**
 * pickups.js — Handles street pickups (cash, health, armor, weapons)
 * @module weapons/pickups
 */

import * as THREE from 'three';
import { player } from '../controls.js';
import { addCash, healPlayer, addArmor } from '../player/player.js';
import { pickupWeapon } from '../player/inventory.js';
import { playPickupSound } from '../audio.js';
import { showToast } from '../hud.js';
import { WEAPONS, WEAPON_TYPES } from '../config.js';

let sceneRef = null;
const pickups = [];

const PICKUP_RADIUS = 2.0;

// Materials
const cashMat = new THREE.MeshStandardMaterial({ color: 0x00FF00, roughness: 0.5, metalness: 0.1 });
const healthMat = new THREE.MeshStandardMaterial({ color: 0xFF0000, roughness: 0.6 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
const armorMat = new THREE.MeshStandardMaterial({ color: 0x0088FF, metalness: 0.6, roughness: 0.3 });
const weaponMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.7, roughness: 0.2 });

/**
 * Initialize pickups system.
 * @param {THREE.Scene} scene
 */
export function initPickups(scene) {
    sceneRef = scene;
    // Clear any existing pickups
    for (const p of pickups) {
        sceneRef.remove(p.mesh);
    }
    pickups.length = 0;
}

/**
 * Spawn a pickup at street level.
 * @param {string} type - 'cash', 'health', 'armor', or a WEAPON_TYPES string
 * @param {number} x
 * @param {number} z
 * @param {number} quantity - Cash amount or ammo quantity
 */
export function spawnPickup(type, x, z, quantity = 1) {
    if (!sceneRef) return;

    const group = new THREE.Group();
    group.position.set(x, 0.4, z);

    let displayLabel = type;

    // Create the procedural mesh based on type
    if (type === 'cash') {
        const bundle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), cashMat);
        group.add(bundle);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.3), whiteMat);
        group.add(band);
        displayLabel = `$${quantity}`;
    } 
    else if (type === 'health') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), healthMat);
        group.add(box);
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), whiteMat);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), whiteMat);
        box.add(crossH);
        box.add(crossV);
        displayLabel = 'Health Pack';
    } 
    else if (type === 'armor') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.15), armorMat);
        group.add(shield);
        displayLabel = 'Body Armor';
    } 
    else {
        // Weapon pickup
        const gunCfg = WEAPONS[type];
        if (gunCfg) {
            const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), weaponMat);
            group.add(caseMesh);
            displayLabel = gunCfg.name;
        }
    }

    // Add a soft pulsing glow light below
    const light = new THREE.PointLight(type==='cash'?0x00FF00:type==='health'?0xFF0000:type==='armor'?0x0088FF:0xFFD700, 1.2, 3);
    light.position.set(0, -0.2, 0);
    group.add(light);

    sceneRef.add(group);

    pickups.push({
        mesh: group,
        type,
        x, z,
        quantity,
        light,
        age: Math.random() * Math.PI
    });
}

/**
 * Update pickups bobbing, rotation, and player collision check.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{ x: number, z: number }} playerPos
 */
export function updatePickups(delta, elapsed, playerPos) {
    if (player.pickupActive) {
        player.pickupTimer -= delta;
        if (player.pickupTimer <= 0) {
            player.pickupActive = false;
            player.pickupTimer = 0;
        }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        
        // Bobbing & Rotation
        p.age += delta * 3;
        p.mesh.position.y = 0.45 + Math.sin(p.age) * 0.12;
        p.mesh.rotation.y += delta * 1.5;

        // Pulse light intensity
        if (p.light) {
            p.light.intensity = 1.0 + Math.sin(p.age) * 0.4;
        }

        // Distance check
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < PICKUP_RADIUS) {
            // Picked up!
            collectItem(p);
            
            // Trigger character grab animation
            player.pickupActive = true;
            player.pickupTimer = 0.4; // 0.4s bending gesture duration

            // Remove mesh and clean up resources
            sceneRef.remove(p.mesh);
            p.mesh.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            pickups.splice(i, 1);
        }
    }
}

function collectItem(p) {
    if (p.type === 'cash') {
        addCash(p.quantity);
        playPickupSound('star');
        showToast('Cash Collected', `Picked up $${p.quantity}!`, 'success');
    } 
    else if (p.type === 'health') {
        healPlayer(25);
        playPickupSound('orb');
        showToast('Health Restored', '+25% Health Pack', 'success');
    } 
    else if (p.type === 'armor') {
        addArmor(25);
        playPickupSound('crystal');
        showToast('Armor Equipped', '+25% Armor Plating', 'success');
    } 
    else {
        // Weapon pickup
        const gunCfg = WEAPONS[p.type];
        if (gunCfg) {
            const isNew = pickupWeapon(p.type, p.quantity);
            playPickupSound('crystal');
            if (isNew) {
                showToast('New Weapon', `Equipped ${gunCfg.name}!`, 'info');
            } else {
                showToast('Ammo Added', `+${p.quantity} Ammo for ${gunCfg.name}`, 'info');
            }
        }
    }
}
