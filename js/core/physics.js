/**
 * physics.js — Lightweight physics engine for Stroll
 * Handles gravity, velocity, AABB collision detection/response,
 * projectile physics, and debris simulation.
 * @module core/physics
 */

import { GRAVITY } from '../config.js';
import { buildings } from '../city.js';

/**
 * @typedef {Object} PhysicsBody
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} vx - velocity X
 * @property {number} vy - velocity Y
 * @property {number} vz - velocity Z
 * @property {number} radius - collision radius
 * @property {number} height - collision height
 * @property {boolean} grounded - on ground
 * @property {boolean} gravity - affected by gravity
 * @property {number} mass - for knockback calculations
 * @property {number} friction - ground friction 0-1
 * @property {number} bounce - bounciness 0-1
 */

/**
 * Create a physics body with default values.
 * @param {Partial<PhysicsBody>} opts
 * @returns {PhysicsBody}
 */
export function createBody(opts = {}) {
    return {
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        radius: 0.5,
        height: 2,
        grounded: false,
        gravity: true,
        mass: 1,
        friction: 0.85,
        bounce: 0,
        ...opts,
    };
}

/**
 * Apply gravity and integrate velocity for a physics body.
 * @param {PhysicsBody} body
 * @param {number} delta
 */
export function integrateBody(body, delta) {
    // Gravity
    if (body.gravity && !body.grounded) {
        body.vy -= GRAVITY * delta * 60; // 60fps normalized
    }

    // Integrate position
    body.x += body.vx * delta * 60;
    body.y += body.vy * delta * 60;
    body.z += body.vz * delta * 60;

    // Ground collision
    if (body.y <= 0) {
        body.y = 0;
        if (body.vy < 0) {
            if (body.bounce > 0 && Math.abs(body.vy) > 0.5) {
                body.vy = -body.vy * body.bounce;
            } else {
                body.vy = 0;
                body.grounded = true;
            }
        }
    } else {
        body.grounded = false;
    }

    // Ground friction
    if (body.grounded) {
        body.vx *= body.friction;
        body.vz *= body.friction;
        // Stop tiny movements
        if (Math.abs(body.vx) < 0.001) body.vx = 0;
        if (Math.abs(body.vz) < 0.001) body.vz = 0;
    }

    // Air drag
    if (!body.grounded) {
        body.vx *= 0.99;
        body.vz *= 0.99;
    }
}

/**
 * Check AABB collision between a circle (player/entity) and a box (building).
 * @param {number} cx - Circle center X
 * @param {number} cz - Circle center Z
 * @param {number} cr - Circle radius
 * @param {number} bx - Box center X
 * @param {number} bz - Box center Z
 * @param {number} bw - Box width
 * @param {number} bd - Box depth
 * @returns {{ hit: boolean, pushX: number, pushZ: number }}
 */
export function circleBoxCollision(cx, cz, cr, bx, bz, bw, bd) {
    const halfW = bw / 2;
    const halfD = bd / 2;

    // Find closest point on box to circle
    const closestX = Math.max(bx - halfW, Math.min(cx, bx + halfW));
    const closestZ = Math.max(bz - halfD, Math.min(cz, bz + halfD));

    const dx = cx - closestX;
    const dz = cz - closestZ;
    const dist2 = dx * dx + dz * dz;

    if (dist2 < cr * cr) {
        const dist = Math.sqrt(dist2) || 0.001;
        const overlap = cr - dist;
        return {
            hit: true,
            pushX: (dx / dist) * overlap,
            pushZ: (dz / dist) * overlap,
        };
    }

    return { hit: false, pushX: 0, pushZ: 0 };
}

/**
 * Resolve building collisions for a physics body.
 * @param {PhysicsBody} body
 * @param {number} [padding=0.5]
 * @returns {boolean} true if any collision occurred
 */
export function resolveBuildings(body, padding = 0.5) {
    let collided = false;
    const r = body.radius + padding;

    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        // Skip if clearly above the building
        if (body.y > b.height) continue;

        const result = circleBoxCollision(body.x, body.z, r, b.x, b.z, b.width, b.depth);
        if (result.hit) {
            body.x += result.pushX;
            body.z += result.pushZ;

            // Kill velocity in push direction
            if (Math.abs(result.pushX) > Math.abs(result.pushZ)) {
                body.vx = 0;
            } else {
                body.vz = 0;
            }
            collided = true;
        }
    }

    return collided;
}

/**
 * Check if a point is inside any building.
 * @param {number} x
 * @param {number} z
 * @param {number} [padding=1]
 * @returns {boolean}
 */
