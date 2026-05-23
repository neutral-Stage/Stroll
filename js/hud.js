/**
 * hud.js — GTA-style action game HUD
 * Minimap, health/armor bars, weapon info, wanted stars, damage indicator, death screen
 * @module hud
 */

import { MINIMAP_SIZE, MINIMAP_RANGE, WANTED_LEVELS, HALF_CITY } from './config.js';

let canvas2d = null;
let ctx2d = null;
let isPaused = false;
let pauseStatsProvider = null;

// ── DOM elements (cached) ────────────────────────────────────
const el = {};

/**
 * Initialize HUD by caching DOM references.
 */
export function initHUD() {
    el.healthBar = document.getElementById('health-bar-fill');
    el.healthText = document.getElementById('health-text');
    el.armorBar = document.getElementById('armor-bar-fill');
    el.armorText = document.getElementById('armor-text');
    el.staminaBar = document.getElementById('stamina-bar-fill');
    el.cash = document.getElementById('cash-display');
    el.level = document.getElementById('level-display');
    el.xpBar = document.getElementById('xp-bar-fill');
    el.ammoClip = document.getElementById('ammo-clip');
    el.ammoReserve = document.getElementById('ammo-reserve');
    el.weaponName = document.getElementById('weapon-name');
    el.wantedStars = document.getElementById('wanted-stars');
    el.minimap = document.getElementById('minimap');
    el.crosshair = document.getElementById('crosshair');
    el.damageOverlay = document.getElementById('damage-overlay');
    el.deathScreen = document.getElementById('death-screen');
    el.deathTimer = document.getElementById('death-timer');
    el.toastContainer = document.getElementById('toast-container');
    el.compass = document.getElementById('compass-heading');
    el.killFeed = document.getElementById('kill-feed');
    el.missionText = document.getElementById('mission-text');

    // Minimap canvas
    canvas2d = document.getElementById('minimap-canvas');
    if (canvas2d) {
        canvas2d.width = MINIMAP_SIZE;
        canvas2d.height = MINIMAP_SIZE;
        ctx2d = canvas2d.getContext('2d');
    }
}

/**
 * Update the HUD each frame.
 * @param {Object} stats - Player stats
 * @param {Object} weaponInfo - { name, ammoClip, ammoReserve, maxClip }
 * @param {number} wantedLevel - 0-5
 * @param {Object} camera - Camera for compass
 * @param {Object} playerPos - { x, z }
 * @param {Array} enemies - Array of { x, z, type }
 * @param {Object} buildings - Array of building rects for minimap
 * @param {Object} damageDir - { angle, active }
 */
