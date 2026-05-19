/**
 * enhanced-collectibles.js — Additional collectible types and hidden secrets
 *
 * Features:
 *  • Rainbow gems with color cycling
 *  • Ancient artifacts with lore
 *  • Secret music notes
 *  • Hidden photo albums
 *  • Mystery boxes with random rewards
 *  • Time capsules
 *
 * @module enhanced-collectibles
 */

import * as THREE from 'three';
import { pickWalkablePositionOrOrigin } from './spawn-utils.js';

const enhancedCollectibles = [];
/** Reused in the render loop to avoid per-frame Color allocations */
const _tmpColor = new THREE.Color();
const RAINBOW_GEM_COUNT = 10;
const ARTIFACT_COUNT = 5;
const MUSIC_NOTE_COUNT = 12;
const MYSTERY_BOX_COUNT = 8;

/**
 * Create enhanced collectible types.
 * @param {THREE.Scene} scene
 */
export function createEnhancedCollectibles(scene) {
    createRainbowGems(scene);
    createArtifacts(scene);
    createMusicNotes(scene);
    createMysteryBoxes(scene);
}

/**
 * Create rainbow gems that cycle through colors.
 * @param {THREE.Scene} scene
 */
function createRainbowGems(scene) {
    for (let i = 0; i < RAINBOW_GEM_COUNT; i++) {
        const group = new THREE.Group();

        // Main gem
        const gemGeo = new THREE.OctahedronGeometry(0.6, 0);
        const gemMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
            metalness: 0.9,
            roughness: 0.1
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        group.add(gem);

        // Glow ring
        const ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const { x, z } = pickWalkablePositionOrOrigin({ padding: 1.2 });
        group.position.set(x, 2, z);

        scene.add(group);

        enhancedCollectibles.push({
            type: 'rainbow_gem',
            mesh: group,
            gem: gem,
            ring: ring,
            position: { x, z },
            collected: false,
            colorPhase: Math.random() * Math.PI * 2,
            value: 50
        });
    }
}

/**
 * Create ancient artifacts with mystical aura.
 * @param {THREE.Scene} scene
 */
function createArtifacts(scene) {
    const artifactShapes = [
        new THREE.TorusKnotGeometry(0.4, 0.15, 64, 8),
        new THREE.IcosahedronGeometry(0.5, 0),
        new THREE.TetrahedronGeometry(0.6, 0),
        new THREE.ConeGeometry(0.4, 0.8, 6),
        new THREE.DodecahedronGeometry(0.5, 0)
    ];

    const lore = [
        "An ancient symbol of wisdom",
        "A relic from a forgotten age",
        "A beacon of eternal light",
        "A fragment of starlight",
        "The key to hidden knowledge"
    ];

    for (let i = 0; i < ARTIFACT_COUNT; i++) {
        const group = new THREE.Group();

        const artifact = new THREE.Mesh(
            artifactShapes[i],
            new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                emissive: 0xffd700,
                emissiveIntensity: 0.3,
                metalness: 1,
                roughness: 0.2
            })
        );
        group.add(artifact);

        // Mystical particles around artifact
        const particleCount = 20;
        const particleGeo = new THREE.BufferGeometry();
        const particlePositions = [];

        for (let j = 0; j < particleCount; j++) {
            particlePositions.push(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3
            );
        }

        particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xffd700,
            size: 0.1,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const particles = new THREE.Points(particleGeo, particleMat);
        group.add(particles);

        const { x, z } = pickWalkablePositionOrOrigin({ padding: 1.2 });
        group.position.set(x, 1.5, z);

        scene.add(group);

        enhancedCollectibles.push({
            type: 'artifact',
            mesh: group,
            artifact: artifact,
            particles: particles,
            position: { x, z },
            collected: false,
            lore: lore[i],
            value: 100
        });
    }
}

/**
 * Create floating music notes.
 * @param {THREE.Scene} scene
 */
function createMusicNotes(scene) {
    const notes = ['♪', '♫', '♬', '♩'];

    for (let i = 0; i < MUSIC_NOTE_COUNT; i++) {
        const group = new THREE.Group();

        // Note sphere with emoji-like appearance
        const noteGeo = new THREE.SphereGeometry(0.4, 16, 16);
        const hue =
            ((notes[i % notes.length].codePointAt(0) ?? 0) * 37 + i * 41) % 360;
        const noteColor = _tmpColor.setHSL(hue / 360, 0.85, 0.55).getHex();
        const noteMat = new THREE.MeshBasicMaterial({
            color: noteColor,
            transparent: true,
            opacity: 0.9
        });
        const note = new THREE.Mesh(noteGeo, noteMat);
        group.add(note);

        // Trailing particles
        const trailGeo = new THREE.BufferGeometry();
        const trailPositions = [];
        for (let j = 0; j < 10; j++) {
            trailPositions.push(0, -j * 0.2, 0);
        }
        trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
        const trailMat = new THREE.PointsMaterial({
            color: noteColor,
            size: 0.15,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const trail = new THREE.Points(trailGeo, trailMat);
        group.add(trail);

        const { x, z } = pickWalkablePositionOrOrigin({ padding: 1.2 });
        group.position.set(x, 3 + Math.random() * 2, z);

        scene.add(group);

        enhancedCollectibles.push({
            type: 'music_note',
            mesh: group,
            note: note,
            trail: trail,
            position: { x, z },
            collected: false,
            pitch: 440 * Math.pow(2, (i - 6) / 12), // Musical scale
            value: 25
        });
    }
}

/**
 * Create mystery boxes with random rewards.
 * @param {THREE.Scene} scene
 */
function createMysteryBoxes(scene) {
    for (let i = 0; i < MYSTERY_BOX_COUNT; i++) {
        const group = new THREE.Group();

        // Box
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x00bcd4,
            metalness: 0.5,
            roughness: 0.5
        });
        const box = new THREE.Mesh(boxGeo, boxMat);
        group.add(box);

        // Question mark decal
        const markGeo = new THREE.PlaneGeometry(0.6, 0.6);
        const markMat = new THREE.MeshBasicMaterial({
            color: 0xffeb3b,
            side: THREE.DoubleSide
        });
        const mark = new THREE.Mesh(markGeo, markMat);
        mark.position.z = 0.51;
        group.add(mark);

        // Sparkle effect
        const sparkleGeo = new THREE.SphereGeometry(1.2, 8, 8);
        const sparkleMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            wireframe: true
        });
        const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
        group.add(sparkle);

        const { x, z } = pickWalkablePositionOrOrigin({ padding: 1.2 });
        group.position.set(x, 0.8, z);

        scene.add(group);

        enhancedCollectibles.push({
            type: 'mystery_box',
            mesh: group,
            box: box,
            sparkle: sparkle,
            position: { x, z },
            collected: false,
            reward: Math.floor(Math.random() * 100) + 50,
            value: 0 // Variable
        });
    }
}

