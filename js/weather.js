/**
 * weather.js — Dynamic weather system with rain, fog, and atmospheric effects
 *
 * Features:
 *  • Realistic rain with particle system
 *  • Rain puddle reflections
 *  • Thunder and lightning effects
 *  • Fog variations
 *  • Weather transitions
 *  • Rain sound effects
 *
 * @module weather
 */

import * as THREE from 'three';

/** @type {THREE.Points|null} */
let rainSystem = null;
/** @type {THREE.Mesh|null} */
let lightning = null;
/** @type {Array<THREE.Mesh>} */
let puddles = [];
/** @type {GainNode|null} */
let rainSoundGain = null;
/** @type {AudioBufferSourceNode|null} */
let rainSource = null;

let weatherEnabled = false;
let weatherIntensity = 0; // 0 = no rain, 1 = heavy rain
let targetIntensity = 0;
let lightningTimer = 0;
let nextLightningTime = 10;

const RAIN_PARTICLE_COUNT = 2000;
const PUDDLE_COUNT = 50;

/**
 * Initialize the weather system.
 * @param {THREE.Scene} scene
 */
export function initWeather(scene) {
    createRainSystem(scene);
    createPuddles(scene);
    createLightning(scene);
}

/**
 * Create rain particle system.
 * @param {THREE.Scene} scene
 */
function createRainSystem(scene) {
    const rainGeometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
        positions.push(
            (Math.random() - 0.5) * 200,
            Math.random() * 100 + 50,
            (Math.random() - 0.5) * 200
        );
        velocities.push(Math.random() * 0.2 + 0.5);
    }

    rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rainGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 1));

    const rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.3,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });

    rainSystem = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rainSystem);
}

/**
 * Create rain puddles on the ground.
 * @param {THREE.Scene} scene
 */
function createPuddles(scene) {
    const puddleGeo = new THREE.CircleGeometry(1.5, 16);
    const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x6a7a8a,
        transparent: true,
        opacity: 0,
        roughness: 0.1,
        metalness: 0.8,
        envMapIntensity: 1.5
    });

    for (let i = 0; i < PUDDLE_COUNT; i++) {
        const puddle = new THREE.Mesh(puddleGeo, puddleMat.clone());
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.set(
            (Math.random() - 0.5) * 180,
            0.02,
            (Math.random() - 0.5) * 180
        );
        puddle.scale.set(
            0.5 + Math.random() * 1.5,
            0.5 + Math.random() * 1.5,
            1
        );
        scene.add(puddle);
        puddles.push(puddle);
    }
}

/**
 * Create lightning flash effect.
 * @param {THREE.Scene} scene
 */
function createLightning(scene) {
    const lightningGeo = new THREE.PlaneGeometry(500, 500);
    const lightningMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    lightning = new THREE.Mesh(lightningGeo, lightningMat);
    lightning.position.set(0, 200, 0);
    lightning.rotation.x = -Math.PI / 2;
    scene.add(lightning);
}

/**
 * Toggle weather on/off.
 */
export function toggleWeather() {
    weatherEnabled = !weatherEnabled;
    targetIntensity = weatherEnabled ? 0.7 : 0;
    return weatherEnabled;
}

/**
 * Set weather intensity.
 * @param {number} intensity - 0 to 1
 */
export function setWeatherIntensity(intensity) {
    targetIntensity = Math.max(0, Math.min(1, intensity));
    if (targetIntensity > 0 && !weatherEnabled) {
        weatherEnabled = true;
    }
}

/**
 * Update weather system each frame.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x: number, z: number}} playerPos
 * @param {THREE.Scene} scene
 * @param {AudioContext|null} [audioContext] — shared game context (e.g. from getAudioContext())
 * @param {GainNode|null} [masterGain] — shared master gain (e.g. from getMasterGain())
 */
