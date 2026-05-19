/**
 * accessibility.js — shared a11y helpers
 * @module accessibility
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * @returns {boolean}
 */
export function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * @param {function(boolean): void} callback
 * @returns {function(): void} unsubscribe
 */
export function onReducedMotionChange(callback) {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const handler = () => callback(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
}
