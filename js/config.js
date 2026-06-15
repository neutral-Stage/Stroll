/**
 * config.js — Central configuration for STROLL: Open-World Destruction Sandbox
 * All game constants, weapon stats, enemy configs, and tunable parameters.
 * @module config
 */

// ── City Layout ──────────────────────────────────────────────
export const CITY_SIZE = 400;
export const BLOCK_SIZE = 20;
export const STREET_WIDTH = 10;
export const CELL_SIZE = BLOCK_SIZE + STREET_WIDTH;
export const HALF_CITY = CITY_SIZE / 2;
export const PARK_EXCLUSION = 30;
export const BLOCK_SKIP_CHANCE = 0.12;

// ── Feature Flags ────────────────────────────────────────────
export const FEATURE_WEAPON = true;
export const FEATURE_MINIGAMES = false; // replaced by missions
export const FEATURE_VEHICLES = true;
export const FEATURE_DESTRUCTION = true;
export const FEATURE_WANTED_SYSTEM = true;
export const FEATURE_MISSIONS = true;
export const FEATURE_ENEMIES = true;

// ── Game States ──────────────────────────────────────────────
export const GAME_STATES = {
    MENU: 'MENU',
    LOADING: 'LOADING',
    PLAYING: 'PLAYING',
    CUTSCENE: 'CUTSCENE',
    DEAD: 'DEAD',
    PAUSED: 'PAUSED',
    MISSION_COMPLETE: 'MISSION_COMPLETE',
};

// ── Player ───────────────────────────────────────────────────
export const WALK_SPEED = 0.04;
export const SPRINT_SPEED = 0.08;
export const CROUCH_SPEED = 0.02;
export const LOOK_SPEED = 0.002;
export const TOUCH_LOOK_SPEED = 0.005;
export const PLAYER_HEIGHT = 3.5;
export const CROUCH_HEIGHT = 2.0;
export const COLLISION_PADDING = 0.9;
export const CITY_BOUND_MARGIN = 2;
export const HEAD_BOB_SPEED = 8;
export const HEAD_BOB_AMOUNT = 0.05;
export const HEAD_BOB_THRESHOLD = 0.1;
export const JUMP_FORCE = 0.15;
export const GRAVITY = 0.4;
export const DODGE_SPEED = 0.2;
export const DODGE_DURATION = 0.3;
export const DODGE_COOLDOWN = 0.8;

// Player Stats
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ARMOR = 100;
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_DRAIN_RATE = 15; // per second while sprinting
export const STAMINA_REGEN_RATE = 8; // per second
export const HEALTH_REGEN_RATE = 2; // per second (out of combat)
export const HEALTH_REGEN_DELAY = 5; // seconds after last damage
export const STARTING_CASH = 500;

// ── Camera ───────────────────────────────────────────────────
export const CAMERA_MODES = { FIRST_PERSON: 0, THIRD_PERSON: 1 };
export const THIRD_PERSON_OFFSET = { x: 1.5, y: 3.5, z: 5 };
export const THIRD_PERSON_AIM_OFFSET = { x: 1.0, y: 2.5, z: 3 };
export const CAMERA_LERP_SPEED = 8;
export const CAMERA_COLLISION_PADDING = 0.3;

// ── Culling ──────────────────────────────────────────────────
export const TRAFFIC_CULL_DISTANCE = 120;
export const WILDLIFE_CULL_DISTANCE = 80;
export const ENEMY_CULL_DISTANCE = 100;
export const NPC_CULL_DISTANCE = 100;
export const DESTRUCTION_CULL_DISTANCE = 150;

