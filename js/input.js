/**
 * input.js — Central keyboard / pointer bindings
 * @module input
 */

import { FEATURE_WEAPON, FEATURE_MINIGAMES } from './config.js';
import { isCinematicPlaying, skipCinematic } from './cinematic.js';
import { getIsPaused, isJournalOpen, togglePause, toggleJournal, showToast } from './hud.js';
import { canPlayerAct } from './player-input.js';
import { togglePhotoMode, isPhotoModeActive, photoModeMouseMove, photoModeScroll, cycleFilter, takeScreenshot } from './photomode.js';
import { toggleMeditation, isMeditationActive } from './meditation.js';
import { toggleWeather } from './weather.js';
import { startMiniGame, endMiniGame, getActiveGame, getPlayableGames } from './minigames.js';
import { setAmbientMood } from './ambient.js';
import { getDiscoveries, getAchievements, getAchievementList } from './challenges.js';
import { session, markPhotoModeUsed } from './game-state.js';
import { handleClick } from './interactive.js';

const MOODS = ['calm', 'nature', 'meditative', 'dreamy'];
let moodIndex = 0;

/**
 * @param {object} ctx
 * @param {THREE.PerspectiveCamera} ctx.camera
 * @param {import('./controls.js').player} ctx.player
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {THREE.Scene} ctx.scene
 */
export function setupGameInput(ctx) {
    const { camera, player, renderer, scene } = ctx;

    document.addEventListener('keydown', (e) => {
        if (isCinematicPlaying()) {
            skipCinematic();
            return;
        }

        if (e.key === 'Escape') {
            if (isJournalOpen()) {
                toggleJournal([], [], []);
            } else {
                togglePause();
            }
            return;
        }

        if (getIsPaused() || isJournalOpen()) return;

        if (e.key === 'p' || e.key === 'P') {
            if (isMeditationActive()) return;
            if (togglePhotoMode(camera, player, renderer)) {
                markPhotoModeUsed();
                showToast('📸', 'Photo Mode', 'Orbit with mouse, scroll to zoom', 'info');
            }
        }

        if (e.key === 'n' || e.key === 'N') {
            if (isPhotoModeActive()) return;
            if (toggleMeditation(camera, player)) {
                session.meditated = true;
                showToast('🧘', 'Meditation', 'Relax and breathe...', 'info');
            }
        }

        if (e.key === 'j' || e.key === 'J') {
            toggleJournal(getDiscoveries(), getAchievements(), getAchievementList());
        }

        if (e.key === 'r' || e.key === 'R') {
            const enabled = toggleWeather();
            showToast(enabled ? '🌧️' : '☀️', 'Weather', enabled ? 'Rain starting...' : 'Clearing up...', 'info');
        }

        if (e.key === 'b' || e.key === 'B') {
            cycleAmbientMood();
        }

        if (FEATURE_MINIGAMES && (e.key === 'g' || e.key === 'G')) {
            if (!canPlayerAct()) return;
            if (getActiveGame()) {
                const result = endMiniGame(scene);
                showToast('🎮', 'Game Over', `Score: ${result.score}`, 'achievement');
            } else {
                const games = getPlayableGames();
                const game = games[Math.floor(Math.random() * games.length)];
                startMiniGame(game, scene);
                showToast('🎮', 'Mini-Game', 'Treasure hunt — follow the clues!', 'info');
            }
        }

        if (isPhotoModeActive()) {
            if (e.key === 'f' || e.key === 'F') cycleFilter(renderer);
            if (e.key === ' ') {
                takeScreenshot(renderer, scene, camera);
                session.photosTaken++;
                showToast('📸', 'Photo Saved!', 'Screenshot downloaded', 'info');
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPhotoModeActive()) photoModeMouseMove(e.movementX, e.movementY);
    });

    document.addEventListener('wheel', (e) => {
        if (isPhotoModeActive()) photoModeScroll(e.deltaY);
    });

    renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!canPlayerAct()) return;

        const mouseNDC = {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1,
        };
        if (handleClick(camera, mouseNDC, scene)) {
            showToast('🌸', 'Bloom!', 'A flower opens for you', 'info');
        }
    });

}

function cycleAmbientMood() {
    moodIndex = (moodIndex + 1) % MOODS.length;
    const mood = MOODS[moodIndex];
    setAmbientMood(mood);
    const labels = { calm: 'Calm', nature: 'Nature', meditative: 'Meditative', dreamy: 'Dreamy' };
    showToast('🎵', 'Ambient Mood', labels[mood] || mood, 'info');
}

export function setupJournalTabListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('journal-tab')) {
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.journal-tab').forEach((t) => t.classList.remove('active'));
            e.target.classList.add('active');
            const disc = document.getElementById('journal-discoveries');
            const ach = document.getElementById('journal-achievements');
            if (disc) disc.style.display = tab === 'discoveries' ? 'block' : 'none';
            if (ach) ach.style.display = tab === 'achievements' ? 'block' : 'none';
        }
        if (e.target.id === 'journal-close') {
            toggleJournal([], [], []);
        }
    });
}
