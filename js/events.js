/**
 * events.js — Lightweight pub/sub for cross-module hooks
 * @module events
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * @param {string} event
 * @param {Function} fn
 * @returns {function(): void} unsubscribe
 */
export function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
}

/**
 * @param {string} event
 * @param {unknown} [payload]
 */
export function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
        try {
            fn(payload);
        } catch (err) {
            console.warn(`[events] ${event} handler failed:`, err);
        }
    }
}

export const Events = {
    PICKUP: 'pickup',
    ACHIEVEMENT: 'achievement',
    DISCOVERY: 'discovery',
    WEAPON_SHOT: 'weapon_shot',
};