// ── NPCs ─────────────────────────────────────────────────────
export const NPC_COUNT = 40;
export const NPC_WALK_SPEED_MIN = 1.0;
export const NPC_WALK_SPEED_MAX = 1.5;
export const NPC_FLEE_SPEED = 3.5;
export const NPC_MIN_SPEED = NPC_WALK_SPEED_MIN;
export const NPC_SPEED_RANGE = NPC_WALK_SPEED_MAX - NPC_WALK_SPEED_MIN;
export const NPC_PATH_MIN_POINTS = 4;
export const NPC_PATH_EXTRA_POINTS = 6;
export const NPC_PATH_STEP = 10;
export const NPC_MIN_SEGMENT_LEN = 2;
export const NPC_BOB_SPEED = 8;
export const NPC_BOB_AMOUNT = 0.08;
export const NPC_ALERT_RADIUS = 30; // NPCs flee within this radius of gunfire
export const NPC_CALL_POLICE_CHANCE = 0.3;

// ── Trees, Benches, Lamps ────────────────────────────────────
export const TREE_COUNT = 60;
export const BENCH_COUNT = 20;
export const LAMP_COUNT = 30;
export const MAX_ACTIVE_LIGHTS = 8;

// ── Buildings ────────────────────────────────────────────────
export const MIN_BUILDING_HEIGHT = 4;
export const BUILDING_HEIGHT_RANGE = 25;
export const WINDOW_SIZE = 0.6;
export const WINDOW_ASPECT = 1.3;
export const WINDOW_SPACING_Y = 3;
export const WINDOW_SPACING_X = 2.5;
export const WINDOW_SKIP_CHANCE = 0.2;
export const ROOFTOP_DETAIL_CHANCE = 0.3;

// ── Lighting ─────────────────────────────────────────────────
export const SHADOW_MAP_SIZE = 2048;
export const SHADOW_FRUSTUM = 150;
export const FOG_DENSITY = 0.006;
export const FOG_COLOR = 0xFFB6C1; // Vice City Sunset Pink

// ── Skybox ───────────────────────────────────────────────────
export const SKY_RADIUS = 500;
export const SKY_SEGMENTS = 16;

// ── Particles ────────────────────────────────────────────────
export const LEAF_COUNT = 30;
export const FIREFLY_COUNT = 20;
export const MAX_DEBRIS_PARTICLES = 200;
export const MAX_IMPACT_PARTICLES = 100;
export const SHELL_CASING_LIFETIME = 3;

// ── Day/Night Cycle ──────────────────────────────────────────
export const DAY_NIGHT_CYCLE_DURATION = 1800; // slower, more cinematic time-of-day passage
export const DAY_NIGHT_ENABLED = true;

// ── Weapons ──────────────────────────────────────────────────
export const WEAPON_TYPES = {
    FISTS: 'fists',
    BAT: 'bat',
    SWORD: 'sword',
    KNIFE: 'knife',
    PISTOL: 'pistol',
    SHOTGUN: 'shotgun',
    SMG: 'smg',
    ASSAULT_RIFLE: 'assault_rifle',
    SNIPER: 'sniper',
    RPG: 'rpg',
    GRENADE: 'grenade',
    MOLOTOV: 'molotov',
    SMOKE_BOMB: 'smoke_bomb',
    MINIGUN: 'minigun',
    GRAPPLE: 'grapple',
};

export const WEAPON_CATEGORIES = {
    MELEE: 'melee',
    PISTOLS: 'pistols',
    SMGS: 'smgs',
    RIFLES: 'rifles',
    HEAVY: 'heavy',
    THROWABLES: 'throwables',
};

