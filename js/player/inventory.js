/**
 * inventory.js — Unified Weapon and Superpowers Inventory Management
 * @module player/inventory
 */

import { WEAPONS, WEAPON_TYPES, WEAPON_CATEGORIES } from '../config.js';
import { setCurrentPower, getFiringState } from '../weapons/powers-system.js';

/** @type {Map<string, { ammoClip: number, ammoReserve: number }>} */
const weapons = new Map();

/** @type {string} Currently equipped weapon type */
let currentWeapon = WEAPON_TYPES.PISTOL;

/** @type {string[]} Ordered weapon slots for cycling */
let weaponOrder = [];

/** @type {boolean} True if using superpowers, false if using physical weapons */
let isSuperpowersMode = true;

/**
 * Initialize inventory with starting weapons.
 */
export function initInventory() {
    weapons.clear();
    weaponOrder = [];
    pickupWeapon(WEAPON_TYPES.FISTS, Infinity);
    pickupWeapon(WEAPON_TYPES.KNIFE, Infinity);
    pickupWeapon(WEAPON_TYPES.PISTOL, 45);

    // Adjust pistol ammo to exactly 15 clip / 30 reserve
    const pistolWeapon = weapons.get(WEAPON_TYPES.PISTOL);
    if (pistolWeapon) {
        pistolWeapon.ammoClip = 15;
        pistolWeapon.ammoReserve = 30;
    }

    currentWeapon = WEAPON_TYPES.PISTOL;
    isSuperpowersMode = true; // default to superpowers
}

if (typeof window !== 'undefined') {
    // Keyboard select
    window.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '6') {
            isSuperpowersMode = true;
            setCurrentPower(parseInt(e.key));
        } else if (e.key === '7') {
            // Melee weapons
            if (cycleCategory([WEAPON_TYPES.FISTS, WEAPON_TYPES.BAT, WEAPON_TYPES.SWORD, WEAPON_TYPES.KNIFE])) {
                isSuperpowersMode = false;
            }
        } else if (e.key === '8') {
            // Guns
            if (cycleCategory([WEAPON_TYPES.PISTOL, WEAPON_TYPES.SHOTGUN, WEAPON_TYPES.SMG, WEAPON_TYPES.ASSAULT_RIFLE, WEAPON_TYPES.MINIGUN])) {
                isSuperpowersMode = false;
            }
        } else if (e.key === '9') {
            // Heavy/Special
            if (cycleCategory([WEAPON_TYPES.SNIPER, WEAPON_TYPES.RPG, WEAPON_TYPES.GRAPPLE])) {
                isSuperpowersMode = false;
            }
        } else if (e.key === '0') {
            // Throwables
            if (cycleCategory([WEAPON_TYPES.GRENADE, WEAPON_TYPES.MOLOTOV, WEAPON_TYPES.SMOKE_BOMB])) {
                isSuperpowersMode = false;
            }
        }
    });

    // Scroll wheel cycle
    window.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > 5) {
            const dir = e.deltaY > 0 ? 1 : -1;
            cycleAll(dir);
        }
    }, { passive: true });
}

function cycleCategory(list) {
    const owned = list.filter(t => weapons.has(t));
    if (owned.length === 0) return false;
    const idx = owned.indexOf(currentWeapon);
    const nextIdx = idx !== -1 ? (idx + 1) % owned.length : 0;
    currentWeapon = owned[nextIdx];
    return true;
}

const ALL_ITEMS = [
    1, 2, 3, 4, 5, 6, // superpowers
    WEAPON_TYPES.FISTS,
    WEAPON_TYPES.BAT,
    WEAPON_TYPES.SWORD,
    WEAPON_TYPES.KNIFE,
    WEAPON_TYPES.PISTOL,
    WEAPON_TYPES.SHOTGUN,
    WEAPON_TYPES.SMG,
    WEAPON_TYPES.ASSAULT_RIFLE,
    WEAPON_TYPES.MINIGUN,
    WEAPON_TYPES.SNIPER,
    WEAPON_TYPES.RPG,
    WEAPON_TYPES.GRENADE,
    WEAPON_TYPES.MOLOTOV,
    WEAPON_TYPES.SMOKE_BOMB,
    WEAPON_TYPES.GRAPPLE
];

function cycleAll(dir) {
    const available = ALL_ITEMS.filter(item => {
        if (typeof item === 'number') return true;
        return weapons.has(item);
    });
    if (available.length === 0) return;

    const currentItem = isSuperpowersMode ? getActiveSuperpower() : currentWeapon;
    const idx = available.indexOf(currentItem);
    const newIdx = idx !== -1 ? (idx + dir + available.length) % available.length : 0;
    const nextItem = available[newIdx];

    if (typeof nextItem === 'number') {
        isSuperpowersMode = true;
        setCurrentPower(nextItem);
    } else {
        isSuperpowersMode = false;
        currentWeapon = nextItem;
    }
}

function getActiveSuperpower() {
    try {
        const state = getFiringState();
        return state.currentPower || 1;
    } catch(e) {
        return 1;
    }
}

/**
 * Check if superpowers mode is active.
 * @returns {boolean}
 */
export function getIsSuperpowersMode() {
    return isSuperpowersMode;
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
        const w = weapons.get(type);
        w.ammoReserve = Math.min(w.ammoReserve + ammo, cfg.maxAmmo || Infinity);
        return false;
    }

    weapons.set(type, {
        ammoClip: Math.min(ammo, cfg.clipSize || Infinity),
        ammoReserve: Math.max(0, ammo - (cfg.clipSize || 0)),
    });

    if (!weaponOrder.includes(type)) {
        weaponOrder.push(type);
    }
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
    isSuperpowersMode = false;
    return true;
}

/**
 * Cycle to next weapon.
 * @param {number} [dir=1]
 * @returns {string} new weapon type
 */
export function cycleWeapon(dir = 1) {
    const owned = weaponOrder.filter(type => weapons.has(type));
    if (owned.length === 0) return currentWeapon;
    const idx = owned.indexOf(currentWeapon);
    const newIdx = idx !== -1 ? (idx + dir + owned.length) % owned.length : 0;
    currentWeapon = owned[newIdx];
    isSuperpowersMode = false;
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
 * @param {string} [type]
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
    if (cfg.clipSize === Infinity) return true;

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
