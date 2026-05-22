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
import { updateHUD, showDeathScreen, hideDeathScreen, showToast, addKillFeed } from './hud.js';
import { GAME_STATES, CONTROLS_HINT_FADE_DELAY, PLAYER_QUIPS, THOUGHT_MIN_DELAY, THOUGHT_EXTRA_DELAY, THOUGHT_DISPLAY_TIME } from './config.js';
import { getState, isState, updateStateMachine } from './core/state-machine.js';
import { updatePlayerStats, getPlayerStats, isPlayerDead, damagePlayer, addCash, addXP, addKill, respawnPlayer, getDamageDirection } from './player/player.js';
import { getCurrentWeapon, getCurrentWeaponType, getAmmo, cycleWeapon, setCurrentWeapon } from './player/inventory.js';
import { updateCamera, addCameraShake, getCameraMode } from './camera/camera-controller.js';
import { updateWeaponSystem, getBullets, clearBullets, switchWeapon, startFiring, stopFiring } from './weapons/weapon-system.js';
import { updateEnemies, damageEnemyAtPoint, alertEnemiesNear, spawnEnemy, getActiveEnemyCount, spawnWantedEnemies } from './enemies/enemy-manager.js';
import { updateExplosions, createExplosion, createFirePatch } from './destruction/explosions.js';
import { updateWanted, getWantedLevel, commitCrime, CRIMES } from './systems/wanted.js';
import { updateMissions, reportKill, getMissionMarker } from './missions/mission-manager.js';
import { updateVehicles, isPlayerDriving, getPlayerVehicle } from './vehicles/vehicle-system.js';
import { updateHelicopters, isPlayerInHeli, spawnPoliceChopper } from './vehicles/helicopter-system.js';
import { updateRadio } from './audio/radio.js';
import { initEconomy, updateEconomy } from './shops/economy-system.js';
import { updateStory } from './missions/story.js';
import { updateInteriors } from './interiors/interior-system.js';
import { buildings } from './city.js';

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
    const { scene, camera, renderer, composer, delta, elapsed, lastPlayerPos } = ctx;
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
            hideDeathScreen();
            // State will transition back to PLAYING
        }

        // Still render scene (greyscale effect could be applied)
        updateDayNight(elapsed);
        if (composer) composer.render(dt);
        else renderer.render(scene, camera);
        return { lastPlayerPos };
    }

    // ── PLAYING state ────────────────────────────────────────
    const player = ctx.player || { x: 0, y: 0, z: 0 };
    const playerPos = { x: player.x, z: player.z };

    // Player stats (health regen, stamina)
    updatePlayerStats(dt, sprintFlag);

    // Check death
    if (isPlayerDead()) {
        respawnTimer = RESPAWN_TIME;
        showDeathScreen(respawnTimer);
        return { lastPlayerPos: playerPos };
    }

    if (!isPlayerDriving() && !isPlayerInHeli()) {
        updatePlayer(dt, camera);

        // Update player direction based on camera look
        syncPlayerLookFromCamera(camera);

        // Camera
        updateCamera(dt, player.x, player.y, player.z, playerYaw, playerPitch, sprintFlag, aimFlag, headBobOffset);
    }
    // Day/Night
    updateDayNight(elapsed);
    const nightAmount = getNightAmount();

    // Controls hint
    controlsHintTimer += dt;
    if (controlsHintTimer > CONTROLS_HINT_FADE_DELAY / 1000) {
        const hint = document.getElementById('controls-hint');
        if (hint && hint.style.opacity !== '0') hint.style.opacity = '0';
    }

    // ── Combat Systems ───────────────────────────────────────

    // Weapon system
    updateWeaponSystem(dt, elapsed, playerPos, aimFlag, renderer);

    // Check bullet hits against enemies
    const bulletList = getBullets();
    for (let i = bulletList.length - 1; i >= 0; i--) {
        const b = bulletList[i];
        const killed = damageEnemyAtPoint(
            b.mesh.position.x, b.mesh.position.y, b.mesh.position.z,
            b.isRocket ? 0.5 : 0.8, // hit detection radius
            b.damage
        );

        if (killed > 0) {
            // Remove bullet on hit (do not dispose shared geometries)
            if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
            bulletList.splice(i, 1);

            reportKill(); // Notify mission system
            const stats = getPlayerStats();
            const enemyCfg = { xpReward: 25 }; // Simplified
            const result = addXP(enemyCfg.xpReward);
            if (result.leveledUp) {
                showToast('LEVEL UP!', `Level ${result.newLevel}`, 'level');
            }
            addKillFeed(`Enemy eliminated +${enemyCfg.xpReward}XP`);
            commitCrime('SHOOT_WEAPON', player.x, player.z);
        }

        // Explosive bullets
        if (b.hitExplosion || (b.explosive && b.lifetime <= 0)) {
            createExplosion(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z,
                b.explosionRadius || 5, b.damage || 100);
            addCameraShake(0.08, 0.3);
            commitCrime('EXPLOSION', player.x, player.z);
        }
    }

    // Alert enemies near gunfire
    if (bulletList.length > 0) {
        alertEnemiesNear(player.x, player.z, 50);
    }

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
    updateRadio(dt, player.x, player.y, player.z);
    updateTraffic(dt, elapsed, playerPos);
    updateParticles(dt, elapsed, playerPos);
    updateWildlife(dt, elapsed, playerPos);
    updateWeather(dt, elapsed, lastPlayerPos, scene);
    updateEconomy(dt, elapsed, playerPos);

    // ── HUD ──────────────────────────────────────────────────
    const stats = getPlayerStats();
    const weapon = getCurrentWeapon();
    const ammo = getAmmo();
    const weaponInfo = {
        name: weapon.name || 'Fists',
        ammoClip: ammo.clip,
        ammoReserve: ammo.reserve,
        maxClip: ammo.maxClip,
    };

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

    // ── Render ───────────────────────────────────────────────
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);

    return { lastPlayerPos: playerPos };
}
