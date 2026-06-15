/**
 * feel.js — Game-feel layer (the "juice").
 *
 * Centralizes the cheap-but-high-impact feedback that makes combat and
 * interaction feel responsive: floating damage numbers, hit markers,
 * full-screen flashes, hit-stop, and camera shake routing.
 *
 * Design goals:
 *  - Zero per-frame allocations in the hot path (pooled DOM nodes).
 *  - Screen-space animation: world positions are projected ONCE at spawn,
 *    then animated in 2D, so there is no per-frame projection cost and
 *    numbers never jitter with the camera.
 *  - Mobile-safe: hard caps on simultaneous elements, scaled by quality.
 *
 * @module core/feel
 */

import * as THREE from 'three';
import { addCameraShake } from '../camera/camera-controller.js';
import { getQuality } from '../quality.js';

/** @type {THREE.PerspectiveCamera|null} */
let camera = null;
/** @type {HTMLElement|null} */
let layer = null;
/** @type {HTMLElement|null} */
let flashEl = null;

// Pools / active lists
const numbers = [];      // active floating damage numbers
const numberPool = [];   // recycled DOM nodes
const markers = [];      // active hit markers
const markerPool = [];

// Screen-flash state
let flashColor = '#ffffff';
let flashAlpha = 0;
let flashDecay = 0;

// Hit-stop (global time scale dampener the game loop may consult)
let hitStopTimer = 0;

// Caps (tuned per quality tier on init)
let MAX_NUMBERS = 28;
let MAX_MARKERS = 12;

const _v = new THREE.Vector3();

/**
 * Initialize the feel layer. Builds the DOM overlay + styles once.
 * @param {THREE.PerspectiveCamera} cam
 */
export function initFeel(cam) {
    camera = cam;

    const q = getQuality();
    // Fewer simultaneous DOM nodes on low-end devices.
    MAX_NUMBERS = q.bloom ? 28 : 16;
    MAX_MARKERS = q.bloom ? 12 : 6;

    if (!document.getElementById('feel-styles')) {
        const style = document.createElement('style');
        style.id = 'feel-styles';
        style.textContent = FEEL_CSS;
        document.head.appendChild(style);
    }

    layer = document.getElementById('feel-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'feel-layer';
        document.body.appendChild(layer);
    }
    layer.innerHTML = '';

    flashEl = document.createElement('div');
    flashEl.id = 'feel-flash';
    layer.appendChild(flashEl);

    numbers.length = 0;
    markers.length = 0;
    numberPool.length = 0;
    markerPool.length = 0;
    flashAlpha = 0;
    hitStopTimer = 0;
}

/**
 * Advance all feel animations. Call once per frame (before render).
 * @param {number} dt - seconds
 */
export function updateFeel(dt) {
    if (!layer) return;

    if (hitStopTimer > 0) hitStopTimer -= dt;

    // Floating damage numbers — rise + fade in screen space.
    for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.life -= dt;
        if (n.life <= 0) {
            recycleNumber(n);
            numbers.splice(i, 1);
            continue;
        }
        const k = 1 - n.life / n.maxLife;          // 0 → 1 progress
        n.vy -= 40 * dt;                            // gentle gravity for a pop-arc
        n.y += n.vy * dt;
        n.x += n.vx * dt;
        const scale = n.crit
            ? 1 + 0.5 * Math.max(0, 1 - k * 4)      // crit punches in then settles
            : 1;
        const alpha = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        n.el.style.transform = `translate(-50%,-50%) translate(${n.x}px,${n.y}px) scale(${scale.toFixed(3)})`;
        n.el.style.opacity = alpha.toFixed(3);
    }

    // Hit markers — quick expand + fade at center.
    for (let i = markers.length - 1; i >= 0; i--) {
        const m = markers[i];
        m.life -= dt;
        if (m.life <= 0) {
            recycleMarker(m);
            markers.splice(i, 1);
            continue;
        }
        const k = 1 - m.life / m.maxLife;
        const spread = 6 + k * 10;
        m.el.style.opacity = (1 - k).toFixed(3);
        m.el.style.setProperty('--spread', spread.toFixed(1) + 'px');
    }

    // Screen flash decay.
    if (flashAlpha > 0) {
        flashAlpha = Math.max(0, flashAlpha - flashDecay * dt);
        flashEl.style.backgroundColor = flashColor;
        flashEl.style.opacity = flashAlpha.toFixed(3);
    }
}

/**
 * Spawn a floating damage number anchored to a world position.
 * @param {number} x @param {number} y @param {number} z
 * @param {number} amount
 * @param {{color?:string, crit?:boolean}} [opts]
 */
export function spawnDamageNumber(x, y, z, amount, opts = {}) {
    if (!camera || !layer) return;

    // Project world → screen ONCE. Keep matrices fresh since we run pre-render.
    camera.updateMatrixWorld();
    _v.set(x, y, z).project(camera);
    if (_v.z > 1) return; // behind camera

    const sx = (_v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-_v.y * 0.5 + 0.5) * window.innerHeight;

    if (numbers.length >= MAX_NUMBERS) {
        recycleNumber(numbers.shift());
    }

    const crit = !!opts.crit;
    const el = numberPool.pop() || makeNumberEl();
    el.textContent = (crit ? '' : '') + Math.round(amount);
    el.className = 'feel-num' + (crit ? ' feel-num--crit' : '');
    el.style.color = opts.color || (crit ? '#ffd23f' : '#ffffff');
    el.style.opacity = '0';
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    if (el.parentNode !== layer) layer.appendChild(el);

    const life = crit ? 1.0 : 0.8;
    numbers.push({
        el, x: 0, y: 0,
        vx: (Math.random() - 0.5) * 26,
        vy: -70 - Math.random() * 20,
        life, maxLife: life, crit,
    });
}

