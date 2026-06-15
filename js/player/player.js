/**
 * player.js — Player entity with health, armor, stamina, progression
 * @module player/player
 */

import {
    PLAYER_MAX_HEALTH, PLAYER_MAX_ARMOR, PLAYER_MAX_STAMINA,
    STAMINA_DRAIN_RATE, STAMINA_REGEN_RATE,
    HEALTH_REGEN_RATE, HEALTH_REGEN_DELAY, STARTING_CASH,
    XP_PER_LEVEL, LEVEL_UNLOCKS,
} from '../config.js';

let currentMaxHealth = PLAYER_MAX_HEALTH;
let currentMaxArmor = PLAYER_MAX_ARMOR;
let currentMaxStamina = PLAYER_MAX_STAMINA;

let health = currentMaxHealth;
let armor = 0;
let stamina = currentMaxStamina;
let cash = STARTING_CASH;
let xp = 0;
let level = 1;
let dead = false;
let timeSinceDamage = 999;
let isSprinting = false;
let lastDamageDir = 0; // radians, direction damage came from
let lastDamageDirTimer = 0;
let kills = 0;

/**
 * Initialize/reset player stats.
 */
export function createPlayer() {
    health = currentMaxHealth;
    armor = 0;
    stamina = currentMaxStamina;
    cash = STARTING_CASH;
    xp = 0;
    level = 1;
    dead = false;
    timeSinceDamage = 999;
    kills = 0;
}

/**
 * Update player stats each frame.
 * @param {number} delta
 * @param {boolean} sprinting
 */
export function updatePlayerStats(delta, sprinting) {
    if (dead) return;
    isSprinting = sprinting;

    // Stamina
    if (sprinting && stamina > 0) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN_RATE * delta);
    } else if (!sprinting) {
        stamina = Math.min(PLAYER_MAX_STAMINA, stamina + STAMINA_REGEN_RATE * delta);
    }

    // Health regen (out of combat)
    timeSinceDamage += delta;
    if (timeSinceDamage >= HEALTH_REGEN_DELAY && health < currentMaxHealth && health > 0) {
        health = Math.min(currentMaxHealth, health + HEALTH_REGEN_RATE * delta);
    }

    // Damage direction indicator fade
    if (lastDamageDirTimer > 0) {
        lastDamageDirTimer -= delta;
    }
}

/**
 * Apply damage to the player.
 * @param {number} amount
 * @param {number} [fromX=0] - Source X position (for damage indicator)
 * @param {number} [fromZ=0] - Source Z position
 * @param {number} [playerX=0] - Player X
 * @param {number} [playerZ=0] - Player Z
 * @param {number} [playerYaw=0] - Player facing direction
 * @returns {{ killed: boolean, remainingHealth: number }}
 */
export function damagePlayer(amount, fromX = 0, fromZ = 0, playerX = 0, playerZ = 0, playerYaw = 0) {
    if (dead) return { killed: false, remainingHealth: 0 };

    timeSinceDamage = 0;

    // Armor absorbs damage first
    if (armor > 0) {
        const armorAbsorb = Math.min(armor, amount * 0.6);
        armor -= armorAbsorb;
        amount -= armorAbsorb;
    }

    health = Math.max(0, health - amount);

    // Calculate damage direction relative to player facing
    const angleToSource = Math.atan2(fromX - playerX, fromZ - playerZ);
    lastDamageDir = angleToSource - playerYaw;
    lastDamageDirTimer = 1.5;

    if (health <= 0) {
        dead = true;
        return { killed: true, remainingHealth: 0 };
    }

    return { killed: false, remainingHealth: health };
}

/**
 * Heal the player.
 * @param {number} amount
 */
export function healPlayer(amount) {
    if (dead) return;
    health = Math.min(currentMaxHealth, health + amount);
}

/**
 * Add armor.
 * @param {number} amount
 */
export function addArmor(amount) {
    armor = Math.min(currentMaxArmor, armor + amount);
}

/**
 * Add cash.
 * @param {number} amount
 */
export function addCash(amount) {
    cash += amount;
}

/**
 * Spend cash.
 * @param {number} amount
 * @returns {boolean} true if had enough
 */
export function spendCash(amount) {
    if (cash >= amount) {
        cash -= amount;
        return true;
    }
    return false;
}

export function spendXP(amount) {
    if (xp >= amount) {
        xp -= amount;
        return true;
    }
    return false;
}

export function upgradeMaxHealth(amount) {
    currentMaxHealth += amount;
    health += amount;
}

export function upgradeMaxStamina(amount) {
    currentMaxStamina += amount;
    stamina += amount;
}

/**
 * Add XP and handle level ups.
 * @param {number} amount
 * @returns {{ leveledUp: boolean, newLevel: number, unlocks: string[] }}
 */
export function addXP(amount) {
    xp += amount;
    const newLevel = calculateLevel();
    const result = { leveledUp: false, newLevel: level, unlocks: [] };

    if (newLevel > level) {
        result.leveledUp = true;
        result.newLevel = newLevel;
        // Collect unlocks for all levels gained
        for (let l = level + 1; l <= newLevel; l++) {
            if (LEVEL_UNLOCKS[l]) {
                result.unlocks.push(...LEVEL_UNLOCKS[l]);
            }
        }
        level = newLevel;
    }

    return result;
}

function calculateLevel() {
    for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
        if (xp >= XP_PER_LEVEL[i]) return i + 1;
    }
    return 1;
}

/**
 * Get all player stats.
 */
export function getPlayerStats() {
    return {
        health, maxHealth: currentMaxHealth,
        armor, maxArmor: currentMaxArmor,
        stamina, maxStamina: currentMaxStamina,
        cash, xp, level, dead, kills,
        xpForPrev: XP_PER_LEVEL[level - 1] || 0,
        xpForNext: XP_PER_LEVEL[level] || Infinity,
        canSprint: stamina > 5,
    };
}

/** @returns {boolean} */
export function isPlayerDead() { return dead; }
/** @returns {number} */
export function getHealth() { return health; }
/** @returns {number} */
export function getArmor() { return armor; }
/** @returns {number} */
export function getStamina() { return stamina; }
/** @returns {number} */
export function getCash() { return cash; }
/** @returns {number} */
export function getPlayerLevel() { return level; }
/** @returns {number} */
export function getXP() { return xp; }

/**
 * Get damage direction for HUD indicator.
 * @returns {{ angle: number, active: boolean }}
 */
export function getDamageDirection() {
    return { angle: lastDamageDir, active: lastDamageDirTimer > 0 };
}

/**
 * Respawn the player.
 * @param {number} [x=0]
 * @param {number} [z=0]
 */
export function respawnPlayer(x = 0, z = 0) {
    health = currentMaxHealth;
    armor = 0;
    stamina = currentMaxStamina;
    dead = false;
    timeSinceDamage = 999;
    // Cash penalty on death
    cash = Math.max(0, Math.floor(cash * 0.9));
}

/** Record a kill. */
export function addKill() { kills++; }
/** @returns {number} */
export function getKills() { return kills; }