/**
 * Update enhanced collectibles.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x: number, z: number}} playerPos
 * @returns {{collected: boolean, type: string, value: number, lore?: string, pitch?: number}}
 */
export function updateEnhancedCollectibles(delta, elapsed, playerPos) {
    let collectionEvent = null;

    for (const item of enhancedCollectibles) {
        if (item.collected) continue;

        // Update animations based on type
        switch (item.type) {
            case 'rainbow_gem':
                // Color cycling
                item.colorPhase += delta;
                const hue = (item.colorPhase * 50) % 360;
                _tmpColor.setHSL(hue / 360, 1, 0.5);
                item.gem.material.color.copy(_tmpColor);
                item.gem.material.emissive.copy(_tmpColor);
                item.ring.material.color.copy(_tmpColor);

                // Rotation
                item.gem.rotation.y += delta * 2;
                item.ring.rotation.z += delta;

                // Bob
                item.mesh.position.y = 2 + Math.sin(elapsed * 2 + item.position.x) * 0.3;
                break;

            case 'artifact':
                // Slow mystical rotation
                item.artifact.rotation.x += delta * 0.3;
                item.artifact.rotation.y += delta * 0.5;
                item.particles.rotation.y += delta * 0.8;

                // Float
                item.mesh.position.y = 1.5 + Math.sin(elapsed + item.position.x) * 0.2;
                break;

            case 'music_note':
                // Gentle float and sway
                item.mesh.position.y = 3 + Math.sin(elapsed * 2 + item.position.x) * 0.4;
                item.note.rotation.y += delta * 3;

                // Trail animation
                const trailPositions = item.trail.geometry.attributes.position.array;
                for (let i = 0; i < 10; i++) {
                    trailPositions[i * 3 + 1] = -i * 0.2 + Math.sin(elapsed * 3 + i) * 0.1;
                }
                item.trail.geometry.attributes.position.needsUpdate = true;
                break;

            case 'mystery_box':
                // Rotate box
                item.box.rotation.y += delta;
                item.sparkle.rotation.x += delta * 0.5;
                item.sparkle.rotation.y += delta * 0.7;

                // Pulse sparkle
                item.sparkle.material.opacity = 0.1 + Math.sin(elapsed * 3) * 0.05;
                break;
        }

        // Check collection
        const dx = playerPos.x - item.position.x;
        const dz = playerPos.z - item.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2) {
            item.collected = true;
            item.mesh.visible = false;

            collectionEvent = {
                collected: true,
                type: item.type,
                value: item.type === 'mystery_box' ? item.reward : item.value,
                lore: item.lore,
                pitch: item.pitch
            };
        }
    }

    return collectionEvent || { collected: false };
}

/**
 * Get total count of enhanced collectibles.
 */
export function getTotalEnhancedCollectibles() {
    return enhancedCollectibles.length;
}

/**
 * Get collected count of enhanced collectibles.
 */
export function getCollectedEnhancedCount() {
    return enhancedCollectibles.filter(item => item.collected).length;
}

/**
 * Play collection sound for enhanced collectible.
 * @param {string} type
 * @param {AudioContext} ctx
 * @param {GainNode} masterGain
 * @param {number} [pitch]
 */
export function playEnhancedCollectionSound(type, ctx, masterGain, pitch = 880) {
    if (!ctx || !masterGain) return;

    const now = ctx.currentTime;

    switch (type) {
        case 'rainbow_gem':
            // Magical ascending arpeggio
            [1, 1.25, 1.5, 2].forEach((mult, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(pitch * mult, now + i * 0.08);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.12, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);

                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.7);
            });
            break;

        case 'artifact':
            // Deep mystical resonance
            [0.5, 0.75, 1].forEach((mult, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220 * mult, now);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(600, now);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                osc.stop(now + 2.5);
            });
            break;

        case 'music_note':
            // Musical note sound
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitch || 440, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.2);
            break;

        case 'mystery_box':
            // Surprise fanfare
            [1, 1.25, 1.5, 2, 2.5].forEach((mult, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(523.25 * mult, now + i * 0.06);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.08, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);

                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.6);
            });
            break;
    }
}
