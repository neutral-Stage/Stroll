/**
 * entity-manager.js — Lightweight entity system with spatial hashing
 * Manages game entities (enemies, vehicles, projectiles, debris) with
 * efficient spatial queries for collision detection and proximity checks.
 * @module core/entity-manager
 */

const CELL_SIZE = 16; // spatial hash cell size in world units

/**
 * @typedef {Object} Entity
 * @property {string} id - Unique identifier
 * @property {string} type - Entity type (enemy, vehicle, bullet, debris, pickup, etc.)
 * @property {number} x - World X position
 * @property {number} y - World Y position
 * @property {number} z - World Z position
 * @property {number} [health] - Current health
 * @property {number} [maxHealth] - Maximum health
 * @property {boolean} active - Whether entity is active
 * @property {THREE.Object3D} [mesh] - Three.js mesh reference
 * @property {Object} [data] - Type-specific data
 */

/** @type {Map<string, Entity>} */
const entities = new Map();

/** @type {Map<string, Set<string>>} Spatial hash: "cellX,cellZ" → Set of entity IDs */
const spatialHash = new Map();

/** @type {Map<string, Set<string>>} Type index: type → Set of entity IDs */
const typeIndex = new Map();

let nextId = 0;

/**
 * Generate a unique entity ID.
 * @param {string} type
 * @returns {string}
 */
function generateId(type) {
    return `${type}_${nextId++}`;
}

/**
 * Get spatial hash key for a position.
 * @param {number} x
 * @param {number} z
 * @returns {string}
 */
function hashKey(x, z) {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    return `${cx},${cz}`;
}

/**
 * Create and register a new entity.
 * @param {string} type
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Object} [data={}] - Additional entity data
 * @returns {Entity}
 */
export function createEntity(type, x, y, z, data = {}) {
    const id = generateId(type);
    const entity = {
        id,
        type,
        x, y, z,
        active: true,
        health: data.health || 0,
        maxHealth: data.maxHealth || data.health || 0,
        mesh: data.mesh || null,
        data: { ...data },
    };

    entities.set(id, entity);

    // Add to type index
    if (!typeIndex.has(type)) typeIndex.set(type, new Set());
    typeIndex.get(type).add(id);

    // Add to spatial hash
    const key = hashKey(x, z);
    if (!spatialHash.has(key)) spatialHash.set(key, new Set());
    spatialHash.get(key).add(id);

    return entity;
}

/**
 * Remove an entity.
 * @param {string} id
 */
export function removeEntity(id) {
    const entity = entities.get(id);
    if (!entity) return;

    // Remove from spatial hash
    const key = hashKey(entity.x, entity.z);
    const cell = spatialHash.get(key);
    if (cell) {
        cell.delete(id);
        if (cell.size === 0) spatialHash.delete(key);
    }

    // Remove from type index
    const typeSet = typeIndex.get(entity.type);
    if (typeSet) {
        typeSet.delete(id);
        if (typeSet.size === 0) typeIndex.delete(entity.type);
    }

    entity.active = false;
    entities.delete(id);
}

/**
 * Get an entity by ID.
 * @param {string} id
 * @returns {Entity|undefined}
 */
export function getEntity(id) {
    return entities.get(id);
}

/**
 * Get all entities of a specific type.
 * @param {string} type
 * @returns {Entity[]}
 */
export function getEntitiesByType(type) {
    const ids = typeIndex.get(type);
    if (!ids) return [];
    const result = [];
    for (const id of ids) {
        const e = entities.get(id);
        if (e && e.active) result.push(e);
    }
    return result;
}

/**
 * Update an entity's position (updates spatial hash).
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function updateEntityPosition(id, x, y, z) {
    const entity = entities.get(id);
    if (!entity) return;

    const oldKey = hashKey(entity.x, entity.z);
    const newKey = hashKey(x, z);

    if (oldKey !== newKey) {
        // Remove from old cell
        const oldCell = spatialHash.get(oldKey);
        if (oldCell) {
            oldCell.delete(id);
            if (oldCell.size === 0) spatialHash.delete(oldKey);
        }
        // Add to new cell
        if (!spatialHash.has(newKey)) spatialHash.set(newKey, new Set());
        spatialHash.get(newKey).add(id);
    }

    entity.x = x;
    entity.y = y;
    entity.z = z;
}

/**
 * Query entities within a radius of a point (spatial hash accelerated).
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {string} [filterType] - Optional type filter
 * @returns {Entity[]}
 */
export function queryNearby(x, z, radius, filterType) {
    const results = [];
    const r2 = radius * radius;

    // Check all cells that could contain entities within radius
    const minCX = Math.floor((x - radius) / CELL_SIZE);
    const maxCX = Math.floor((x + radius) / CELL_SIZE);
    const minCZ = Math.floor((z - radius) / CELL_SIZE);
    const maxCZ = Math.floor((z + radius) / CELL_SIZE);

    for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
            const cell = spatialHash.get(`${cx},${cz}`);
            if (!cell) continue;

            for (const id of cell) {
                const entity = entities.get(id);
                if (!entity || !entity.active) continue;
                if (filterType && entity.type !== filterType) continue;

                const dx = entity.x - x;
                const dz = entity.z - z;
                if (dx * dx + dz * dz <= r2) {
                    results.push(entity);
                }
            }
        }
    }

    return results;
}

/**
 * Apply damage to an entity.
 * @param {string} id
 * @param {number} amount
 * @returns {{ killed: boolean, remaining: number }}
 */
export function damageEntity(id, amount) {
    const entity = entities.get(id);
    if (!entity || !entity.active) return { killed: false, remaining: 0 };

    entity.health = Math.max(0, entity.health - amount);

    if (entity.health <= 0) {
        return { killed: true, remaining: 0 };
    }

    return { killed: false, remaining: entity.health };
}

/**
 * Heal an entity.
 * @param {string} id
 * @param {number} amount
 */
export function healEntity(id, amount) {
    const entity = entities.get(id);
    if (!entity || !entity.active) return;
    entity.health = Math.min(entity.maxHealth, entity.health + amount);
}

/**
 * Get count of active entities.
 * @param {string} [type] - Optional type filter
 * @returns {number}
 */
export function getEntityCount(type) {
    if (type) {
        const ids = typeIndex.get(type);
        return ids ? ids.size : 0;
    }
    return entities.size;
}

/**
 * Get all active entities.
 * @returns {Entity[]}
 */
export function getAllEntities() {
    return Array.from(entities.values()).filter(e => e.active);
}

/**
 * Clear all entities.
 */
export function clearAllEntities() {
    entities.clear();
    spatialHash.clear();
    typeIndex.clear();
    nextId = 0;
}

/**
 * Find the closest entity of a given type to a point.
 * @param {number} x
 * @param {number} z
 * @param {string} type
 * @param {number} [maxDist=Infinity]
 * @returns {Entity|null}
 */
export function findClosest(x, z, type, maxDist = Infinity) {
    const candidates = getEntitiesByType(type);
    let closest = null;
    let closestDist = maxDist * maxDist;

    for (const entity of candidates) {
        const dx = entity.x - x;
        const dz = entity.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < closestDist) {
            closestDist = d2;
            closest = entity;
        }
    }

    return closest;
}
