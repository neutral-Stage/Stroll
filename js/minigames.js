/**
 * minigames.js — Interactive mini-games and fun challenges
 *
 * Features:
 *  • Memory matching game with city landmarks
 *  • Rhythm timing game with musical notes
 *  • Treasure hunt with clues
 *  • Photography challenge
 *  • Meditation breathing game
 *  • Star constellation finding
 *
 * @module minigames
 */

import * as THREE from 'three';

/** Active mini-game state */
let activeGame = null;
let gameScore = 0;
let gameState = {};

/** Mini-game types */
const GAMES = {
    MEMORY: 'memory',
    RHYTHM: 'rhythm',
    TREASURE: 'treasure',
    PHOTO: 'photo',
    BREATHING: 'breathing',
    CONSTELLATION: 'constellation'
};

/**
 * Start a mini-game.
 * @param {string} gameType - One of GAMES
 * @param {THREE.Scene} scene
 */
export function startMiniGame(gameType, scene) {
    if (activeGame) {
        endMiniGame();
    }

    activeGame = gameType;
    gameScore = 0;
    gameState = {};

    switch (gameType) {
        case GAMES.MEMORY:
            initMemoryGame(scene);
            break;
        case GAMES.RHYTHM:
            initRhythmGame(scene);
            break;
        case GAMES.TREASURE:
            initTreasureHunt(scene);
            break;
        case GAMES.PHOTO:
            initPhotoChallenge(scene);
            break;
        case GAMES.BREATHING:
            initBreathingGame();
            break;
        case GAMES.CONSTELLATION:
            initConstellationGame(scene);
            break;
    }

    showGameUI(gameType);
}

/**
 * End current mini-game.
 */
export function endMiniGame() {
    if (!activeGame) return;

    hideGameUI();
    cleanupGameObjects();
    
    const finalScore = gameScore;
    const gameType = activeGame;
    
    activeGame = null;
    gameScore = 0;
    gameState = {};

    return { type: gameType, score: finalScore };
}

/**
 * Update active mini-game.
 * @param {number} delta
 * @param {number} elapsed
 * @param {{x: number, z: number}} playerPos
 */