export const WEAPONS = {
    [WEAPON_TYPES.FISTS]: {
        name: 'Fists', category: WEAPON_CATEGORIES.MELEE,
        damage: 10, fireRate: 4, range: 2.5, clipSize: Infinity, maxAmmo: Infinity,
        recoil: 0, spread: 0, headshotMult: 1.5, auto: false,
        description: 'Your bare hands. Fast combos.',
    },
    [WEAPON_TYPES.BAT]: {
        name: 'Baseball Bat', category: WEAPON_CATEGORIES.MELEE,
        damage: 25, fireRate: 2, range: 3, clipSize: Infinity, maxAmmo: Infinity,
        recoil: 0, spread: 0, headshotMult: 2, auto: false, knockback: 5,
        description: 'Wooden persuasion. Strong knockback.',
    },
    [WEAPON_TYPES.SWORD]: {
        name: 'Katana Sword', category: WEAPON_CATEGORIES.MELEE,
        damage: 45, fireRate: 2.5, range: 3.5, clipSize: Infinity, maxAmmo: Infinity,
        recoil: 0, spread: 0, headshotMult: 2, auto: false, knockback: 6,
        description: 'Traditional katana. Deadly slashes.',
    },
    [WEAPON_TYPES.KNIFE]: {
        name: 'Combat Knife', category: WEAPON_CATEGORIES.MELEE,
        damage: 20, fireRate: 5, range: 2.2, clipSize: Infinity, maxAmmo: Infinity,
        recoil: 0, spread: 0, headshotMult: 2.5, auto: false, knockback: 2,
        description: 'Tactical blade. Rapid close attacks.',
    },
    [WEAPON_TYPES.PISTOL]: {
        name: '9mm Pistol', category: WEAPON_CATEGORIES.PISTOLS,
        damage: 20, fireRate: 5, range: 80, clipSize: 17, maxAmmo: 200,
        recoil: 0.03, spread: 0.01, headshotMult: 2, auto: false,
        reloadTime: 1.2, bulletSpeed: 150,
        description: 'Reliable sidearm. Accurate and quick.',
    },
    [WEAPON_TYPES.SHOTGUN]: {
        name: 'Pump Shotgun', category: WEAPON_CATEGORIES.RIFLES,
        damage: 15, fireRate: 1.2, range: 15, clipSize: 8, maxAmmo: 80,
        recoil: 0.08, spread: 0.12, headshotMult: 1.5, auto: false,
        pellets: 8, reloadTime: 2.5, bulletSpeed: 100,
        description: 'Devastating at close range. 8 pellets per shot.',
    },
    [WEAPON_TYPES.SMG]: {
        name: 'MP5', category: WEAPON_CATEGORIES.SMGS,
        damage: 12, fireRate: 12, range: 50, clipSize: 30, maxAmmo: 300,
        recoil: 0.025, spread: 0.04, headshotMult: 1.8, auto: true,
        reloadTime: 1.8, bulletSpeed: 130,
        description: 'Rapid fire submachine gun. Spray and pray.',
    },
    [WEAPON_TYPES.ASSAULT_RIFLE]: {
        name: 'M4 Carbine', category: WEAPON_CATEGORIES.RIFLES,
        damage: 18, fireRate: 8, range: 100, clipSize: 30, maxAmmo: 300,
        recoil: 0.035, spread: 0.025, headshotMult: 2, auto: true,
        reloadTime: 2.0, bulletSpeed: 160,
        description: 'Versatile assault rifle. Balanced all-rounder.',
    },
    [WEAPON_TYPES.SNIPER]: {
        name: 'Sniper Rifle', category: WEAPON_CATEGORIES.RIFLES,
        damage: 90, fireRate: 0.8, range: 250, clipSize: 5, maxAmmo: 40,
        recoil: 0.12, spread: 0.002, headshotMult: 3, auto: false,
        reloadTime: 3.0, bulletSpeed: 300, scopeZoom: 4,
        description: 'Long range precision. One-shot headshots.',
    },
    [WEAPON_TYPES.RPG]: {
        name: 'RPG-7', category: WEAPON_CATEGORIES.HEAVY,
        damage: 200, fireRate: 0.5, range: 150, clipSize: 1, maxAmmo: 10,
        recoil: 0.15, spread: 0.01, headshotMult: 1, auto: false,
        reloadTime: 3.5, bulletSpeed: 40, explosive: true, explosionRadius: 8,
        description: 'Rocket launcher. Destroys buildings and vehicles.',
    },
    [WEAPON_TYPES.GRENADE]: {
        name: 'Frag Grenade', category: WEAPON_CATEGORIES.THROWABLES,
        damage: 150, fireRate: 1, range: 30, clipSize: 1, maxAmmo: 10,
        recoil: 0, spread: 0, headshotMult: 1, auto: false,
        fuseTime: 3, explosionRadius: 6, throwForce: 15,
        description: 'Timed explosive. Cook and throw.',
    },
    [WEAPON_TYPES.MOLOTOV]: {
        name: 'Molotov Cocktail', category: WEAPON_CATEGORIES.THROWABLES,
        damage: 80, fireRate: 1, range: 25, clipSize: 1, maxAmmo: 10,
        recoil: 0, spread: 0, headshotMult: 1, auto: false,
        fireRadius: 5, fireDuration: 12, throwForce: 12,
        description: 'Incendiary. Creates a pool of fire.',
    },
    [WEAPON_TYPES.SMOKE_BOMB]: {
        name: 'Smoke Bomb', category: WEAPON_CATEGORIES.THROWABLES,
        damage: 0, fireRate: 1.2, range: 25, clipSize: 1, maxAmmo: 10,
        recoil: 0, spread: 0, headshotMult: 1, auto: false,
        smokeRadius: 8, smokeDuration: 10, throwForce: 12,
        description: 'Tactical smoke. Disorients enemies.',
    },
    [WEAPON_TYPES.MINIGUN]: {
        name: 'Minigun', category: WEAPON_CATEGORIES.HEAVY,
        damage: 8, fireRate: 30, range: 60, clipSize: 200, maxAmmo: 1000,
        recoil: 0.015, spread: 0.06, headshotMult: 1.5, auto: true,
        reloadTime: 4.0, bulletSpeed: 140, spinUpTime: 0.8,
        description: 'Devastation incarnate. Spin-up required.',
    },
    [WEAPON_TYPES.GRAPPLE]: {
        name: 'Grappling Hook', category: WEAPON_CATEGORIES.THROWABLES,
        damage: 0, fireRate: 1, range: 100, clipSize: 1, maxAmmo: Infinity,
        recoil: 0, spread: 0, headshotMult: 1, auto: false,
        grappleSpeed: 40,
        description: 'Hook onto buildings and swing!',
    },
};

