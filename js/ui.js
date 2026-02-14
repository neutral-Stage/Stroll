/**
 * ui.js — UI management system
 *
 * Handles HUD, discovery journal, photo mode, meditation mode,
 * pause menu, achievement notifications, compass, and cinematic intro.
 *
 * @module ui
 */

import * as gamestate from './gamestate.js';
import { playShutterSound } from './audio.js';

let compassAngle = 0;
let introCallback = null;

/**
 * Initialize all UI systems and event listeners.
 * @param {Function} onIntroComplete - callback when intro finishes
 */
export function initUI(onIntroComplete) {
    introCallback = onIntroComplete;
    
    // Subscribe to game events
    gamestate.on('collection', onCollection);
    gamestate.on('achievement', onAchievement);
    gamestate.on('scoreChange', onScoreChange);
    gamestate.on('photoMode', onPhotoModeChange);
    gamestate.on('meditation', onMeditationChange);
    gamestate.on('pause', onPauseChange);
    
    // Initial score
    updateScoreDisplay(0);
    updateDiscoveryCount(0, 47);
    
    // Setup pause menu controls
    setupPauseMenu();
    setupJournalToggle();
    setupPhotoMode();
}

/**
 * Run the cinematic intro sequence.
 */
export function runIntro() {
    const intro = document.getElementById('cinematic-intro');
    if (!intro) {
        if (introCallback) introCallback();
        return;
    }
    
    intro.style.display = 'flex';
    intro.style.opacity = '1';
    
    // Sequence of text reveals
    const lines = intro.querySelectorAll('.intro-line');
    let delay = 500;
    
    lines.forEach((line, i) => {
        setTimeout(() => {
            line.classList.add('visible');
        }, delay);
        delay += 2000;
    });
    
    // Fade out intro
    setTimeout(() => {
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.style.display = 'none';
            gamestate.setIntroComplete();
            if (introCallback) introCallback();
        }, 1500);
    }, delay + 1000);
}

/**
 * Skip intro immediately.
 */
export function skipIntro() {
    const intro = document.getElementById('cinematic-intro');
    if (intro) {
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.style.display = 'none';
            gamestate.setIntroComplete();
            if (introCallback) introCallback();
        }, 500);
    }
}

// ── HUD Updates ──────────────────────────────────────────────

function updateScoreDisplay(score) {
    const el = document.getElementById('hud-score-value');
    if (el) el.textContent = score;
}

function updateDiscoveryCount(found, total) {
    const el = document.getElementById('hud-discoveries-value');
    if (el) el.textContent = `${found}/${total}`;
}

function onScoreChange(score) {
    updateScoreDisplay(score);
    // Animate score pop
    const el = document.getElementById('hud-score-value');
    if (el) {
        el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 300);
    }
}

function onCollection(data) {
    const stats = gamestate.getState();
    updateDiscoveryCount(stats.discoveries ? stats.discoveries.length : 0, 47);
    
    // Show collection toast
    showToast(`✨ ${data.item.name} +${data.points}`, 'collection');
    
    // Update journal
    updateJournalContent();
}

function onAchievement(achievement) {
    showAchievementNotification(achievement);
    updateJournalContent();
}

function onPhotoModeChange(active) {
    const overlay = document.getElementById('photo-overlay');
    const hud = document.getElementById('hud');
    if (overlay) overlay.style.display = active ? 'block' : 'none';
    if (hud) hud.style.opacity = active ? '0' : '1';
}

function onMeditationChange(active) {
    const overlay = document.getElementById('meditation-overlay');
    if (overlay) overlay.style.display = active ? 'flex' : 'none';
}

function onPauseChange(paused) {
    const menu = document.getElementById('pause-menu');
    if (menu) menu.style.display = paused ? 'flex' : 'none';
}

// ── Toast Notifications ──────────────────────────────────────

const toastQueue = [];
let toastActive = false;

function showToast(message, type = 'info') {
    toastQueue.push({ message, type });
    if (!toastActive) processToastQueue();
}

function processToastQueue() {
    if (toastQueue.length === 0) {
        toastActive = false;
        return;
    }
    
    toastActive = true;
    const { message, type } = toastQueue.shift();
    
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.remove();
            processToastQueue();
        }, 500);
    }, 2500);
}

// ── Achievement Notification ─────────────────────────────────

function showAchievementNotification(achievement) {
    const container = document.getElementById('achievement-notification');
    if (!container) return;
    
    const icon = container.querySelector('.achievement-icon');
    const name = container.querySelector('.achievement-name');
    const desc = container.querySelector('.achievement-desc');
    
    if (icon) icon.textContent = achievement.icon;
    if (name) name.textContent = achievement.name;
    if (desc) desc.textContent = achievement.desc;
    
    container.classList.add('visible');
    
    setTimeout(() => {
        container.classList.remove('visible');
    }, 4000);
}

// ── Compass ──────────────────────────────────────────────────

/**
 * Update compass direction.
 * @param {number} yaw - player yaw in radians
 */
export function updateCompass(yaw) {
    compassAngle = yaw;
    const needle = document.getElementById('compass-needle');
    if (needle) {
        needle.style.transform = `rotate(${(-yaw * 180 / Math.PI)}deg)`;
    }
    
    // Update direction text
    const dirEl = document.getElementById('compass-direction');
    if (dirEl) {
        const deg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
        let dir = 'N';
        if (deg > 22.5 && deg <= 67.5) dir = 'NE';
        else if (deg > 67.5 && deg <= 112.5) dir = 'E';
        else if (deg > 112.5 && deg <= 157.5) dir = 'SE';
        else if (deg > 157.5 && deg <= 202.5) dir = 'S';
        else if (deg > 202.5 && deg <= 247.5) dir = 'SW';
        else if (deg > 247.5 && deg <= 292.5) dir = 'W';
        else if (deg > 292.5 && deg <= 337.5) dir = 'NW';
        dirEl.textContent = dir;
    }
}

