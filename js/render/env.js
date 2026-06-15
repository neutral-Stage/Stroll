/**
 * env.js — Procedural environment map for image-based lighting (IBL).
 *
 * Builds a small equirectangular sunset gradient, runs it through a
 * PMREM generator, and assigns it as scene.environment. This gives every
 * MeshStandardMaterial subtle, direction-aware ambient reflections — the
 * single cheapest upgrade from "flat Lambert" to "believable PBR".
 *
 * No external assets: the gradient is painted to a canvas at runtime.
 *
 * @module render/env
 */

import * as THREE from 'three';

let pmrem = null;
let envRT = null;

/**
 * Paint an equirectangular sky gradient (warm sunset) to a canvas texture.
 * Horizontally uniform; vertical band = zenith → horizon → ground bounce.
 */
function makeGradientEquirect() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, '#2a1a4a'); // zenith — deep violet
    g.addColorStop(0.30, '#7b3a6e'); // upper sky — magenta
    g.addColorStop(0.50, '#c85a5a'); // mid — warm rose
    g.addColorStop(0.62, '#f3955a'); // horizon glow — orange
    g.addColorStop(0.70, '#ffc987'); // horizon — gold
    g.addColorStop(0.74, '#9aa7b4'); // ground line — cool haze
    g.addColorStop(1.00, '#3a3540'); // ground bounce — muted
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Build the IBL environment and apply it to the scene.
 * Call once after the renderer exists.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 */
export function setupEnvironment(scene, renderer) {
    try {
        pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const src = makeGradientEquirect();
        envRT = pmrem.fromEquirectangular(src);
        scene.environment = envRT.texture;
        src.dispose();
    } catch (err) {
        console.warn('Environment map unavailable:', err?.message || err);
    }
}

/** Free GPU resources (e.g. on teardown). */
export function disposeEnvironment() {
    if (envRT) { envRT.dispose(); envRT = null; }
    if (pmrem) { pmrem.dispose(); pmrem = null; }
}
