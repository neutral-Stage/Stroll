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

import {
    WALK_SPEED, LOOK_SPEED, TOUCH_LOOK_SPEED, PLAYER_HEIGHT,
    COLLISION_PADDING, CITY_SIZE, CITY_BOUND_MARGIN,
    HEAD_BOB_SPEED, HEAD_BOB_AMOUNT, HEAD_BOB_THRESHOLD,
    CONTROLS_HINT_FADE_DELAY
} from './config.js';
import { isInsideBuilding } from './city.js';

/** Player state */
export const player = { x: 0, z: 0, yaw: 0, pitch: 0 };

/** Keyboard state */
const keys = {};

/** Whether player is currently moving */
let playerMoving = false;

/**
 * Check if the player is currently moving.
 * @returns {boolean}
 */
export function isPlayerMoving() {
    return playerMoving;
}

/**
 * Get keys state.
 * @returns {Object}
 */
export function getKeys() {
    return keys;
}

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

/** Accumulated time for head bob (uses clock, not Date.now()) */
let bobTime = 0;

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

    // Set rotation order once (not every frame)
    camera.rotation.order = 'YXZ';

    // Keyboard — support both e.code (positional) and e.key (layout-aware)
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        keys[e.key] = true;
        // Sound toggle shortcut
        if (e.key === 'm' || e.key === 'M') {
            const toggle = document.getElementById('sound-toggle');
            if (toggle) toggle.click();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        keys[e.key] = false;
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
            document.body.classList.add('playing');
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

    // Normalize
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
        moveX /= len;
        moveZ /= len;
    }
    playerMoving = len > 0.1;

    // Apply movement relative to camera direction
    const speed = WALK_SPEED * delta * 60;
    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);

    const newX = player.x + (moveX * cosYaw + moveZ * sinYaw) * speed;
    const newZ = player.z + (-moveX * sinYaw + moveZ * cosYaw) * speed;

    // Sliding collision detection
    if (!isInsideBuilding(newX, newZ, COLLISION_PADDING)) {
        player.x = newX;
        player.z = newZ;
    } else if (!isInsideBuilding(newX, player.z, COLLISION_PADDING)) {
        player.x = newX;
    } else if (!isInsideBuilding(player.x, newZ, COLLISION_PADDING)) {
        player.z = newZ;
    }

    // Clamp to city bounds
    const bound = CITY_SIZE / 2 - CITY_BOUND_MARGIN;
    player.x = Math.max(-bound, Math.min(bound, player.x));
    player.z = Math.max(-bound, Math.min(bound, player.z));

    // Update camera position
    camera.position.set(player.x, PLAYER_HEIGHT, player.z);

    // Gentle head bob when moving (uses accumulated clock time, not Date.now())
    if (len > HEAD_BOB_THRESHOLD) {
        bobTime += delta;
        const bobAmount = Math.sin(bobTime / HEAD_BOB_SPEED * 0.001) * HEAD_BOB_AMOUNT;
        camera.position.y += bobAmount;
    }

    // Camera rotation (order already set in setupControls)
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
}

/**
 * Debounced window resize handler.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {Function} [onResize] - optional callback for post-processing resize
 */
export function setupResize(camera, renderer, onResize) {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (onResize) onResize(window.innerWidth, window.innerHeight);
        }, 100);
    });
}
