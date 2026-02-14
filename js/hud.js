/**
 * hud.js — HUD, compass, pause menu, achievements, toast notifications
 *
 * Features:
 *  • Minimal HUD showing score, discoveries, time of day
 *  • Compass showing cardinal directions
 *  • Pause menu with settings
 *  • Achievement toast notifications
 *  • Discovery journal overlay
 *
 * @module hud
 */

/** @type {boolean} */
let isPaused = false;
let journalOpen = false;

/** Toast queue */
const toastQueue = [];
let toastActive = false;

/**
 * Update the HUD elements each frame.
 * @param {object} state
 */
export function updateHUD(state) {
    // Score
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = state.score || 0;

    // Collectibles
    const collectEl = document.getElementById('hud-collected');
    if (collectEl) collectEl.textContent = `${state.collected || 0}/${state.totalCollectibles || 0}`;

    // Waypoints
    const waypointEl = document.getElementById('hud-waypoints');
    if (waypointEl) waypointEl.textContent = `${state.waypointsFound || 0}/${state.totalWaypoints || 0}`;

    // Time of day
    const timeEl = document.getElementById('hud-time');
    if (timeEl) {
        const phase = state.cycleTime || 0;
        const nightAmount = Math.sin(phase * Math.PI);
        let timeStr = 'Golden Hour';
        if (nightAmount > 0.8) timeStr = 'Midnight';
        else if (nightAmount > 0.5) timeStr = 'Night';
        else if (nightAmount > 0.2) timeStr = 'Dusk';
        else if (phase > 0.5) timeStr = 'Dawn';
        timeEl.textContent = timeStr;
    }

    // Compass
    updateCompass(state.playerYaw || 0);
}

function updateCompass(yaw) {
    const needle = document.getElementById('compass-needle');
    if (!needle) return;

    // Yaw is in radians, convert to degrees
    const degrees = (yaw * 180 / Math.PI) % 360;
    needle.style.transform = `rotate(${degrees}deg)`;

    // Cardinal direction text
    const dirEl = document.getElementById('compass-dir');
    if (dirEl) {
        const normalized = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
        let dir = 'N';
        if (normalized > 337.5 || normalized <= 22.5) dir = 'N';
        else if (normalized > 22.5 && normalized <= 67.5) dir = 'NE';
        else if (normalized > 67.5 && normalized <= 112.5) dir = 'E';
        else if (normalized > 112.5 && normalized <= 157.5) dir = 'SE';
        else if (normalized > 157.5 && normalized <= 202.5) dir = 'S';
        else if (normalized > 202.5 && normalized <= 247.5) dir = 'SW';
        else if (normalized > 247.5 && normalized <= 292.5) dir = 'W';
        else if (normalized > 292.5 && normalized <= 337.5) dir = 'NW';
        dirEl.textContent = dir;
    }
}

/**
 * Toggle pause menu.
 * @returns {boolean} new paused state
 */
export function togglePause() {
    isPaused = !isPaused;
    const menu = document.getElementById('pause-menu');
    if (menu) menu.style.display = isPaused ? 'flex' : 'none';
    return isPaused;
}

/**
 * Toggle discovery journal.
 * @param {Array<string>} discoveries
 * @param {Array<string>} achievements
 * @param {Array<object>} achievementList
 */
export function toggleJournal(discoveries, achievements, achievementList) {
    journalOpen = !journalOpen;
    const journal = document.getElementById('journal-overlay');
    if (!journal) return;

    if (journalOpen) {
        journal.style.display = 'flex';

        // Populate discoveries
        const discList = document.getElementById('journal-discoveries');
        if (discList) {
            discList.innerHTML = discoveries.length > 0
                ? discoveries.map(d => `<div class="journal-item">📍 ${d}</div>`).join('')
                : '<div class="journal-empty">No discoveries yet. Explore the city!</div>';
        }

        // Populate achievements
        const achList = document.getElementById('journal-achievements');
        if (achList) {
            achList.innerHTML = achievementList.map(a => {
                const unlocked = achievements.includes(a.id);
                return `<div class="journal-item ${unlocked ? 'unlocked' : 'locked'}">
                    <span class="ach-icon">${unlocked ? a.icon : '🔒'}</span>
                    <span class="ach-name">${a.name}</span>
                    <span class="ach-desc">${unlocked ? a.desc : '???'}</span>
                </div>`;
            }).join('');
        }
    } else {
        journal.style.display = 'none';
    }

    return journalOpen;
}

/**
 * Show a toast notification.
 * @param {string} icon
 * @param {string} title
 * @param {string} message
 * @param {string} [type='info'] - 'achievement', 'discovery', 'info'
 */
export function showToast(icon, title, message, type = 'info') {
    toastQueue.push({ icon, title, message, type });
    if (!toastActive) processToastQueue();
}

function processToastQueue() {
    if (toastQueue.length === 0) {
        toastActive = false;
        return;
    }

    toastActive = true;
    const toast = toastQueue.shift();
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${toast.type}`;
    el.innerHTML = `
        <span class="toast-icon">${toast.icon}</span>
        <div class="toast-content">
            <div class="toast-title">${toast.title}</div>
            <div class="toast-message">${toast.message}</div>
        </div>
    `;

    container.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        el.classList.add('toast-show');
    });

    // Remove after delay
    setTimeout(() => {
        el.classList.remove('toast-show');
        el.classList.add('toast-hide');
        setTimeout(() => {
            el.remove();
            processToastQueue();
        }, 500);
    }, 3000);
}

export function getIsPaused() { return isPaused; }
export function isJournalOpen() { return journalOpen; }

/**
 * Set up pause menu button handlers.
 */
export function setupPauseMenu() {
    const resumeBtn = document.getElementById('pause-resume');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            togglePause();
        });
    }
}
