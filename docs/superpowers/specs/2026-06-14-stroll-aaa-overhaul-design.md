# STROLL → "AAA-inspired, browser-native" — Design & Roadmap

_Date: 2026-06-14 · Branch: `feature/aaa-overhaul`_

## Vision

Transform STROLL from a fragile-feeling demo into a cohesive **stylized-realism**
open-world action sandbox that feels great to control, hits hard in combat, and
has a city that reacts to the player — running at ~60fps from gaming PCs down to
mid-range phones, with **zero asset downloads** (instant load from a URL).

GTA VI is the inspiration, not the literal target: true photoreal AAA fidelity is
not reachable in a browser. The win comes from strong, consistent art direction and
game-feel, not from chasing photorealism (which in-browser reads as worse, not better).

## Decisions (locked)

| Question | Decision |
|---|---|
| Online | **Browser single-player** — no backend; shareable URL. |
| Pillars | All four: visuals, movement/animation, combat/powers, world/gameplay. |
| Art direction | **Stylized realism**, scaled by quality tier. |
| Hardware | **Must run on phones/tablets** → disciplined perf budget, scalable quality. |
| Rebuild approach | **Incremental overhaul** — keep the good core, replace skin & feel phase-by-phase. |
| Models | **Upgraded procedural + real skeleton** — code-generated, PBR, skeletal animation. No downloads. |

## Guiding principles

1. **Keep the skeleton, replace the skin & feel.** The audit confirmed the architecture is sound.
2. **Game-feel first.** Screen shake, hit markers, impact VFX, acceleration curves.
3. **One scalable look, many tiers.** Never a separate ugly mobile build.
4. **Procedural everything, zero downloads.** Canvas textures, code-built models.
5. **Every phase ships.** No long "broken" windows; verify each phase by running the real game.

## Architecture

**Kept core:** entity-manager, physics, procedural city (instanced windows + merged geo),
object-pooled explosions, quality-tier system, state machine, config, wanted system.

**Deleted (Phase 0, verified unreachable from `index.html → main.js`):**
`js/weapon.js`, `js/events.js`, `js/input.js`, `js/game-state.js`, `js/interactive.js`,
`js/challenges.js`, `js/enhanced-collectibles.js`, `js/collectibles.js`, `js/spawn-utils.js`,
`js/focus-trap.js`, and 10 root scratch files (`debug-*.js`, `test_traffic*.js`, `patch.js`).
(Audit was wrong about `story.js`, `lofi.js`, `cinematic/meditation/minigames/photomode`
being dead — those ARE reachable and were kept. Code beats audit.)

**New modules:** `js/core/feel.js` (game-feel layer), and a `js/render/` layer to come
(PBR material library, procedural textures, post-FX pipeline, env map).

## Phases

- **Phase 0 — Cleanup & Foundation** ✅ _done_
  Deleted dead code; fixed a pre-existing `city.js` syntax error that blocked boot;
  built `js/core/feel.js` (damage numbers, hit markers, screen flash, hit-stop, shake
  routing, `impact()` helper) wired into `main.js` + `game-loop.js`; extended quality
  tiers (`ssao`, `postFxScale`, `vfxIntensity`, `maxParticles`, `maxActiveLights`,
  `materialTier`, LOD distances, `fpsCap`) + `vfxScale()`/`scaleCount()` helpers.
  Verified: game boots, menu → play renders city, feel layer functional, no console errors.

- **Phase 1 — Visual Overhaul** _(the "wow")_
  Exposure/tone/color-grade tune; Lambert→Standard PBR materials with per-district
  roughness/metalness; procedural canvas normal+roughness textures; SSAO (tier-gated);
  selective bloom via emissive lamps/windows/neon; sky + fog tune; PMREM env map for
  reflective puddles/glass; fresnel window glass.

- **Phase 2 — Movement, Animation & Camera** _(feels good to control)_
  Velocity-based movement w/ accel/decel, frame-rate independent; player skeleton +
  animation FSM (idle/walk/run/jump/aim/fall) with crossfades driven by velocity;
  procedural idle; camera smoothing + fixed rotation order + quaternion 3rd-person follow
  + recoil hook; better jump arc; delta-compensated touch look.

- **Phase 3 — Combat, Weapons & VFX** _(punchy)_
  Fix muzzle flash (bright, longer, emissive→bloom, muzzle light); impact system (decals,
  sparks, hit-markers, damage numbers, screen shake) via `feel.js`; rebuild weak powers
  (thick tube lightning, volumetric laser, longer blasts, real tornado, freeze shatter,
  geometry-aware fire); explosion polish; melee hit-stop. All VFX scaled by `vfxIntensity`.

- **Phase 4 — Living World & Gameplay** _(want to keep playing)_
  NPC panic/flee/scatter from gunfire (wire up unused `NPC_ALERT_RADIUS`) + dialogue;
  richer traffic (lanes, spacing, intersections); real enemy AI (implement dead
  `usesCover`/`flanks` + suppressive fire, retreat, squad leaders); vehicle feel (inertia,
  drift, damage states); city districts + landmarks + neon; mission variety + waypoint/
  minimap markers + wanted-level HUD.

- **Phase 5 — Mobile/Perf Hardening & Polish** _(runs everywhere)_
  Instancing/shared materials for NPCs/traffic/enemies; spatial-grid collision; static
  frustum culling + building LOD; per-tier post-FX render-scaling + adaptive quality;
  particle & path pooling; touch-UX polish, FPS cap, battery-aware quality; final QA across
  tiers + `vite build` → GitHub Pages deploy. (Re-enables render-scaled bloom on low tier.)

## Success criteria

- 60fps on desktop (high) and a mid-range phone (low); no GC stutter spikes.
- Unmistakable combat feedback on every shot/hit/kill.
- Movement has weight and a continuous animation loop (no T-pose snapping).
- Cohesive stylized-realism look with real depth (AO), reflections, lighting.
- The city visibly reacts to violence.
- Loads in a couple seconds from a URL with no asset downloads.

## Verification method

Each phase is verified by running the real game via a static server + headless browser
(`.claude/launch.json` → `preview_start`), capturing console errors and before/after
screenshots. Syntax-checked with `node --check` before browser runs.