// ── Time Indicator ───────────────────────────────────────────

/**
 * Update time of day indicator.
 * @param {number} cycleTime - 0..1
 */
export function updateTimeIndicator(cycleTime) {
    const el = document.getElementById('hud-time-icon');
    if (!el) return;
    
    const nightAmount = Math.sin(cycleTime * Math.PI);
    if (nightAmount < 0.3) {
        el.textContent = '☀️';
    } else if (nightAmount < 0.6) {
        el.textContent = '🌅';
    } else {
        el.textContent = '🌙';
    }
}

// ── Journal ──────────────────────────────────────────────────

function setupJournalToggle() {
    const btn = document.getElementById('journal-toggle');
    const panel = document.getElementById('journal-panel');
    if (!btn || !panel) return;
    
    btn.addEventListener('click', () => {
        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            panel.classList.remove('open');
        } else {
            updateJournalContent();
            panel.classList.add('open');
        }
    });
    
    const closeBtn = document.getElementById('journal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('open');
        });
    }
}

function updateJournalContent() {
    const discoveries = gamestate.getDiscoveries();
    const achievements = gamestate.getAllAchievements();
    
    // Discoveries tab
    const discList = document.getElementById('journal-discoveries');
    if (discList) {
        if (discoveries.length === 0) {
            discList.innerHTML = '<div class="journal-empty">No discoveries yet. Explore the world!</div>';
        } else {
            discList.innerHTML = discoveries.map(d => {
                const icon = d.type === 'orb' ? '💫' : d.type === 'crystal' ? '💎' : '🌸';
                return `<div class="journal-item"><span class="journal-item-icon">${icon}</span><span class="journal-item-name">${d.name}</span><span class="journal-item-points">+${d.points}</span></div>`;
            }).join('');
        }
    }
    
    // Achievements tab
    const achList = document.getElementById('journal-achievements');
    if (achList) {
        achList.innerHTML = achievements.map(a => {
            const cls = a.unlocked ? 'journal-achievement unlocked' : 'journal-achievement locked';
            return `<div class="${cls}"><span class="achievement-badge">${a.icon}</span><div class="achievement-info"><div class="achievement-title">${a.name}</div><div class="achievement-requirement">${a.desc}</div></div></div>`;
        }).join('');
    }
}

// ── Pause Menu ───────────────────────────────────────────────

function setupPauseMenu() {
    const resumeBtn = document.getElementById('pause-resume');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            gamestate.togglePause();
        });
    }
    
    const volumeSlider = document.getElementById('pause-volume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            gamestate.setVolume(parseFloat(e.target.value));
        });
    }
    
    const qualitySelect = document.getElementById('pause-quality');
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            gamestate.setQuality(e.target.value);
        });
    }
}

// ── Photo Mode ───────────────────────────────────────────────

let photoFilterIndex = 0;
const photoFilters = [
    { name: 'None', css: '' },
    { name: 'Warm', css: 'sepia(0.3) saturate(1.3)' },
    { name: 'Cool', css: 'hue-rotate(20deg) saturate(0.9)' },
    { name: 'Vintage', css: 'sepia(0.5) contrast(1.1) brightness(0.9)' },
    { name: 'Dramatic', css: 'contrast(1.4) saturate(1.5)' },
    { name: 'Dreamy', css: 'blur(1px) brightness(1.1) saturate(1.2)' },
    { name: 'B&W', css: 'grayscale(1) contrast(1.2)' }
];

function setupPhotoMode() {
    // Filter cycling handled in controls
}

/**
 * Cycle photo filter.
 */
export function cyclePhotoFilter() {
    photoFilterIndex = (photoFilterIndex + 1) % photoFilters.length;
    const canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.style.filter = photoFilters[photoFilterIndex].css;
    }
    const filterName = document.getElementById('photo-filter-name');
    if (filterName) filterName.textContent = photoFilters[photoFilterIndex].name;
}

/**
 * Take a screenshot in photo mode.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 */
export function takePhoto(renderer, scene, camera) {
    // Flash effect
    const flash = document.getElementById('photo-flash');
    if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 150);
    }
    
    playShutterSound();
    gamestate.recordPhoto();
    
    // Save screenshot
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `stroll-photo-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    showToast('📸 Photo saved!', 'info');
}

/**
 * Reset photo filter when leaving photo mode.
 */
export function resetPhotoFilter() {
    photoFilterIndex = 0;
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.filter = '';
    const filterName = document.getElementById('photo-filter-name');
    if (filterName) filterName.textContent = 'None';
}

// ── Meditation Mode UI ───────────────────────────────────────

let meditationTimer = 0;

/**
 * Update meditation timer display.
 * @param {number} delta
 */
export function updateMeditationTimer(delta) {
    if (!gamestate.getState().isMeditating) return;
    meditationTimer += delta;
    const el = document.getElementById('meditation-timer');
    if (el) {
        const mins = Math.floor(meditationTimer / 60);
        const secs = Math.floor(meditationTimer % 60);
        el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Reset meditation timer.
 */
export function resetMeditationTimer() {
    meditationTimer = 0;
}

// ── Distance Display ─────────────────────────────────────────

/**
 * Update distance walked display.
 * @param {number} distance
 */
export function updateDistanceDisplay(distance) {
    const el = document.getElementById('hud-distance-value');
    if (el) el.textContent = Math.floor(distance) + 'm';
}
