/**
 * controls.js — Player input handling (keyboard, mouse, mobile touch)
 *
 * Fixes from review:
 *  • Supports both e.code and e.key for international keyboard layouts.
 *  • Touch handling tracks individual touch identifiers for proper multi-touch.
 *  • Smooth camera transitions using lerp for yaw/pitch.
 *  • camera.rotation.order set once, not every frame.
 *
 * @module controls
 */

import * as THREE from 'three';
import {
    WALK_SPEED, LOOK_SPEED, TOUCH_LOOK_SPEED, PLAYER_HEIGHT,
    COLLISION_PADDING, CITY_SIZE, CITY_BOUND_MARGIN,
    HEAD_BOB_SPEED, HEAD_BOB_AMOUNT, HEAD_BOB_THRESHOLD,
    CONTROLS_HINT_FADE_DELAY
} from './config.js';
import { isInsideBuilding, isBlockedByTree } from './city.js';
import { canPlayerMove } from './player-input.js';

/** Player state */
export const player = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0 };

/** Keyboard state */
const keys = {};

/** Pointer lock state */
let isPointerLocked = false;

/** Mobile state */
let isMobile = false;
let joystickActive = false;
const joystickDelta = { x: 0, y: 0 };

/** Touch tracking with identifiers for proper multi-touch */
let moveTouchId = null;
let lookTouchId = null;
let lookLastX = 0;
let lookLastY = 0;

/** Head bob phase (radians) */
let bobPhase = 0;

/** Smoothed look (optional lag) */
let viewYaw = 0;
let viewPitch = 0;

/** Controls hint visibility */
let controlsHintVisible = true;

/** @type {THREE.WebGLRenderer} */
let rendererRef = null;
/** @type {THREE.PerspectiveCamera} */
let cameraRef = null;

/**
 * Detect if the device is mobile.
 */
export function detectMobile() {
    isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    return isMobile;
}

/**
 * Set up keyboard and mouse controls.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 */
export function setupControls(renderer, camera) {
    rendererRef = renderer;
    cameraRef = camera;

    camera.rotation.order = 'YXZ';
    viewYaw = player.yaw;
    viewPitch = player.pitch;

    // Keyboard — support both e.code (positional) and e.key (layout-aware)
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        keys[e.key] = true;
        if (e.code === 'Space') keys['Space'] = true;
        // Sound toggle shortcut
        if (e.key === 'm' || e.key === 'M') {
            const toggle = document.getElementById('sound-toggle');
            if (toggle) toggle.click();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        keys[e.key] = false;
        if (e.code === 'Space') keys['Space'] = false;
    });

    // Pointer lock for mouse look
    renderer.domElement.addEventListener('click', () => {
        if (!isMobile) {
            try {
                renderer.domElement.requestPointerLock();
            } catch (err) {
                console.warn('Pointer lock not supported:', err);
            }
        }
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
        if (isPointerLocked) {
            document.body.classList.add('is-playing', 'playing');
            fadeControlsHint();
        } else {
            document.body.classList.remove('playing');
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;
        player.yaw -= e.movementX * LOOK_SPEED;
        player.pitch -= e.movementY * LOOK_SPEED;
        player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
    });
}

/**
 * Set up mobile touch controls with proper touch identifier tracking.
 */
export function setupMobileControls() {
    if (!isMobile) return;

    const joystickBase = document.getElementById('joystick-base');
    const joystickThumb = document.getElementById('joystick-thumb');

    // Touch start — identify which side the touch is on
    document.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.clientX < window.innerWidth / 2) {
                // Left side — movement joystick
                moveTouchId = touch.identifier;
                joystickActive = true;
            } else {
                // Right side — look
                lookTouchId = touch.identifier;
                lookLastX = touch.clientX;
                lookLastY = touch.clientY;
            }
        }
    }, { passive: false });

    // Touch move — update based on tracked identifiers
    document.addEventListener('touchmove', (e) => {
        e.preventDefault(); // prevent scroll (needed since we call preventDefault)
        for (const touch of e.changedTouches) {
            if (touch.identifier === moveTouchId && joystickActive) {
                const rect = joystickBase.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = touch.clientX - centerX;
                const dy = touch.clientY - centerY;
                const maxDist = 35;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
                const angle = Math.atan2(dy, dx);

                joystickDelta.x = (Math.cos(angle) * dist) / maxDist;
                joystickDelta.y = (Math.sin(angle) * dist) / maxDist;

                joystickThumb.style.transform = `translate(${joystickDelta.x * 25}px, ${joystickDelta.y * 25}px)`;
            }

            if (touch.identifier === lookTouchId) {
                const dx = touch.clientX - lookLastX;
                const dy = touch.clientY - lookLastY;
                player.yaw -= dx * TOUCH_LOOK_SPEED;
                player.pitch -= dy * TOUCH_LOOK_SPEED;
                player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
                lookLastX = touch.clientX;
                lookLastY = touch.clientY;
            }
        }
    }, { passive: false });

    // Touch end — only reset the specific control that was released
    document.addEventListener('touchend', (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === moveTouchId) {
                moveTouchId = null;
                joystickActive = false;
                joystickDelta.x = 0;
                joystickDelta.y = 0;
                joystickThumb.style.transform = 'translate(0, 0)';
            }
            if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            }
        }
    });

    // Auto-start on mobile (no pointer lock needed)
    fadeControlsHint();
}

