# Stroll — project architecture & maintenance guide

Vanilla ES modules + Three.js (`r160`) loaded via **import map** in `index.html`. No bundler — works from any static host (GitHub Pages, previews, etc.).

## Layout

```
/
├── index.html          Single page: shells for HUD, overlays, import map
├── css/
│   ├── tokens.css          Design tokens (colors, fonts, z-index)
│   ├── base.css            Reset, shell UI, mobile, keyframes
│   ├── hud.css             HUD, compass, toasts
│   ├── overlays.css        Pause, journal, loading, modes, minigames
│   ├── reduced-motion.css  prefers-reduced-motion overrides
│   └── style.css           Entry (@imports partials in order)
├── docs/
│   ├── ARCHITECTURE.md This file
│   └── PROJECT_PLAN.md Roadmap and definition of done
└── js/
    ├── main.js         Boot, scene/renderer/composer, game loop glue
    ├── game-state.js   Session flags + stats builders (HUD / achievements / pause)
    ├── focus-trap.js   Keyboard focus for pause / journal modals
    ├── accessibility.js prefers-reduced-motion helper
    ├── config.js       Tunables — prefer changing values here vs scattered literals
    ├── lighting.js     Sun, shadows, fog, sky, ground, day/night cycle
    ├── city.js         Procedural city + collision helpers (`buildings`, `isInsideBuilding`)
    ├── controls.js     Input (keyboard, pointer lock, mobile joystick), resize helper
    ├── audio.js        User-gated AudioContext — wind/birds/lofi; calls `ambient.js` when enabled
    ├── ambient.js      Extra pads/bells/ocean (runs only after sound is on + graph exists)
    ├── lofi.js         Procedural lofi beats
    ├── collectibles.js Orbs/crystals/stars + HUD **score**
    ├── enhanced-collectibles.js  Gems, artifacts, notes, mystery boxes (bonuses fed into score via `addScore`)
    ├── challenges.js   Waypoints, journal data, achievements
    ├── npcs.js         Pedestrians
    ├── traffic.js      Cars
    ├── dog.js          Companion
    ├── wildlife.js     Birds / butterflies
    ├── particles.js    Leaves / fireflies
    ├── weather.js      Rain / lightning / fog integration
    ├── interactive.js Flowers (right-click) + ambient interactives
    ├── weapon.js       FPS pistol overlay + pickups
    ├── photomode.js    Orbit cam + screenshots
    ├── meditation.js  Breathing / camera soften
    ├── minigames.js    Simple overlay games (`G`)
    ├── cinematic.js   Opening flythrough
    └── hud.js         Compass, HUD numbers, pause, journal, toasts
```

## Runtime flow

1. **`startWhenReady()`** — Runs `init()` after `DOMContentLoaded` **or** immediately if the document is already parsed (fixes ES-module timing).
2. **`init()`** — try/catch; **`initCore()`** bails early if WebGL/composer/scene failed.
3. **World build** — city → NPCs → collectibles → … → controls + UI bindings.
4. **First frame** — loading screen hides, cinematic starts (optional skip). Gameplay branch of **`animate()`** runs after cinematic.
5. **Loop** — movement → NPCs/day-night/particles/traffic/dog → weather (+ optional audio ctx) → minigames → collectibles (**score** updates in `collectibles.js`) → enhanced pickups (**`addScore`**) → challenges → HUD → composer render → weapon pass.

### Single sources of truth

| Concern | Source |
|--------|--------|
| Pickup totals for HUD / “Completionist” | `collectibles.js` counts + `enhanced-collectibles.js` counts (summed in `main.js`) |
| Score HUD | `collectibles.js` internal `score` (base pickups + **`addScore()`** for enhanced) |
| Achievements | `challenges.js` — stats from **`game-state.buildChallengeStats()`** |
| Pause menu stats | **`hud.updatePauseStats`** via **`setPauseStatsProvider`** in main |
| Pointer / movement | **`controls.js`** — pointer lock is desktop-only |
| Ambient layered audio | Created only inside **`audio.js`** `enableSound()` — never pass `null` context into **`ambient.startAmbient`** |

## Audio policy (important)

Browsers block `AudioContext` until a **user gesture**. Flow:

1. On load: no `AudioContext` yet — **`ambient`** must not allocate nodes.
2. User clicks 🔇/`sound-toggle`: **`audio.js`** creates context + `masterGain`, builds soundscape, then **`startAmbient(ctx, masterGain)`**.
3. Other systems (**weather** SFX, enhanced pickup pings) safely no-op when `getAudioContext()` is null.

## Post-processing & resize

`EffectComposer` + bloom + FXAA. **FXAA resolution uniforms** must follow window size → **`updateFxaaResolution()`** chained with **`resizeWeapon()`** from **`controls.setupResize`**.

## Polishing backlog (recommended)

- **Testing**: Add Vitest + jsdom smoke tests that import modules with mocked `THREE` Canvas, or Playwright screenshot tests for regressions.
- **Build**: Optional Vite to bundle/version assets and tree-shake; keep import-map build for fallback.
- **CSS**: Split `style.css` into `tokens.css` (variables) + partials imported via `@import` if file size grows further.
- **Types**: Incremental **`// @ts-check`** with JSDoc on `main.js` and game state objects.
- **Feature flags**: Optional `config.FEATURE_WEAPON` etc. if the “peaceful walk” SKU should hide shooting.

## Conventions

- **Magic numbers**: Prefer `config.js`.
- **New systems**: Export `create*` + `update*`; register `update*` exactly once inside `animate()` in the appropriate mode branch (cinematic / paused / photo / meditation / play).
- **DOM**: HUD IDs are the contract between `index.html` and `hud.js` — keep them stable or update both.
