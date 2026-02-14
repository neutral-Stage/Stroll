/**
 * gamestate.js — Central game state, scoring, achievements, and journal
 *
 * Manages score, discoveries, achievements, and the discovery journal.
 * Provides event-driven notifications for UI updates.
 *
 * @module gamestate
 */

/** Game state */
const state = {
    score: 0,
    discoveries: [],
    achievements: [],
    unlockedAchievements: [],
    distanceWalked: 0,
    timePlayedSeconds: 0,
    photosTaken: 0,
    meditationTime: 0,
    flowersInteracted: 0,
    nightsWitnessed: 0,
    waypointsReached: 0,
    isPaused: false,
    isPhotoMode: false,
    isMeditating: false,
    introComplete: false,
    cycleTime: 0, // 0..1 day/night cycle
    volume: 0.7,
    quality: 'high' // 'low', 'medium', 'high'
};

/** Achievement definitions */
const ACHIEVEMENTS = [
    { id: 'first_collect', name: 'First Discovery', desc: 'Collect your first item', icon: '✨', check: () => state.discoveries.length >= 1 },
    { id: 'collector_5', name: 'Curious Explorer', desc: 'Collect 5 items', icon: '🔮', check: () => state.discoveries.length >= 5 },
    { id: 'collector_15', name: 'Avid Collector', desc: 'Collect 15 items', icon: '💎', check: () => state.discoveries.length >= 15 },
    { id: 'collector_30', name: 'Master Gatherer', desc: 'Collect 30 items', icon: '👑', check: () => state.discoveries.length >= 30 },
    { id: 'all_orbs', name: 'Light Keeper', desc: 'Collect all orbs', icon: '💡', check: () => state.discoveries.filter(d => d.type === 'orb').length >= 20 },
    { id: 'all_crystals', name: 'Crystal Sage', desc: 'Collect all crystals', icon: '🔮', check: () => state.discoveries.filter(d => d.type === 'crystal').length >= 12 },
    { id: 'all_flowers', name: 'Garden Keeper', desc: 'Collect all flowers', icon: '🌸', check: () => state.discoveries.filter(d => d.type === 'flower').length >= 15 },
    { id: 'walker_500', name: 'Wanderer', desc: 'Walk 500 meters', icon: '🚶', check: () => state.distanceWalked >= 500 },
    { id: 'walker_2000', name: 'Pathfinder', desc: 'Walk 2000 meters', icon: '🗺️', check: () => state.distanceWalked >= 2000 },
    { id: 'photographer', name: 'Photographer', desc: 'Take your first photo', icon: '📸', check: () => state.photosTaken >= 1 },
    { id: 'photo_5', name: 'Shutterbug', desc: 'Take 5 photos', icon: '🎞️', check: () => state.photosTaken >= 5 },
    { id: 'meditator', name: 'Inner Peace', desc: 'Meditate for 30 seconds', icon: '🧘', check: () => state.meditationTime >= 30 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Witness the night', icon: '🦉', check: () => state.nightsWitnessed >= 1 },
    { id: 'flower_friend', name: 'Flower Whisperer', desc: 'Interact with 5 flowers', icon: '🌺', check: () => state.flowersInteracted >= 5 },
    { id: 'completionist', name: 'Completionist', desc: 'Collect every item', icon: '🏆', check: () => state.discoveries.length >= 47 },
    { id: 'zen_master', name: 'Zen Master', desc: 'Meditate for 5 minutes', icon: '☯️', check: () => state.meditationTime >= 300 },
];

state.achievements = ACHIEVEMENTS;

/** Event listeners */
const listeners = {};

/**
 * Subscribe to game events.
 * @param {string} event
 * @param {Function} callback
 */
export function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
}

function emit(event, data) {
    if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
    }
}

/**
 * Record a collected item.
 * @param {Object} item - { type, name }
 */
export function recordCollection(item) {
    const points = item.type === 'orb' ? 10 : item.type === 'crystal' ? 25 : 15;
    state.score += points;
    state.discoveries.push({
        type: item.type,
        name: item.name,
        time: state.timePlayedSeconds,
        points
    });
    
    emit('collection', { item, points, totalScore: state.score });
    emit('scoreChange', state.score);
    checkAchievements();
}

/**
 * Update distance walked.
 * @param {number} distance
 */
export function addDistance(distance) {
    state.distanceWalked += distance;
}

/**
 * Update time played.
 * @param {number} delta
 */
export function addTime(delta) {
    state.timePlayedSeconds += delta;
}

/**
 * Record a photo taken.
 */
export function recordPhoto() {
    state.photosTaken++;
    state.score += 5;
    emit('photo', { count: state.photosTaken });
    emit('scoreChange', state.score);
    checkAchievements();
}

/**
 * Add meditation time.
 * @param {number} delta
 */
export function addMeditationTime(delta) {
    state.meditationTime += delta;
    checkAchievements();
}

/**
 * Record a night witnessed.
 */
export function recordNight() {
    state.nightsWitnessed++;
    checkAchievements();
}

/**
 * Record flower interaction.
 */
export function recordFlowerInteraction() {
    state.flowersInteracted++;
    state.score += 3;
    emit('scoreChange', state.score);
    checkAchievements();
}

/**
 * Check all achievements and unlock new ones.
 */
function checkAchievements() {
    ACHIEVEMENTS.forEach(a => {
        if (!state.unlockedAchievements.includes(a.id) && a.check()) {
            state.unlockedAchievements.push(a.id);
            state.score += 50;
            emit('achievement', a);
            emit('scoreChange', state.score);
        }
    });
}

/**
 * Get current game state (read-only copy).
 */
export function getState() {
    return { ...state };
}

/**
 * Get discoveries list.
 */
export function getDiscoveries() {
    return [...state.discoveries];
}

/**
 * Get unlocked achievements.
 */
export function getUnlockedAchievements() {
    return ACHIEVEMENTS.filter(a => state.unlockedAchievements.includes(a.id));
}

/**
 * Get all achievements with unlock status.
 */
export function getAllAchievements() {
    return ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: state.unlockedAchievements.includes(a.id)
    }));
}

/**
 * Set cycle time for UI.
 * @param {number} t - 0..1
 */
export function setCycleTime(t) {
    state.cycleTime = t;
}

/**
 * Toggle pause state.
 */
export function togglePause() {
    state.isPaused = !state.isPaused;
    emit('pause', state.isPaused);
    return state.isPaused;
}

/**
 * Set photo mode.
 */
export function setPhotoMode(active) {
    state.isPhotoMode = active;
    emit('photoMode', active);
}

/**
 * Set meditation mode.
 */
export function setMeditating(active) {
    state.isMeditating = active;
    emit('meditation', active);
}

/**
 * Set intro complete.
 */
export function setIntroComplete() {
    state.introComplete = true;
    emit('introComplete', true);
}

/**
 * Set volume.
 */
export function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    emit('volumeChange', state.volume);
}

/**
 * Set quality.
 */
export function setQuality(q) {
    state.quality = q;
    emit('qualityChange', q);
}
