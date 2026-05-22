/**
 * state-machine.js — Game state management
 * Handles transitions between game states with fade effects.
 * @module core/state-machine
 */

import { GAME_STATES } from '../config.js';

/** @type {string} */
let currentState = GAME_STATES.MENU;
/** @type {string|null} */
let previousState = null;
/** @type {Map<string, Set<function>>} */
const listeners = new Map();
/** @type {boolean} */
let transitioning = false;
/** @type {number} */
let transitionProgress = 0;
/** @type {string|null} */
let transitionTarget = null;
const TRANSITION_SPEED = 3; // speed of fade

/**
 * Get current game state.
 * @returns {string}
 */
export function getState() {
    return currentState;
}

/**
 * Get previous game state.
 * @returns {string|null}
 */
export function getPreviousState() {
    return previousState;
}

/**
 * Check if currently in a specific state.
 * @param {string} state
 * @returns {boolean}
 */
export function isState(state) {
    return currentState === state;
}

/**
 * Check if the game is in a playable state (not menu, dead, or transitioning).
 * @returns {boolean}
 */
export function isPlayable() {
    return currentState === GAME_STATES.PLAYING || currentState === GAME_STATES.CUTSCENE;
}

/**
 * Transition to a new state with optional fade.
 * @param {string} newState
 * @param {boolean} [instant=false] - Skip fade transition
 */
export function setState(newState, instant = false) {
    if (newState === currentState) return;
    if (transitioning && !instant) return;

    if (instant) {
        previousState = currentState;
        currentState = newState;
        emit(newState);
        return;
    }

    transitioning = true;
    transitionTarget = newState;
    transitionProgress = 0;
}

/**
 * Update the state machine (call every frame).
 * @param {number} delta
 * @returns {{ transitioning: boolean, fadeAlpha: number }}
 */
export function updateStateMachine(delta) {
    if (!transitioning) {
        return { transitioning: false, fadeAlpha: 0 };
    }

    transitionProgress += delta * TRANSITION_SPEED;

    if (transitionProgress >= 1 && transitionTarget) {
        // At peak fade, switch state
        if (transitionProgress >= 1 && currentState !== transitionTarget) {
            previousState = currentState;
            currentState = transitionTarget;
            emit(currentState);
        }
    }

    if (transitionProgress >= 2) {
        // Fade complete
        transitioning = false;
        transitionTarget = null;
        transitionProgress = 0;
        return { transitioning: false, fadeAlpha: 0 };
    }

    // Fade alpha: rises to 1 at midpoint, falls back to 0
    const fadeAlpha = transitionProgress <= 1
        ? transitionProgress
        : 2 - transitionProgress;

    return { transitioning: true, fadeAlpha };
}

/**
 * Register a listener for a specific state transition.
 * @param {string} state - The state to listen for
 * @param {function} callback
 */
export function onStateChange(state, callback) {
    if (!listeners.has(state)) {
        listeners.set(state, new Set());
    }
    listeners.get(state).add(callback);
}

/**
 * Register a listener for ANY state change.
 * @param {function} callback - receives (newState, oldState)
 */
export function onAnyStateChange(callback) {
    if (!listeners.has('*')) {
        listeners.set('*', new Set());
    }
    listeners.get('*').add(callback);
}

/**
 * Remove a state change listener.
 * @param {string} state
 * @param {function} callback
 */
export function offStateChange(state, callback) {
    const set = listeners.get(state);
    if (set) set.delete(callback);
}

/** Emit state change to listeners */
function emit(state) {
    const specific = listeners.get(state);
    if (specific) specific.forEach(cb => cb(state, previousState));

    const wildcard = listeners.get('*');
    if (wildcard) wildcard.forEach(cb => cb(state, previousState));
}

/**
 * Check if transitioning between states.
 * @returns {boolean}
 */
export function isTransitioning() {
    return transitioning;
}
