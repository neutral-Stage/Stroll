// @ts-check
/**
 * game-loop.js — Per-frame update branches
 * @module game-loop
 */

import { updatePlayer, player } from './controls.js';
import { updateNPCs } from './npcs.js';
import { updateDayNight, getCycleTime, getNightAmount } from './lighting.js';
import { updateParticles } from './particles.js';
import { updateDog } from './dog.js';
import { updateTraffic } from './traffic.js';
import { updateWeather } from './weather.js';
import { updateMiniGame, getActiveGame } from './minigames.js';
import { updateCollectibles, addScore, getCollectedCount, getTotalCollectibles } from './collectibles.js';
import { updateEnhancedCollectibles, getTotalEnhancedCollectibles, getCollectedEnhancedCount, playEnhancedCollectionSound } from './enhanced-collectibles.js';
import { updateWildlife } from './wildlife.js';
import { updateChallenges, getWaypointsFound, getTotalWaypoints } from './challenges.js';
import { updateInteractive, getFlowersInteracted } from './interactive.js';
import { updateHUD, getIsPaused, isJournalOpen } from './hud.js';
import { updatePhotoMode, isPhotoModeActive } from './photomode.js';
import { updateMeditation, isMeditationActive } from './meditation.js';
import { updateCinematic, isCinematicPlaying } from './cinematic.js';
import { updateAudioTimeOfDay, getAudioContext, getMasterGain } from './audio.js';
import { updateWeapon } from './weapon.js';
import { session, buildChallengeStats } from './game-state.js';
import { showToast } from './hud.js';
import { FEATURE_WEAPON } from './config.js';
import { emit, Events } from './events.js';

/**
 * @param {object} ctx
 * @param {THREE.Scene} ctx.scene
 * @param {THREE.PerspectiveCamera} ctx.camera
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {import('three/addons/postprocessing/EffectComposer.js').EffectComposer} ctx.composer
 * @param {number} ctx.delta
 * @param {number} ctx.elapsed
 * @param {{ x: number, z: number }} ctx.lastPlayerPos
 * @returns {{ lastPlayerPos: { x: number, z: number } }}
 */
export function tick(ctx) {
    const { scene, camera, renderer, composer, delta, elapsed } = ctx;
    let lastPlayerPos = ctx.lastPlayerPos;

    if (isCinematicPlaying()) {
        updateCinematic(delta, camera);
        updateDayNight(delta, scene);
        composer.render();
        return { lastPlayerPos };
    }

    if (getIsPaused() || isJournalOpen()) {
        composer.render();
        return { lastPlayerPos };
    }

    if (isPhotoModeActive()) {
        updatePhotoMode(camera);
        updateDayNight(delta, scene);
        updateParticles(delta, elapsed, player);
        composer.render();
        return { lastPlayerPos };
    }

    if (isMeditationActive()) {
        updateMeditation(delta, camera);
        updateDayNight(delta, scene);
        updateParticles(delta, elapsed, player);
        updateWildlife(delta, elapsed, player);
        composer.render();
        return { lastPlayerPos };
    }

    updatePlayer(delta, camera);

    const dx = player.x - lastPlayerPos.x;
    const dz = player.z - lastPlayerPos.z;
    session.distanceWalked += Math.sqrt(dx * dx + dz * dz);
    lastPlayerPos = { x: player.x, z: player.z };

    updateNPCs(delta, player);
    updateDayNight(delta, scene);
    updateParticles(delta, elapsed, player);
    updateDog(delta, elapsed, player);
    updateTraffic(delta, player);
    updateWeather(delta, elapsed, player, scene, getAudioContext(), getMasterGain());

    if (getActiveGame()) {
        updateMiniGame(delta, elapsed, player, scene);
    }

    const nightAmount = getNightAmount();
    const cycleTime = getCycleTime();
    if (nightAmount > 0.7) session.nightSeen = true;
    updateAudioTimeOfDay(nightAmount);

    const collectResult = updateCollectibles(delta, elapsed, player, scene);
    if (collectResult.justCollected) {
        emit(Events.PICKUP, collectResult);
        if (collectResult.justCollected === 'star') session.starsCollected++;
    }

    const enhancedCollect = updateEnhancedCollectibles(delta, elapsed, player);
    if (enhancedCollect.collected) {
        if (enhancedCollect.value) addScore(enhancedCollect.value);
        const audioCtx = getAudioContext();
        const masterGain = getMasterGain();
        if (audioCtx && masterGain) {
            playEnhancedCollectionSound(enhancedCollect.type, audioCtx, masterGain, enhancedCollect.pitch);
        }
        let message = '';
        switch (enhancedCollect.type) {
            case 'rainbow_gem': message = `Rainbow Gem! +${enhancedCollect.value}`; break;
            case 'artifact': message = enhancedCollect.lore || 'Ancient Artifact!'; break;
            case 'music_note': message = 'Musical Note! ♪'; break;
            case 'mystery_box': message = `Mystery Box! +${enhancedCollect.value}`; break;
        }
        showToast('✨', 'Discovery!', message, 'discovery');
    }

    updateWildlife(delta, elapsed, player);

    const totalCollectedNow = getCollectedCount() + getCollectedEnhancedCount();
    const totalPickupsWorld = getTotalCollectibles() + getTotalEnhancedCollectibles();

    updateChallenges(delta, elapsed, player, buildChallengeStats({
        collected: totalCollectedNow,
        totalCollectibles: totalPickupsWorld,
        waypointsFound: getWaypointsFound(),
        flowersInteracted: getFlowersInteracted(),
    }));

    updateInteractive(delta, elapsed, player, nightAmount);

    updateHUD({
        score: collectResult.score,
        collected: totalCollectedNow,
        totalCollectibles: totalPickupsWorld,
        waypointsFound: getWaypointsFound(),
        totalWaypoints: getTotalWaypoints(),
        cycleTime,
        playerYaw: player.yaw,
    });

    composer.render();

    if (FEATURE_WEAPON) {
        updateWeapon(delta, elapsed, player, renderer);
    }

    return { lastPlayerPos };
}
