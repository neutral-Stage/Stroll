/**
 * game-loop.js — Main game loop for STROLL open-world action game
 * Orchestrates all game systems per frame.
 * @module game-loop
 */

import { updateDayNight, getNightAmount } from './lighting.js';
import { updateNPCs } from './npcs.js';
import { updateParticles } from './particles.js';
import { updateTraffic } from './traffic.js';
import { updateWildlife } from './wildlife.js';
import { updateWeather } from './weather.js';
import { updateLevelSystem, onEnemyKilled } from './systems/level-system.js';
import { updateHUD, showDeathScreen, hideDeathScreen, showToast, addKillFeed, updateMissionHUD } from './hud.js';
import { GAME_STATES, CONTROLS_HINT_FADE_DELAY, PLAYER_QUIPS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME } from './config.js';
import { getState, isState, setState, updateStateMachine } from './core/state-machine.js';
import { updatePlayerStats, getPlayerStats, isPlayerDead, damagePlayer, addCash, addXP, addKill, respawnPlayer, getDamageDirection } from './player/player.js';
import { updatePlayerModel } from './player/player-model.js';
import { getCurrentWeapon, getCurrentWeaponType, getAmmo, cycleWeapon, setCurrentWeapon } from './player/inventory.js';
import { updateCamera, addCameraShake, getCameraMode } from './camera/camera-controller.js';
import { updatePowersSystem, getCurrentPowerInfo } from './weapons/powers-system.js';
import { updateEnemies, damageEnemyAtPoint, alertEnemiesNear, spawnEnemy, getActiveEnemyCount, spawnWantedEnemies } from './enemies/enemy-manager.js';
import { updateExplosions, createExplosion, createFirePatch } from './destruction/explosions.js';
import { updateWanted, getWantedLevel, commitCrime, CRIMES } from './systems/wanted.js';
import { updateMissions, reportKill, getMissionMarker, getMissionState } from './missions/mission-manager.js';
import { updateVehicles, isPlayerDriving, getPlayerVehicle } from './vehicles/vehicle-system.js';
import { updateHelicopters, isPlayerInHeli, spawnPoliceChopper } from './vehicles/helicopter-system.js';
import { updateRadio } from './audio/radio.js';
import { initEconomy, updateEconomy } from './shops/economy-system.js';
import { updateStory } from './missions/story.js';
import { updateInteriors } from './interiors/interior-system.js';
import { buildings, updateCity, getPlayerSpawn } from './city.js';
import { updatePlayer, syncPlayerLookFromCamera } from './controls.js';
import { updatePickups } from './weapons/pickups.js';
import { getIsSuperpowersMode } from './player/inventory.js';
import { updateWeaponSystem, getIsReloading } from './weapons/weapon-system.js';
import { updateFeel } from './core/feel.js';

// ── State ────────────────────────────────────────────────────
let controlsHintTimer = 0;
let thoughtTimer = 0;
let respawnTimer = 0;
const RESPAWN_TIME = 5;

// ── Movement flags (set by controls.js) ──────────────────────
let sprintFlag = false;
let aimFlag = false;
let playerYaw = 0;
let playerPitch = 0;
let headBobOffset = 0;

/**
 * Set movement flags from controls module.
 */
export function setMovementFlags(flags) {
    sprintFlag = flags.sprinting || false;
    aimFlag = flags.aiming || false;
    playerYaw = flags.yaw || 0;
    playerPitch = flags.pitch || 0;
    headBobOffset = flags.headBob || 0;
}

/**
 * Main tick function — called every frame.
 * @param {Object} ctx
 * @returns {{ lastPlayerPos: {x: number, z: number} }}
 */