/**
 * Flash a hit marker near the crosshair. Use `kill` for a heavier flourish.
 * @param {{kill?:boolean, color?:string}} [opts]
 */
export function spawnHitMarker(opts = {}) {
    if (!layer) return;
    if (markers.length >= MAX_MARKERS) recycleMarker(markers.shift());

    const el = markerPool.pop() || makeMarkerEl();
    const kill = !!opts.kill;
    el.className = 'feel-marker' + (kill ? ' feel-marker--kill' : '');
    el.style.color = opts.color || (kill ? '#ff4444' : '#ffffff');
    el.style.opacity = '1';
    if (el.parentNode !== layer) layer.appendChild(el);

    const life = kill ? 0.35 : 0.18;
    markers.push({ el, life, maxLife: life });
}

/**
 * Full-screen color flash (explosions, taking damage, power casts).
 * @param {string} color
 * @param {number} alpha - peak opacity 0..1
 * @param {number} [decayPerSec=4] - how fast it fades
 */
export function screenFlash(color, alpha, decayPerSec = 4) {
    if (!flashEl) return;
    // Take the stronger of any in-flight flash so rapid hits don't dim each other.
    if (alpha >= flashAlpha) {
        flashColor = color;
        flashAlpha = Math.min(1, alpha);
        flashDecay = decayPerSec;
    }
}

/**
 * Route camera shake through the existing controller.
 * @param {number} intensity @param {number} duration
 */
export function shake(intensity, duration) {
    addCameraShake(intensity, duration);
}

/**
 * Brief global hit-stop. The game loop may scale its delta by
 * getTimeScale() to sell heavy impacts. Kept tiny to avoid feeling laggy.
 * @param {number} seconds
 */
export function hitStop(seconds) {
    hitStopTimer = Math.max(hitStopTimer, seconds);
}

/** @returns {number} 0..1 time scale for the current frame (1 = normal). */
export function getTimeScale() {
    return hitStopTimer > 0 ? 0.0 : 1;
}

/**
 * One-call convenience for an impact: number + marker + shake + flash.
 * Phases 3/4 call this from weapon/power/explosion hit handlers.
 * @param {number} x @param {number} y @param {number} z
 * @param {object} o
 * @param {number} [o.damage]
 * @param {boolean} [o.kill]
 * @param {boolean} [o.crit]
 * @param {number} [o.shake]
 * @param {string} [o.flash]
 * @param {string} [o.color]
 */
export function impact(x, y, z, o = {}) {
    if (typeof o.damage === 'number') {
        spawnDamageNumber(x, y, z, o.damage, { crit: o.crit, color: o.color });
    }
    spawnHitMarker({ kill: o.kill, color: o.color });
    if (o.shake) shake(o.shake, 0.12);
    if (o.flash) screenFlash(o.flash, 0.25, 6);
}

// ── internals ────────────────────────────────────────────────

function makeNumberEl() {
    const el = document.createElement('div');
    el.className = 'feel-num';
    return el;
}
function makeMarkerEl() {
    const el = document.createElement('div');
    el.className = 'feel-marker';
    return el;
}
function recycleNumber(n) {
    if (!n) return;
    n.el.style.opacity = '0';
    if (numberPool.length < 40) numberPool.push(n.el);
    else n.el.remove();
}
function recycleMarker(m) {
    if (!m) return;
    m.el.style.opacity = '0';
    if (markerPool.length < 20) markerPool.push(m.el);
    else m.el.remove();
}

const FEEL_CSS = `
#feel-layer{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden;
  font-family:'Rajdhani','Segoe UI',system-ui,sans-serif;}
#feel-flash{position:absolute;inset:0;opacity:0;mix-blend-mode:screen;
  transition:none;will-change:opacity;}
.feel-num{position:absolute;transform:translate(-50%,-50%);will-change:transform,opacity;
  font-weight:800;font-size:22px;letter-spacing:.5px;
  text-shadow:0 2px 4px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9);
  -webkit-text-stroke:1px rgba(0,0,0,.55);}
.feel-num--crit{font-size:34px;text-shadow:0 0 10px rgba(255,200,40,.9),0 2px 5px rgba(0,0,0,.9);}
.feel-marker{position:absolute;left:50%;top:50%;width:26px;height:26px;
  transform:translate(-50%,-50%) rotate(45deg);will-change:opacity;--spread:8px;}
.feel-marker::before,.feel-marker::after{content:'';position:absolute;background:currentColor;
  box-shadow:0 0 4px rgba(0,0,0,.7);}
.feel-marker::before{left:50%;top:0;width:2.5px;height:9px;transform:translateX(-50%);
  margin-top:calc(-1 * var(--spread));box-shadow:0 0 4px currentColor;}
.feel-marker::after{left:0;top:50%;height:2.5px;width:9px;transform:translateY(-50%);
  margin-left:calc(-1 * var(--spread));}
.feel-marker--kill{width:34px;height:34px;}
`;