export function updateHUD(stats, weaponInfo, wantedLevel, camera, playerPos, enemies, buildings, damageDir, missionMarker) {
    // Health bar
    if (el.healthBar) {
        const pct = (stats.health / stats.maxHealth) * 100;
        el.healthBar.style.width = `${pct}%`;
        el.healthBar.style.background = pct > 50
            ? `linear-gradient(90deg, #00cc44, #44ff66)`
            : pct > 25
                ? `linear-gradient(90deg, #cc8800, #ffaa00)`
                : `linear-gradient(90deg, #cc0000, #ff4444)`;
    }
    if (el.healthText) el.healthText.textContent = Math.ceil(stats.health);

    // Armor bar
    if (el.armorBar) {
        const pct = (stats.armor / stats.maxArmor) * 100;
        el.armorBar.style.width = `${pct}%`;
    }
    if (el.armorText) el.armorText.textContent = Math.ceil(stats.armor);

    // Stamina bar
    if (el.staminaBar) {
        const pct = (stats.stamina / stats.maxStamina) * 100;
        el.staminaBar.style.width = `${pct}%`;
    }

    // Cash
    if (el.cash) el.cash.textContent = `$${stats.cash.toLocaleString()}`;

    // Level & XP
    if (el.level) el.level.textContent = `LVL ${stats.level}`;
    if (el.xpBar) {
        const pct = ((stats.xp - (stats.xpForPrev || 0)) / ((stats.xpForNext || 100) - (stats.xpForPrev || 0))) * 100;
        el.xpBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    // Weapon info
    if (el.weaponName) el.weaponName.textContent = weaponInfo.name || 'Fists';
    if (el.ammoClip) el.ammoClip.textContent = weaponInfo.ammoClip === Infinity ? '∞' : weaponInfo.ammoClip;
    if (el.ammoReserve) el.ammoReserve.textContent = weaponInfo.ammoReserve === Infinity ? '' : `/ ${weaponInfo.ammoReserve}`;

    // Wanted stars
    if (el.wantedStars) {
        let stars = '';
        for (let i = 0; i < WANTED_LEVELS; i++) {
            stars += i < wantedLevel
                ? '<span class="star active">★</span>'
                : '<span class="star">☆</span>';
        }
        el.wantedStars.innerHTML = stars;
    }

    // Compass
    if (el.compass && camera) {
        const yaw = camera.rotation.y;
        const deg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const idx = Math.round(deg / 45) % 8;
        el.compass.textContent = `${dirs[idx]} ${Math.round(deg)}°`;
    }

    // Damage overlay direction
    if (el.damageOverlay && damageDir) {
        if (damageDir.active) {
            el.damageOverlay.style.opacity = '1';
            el.damageOverlay.style.background = `radial-gradient(
                circle,
                transparent 40%,
                rgba(255, 0, 0, 0.2) 75%,
                rgba(255, 0, 0, 0.7) 100%
            )`;
        } else {
            el.damageOverlay.style.opacity = '0';
        }
    }

    // Draw minimap
    drawMinimap(playerPos, camera, enemies, buildings, missionMarker);
}

function drawMinimap(playerPos, camera, enemies, buildings, missionMarker) {
    if (!ctx2d) return;
    const S = MINIMAP_SIZE;
    const halfS = S / 2;
    const scale = S / (MINIMAP_RANGE * 2);

    ctx2d.clearRect(0, 0, S, S);

    // Background
    ctx2d.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx2d.beginPath();
    ctx2d.arc(halfS, halfS, halfS, 0, Math.PI * 2);
    ctx2d.fill();

    // Buildings (as rects)
    ctx2d.fillStyle = 'rgba(60, 60, 80, 0.7)';
    if (buildings) {
        for (const b of buildings) {
            const rx = (b.x - playerPos.x) * scale + halfS;
            const rz = (b.z - playerPos.z) * scale + halfS;
            const rw = b.width * scale;
            const rd = b.depth * scale;

            // Skip if outside minimap circle
            if (Math.abs(rx - halfS) > halfS + rw || Math.abs(rz - halfS) > halfS + rd) continue;

            ctx2d.fillRect(rx - rw / 2, rz - rd / 2, rw, rd);
        }
    }

    // Enemies (red dots)
    if (enemies) {
        ctx2d.fillStyle = '#ff4444';
        for (const e of enemies) {
            const ex = (e.x - playerPos.x) * scale + halfS;
            const ez = (e.z - playerPos.z) * scale + halfS;
            const dist = Math.sqrt((ex - halfS) ** 2 + (ez - halfS) ** 2);
            if (dist > halfS - 4) continue;

            ctx2d.beginPath();
            ctx2d.arc(ex, ez, 2.5, 0, Math.PI * 2);
            ctx2d.fill();
        }
    }

    // Mission marker (yellow dot)
    if (missionMarker) {
        ctx2d.fillStyle = '#ffcc00';
        const mx = (missionMarker.x - playerPos.x) * scale + halfS;
        const mz = (missionMarker.z - playerPos.z) * scale + halfS;
        
        // Clamp to circle edge if outside
        const dist = Math.sqrt((mx - halfS) ** 2 + (mz - halfS) ** 2);
        let drawX = mx;
        let drawZ = mz;
        if (dist > halfS - 6) {
            const angle = Math.atan2(mz - halfS, mx - halfS);
            drawX = halfS + Math.cos(angle) * (halfS - 6);
            drawZ = halfS + Math.sin(angle) * (halfS - 6);
        }
        
        ctx2d.beginPath();
        ctx2d.arc(drawX, drawZ, 4, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx2d.lineWidth = 1;
        ctx2d.stroke();
    }

    // Player (white triangle)
    ctx2d.save();
    ctx2d.translate(halfS, halfS);
    const yaw = camera ? -camera.rotation.y : 0;
    ctx2d.rotate(yaw);
    ctx2d.fillStyle = '#ffffff';
    ctx2d.beginPath();
    ctx2d.moveTo(0, -6);
    ctx2d.lineTo(-4, 4);
    ctx2d.lineTo(4, 4);
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.restore();

    // Border ring
    ctx2d.strokeStyle = 'rgba(120, 120, 140, 0.5)';
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.arc(halfS, halfS, halfS - 1, 0, Math.PI * 2);
    ctx2d.stroke();

    // Clip to circle
    ctx2d.globalCompositeOperation = 'destination-in';
    ctx2d.fillStyle = '#fff';
    ctx2d.beginPath();
    ctx2d.arc(halfS, halfS, halfS, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.globalCompositeOperation = 'source-over';
}

/**
 * Show the death screen.
 * @param {number} respawnTime - Seconds until respawn
 */
export function showDeathScreen(respawnTime) {
    if (el.deathScreen) {
        el.deathScreen.classList.add('active');
    }
    if (el.deathTimer) {
        el.deathTimer.textContent = Math.ceil(respawnTime);
    }
}

/**
 * Hide the death screen.
 */
export function hideDeathScreen() {
    if (el.deathScreen) {
        el.deathScreen.classList.remove('active');
    }
}

/**
 * Show a toast notification.
 * @param {string} title
 * @param {string} message
 * @param {string} [type='info'] - 'info', 'achievement', 'kill', 'mission', 'level'
 */
export function showToast(title, message, type = 'info') {
    if (!el.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Add a kill feed entry.
 * @param {string} text
 */
export function addKillFeed(text) {
    if (!el.killFeed) return;
    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry';
    entry.textContent = text;
    el.killFeed.appendChild(entry);

    setTimeout(() => {
        entry.classList.add('fade-out');
        setTimeout(() => entry.remove(), 500);
    }, 4000);

    // Max 5 entries
    while (el.killFeed.children.length > 5) {
        el.killFeed.removeChild(el.killFeed.firstChild);
    }
}

/**
 * Show mission text.
 * @param {string} text
 * @param {number} [duration=3]
 */
export function showMissionText(text, duration = 3) {
    if (el.missionText) {
        el.missionText.textContent = text;
        el.missionText.classList.add('visible');
        setTimeout(() => el.missionText.classList.remove('visible'), duration * 1000);
    }
}

/** Toggle pause menu */
export function togglePause() {
    isPaused = !isPaused;
    const pauseEl = document.getElementById('pause-menu');
    if (pauseEl) pauseEl.classList.toggle('active', isPaused);
    return isPaused;
}

/** @returns {boolean} */
export function getIsPaused() { return isPaused; }

/** Set pause stats provider */
export function setPauseStatsProvider(fn) { pauseStatsProvider = fn; }

/** Setup pause menu */
export function setupPauseMenu() {
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            isPaused = false;
            const pauseEl = document.getElementById('pause-menu');
            if (pauseEl) pauseEl.classList.remove('active');
        });
    }
}

/** Check if journal is open (legacy compat) */
export function isJournalOpen() { return false; }

/** Toggle journal (legacy compat — removed in action game) */
export function toggleJournal() { return false; }