// ── Enemies ──────────────────────────────────────────────────
export const ENEMY_TYPES = {
    THUG: 'thug',
    GANG_MEMBER: 'gang_member',
    ENFORCER: 'enforcer',
    SNIPER_ENEMY: 'sniper_enemy',
    POLICE: 'police',
    SWAT: 'swat',
    MILITARY: 'military',
    BOSS_CRIME_LORD: 'boss_crime_lord',
    BOSS_GENERAL: 'boss_general',
    MONSTER: 'monster',
    FLYING_MONSTER: 'flying_monster',
    UFO: 'ufo',
};

export const ENEMIES = {
    [ENEMY_TYPES.THUG]: {
        name: 'Street Thug', health: 50, speed: 2.5, damage: 10,
        weapon: WEAPON_TYPES.FISTS, alertRange: 15, attackRange: 3,
        xpReward: 10, cashDrop: [10, 50], color: 0x8B0000,
    },
    [ENEMY_TYPES.GANG_MEMBER]: {
        name: 'Gang Member', health: 75, speed: 2.0, damage: 15,
        weapon: WEAPON_TYPES.PISTOL, alertRange: 25, attackRange: 30,
        xpReward: 25, cashDrop: [20, 100], color: 0x4B0082,
        usesCover: true,
    },
    [ENEMY_TYPES.ENFORCER]: {
        name: 'Enforcer', health: 120, speed: 1.5, damage: 40,
        weapon: WEAPON_TYPES.SHOTGUN, alertRange: 20, attackRange: 12,
        xpReward: 40, cashDrop: [50, 150], color: 0x2F4F4F,
    },
    [ENEMY_TYPES.SNIPER_ENEMY]: {
        name: 'Sniper', health: 40, speed: 0, damage: 60,
        weapon: WEAPON_TYPES.SNIPER, alertRange: 80, attackRange: 100,
        xpReward: 50, cashDrop: [40, 120], color: 0x556B2F,
        rooftop: true,
    },
    [ENEMY_TYPES.POLICE]: {
        name: 'Police Officer', health: 80, speed: 2.8, damage: 15,
        weapon: WEAPON_TYPES.PISTOL, alertRange: 40, attackRange: 30,
        xpReward: 30, cashDrop: [0, 0], color: 0x00008B,
        usesCover: true, wantedOnly: true,
    },
    [ENEMY_TYPES.SWAT]: {
        name: 'SWAT Operator', health: 150, speed: 2.5, damage: 20,
        weapon: WEAPON_TYPES.SMG, alertRange: 50, attackRange: 40,
        xpReward: 60, cashDrop: [20, 100], color: 0x1a1a1a,
        usesCover: true, flanks: true, wantedOnly: true,
    },
    [ENEMY_TYPES.MILITARY]: {
        name: 'Soldier', health: 180, speed: 2.2, damage: 25,
        weapon: WEAPON_TYPES.ASSAULT_RIFLE, alertRange: 60, attackRange: 60,
        xpReward: 80, cashDrop: [0, 0], color: 0x3B5323,
        usesCover: true, flanks: true, wantedOnly: true,
    },
    [ENEMY_TYPES.BOSS_CRIME_LORD]: {
        name: 'The Kingpin', health: 500, speed: 1.8, damage: 30,
        weapon: WEAPON_TYPES.SMG, alertRange: 40, attackRange: 35,
        xpReward: 500, cashDrop: [5000, 10000], color: 0x800020,
        usesCover: true, boss: true, summonsCrew: true,
    },
    [ENEMY_TYPES.BOSS_GENERAL]: {
        name: 'General Ironclad', health: 800, speed: 2.0, damage: 50,
        weapon: WEAPON_TYPES.RPG, alertRange: 60, attackRange: 80,
        xpReward: 1000, cashDrop: [10000, 20000], color: 0x2E2E2E,
        usesCover: true, boss: true, armored: true,
    },
    [ENEMY_TYPES.MONSTER]: {
        name: 'Street Beast', health: 250, speed: 3.5, damage: 25,
        weapon: WEAPON_TYPES.FISTS, alertRange: 25, attackRange: 3.0,
        xpReward: 50, cashDrop: [100, 300], color: 0x8A2BE2,
    },
    [ENEMY_TYPES.FLYING_MONSTER]: {
        name: 'Gargoyle', health: 80, speed: 3.0, damage: 15,
        weapon: WEAPON_TYPES.FISTS, alertRange: 30, attackRange: 20,
        xpReward: 30, cashDrop: [50, 150], color: 0x2E8B57,
    },
    [ENEMY_TYPES.UFO]: {
        name: 'Alien UFO', health: 600, speed: 2.0, damage: 40,
        weapon: WEAPON_TYPES.FISTS, alertRange: 50, attackRange: 40,
        xpReward: 200, cashDrop: [500, 1000], color: 0x00FF00,
        boss: true,
    },
};

