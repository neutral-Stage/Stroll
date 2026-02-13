/**
 * config.js — Central configuration and constants for Stroll
 * All magic numbers and tunable parameters live here.
 * @module config
 */

// ── City Layout ──────────────────────────────────────────────
export const CITY_SIZE = 200;
export const BLOCK_SIZE = 20;
export const STREET_WIDTH = 8;
export const CELL_SIZE = BLOCK_SIZE + STREET_WIDTH;
export const HALF_CITY = CITY_SIZE / 2;
export const PARK_EXCLUSION = 25; // radius around center reserved for park
export const BLOCK_SKIP_CHANCE = 0.15; // probability of skipping a block

// ── Player ───────────────────────────────────────────────────
export const WALK_SPEED = 0.08;
export const LOOK_SPEED = 0.002;
export const TOUCH_LOOK_SPEED = 0.005;
export const PLAYER_HEIGHT = 3.5;
export const COLLISION_PADDING = 1.5;
export const CITY_BOUND_MARGIN = 2;
export const HEAD_BOB_SPEED = 0.005;
export const HEAD_BOB_AMOUNT = 0.04;
export const HEAD_BOB_THRESHOLD = 0.1;

// ── NPCs ─────────────────────────────────────────────────────
export const NPC_COUNT = 25;
export const NPC_MIN_SPEED = 0.015;
export const NPC_SPEED_RANGE = 0.015;
export const NPC_PATH_MIN_POINTS = 4;
export const NPC_PATH_EXTRA_POINTS = 6;
export const NPC_PATH_STEP = 40;
export const NPC_BOB_SPEED = 8;
export const NPC_BOB_AMOUNT = 0.08;
export const NPC_CULL_DISTANCE = 80; // only update NPCs within this radius

// ── Trees, Benches, Lamps ────────────────────────────────────
export const TREE_COUNT = 40;
export const BENCH_COUNT = 15;
export const LAMP_COUNT = 20;
export const MAX_ACTIVE_LIGHTS = 5; // max PointLights for lamp posts

// ── Buildings ────────────────────────────────────────────────
export const MIN_BUILDING_HEIGHT = 4;
export const BUILDING_HEIGHT_RANGE = 20;
export const WINDOW_SIZE = 0.6;
export const WINDOW_ASPECT = 1.3;
export const WINDOW_SPACING_Y = 3;
export const WINDOW_SPACING_X = 2.5;
export const WINDOW_SKIP_CHANCE = 0.2;
export const ROOFTOP_DETAIL_CHANCE = 0.3;

// ── Lighting ─────────────────────────────────────────────────
export const SHADOW_MAP_SIZE = 2048;
export const SHADOW_FRUSTUM = 120;
export const FOG_DENSITY = 0.008;
export const FOG_COLOR = 0xFFE8CC;

// ── Skybox ───────────────────────────────────────────────────
export const SKY_RADIUS = 400;
export const SKY_SEGMENTS = 16; // reduced from 32 — sufficient for gradient

// ── Particles ────────────────────────────────────────────────
export const LEAF_COUNT = 60;
export const FIREFLY_COUNT = 40;

// ── Day/Night Cycle ──────────────────────────────────────────
export const DAY_NIGHT_CYCLE_DURATION = 120; // seconds for a full cycle
export const DAY_NIGHT_ENABLED = true;

// ── Thoughts ─────────────────────────────────────────────────
export const THOUGHT_MIN_DELAY = 15000;
export const THOUGHT_EXTRA_DELAY = 25000;
export const THOUGHT_DISPLAY_TIME = 6000;
export const CONTROLS_HINT_FADE_DELAY = 3000;

// ── Colors ───────────────────────────────────────────────────
export const BUILDING_COLORS = [
    0xF4E4C1, 0xE8D5B7, 0xF0C9A0, 0xDEB887, 0xD4A574,
    0xE6C9A8, 0xF5DEB3, 0xFFE4C4, 0xFAD6A5, 0xF0E68C,
    0xE8D4A2, 0xD2B48C, 0xC4A882, 0xBDB76B, 0xF5F0DC,
    0xFFF8DC, 0xFAEBD7, 0xFFEFD5, 0xFFE4B5, 0xFFDAB9,
    0xE6CCAB, 0xD4A98C, 0xC9967E, 0xBE8C71, 0xCFB095
];

export const NPC_COLORS = [
    0xE57373, 0x64B5F6, 0x81C784, 0xFFB74D, 0xBA68C8,
    0x4DB6AC, 0xFF8A65, 0xA1887F, 0x90A4AE, 0xF06292,
    0xAED581, 0x4DD0E1, 0xFFD54F, 0x7986CB, 0xE0E0E0
];

export const FOLIAGE_COLORS = [0x558B2F, 0x689F38, 0x7CB342, 0x8BC34A, 0x9CCC65];

export const THOUGHTS = [
    "The light is beautiful today...",
    "Sometimes the best path is the one with no destination.",
    "Listen to the city breathe.",
    "Every corner holds a small story.",
    "The golden hour makes everything feel like a memory.",
    "Slow down. There's nowhere to be.",
    "Notice the shadows stretching across the street.",
    "A gentle breeze carries the scent of evening.",
    "The city hums its quiet lullaby.",
    "What a lovely place to simply exist.",
    "The warmth of the sun on your face...",
    "Each step is a small meditation.",
    "Beauty hides in the ordinary.",
    "The world is softer at this hour."
];
