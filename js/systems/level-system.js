/**
 * level-system.js - Wave-based level system
 */
import { ENEMY_TYPES, MAX_ENEMIES } from '../config.js';
import { spawnEnemy, getActiveEnemyCount } from '../enemies/enemy-manager.js';
import { isInsideAnyBuilding } from '../core/physics.js';
import { player } from '../controls.js';
import { showWaveUI, updateWaveUI, animateWaveComplete } from '../hud.js';

let level = 1;
let enemiesRemaining = 0;
let enemiesSpawnedThisWave = 0;
let enemiesToSpawnThisWave = 0;
let spawnTimer = 0;
let waveTransitioning = false;
let waveTransitionTimer = 0;

export function initLevelSystem() {
    startWave(1);
}

function startWave(newLevel) {
    level = newLevel;
    enemiesToSpawnThisWave = level * 10;
    enemiesSpawnedThisWave = 0;
    enemiesRemaining = enemiesToSpawnThisWave;
    waveTransitioning = false;
    
    // Show UI
    showWaveUI(level);
    updateWaveUI(enemiesRemaining);
}

export function updateLevelSystem(delta) {
    if (waveTransitioning) {
        waveTransitionTimer -= delta;
        if (waveTransitionTimer <= 0) {
            startWave(level + 1);
        }
        return;
    }

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
        spawnTimer = 0.5 + Math.random() * 1.5; // Randomize spawn a bit
        
        // Spawn up to a batch if we have room
        const activeCount = getActiveEnemyCount();
        const spawnAmount = Math.min(
            5, // max per tick
            MAX_ENEMIES - activeCount,
            enemiesToSpawnThisWave - enemiesSpawnedThisWave
        );

        for (let i = 0; i < spawnAmount; i++) {
            spawnWaveEnemy();
        }
    }
}

function spawnWaveEnemy() {
    const dist = 60 + Math.random() * 40; // Outside immediate view
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * dist;
    const z = player.z + Math.sin(angle) * dist;

    if (!isInsideAnyBuilding(x, z, 2)) {
        // Choose type based on level
        let type = ENEMY_TYPES.THUG;
        const r = Math.random();
        
        if (level > 1) {
            if (r < 0.2 + (level * 0.05)) type = ENEMY_TYPES.GANG_MEMBER;
        }
        if (level > 3) {
            if (r < 0.1 + (level * 0.02)) type = ENEMY_TYPES.ENFORCER;
        }
        if (level > 5 && r < 0.05) {
            type = ENEMY_TYPES.SWAT;
        }
        
        const id = spawnEnemy(type, x, z);
        if (id) {
            enemiesSpawnedThisWave++;
        }
    }
}

/**
 * Call this when an enemy dies.
 */
export function onEnemyKilled() {
    if (waveTransitioning) return;
    
    enemiesRemaining--;
    if (enemiesRemaining < 0) enemiesRemaining = 0;
    
    updateWaveUI(enemiesRemaining);
    
    if (enemiesRemaining === 0) {
        waveTransitioning = true;
        waveTransitionTimer = 4.0;
        animateWaveComplete();
    }
}

export function getCurrentLevel() { return level; }
export function getEnemiesRemaining() { return enemiesRemaining; }