export const MAX_ENEMIES = 80;
export const ENEMY_SPAWN_INTERVAL = 1; // seconds between spawn checks
export const ENEMY_DESPAWN_DISTANCE = 150;

// ── Wanted System ────────────────────────────────────────────
export const WANTED_LEVELS = 5;
export const WANTED_DECAY_TIME = [30, 45, 60, 90, 120]; // seconds per level to decay
export const WANTED_SEARCH_RADIUS = [40, 60, 80, 100, 130];
export const WANTED_SPAWN_COUNTS = [2, 4, 8, 12, 20]; // enemies per wave

// ── Vehicles ─────────────────────────────────────────────────
export const VEHICLE_TYPES = {
    SEDAN: 'sedan',
    SPORTS: 'sports',
    MOTORCYCLE: 'motorcycle',
    TRUCK: 'truck',
    POLICE_CAR: 'police_car',
    TANK: 'tank',
};

export const VEHICLES = {
    [VEHICLE_TYPES.SEDAN]: {
        name: 'Sedan', maxSpeed: 25, acceleration: 8, handling: 0.7,
        health: 200, color: 0x4682B4, size: { w: 2, h: 1.5, d: 4.5 },
    },
    [VEHICLE_TYPES.SPORTS]: {
        name: 'Sports Car', maxSpeed: 40, acceleration: 15, handling: 0.9,
        health: 150, color: 0xFF0000, size: { w: 1.8, h: 1.2, d: 4 },
    },
    [VEHICLE_TYPES.MOTORCYCLE]: {
        name: 'Motorcycle', maxSpeed: 35, acceleration: 12, handling: 1.0,
        health: 80, color: 0x333333, size: { w: 0.8, h: 1.2, d: 2.2 },
    },
    [VEHICLE_TYPES.TRUCK]: {
        name: 'Truck', maxSpeed: 15, acceleration: 4, handling: 0.4,
        health: 500, color: 0x8B4513, size: { w: 2.5, h: 2.5, d: 6 },
    },
    [VEHICLE_TYPES.POLICE_CAR]: {
        name: 'Police Cruiser', maxSpeed: 30, acceleration: 12, handling: 0.8,
        health: 250, color: 0x000080, size: { w: 2, h: 1.5, d: 4.5 },
        siren: true,
    },
    [VEHICLE_TYPES.TANK]: {
        name: 'M1 Abrams', maxSpeed: 8, acceleration: 2, handling: 0.2,
        health: 5000, color: 0x4B5320, size: { w: 3.5, h: 2.5, d: 7 },
        cannon: true, crushes: true,
    },
};