export function tick(ctx) {
    const { scene, camera, renderer, composer, delta, elapsed, lastPlayerPos, player } = ctx;
    const dt = Math.min(delta, 0.05); // Cap delta at 50ms (20fps floor)

    updateWeather(0, 0, lastPlayerPos, scene);

    // Update state machine fade
    const transition = updateStateMachine(dt);

    // Draw fade overlay if transitioning
    if (transition.transitioning) {
        const fadeEl = document.getElementById('fade-overlay');
        if (fadeEl) {
            fadeEl.style.opacity = transition.fadeAlpha;
            fadeEl.style.display = transition.fadeAlpha > 0.01 ? 'block' : 'none';
        }
    }

    const currentState = getState();

    // ── MENU state ───────────────────────────────────────────
    if (currentState === GAME_STATES.MENU) {
        if (composer) composer.render(dt);
        else renderer.render(scene, camera);
        return { lastPlayerPos };
    }

    // ── PAUSED state ─────────────────────────────────────────
    if (currentState === GAME_STATES.PAUSED) {
        if (composer) composer.render(dt);
        else renderer.render(scene, camera);
        return { lastPlayerPos };
    }

    // ── DEAD state ───────────────────────────────────────────
    if (currentState === GAME_STATES.DEAD) {
        respawnTimer -= dt;
        showDeathScreen(respawnTimer);

        if (respawnTimer <= 0) {
            respawnPlayer();
            if (player) {
                const sp = getPlayerSpawn();
                player.x = sp.x;
                player.y = 0;
                player.z = sp.z;
                player.vy = 0;
                player.velX = 0;
                player.velZ = 0;
                player.yaw = sp.yaw;
                player.viewYaw = sp.yaw;
                player.pitch = 0;
            }
            hideDeathScreen();
            setState(GAME_STATES.PLAYING);
        }

        // Still render scene (greyscale effect could be applied)
        updateDayNight(dt, scene, lastPlayerPos);
        if (composer) composer.render(dt);
        else renderer.render(scene, camera);
        return { lastPlayerPos };
    }

    // ── PLAYING state ────────────────────────────────────────
    const playerPos = { x: player?.x || 0, z: player?.z || 0 };

    // Player stats (health regen, stamina)
    updatePlayerStats(dt, sprintFlag);

    // Check death
    if (isPlayerDead()) {
        respawnTimer = RESPAWN_TIME;
        setState(GAME_STATES.DEAD);
        showDeathScreen(respawnTimer);
        return { lastPlayerPos: playerPos };
    }

    if (!isPlayerDriving() && !isPlayerInHeli()) {
        updatePlayer(dt, camera);

        // Camera
        updateCamera(dt, player.x, player.y, player.z, playerYaw, playerPitch, sprintFlag, aimFlag, headBobOffset);
        
        // Player Model
        const isMoving = (player.speed || 0) > 0.4;
        updatePlayerModel(player, isMoving, getCameraMode());
    }
    // Day/Night
    updateDayNight(dt, scene, playerPos);
    const nightAmount = getNightAmount();

    // Controls hint
    controlsHintTimer += dt;
    if (controlsHintTimer > CONTROLS_HINT_FADE_DELAY / 1000) {
        const hint = document.getElementById('controls-hint');
        if (hint && hint.style.opacity !== '0') hint.style.opacity = '0';
    }

    // ── Combat Systems ───────────────────────────────────────

    // Combat updates (Superpowers or Weapon system)
    if (getIsSuperpowersMode()) {
        updatePowersSystem(dt, elapsed, playerPos, aimFlag);
    } else {
        updateWeaponSystem(dt, elapsed, playerPos, aimFlag, renderer);
    }

    // City collapses update
    updateCity(dt);

    // Street pickups update
    updatePickups(dt, elapsed, playerPos);

    // Level System (Wave Spawning)
    updateLevelSystem(dt);

    // Enemy system
    const enemyResult = updateEnemies(dt, elapsed, player.x, player.z);

    // Process enemy attacks
    for (const attack of enemyResult.attacks) {
        const result = damagePlayer(attack.damage, attack.fromX, attack.fromZ, player.x, player.z, playerYaw);
        addCameraShake(0.02, 0.15);

        if (result.killed) {
            respawnTimer = RESPAWN_TIME;
        }
    }

    // Explosions & debris
    updateExplosions(dt, elapsed, player.x, player.z);

    // Wanted system
    const wantedResult = updateWanted(dt, player.x, player.z);
    if (wantedResult.spawnRequest) {
        const req = wantedResult.spawnRequest;
        spawnWantedEnemies(getWantedLevel(), req.nearX, req.nearZ, req.count, req.type);
        if (req.spawnChopper) {
            spawnPoliceChopper(req.nearX, req.nearZ);
        }
    }

    // Missions
    updateMissions(dt, player.x, player.z);

    // ── World Systems ────────────────────────────────────────
    updateVehicles(dt, elapsed);
    updateHelicopters(dt, elapsed);
    updateStory(dt, elapsed, playerPos);

    // Interiors
    updateInteriors(dt, elapsed, playerPos);

    // Audio
    updateRadio();
    updateTraffic(dt, playerPos);
    updateParticles(dt, elapsed, playerPos);
    updateWildlife(dt, elapsed, playerPos);
    updateWeather(dt, elapsed, lastPlayerPos, scene);
    updateEconomy(dt, elapsed, playerPos);

    // ── HUD ──────────────────────────────────────────────────
    const stats = getPlayerStats();
    let weaponInfo;
    if (getIsSuperpowersMode()) {
        const pInfo = getCurrentPowerInfo();
        weaponInfo = {
            name: pInfo.name || 'Power',
            ammoClip: pInfo.cd > 0 ? (Math.ceil(pInfo.cd * 10) / 10) + 's' : 'READY',
            ammoReserve: pInfo.cd > 0 ? 'CD' : '∞',
            maxClip: 1,
            color: pInfo.color
        };
    } else {
        const wep = getCurrentWeapon();
        const ammo = getAmmo();
        weaponInfo = {
            name: wep.name,
            ammoClip: getIsReloading() ? 'RELOAD' : (wep.clipSize === Infinity ? '∞' : ammo.clip),
            ammoReserve: wep.clipSize === Infinity ? '' : '/' + ammo.reserve,
            maxClip: wep.clipSize,
            color: '#FFCC00'
        };
    }

    const damageDir = getDamageDirection();
    const enemyData = [];
    // Simplified enemy position data for minimap

    updateHUD(
        stats,
        weaponInfo,
        getWantedLevel(),
        camera,
        playerPos,
        enemyData,
        buildings,
        damageDir,
        getMissionMarker()
    );

    const missionState = getMissionState();
    if (missionState) {
        updateMissionHUD(missionState.isActive, missionState.title, missionState.text, missionState.timer);
    } else {
        updateMissionHUD(false);
    }

    // ── Game-feel overlay (damage numbers, hit markers, flash) ──
    updateFeel(dt);

    // ── Render ───────────────────────────────────────────────
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);

    return { lastPlayerPos: playerPos };
}