export function updateWeather(delta, elapsed, playerPos, scene, audioContext = null, masterGain = null) {
    // Smoothly transition weather intensity
    if (weatherIntensity < targetIntensity) {
        weatherIntensity = Math.min(weatherIntensity + delta * 0.2, targetIntensity);
    } else if (weatherIntensity > targetIntensity) {
        weatherIntensity = Math.max(weatherIntensity - delta * 0.2, targetIntensity);
    }

    // Update rain particles
    if (rainSystem && weatherIntensity > 0) {
        rainSystem.material.opacity = weatherIntensity * 0.6;
        
        const positions = rainSystem.geometry.attributes.position.array;
        const velocities = rainSystem.geometry.attributes.velocity.array;

        for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            
            // Move rain down
            positions[i3 + 1] -= velocities[i] * delta * 80 * weatherIntensity;

            // Reset if below ground
            if (positions[i3 + 1] < 0) {
                positions[i3] = playerPos.x + (Math.random() - 0.5) * 200;
                positions[i3 + 1] = Math.random() * 100 + 50;
                positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 200;
            }
        }

        rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Update puddles
    for (const puddle of puddles) {
        if (puddle.material.opacity < weatherIntensity * 0.4) {
            puddle.material.opacity = Math.min(puddle.material.opacity + delta * 0.1, weatherIntensity * 0.4);
        } else if (puddle.material.opacity > weatherIntensity * 0.4) {
            puddle.material.opacity = Math.max(puddle.material.opacity - delta * 0.05, weatherIntensity * 0.4);
        }
    }

    // Lightning effects (only in heavier rain)
    if (weatherIntensity > 0.5) {
        lightningTimer += delta;
        
        if (lightningTimer > nextLightningTime) {
            triggerLightning(scene, audioContext, masterGain);
            lightningTimer = 0;
            nextLightningTime = 8 + Math.random() * 15;
        }
    }

    // Update lightning flash
    if (lightning && lightning.material.opacity > 0) {
        lightning.material.opacity = Math.max(0, lightning.material.opacity - delta * 8);
    }

    // Update rain sound (uses shared Web Audio graph when sound is enabled)
    updateRainSound(weatherIntensity, audioContext, masterGain);

    // Adjust fog for rain
    if (scene.fog && scene.fog.density !== undefined) {
        const baseDensity = 0.006;
        const targetDensity = baseDensity * (1 + weatherIntensity * 0.8);
        if (Math.abs(scene.fog.density - targetDensity) > 0.0001) {
            scene.fog.density += (targetDensity - scene.fog.density) * delta * 0.5;
        }
    }
}

/**
 * Trigger a lightning flash.
 * @param {THREE.Scene} scene
 * @param {AudioContext|null} [audioContext]
 * @param {GainNode|null} [masterGain]
 */
function triggerLightning(scene, audioContext = null, masterGain = null) {
    if (!lightning) return;

    // Visual flash
    lightning.material.opacity = 0.3 + Math.random() * 0.3;

    // Play thunder sound
    playThunderSound(audioContext, masterGain);
}

/** @type {AudioContext|null} */
let rainAudioCtxRef = null;

/**
 * Update rain ambient sound (uses shared game AudioContext when available).
 * @param {number} intensity
 * @param {AudioContext|null} [audioContext]
 * @param {GainNode|null} [masterGain]
 */
function updateRainSound(intensity, audioContext = null, masterGain = null) {
    if (intensity === 0) {
        if (rainSource) {
            try {
                rainSource.stop();
            } catch {
                // Already stopped
            }
            try {
                rainSource.disconnect();
            } catch {
                // ignore
            }
            rainSource = null;
        }
        if (rainSoundGain && rainAudioCtxRef) {
            try {
                rainSoundGain.gain.linearRampToValueAtTime(0, rainAudioCtxRef.currentTime + 0.2);
            } catch {
                // ignore
            }
        }
        return;
    }

    if (!audioContext || !masterGain) return;

    try {
        if (rainAudioCtxRef !== audioContext) {
            if (rainSource) {
                try {
                    rainSource.stop();
                } catch {
                    // ignore
                }
                try {
                    rainSource.disconnect();
                } catch {
                    // ignore
                }
                rainSource = null;
            }
            if (rainSoundGain) {
                try {
                    rainSoundGain.disconnect();
                } catch {
                    // ignore
                }
            }
            rainSoundGain = audioContext.createGain();
            rainSoundGain.gain.setValueAtTime(0, audioContext.currentTime);
            rainSoundGain.connect(masterGain);
            rainAudioCtxRef = audioContext;
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (!rainSource && rainSoundGain) {
            const bufferSize = audioContext.sampleRate * 2;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }

            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = true;

            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 0.5;

            source.connect(filter);
            filter.connect(rainSoundGain);
            source.start();
            rainSource = source;
        }

        const targetVolume = intensity * 0.15;
        rainSoundGain.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.5);
    } catch {
        // Silently fail
    }
}

/**
 * Play thunder sound effect.
 * @param {AudioContext|null} [audioContext]
 * @param {GainNode|null} [masterGain]
 */
function playThunderSound(audioContext = null, masterGain = null) {
    if (!audioContext || !masterGain) return;

    try {
        const now = audioContext.currentTime;

        const bufferSize = audioContext.sampleRate * 2;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const envelope = Math.exp(-i / (audioContext.sampleRate * 0.5));
            data[i] = (Math.random() * 2 - 1) * envelope;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        source.start(now);
    } catch {
        // Silently fail
    }
}

export function getWeatherIntensity() {
    return weatherIntensity;
}

export function isWeatherEnabled() {
    return weatherEnabled;
}