export function updateMiniGame(delta, elapsed, playerPos) {
    if (!activeGame) return;

    switch (activeGame) {
        case GAMES.MEMORY:
            updateMemoryGame(delta, elapsed);
            break;
        case GAMES.RHYTHM:
            updateRhythmGame(delta, elapsed);
            break;
        case GAMES.TREASURE:
            updateTreasureHunt(delta, playerPos);
            break;
        case GAMES.PHOTO:
            updatePhotoChallenge(delta);
            break;
        case GAMES.BREATHING:
            updateBreathingGame(delta, elapsed);
            break;
        case GAMES.CONSTELLATION:
            updateConstellationGame(delta, playerPos);
            break;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMORY GAME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initMemoryGame(scene) {
    gameState.pairs = 6;
    gameState.cards = [];
    gameState.flipped = [];
    gameState.matched = [];
    gameState.canFlip = true;

    // Create card pairs
    const symbols = ['🌸', '🦋', '🌟', '🌙', '🌊', '🍃'];
    const cardSymbols = [...symbols, ...symbols].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 12; i++) {
        const card = createMemoryCard(scene, i, cardSymbols[i]);
        gameState.cards.push(card);
    }
}

function createMemoryCard(scene, index, symbol) {
    const group = new THREE.Group();
    
    const cardGeo = new THREE.BoxGeometry(2, 0.1, 3);
    const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
    
    const card = new THREE.Mesh(cardGeo, backMat);
    group.add(card);

    const x = (index % 4) * 3 - 4.5;
    const z = Math.floor(index / 4) * 4 - 4;
    group.position.set(x, 1, z);

    scene.add(group);

    return { mesh: group, symbol, flipped: false, matched: false, index };
}

function updateMemoryGame(delta, elapsed) {
    // Animate cards
    for (const card of gameState.cards) {
        card.mesh.rotation.y = card.flipped || card.matched ? Math.PI : 0;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RHYTHM GAME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initRhythmGame(scene) {
    gameState.notes = [];
    gameState.tempo = 1.0;
    gameState.score = 0;
    gameState.combo = 0;
    gameState.lastNoteTime = 0;
}

function updateRhythmGame(delta, elapsed) {
    // Spawn notes
    if (elapsed - gameState.lastNoteTime > 2 / gameState.tempo) {
        spawnRhythmNote();
        gameState.lastNoteTime = elapsed;
    }

    // Move notes
    for (let i = gameState.notes.length - 1; i >= 0; i--) {
        const note = gameState.notes[i];
        note.mesh.position.z += delta * 5;

        if (note.mesh.position.z > 10) {
            // Missed note
            gameState.combo = 0;
            note.mesh.parent.remove(note.mesh);
            gameState.notes.splice(i, 1);
        }
    }
}

function spawnRhythmNote() {
    // Implementation for rhythm note spawning
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TREASURE HUNT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initTreasureHunt(scene) {
    gameState.clues = [
        { text: "Where the sun sets golden...", position: { x: -70, z: -70 } },
        { text: "By the fountain's gentle spray...", position: { x: 0, z: 0 } },
        { text: "Where tall trees whisper secrets...", position: { x: 60, z: 60 } }
    ];
    gameState.currentClue = 0;
    gameState.treasures = [];

    // Place treasure markers
    for (const clue of gameState.clues) {
        const marker = createTreasureMarker(scene, clue.position);
        gameState.treasures.push(marker);
    }
}

function createTreasureMarker(scene, position) {
    const geo = new THREE.SphereGeometry(0.5, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        emissive: 0xFF8C00,
        emissiveIntensity: 0.5
    });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.set(position.x, 1, position.z);
    scene.add(marker);
    return marker;
}

function updateTreasureHunt(delta, playerPos) {
    if (gameState.currentClue >= gameState.clues.length) return;

    const currentTreasure = gameState.treasures[gameState.currentClue];
    if (!currentTreasure) return;

    // Animate treasure
    currentTreasure.rotation.y += delta * 2;
    currentTreasure.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.3;

    // Check if player is near
    const dx = playerPos.x - currentTreasure.position.x;
    const dz = playerPos.z - currentTreasure.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 3) {
        // Found treasure!
        gameScore += 100;
        gameState.currentClue++;
        currentTreasure.visible = false;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHOTO CHALLENGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initPhotoChallenge(scene) {
    gameState.targets = [
        'Capture the fountain at sunset',
        'Find and photograph a butterfly',
        'Take a photo with all buildings visible',
        'Capture the moon at night',
        'Photograph flowers blooming'
    ];
    gameState.captured = [];
    gameState.currentTarget = 0;
}

function updatePhotoChallenge(delta) {
    // Check photo captures (would integrate with photomode.js)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BREATHING GAME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initBreathingGame() {
    gameState.phase = 'inhale'; // inhale, hold, exhale, rest
    gameState.timer = 0;
    gameState.cycles = 0;
    gameState.targetCycles = 10;
    gameState.accuracy = [];
    gameState.completed = false;
}

function updateBreathingGame(delta, elapsed) {
    gameState.timer += delta;

    const phaseDurations = {
        inhale: 4,
        hold: 2,
        exhale: 6,
        rest: 2
    };

    if (gameState.timer >= phaseDurations[gameState.phase]) {
        gameState.timer = 0;
        
        switch (gameState.phase) {
            case 'inhale':
                gameState.phase = 'hold';
                break;
            case 'hold':
                gameState.phase = 'exhale';
                break;
            case 'exhale':
                gameState.phase = 'rest';
                break;
            case 'rest':
                gameState.phase = 'inhale';
                gameState.cycles++;
                gameScore += 10;
                break;
        }
    }

    if (gameState.cycles >= gameState.targetCycles && !gameState.completed) {
        gameScore += 100;
        gameState.completed = true;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTELLATION GAME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initConstellationGame(scene) {
    gameState.constellations = [
        { name: 'Big Dipper', stars: [] },
        { name: 'Orion', stars: [] },
        { name: 'Cassiopeia', stars: [] }
    ];
    gameState.currentConstellation = 0;
    gameState.foundStars = 0;
}

function updateConstellationGame(delta, playerPos) {
    // Check if player is looking at stars (would integrate with camera direction)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function showGameUI(gameType) {
    let ui = document.getElementById('minigame-ui');
    if (!ui) {
        ui = document.createElement('div');
        ui.id = 'minigame-ui';
        ui.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 20, 40, 0.9);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            color: white;
            font-family: Georgia, serif;
            z-index: 50;
            min-width: 300px;
            text-align: center;
        `;
        document.body.appendChild(ui);
    }

    const titles = {
        [GAMES.MEMORY]: '🧠 Memory Match',
        [GAMES.RHYTHM]: '🎵 Rhythm Flow',
        [GAMES.TREASURE]: '🗺️ Treasure Hunt',
        [GAMES.PHOTO]: '📸 Photo Challenge',
        [GAMES.BREATHING]: '🧘 Breathing Exercise',
        [GAMES.CONSTELLATION]: '⭐ Star Gazing'
    };

    ui.innerHTML = `
        <div style="font-size: 20px; margin-bottom: 10px;">${titles[gameType]}</div>
        <div id="game-instructions" style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;"></div>
        <div id="game-score" style="font-size: 18px; font-weight: bold;">Score: 0</div>
        <div id="game-progress" style="margin-top: 10px; font-size: 12px; opacity: 0.6;"></div>
    `;
}

function hideGameUI() {
    const ui = document.getElementById('minigame-ui');
    if (ui) {
        ui.remove();
    }
}

function cleanupGameObjects() {
    // Remove game-specific objects from scene
    if (gameState.cards) {
        for (const card of gameState.cards) {
            if (card.mesh && card.mesh.parent) {
                card.mesh.parent.remove(card.mesh);
            }
        }
    }
    if (gameState.treasures) {
        for (const treasure of gameState.treasures) {
            if (treasure && treasure.parent) {
                treasure.parent.remove(treasure);
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getActiveGame() {
    return activeGame;
}

export function getGameScore() {
    return gameScore;
}

export { GAMES };
