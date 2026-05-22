/**
 * inventory.js — Weapon inventory management
 * @module player/inventory
 */

import { WEAPONS, WEAPON_TYPES, WEAPON_CATEGORIES } from '../config.js';

/** @type {Map<string, { ammoClip: number, ammoReserve: number }>} */
const weapons = new Map();

/** @type {string} Currently equipped weapon type */
let currentWeapon = WEAPON_TYPES.FISTS;

/** @type {string[]} Ordered weapon slots for cycling */
let weaponOrder = [];

/**
 * Initialize inventory with starting weapons.
 */
export function initInventory() {
    weapons.clear();
    weaponOrder = [];
    pickupWeapon(WEAPON_TYPES.FISTS, 0);
    pickupWeapon(WEAPON_TYPES.PISTOL, 50);
    pickupWeapon(WEAPON_TYPES.GRAPPLE, Infinity);
    currentWeapon = WEAPON_TYPES.PISTOL;
}

/**
 * Pick up a weapon (add to inventory or add ammo).
 * @param {string} type
 * @param {number} ammo
 * @returns {boolean} true if new weapon, false if ammo added
 */
export function pickupWeapon(type, ammo) {
    const cfg = WEAPONS[type];
    if (!cfg) return false;

    if (weapons.has(type)) {
        // Already have it — add ammo
        const w = weapons.get(type);
        w.ammoReserve = Math.min(w.ammoReserve + ammo, cfg.maxAmmo || Infinity);
        return false;
    }

    // New weapon
    weapons.set(type, {
        ammoClip: Math.min(ammo, cfg.clipSize || Infinity),
        ammoReserve: Math.max(0, ammo - (cfg.clipSize || 0)),
    });

    weaponOrder.push(type);
    return true;
}

/**
 * Get currently equipped weapon config.
 * @returns {Object}
 */
export function getCurrentWeapon() {
    return WEAPONS[currentWeapon] || WEAPONS[WEAPON_TYPES.FISTS];
}

/**
 * Get current weapon type string.
 * @returns {string}
 */
export function getCurrentWeaponType() {
    return currentWeapon;
}

/**
 * Switch to a specific weapon type.
 * @param {string} type
 * @returns {boolean} true if switched
 */
export function setCurrentWeapon(type) {
    if (!weapons.has(type)) return false;
    currentWeapon = type;
    return true;
}

/**
 * Cycle to next weapon.
 * @param {number} [dir=1] - 1 for next, -1 for previous
 * @returns {string} new weapon type
 */
export function cycleWeapon(dir = 1) {
    if (weaponOrder.length <= 1) return currentWeapon;
    const idx = weaponOrder.indexOf(currentWeapon);
    const newIdx = (idx + dir + weaponOrder.length) % weaponOrder.length;
    currentWeapon = weaponOrder[newIdx];
    return currentWeapon;
}

/**
 * Check if player has a weapon.
 * @param {string} type
 * @returns {boolean}
 */
export function hasWeapon(type) {
    return weapons.has(type);
}

/**
 * Get ammo info for a weapon.
 * @param {string} [type] - defaults to current weapon
 * @returns {{ clip: number, reserve: number, maxClip: number }}
 */
export function getAmmo(type) {
    const t = type || currentWeapon;
    const w = weapons.get(t);
    const cfg = WEAPONS[t];
    if (!w || !cfg) return { clip: Infinity, reserve: Infinity, maxClip: Infinity };
    return { clip: w.ammoClip, reserve: w.ammoReserve, maxClip: cfg.clipSize || Infinity };
}

/**
 * Use one round of ammo from current weapon clip.
 * @param {string} [type]
 * @returns {boolean} true if had ammo
 */
export function useAmmo(type) {
    const t = type || currentWeapon;
    const w = weapons.get(t);
    if (!w) return false;

    const cfg = WEAPONS[t];
    if (cfg.clipSize === Infinity) return true; // Melee/infinite

    if (w.ammoClip > 0) {
        w.ammoClip--;
        return true;
    }
    return false;
}

/**
 * Reload current weapon.
 * @param {string} [type]
 * @returns {{ reloaded: boolean, reloadTime: number }}
 */
export function reloadWeapon(type) {
    const t = type || currentWeapon;
    const w = weapons.get(t);
    const cfg = WEAPONS[t];
    if (!w || !cfg) return { reloaded: false, reloadTime: 0 };
    if (cfg.clipSize === Infinity) return { reloaded: false, reloadTime: 0 };
    if (w.ammoClip >= cfg.clipSize) return { reloaded: false, reloadTime: 0 };
    if (w.ammoReserve <= 0) return { reloaded: false, reloadTime: 0 };

    const needed = cfg.clipSize - w.ammoClip;
    const toLoad = Math.min(needed, w.ammoReserve);
    w.ammoClip += toLoad;
    w.ammoReserve -= toLoad;

    return { reloaded: true, reloadTime: cfg.reloadTime || 1.5 };
}

/**
 * Add ammo to a weapon's reserve.
 * @param {string} type
 * @param {number} amount
 */
export function addAmmo(type, amount) {
    const w = weapons.get(type);
    const cfg = WEAPONS[type];
    if (!w || !cfg) return;
    w.ammoReserve = Math.min(w.ammoReserve + amount, cfg.maxAmmo || 999);
}

/**
 * Get list of all weapons in inventory for weapon wheel.
 * @returns {Array<{ type: string, config: Object, ammo: Object }>}
 */
export function getWeaponList() {
    return weaponOrder.map(type => ({
        type,
        config: WEAPONS[type],
        ammo: getAmmo(type),
    }));
}

/**
 * Drop current weapon (switch to fists).
 * @returns {string|null} dropped weapon type
 */
export function dropCurrentWeapon() {
    if (currentWeapon === WEAPON_TYPES.FISTS) return null;
    const dropped = currentWeapon;
    weapons.delete(dropped);
    weaponOrder = weaponOrder.filter(t => t !== dropped);
    currentWeapon = weaponOrder[0] || WEAPON_TYPES.FISTS;
    return dropped;
}

/**
 * Get throwable count.
 * @param {string} type
 * @returns {number}
 */
export function getThrowableCount(type) {
    const w = weapons.get(type);
    if (!w) return 0;
    return w.ammoClip + w.ammoReserve;
}

/**
 * Use one throwable.
 * @param {string} type
 * @returns {boolean}
 */
export function useThrowable(type) {
    const w = weapons.get(type);
    if (!w) return false;
    if (w.ammoClip > 0) { w.ammoClip--; return true; }
    if (w.ammoReserve > 0) { w.ammoReserve--; return true; }
    return false;
}