/**
 * Fade out the controls hint after a delay.
 */
function fadeControlsHint() {
    if (controlsHintVisible) {
        controlsHintVisible = false;
        setTimeout(() => {
            const hint = document.getElementById('controls-hint');
            if (hint) hint.style.opacity = '0';
        }, CONTROLS_HINT_FADE_DELAY);
    }
}

/**
 * Update player position and camera. Call each frame.
 * @param {number} delta - frame delta in seconds
 * @param {THREE.PerspectiveCamera} camera
 */
export function updatePlayer(delta, camera) {
    if (!canPlayerMove()) return;

    let moveX = 0;
    let moveZ = 0;

    // Keyboard input (supports both code and key)
    if (keys['KeyW'] || keys['ArrowUp'] || keys['w']) moveZ -= 1;
    if (keys['KeyS'] || keys['ArrowDown'] || keys['s']) moveZ += 1;
    if (keys['KeyA'] || keys['ArrowLeft'] || keys['a']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight'] || keys['d']) moveX += 1;

    // Mobile joystick input
    if (joystickActive) {
        moveX += joystickDelta.x;
        moveZ += joystickDelta.y;
    }

    // Ground level detection
    const bound = CITY_SIZE / 2;
    const isWater = (player.x > bound || player.x < -bound || player.z > bound || player.z < -bound);
    const groundLevel = isWater ? -1.8 : 0; // -1.8 so camera is slightly above water (-2)

    // Normalize
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
        moveX /= len;
        moveZ /= len;
    }

    // Apply movement relative to camera direction
    const baseSpeed = isWater ? (WALK_SPEED * 0.5) : WALK_SPEED;
    const speed = baseSpeed * delta * 60;
    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);

    const newX = player.x + (moveX * cosYaw + moveZ * sinYaw) * speed;
    const newZ = player.z + (-moveX * sinYaw + moveZ * cosYaw) * speed;

    // Jump / Vault (only if on solid ground)
    if (keys['Space'] && player.y === groundLevel && !isWater && canPlayerMove()) {
        player.vy = 10;
        keys['Space'] = false; // consume key
    }

    const blocked = (x, z) =>
        isInsideBuilding(x, z, COLLISION_PADDING) || isBlockedByTree(x, z);

    if (!blocked(newX, newZ)) {
        player.x = newX;
        player.z = newZ;
    } else if (!blocked(newX, player.z)) {
        player.x = newX;
    } else if (!blocked(player.x, newZ)) {
        player.z = newZ;
    }

    // Clamp to massive ocean bounds instead of city bounds
    const oceanBound = 1000;
    player.x = Math.max(-oceanBound, Math.min(oceanBound, player.x));
    player.z = Math.max(-oceanBound, Math.min(oceanBound, player.z));

    // Gravity for jumping/grappling
    if (player.y > groundLevel || player.vy !== 0) {
        player.y += player.vy * delta;
        player.vy -= 20 * delta; // Gravity
        if (player.y <= groundLevel) {
            player.y = groundLevel;
            player.vy = 0;
        }
    } else if (player.y < groundLevel) {
        player.y = groundLevel; // snap up to new ground level if walked off edge
        player.vy = 0;
    }

    // Update camera position
    camera.position.set(player.x, player.y + PLAYER_HEIGHT, player.z);

    if (len > HEAD_BOB_THRESHOLD && player.y === 0) {
        bobPhase += delta * HEAD_BOB_SPEED;
        camera.position.y += Math.abs(Math.sin(bobPhase)) * HEAD_BOB_AMOUNT;
    }

    const lookLerp = 1 - Math.exp(-14 * delta);
    viewYaw += (player.yaw - viewYaw) * lookLerp;
    viewPitch += (player.pitch - viewPitch) * lookLerp;
    camera.rotation.y = viewYaw;
    camera.rotation.x = viewPitch;
}

/**
 * Align player look with camera (after cinematic).
 * @param {THREE.PerspectiveCamera} camera
 */
export function syncPlayerLookFromCamera(camera) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    player.yaw = euler.y;
    player.pitch = euler.x;
    viewYaw = player.yaw;
    viewPitch = player.pitch;
}

/**
 * Debounced window resize handler.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} [composer] - EffectComposer instance if post-processing is enabled
 * @param {function(): void} [onResize] - optional callback after size update (e.g. weapon overlay, FXAA)
 */
export function setupResize(camera, renderer, composer, onResize) {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (composer) composer.setSize(window.innerWidth, window.innerHeight);
            if (typeof onResize === 'function') onResize();
        }, 100);
    });
}
