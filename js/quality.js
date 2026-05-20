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
        bloom: false,
        fxaa: false,
        leafCount: 25,
        fireflyCount: 15,
        npcCount: 12,
        trafficCullDistance: 60,
        wildlifeCullDistance: 50,
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
    },
};

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