export const VEHICLE_COUNT = 25; // parked vehicles in world
export const TRAFFIC_VEHICLE_COUNT = 12;

// ── Destruction ──────────────────────────────────────────────
export const BUILDING_HEALTH_PER_UNIT = 50; // health per unit of building volume
export const MIN_DESTRUCTIBLE_SIZE = 0.5;
export const EXPLOSION_CHAIN_RADIUS = 12;
export const FIRE_SPREAD_INTERVAL = 2; // seconds
export const FIRE_DURATION = 15; // seconds
export const FIRE_DAMAGE_PER_SECOND = 15;

// ── Missions ─────────────────────────────────────────────────
export const MISSION_TYPES = {
    STORY: 'story',
    SIDE: 'side',
    RANDOM_EVENT: 'random_event',
    CHALLENGE: 'challenge',
};

export const MISSION_MARKERS = {
    [MISSION_TYPES.STORY]: 0xFFD700, // gold
    [MISSION_TYPES.SIDE]: 0x4169E1, // blue
    [MISSION_TYPES.RANDOM_EVENT]: 0xFFFFFF, // white
    [MISSION_TYPES.CHALLENGE]: 0x32CD32, // green
};

// ── Districts ────────────────────────────────────────────────
export const DISTRICTS = {
    DOWNTOWN: {
        name: 'Downtown', bounds: { x: [-80, 80], z: [-200, -80] },
        buildingHeightMult: 2.0, colors: [0x708090, 0x778899, 0x6C7B8B, 0x5B6770, 0x8395A7],
        enemyTypes: [ENEMY_TYPES.GANG_MEMBER, ENEMY_TYPES.ENFORCER],
    },
    INDUSTRIAL: {
        name: 'Industrial Zone', bounds: { x: [80, 200], z: [-200, -40] },
        buildingHeightMult: 0.6, colors: [0x6B6B6B, 0x7B7B7B, 0x8B8B5E, 0x556B2F, 0x696969],
        enemyTypes: [ENEMY_TYPES.THUG, ENEMY_TYPES.GANG_MEMBER],
    },
    RESIDENTIAL: {
        name: 'Residential', bounds: { x: [-200, -80], z: [-80, 80] },
        buildingHeightMult: 0.5, colors: [0xF4E4C1, 0xE8D5B7, 0xFFE4C4, 0xFAD6A5, 0xDEB887],
        enemyTypes: [ENEMY_TYPES.THUG],
    },
    WATERFRONT: {
        name: 'Waterfront', bounds: { x: [-200, -40], z: [80, 200] },
        buildingHeightMult: 0.4, colors: [0x5F9EA0, 0x6B8E8E, 0x708090, 0x8FBC8F, 0xB0C4DE],
        enemyTypes: [ENEMY_TYPES.GANG_MEMBER, ENEMY_TYPES.ENFORCER],
    },
    REDLIGHT: {
        name: 'Red Light District', bounds: { x: [40, 200], z: [40, 200] },
        buildingHeightMult: 0.8, colors: [0x8B008B, 0xB22222, 0xDC143C, 0x800000, 0xC71585],
        neon: true,
        enemyTypes: [ENEMY_TYPES.GANG_MEMBER, ENEMY_TYPES.ENFORCER, ENEMY_TYPES.SNIPER_ENEMY],
    },
    PARK: {
        name: 'Central Park', bounds: { x: [-30, 30], z: [-30, 30] },
        buildingHeightMult: 0, colors: [],
        peaceful: true,
    },
};

