/**
 * player-input.js — When the player can move, shoot, or interact
 * @module player-input
 */

import { isCinematicPlaying } from './cinematic.js';
import { getIsPaused, isJournalOpen } from './hud.js';
import { isPhotoModeActive } from './photomode.js';
import { isMeditationActive } from './meditation.js';
import { getActiveGame } from './minigames.js';

/**
 * True during normal exploration (walking, collecting, shooting).
 * @returns {boolean}
 */
export function canPlayerAct() {
    if (isCinematicPlaying()) return false;
    if (getIsPaused() || isJournalOpen()) return false;
    if (isPhotoModeActive() || isMeditationActive()) return false;
    return true;
}

/**
 * Movement allowed (mini-games still allow walk in some modes).
 * @returns {boolean}
 */
export function canPlayerMove() {
    return canPlayerAct() && !getActiveGame();
}