export function isInsideAnyBuilding(x, z, padding = 1) {
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (x > b.x - b.width / 2 - padding && x < b.x + b.width / 2 + padding &&
            z > b.z - b.depth / 2 - padding && z < b.z + b.depth / 2 + padding) {
            return true;
        }
    }
    return false;
}

/**
 * Find the building at a given position.
 * @param {number} x
 * @param {number} z
 * @param {number} [padding=0]
 * @returns {Object|null} building object or null
 */
export function getBuildingAt(x, z, padding = 0) {
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (x > b.x - b.width / 2 - padding && x < b.x + b.width / 2 + padding &&
            z > b.z - b.depth / 2 - padding && z < b.z + b.depth / 2 + padding) {
            return b;
        }
    }
    return null;
}

/**
 * Sphere-sphere collision check.
 * @param {number} x1 - Center 1 X
 * @param {number} y1 - Center 1 Y
 * @param {number} z1 - Center 1 Z
 * @param {number} r1 - Radius 1
 * @param {number} x2 - Center 2 X
 * @param {number} y2 - Center 2 Y
 * @param {number} z2 - Center 2 Z
 * @param {number} r2 - Radius 2
 * @returns {boolean}
 */
export function sphereCollision(x1, y1, z1, r1, x2, y2, z2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dz = z1 - z2;
    const combined = r1 + r2;
    return (dx * dx + dy * dy + dz * dz) < (combined * combined);
}

/**
 * Raycast against buildings to find hit point.
 * Simple step-based raycasting (not pixel-perfect but fast).
 * @param {number} ox - Origin X
 * @param {number} oy - Origin Y
 * @param {number} oz - Origin Z
 * @param {number} dx - Direction X (normalized)
 * @param {number} dy - Direction Y (normalized)
 * @param {number} dz - Direction Z (normalized)
 * @param {number} maxDist - Maximum distance
 * @param {number} [step=0.5] - Step size
 * @returns {{ hit: boolean, x: number, y: number, z: number, dist: number, building: Object|null }}
 */
export function raycastBuildings(ox, oy, oz, dx, dy, dz, maxDist, step = 0.5) {
    let t = 0;
    while (t < maxDist) {
        const x = ox + dx * t;
        const y = oy + dy * t;
        const z = oz + dz * t;

        // Hit ground?
        if (y <= 0) {
            return { hit: true, x, y: 0, z, dist: t, building: null };
        }

        // Hit building?
        const b = getBuildingAt(x, z, 0);
        if (b && y < b.height) {
            return { hit: true, x, y, z, dist: t, building: b };
        }

        t += step;
    }

    return { hit: false, x: ox + dx * maxDist, y: oy + dy * maxDist, z: oz + dz * maxDist, dist: maxDist, building: null };
}

/**
 * Apply an explosive force to a physics body.
 * @param {PhysicsBody} body
 * @param {number} ex - Explosion center X
 * @param {number} ey - Explosion center Y
 * @param {number} ez - Explosion center Z
 * @param {number} force - Force magnitude
 * @param {number} radius - Explosion radius
 */
export function applyExplosionForce(body, ex, ey, ez, force, radius) {
    const dx = body.x - ex;
    const dy = (body.y + body.height / 2) - ey;
    const dz = body.z - ez;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

    if (dist > radius) return;

    const falloff = 1 - (dist / radius);
    const f = (force * falloff) / body.mass;

    body.vx += (dx / dist) * f;
    body.vy += Math.max((dy / dist) * f, f * 0.5); // Always some upward force
    body.vz += (dz / dist) * f;
    body.grounded = false;
}

/**
 * Clamp a position within the city bounds.
 * @param {number} x
 * @param {number} z
 * @param {number} margin
 * @returns {{ x: number, z: number }}
 */
export function clampToCity(x, z, margin = 2) {
    const half = 200; // HALF_CITY
    return {
        x: Math.max(-half + margin, Math.min(half - margin, x)),
        z: Math.max(-half + margin, Math.min(half - margin, z)),
    };
}

/**
 * Get distance between two 2D points.
 * @param {number} x1
 * @param {number} z1
 * @param {number} x2
 * @param {number} z2
 * @returns {number}
 */
export function dist2D(x1, z1, x2, z2) {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Get squared distance between two 2D points (faster, no sqrt).
 * @param {number} x1
 * @param {number} z1
 * @param {number} x2
 * @param {number} z2
 * @returns {number}
 */
export function dist2DSq(x1, z1, x2, z2) {
    const dx = x1 - x2;
    const dz = z1 - z2;
    return dx * dx + dz * dz;
}

/**
 * Normalize a 2D vector.
 * @param {number} x
 * @param {number} z
 * @returns {{ x: number, z: number }}
 */
export function normalize2D(x, z) {
    const len = Math.sqrt(x * x + z * z) || 1;
    return { x: x / len, z: z / len };
}