// ── Progression ──────────────────────────────────────────────
export const XP_PER_LEVEL = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000];
export const LEVEL_UNLOCKS = {
    1: [WEAPON_TYPES.FISTS, WEAPON_TYPES.PISTOL],
    2: [WEAPON_TYPES.BAT],
    3: [WEAPON_TYPES.SHOTGUN],
    4: [WEAPON_TYPES.SMG],
    5: [WEAPON_TYPES.ASSAULT_RIFLE, WEAPON_TYPES.GRENADE],
    6: [WEAPON_TYPES.SNIPER],
    7: [WEAPON_TYPES.MOLOTOV],
    8: [WEAPON_TYPES.RPG],
    9: [WEAPON_TYPES.MINIGUN],
};

// ── HUD ──────────────────────────────────────────────────────
export const MINIMAP_SIZE = 180; // pixels
export const MINIMAP_RANGE = 80; // world units radius shown
export const DAMAGE_INDICATOR_DURATION = 1.5;

// ── Colors ───────────────────────────────────────────────────
export const BUILDING_COLORS = [
    0xffb6c1, 0xffd1dc, 0xffc0cb, 0xff69b4, // Pinks
    0xe0ffff, 0xaffeee, 0x00ffff, 0x40e0d0, // Cyans
    0x98ff98, 0xc1e1c1, 0x00fa9a, 0x3cb371, // Mints
    0xfffacd, 0xffebcd, 0xffe4b5, 0xffa07a, // Yellow/Peach/Coral
    0xe6e6fa, 0xd8bfd8, 0xdda0dd, 0xee82ee, // Lavender/Purple
    0xf0f8ff, 0xf5f5f5, 0xffffff, 0xdcdcdc, // Whites
];

export const NPC_COLORS = [
    0xE57373, 0x64B5F6, 0x81C784, 0xFFB74D, 0xBA68C8,
    0x4DB6AC, 0xFF8A65, 0xA1887F, 0x90A4AE, 0xF06292,
    0xAED581, 0x4DD0E1, 0xFFD54F, 0x7986CB, 0xE0E0E0,
];

export const FOLIAGE_COLORS = [0x55aa55, 0x449944, 0x66bb66, 0x77cc77];

// ── Thoughts → replaced with radio chatter/quips ─────────────
export const PLAYER_QUIPS = [
    "Just another day in paradise...",
    "This city's going to remember my name.",
    "They should've stayed out of my way.",
    "Time to paint the town red.",
    "Let's see what this block is hiding.",
    "Every corner, a new opportunity.",
    "This is MY city now.",
    "They really shouldn't have done that.",
    "Nothing personal... okay, maybe a little.",
    "The night is young and so is my patience.",
    "I didn't start this fight, but I'll finish it.",
    "Welcome to the Stroll.",
    "Keep walking. Keep shooting.",
    "This town ain't big enough for all of us.",
    "Let chaos reign.",
];

export const THOUGHT_MIN_DELAY = 30000;
export const THOUGHT_EXTRA_DELAY = 45000;
export const THOUGHT_DISPLAY_TIME = 4000;
export const CONTROLS_HINT_FADE_DELAY = 5000;
