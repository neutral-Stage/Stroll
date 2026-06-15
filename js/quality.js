/**
 * quality.js — Graphics quality presets (auto-selected on mobile)
 * @module quality
 */

/** @type {'low'|'medium'|'high'} */
let activeLevel = 'medium';

export const QUALITY_PRESETS = {
    low: {
        shadowMapSize: 1024,
        pixelRatioMax: 1,
        bloom: false,           // Phase 5 re-enables this as render-scaled bloom (needs postFxScale wired)
        fxaa: false,
        leafCount: 25,
        fireflyCount: 15,
        npcCount: 12,
        trafficCullDistance: 60,
        wildlifeCullDistance: 50,
        // ── extended tier controls (Phases 1/3/5) ──
        ssao: false,            // ambient occlusion pass (expensive) — off on mobile
        postFxScale: 0.66,      // post-processing render-target resolution scale
        vfxIntensity: 0.5,      // particle/effect density multiplier
        maxParticles: 140,      // hard ceiling on simultaneous particles
        maxActiveLights: 4,     // dynamic point lights (street lamps etc.)
        materialTier: 'lite',   // 'lite' = no normal maps, 'full' = textured PBR
        npcCullDistance: 55,
        staticCullDistance: 130,
        lodDistance: 45,
        fpsCap: 60,
    },
    medium: {
        shadowMapSize: 2048,
        pixelRatioMax: 1.5,
        bloom: true,
        fxaa: true,
        leafCount: 45,
        fireflyCount: 30,
        npcCount: 20,
        trafficCullDistance: 90,
        wildlifeCullDistance: 70,
        ssao: false,           // SSAOPass deferred to Phase 5 (renders black in this pipeline); flag kept for later
        postFxScale: 0.85,
        vfxIntensity: 1.0,
        maxParticles: 300,
        maxActiveLights: 8,
        materialTier: 'full',
        npcCullDistance: 85,
        staticCullDistance: 220,
        lodDistance: 75,
        fpsCap: 0,
    },
    high: {
        shadowMapSize: 4096,
        pixelRatioMax: 2,
        bloom: true,
        fxaa: true,
        leafCount: 60,
        fireflyCount: 40,
        npcCount: 25,
        trafficCullDistance: 120,
        wildlifeCullDistance: 100,
        ssao: false,
        postFxScale: 1.0,
        vfxIntensity: 1.5,
        maxParticles: 520,
        maxActiveLights: 12,
        materialTier: 'full',
        npcCullDistance: 120,
        staticCullDistance: 420,
        lodDistance: 110,
        fpsCap: 0,
    },
};

/** @returns {number} particle/effect density multiplier for the active tier. */
export function vfxScale() {
    return getQuality().vfxIntensity ?? 1;
}

/** Scale a requested particle count by the active VFX tier (min 1). */
export function scaleCount(n) {
    return Math.max(1, Math.round(n * (getQuality().vfxIntensity ?? 1)));
}

/**
 * @param {boolean} isMobile
 * @param {'low'|'medium'|'high'} [force]
 */
export function resolveQuality(isMobile, force) {
    if (force && QUALITY_PRESETS[force]) {
        activeLevel = force;
    } else {
        activeLevel = isMobile ? 'low' : 'high';
    }
    return getQuality();
}

export function getQualityLevel() {
    return activeLevel;
}

export function getQuality() {
    return QUALITY_PRESETS[activeLevel];
}

/**
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyRendererQuality(renderer) {
    const q = getQuality();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatioMax));
    renderer.shadowMap.enabled = q.shadowMapSize > 0;
}
