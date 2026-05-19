# Stroll — product & engineering plan

## Vision

A **calm 3D city walk** in the browser: exploration first, optional playful systems (collectibles, photo mode, meditation, light combat). The frontend should feel **cohesive** (one visual language, one progress model) and **reliable** (no init crashes, achievements that match player actions).

## Current architecture (summary)

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for module map and runtime flow.

| Layer | Responsibility |
|-------|----------------|
| `index.html` | DOM shells for HUD, overlays, import map (dev) |
| `css/` partials | Theme tokens + component styles |
| `js/config.js` | Tunables + feature flags |
| `js/game-state.js` | Session flags + stats builders |
| `js/game-loop.js` | Per-frame update branches |
| `js/main.js` | Boot, scene setup, wiring |
| Feature modules | `create*` at init, `update*` in `tick()` |

## Phase 1 — Integration & correctness ✅

- [x] ES module boot timing, WebGL guard, single Three.js import map
- [x] Audio only after user gesture; ambient deferred
- [x] Unified pickup counts + score for HUD / Completionist
- [x] FXAA resize with window
- [x] `game-state.js` for shared session stats
- [x] Achievements: First Steps after intro; Photographer on photo mode entry
- [x] Pause menu live stats
- [x] CSS design tokens

## Phase 2 — Frontend polish ✅

- [x] Split `style.css` into partials (`base`, `hud`, `overlays`, `reduced-motion`)
- [x] Mini-game UI uses `#minigame-ui` CSS classes
- [x] Focus trap in journal / pause (`focus-trap.js`)
- [x] `prefers-reduced-motion` for breathing guide & toasts
- [x] Loading error state with **Try again** when WebGL fails

## Phase 3 — Gameplay fit & performance ✅

- [x] Walkable spawn helpers (`spawn-utils.js`) for collectibles / pickups
- [x] Quality presets (`quality.js`) — shadows, bloom, FXAA, particles, NPC count
- [x] Traffic / wildlife distance culling from quality preset
- [x] Feature flags: `FEATURE_WEAPON` (peaceful default), `FEATURE_MINIGAMES`
- [x] `canPlayerAct` / `canPlayerMove` guards (`player-input.js`)
- [x] Central input bindings (`input.js`), thin `main.js`, `game-loop.js`
- [x] Ambient mood cycle (**B** key)

## Phase 4 — Quality & shipping ✅

- [x] Playwright smoke tests (canvas + pause menu)
- [x] Vite production build (`npm run build`) with `three` dependency
- [x] GitHub Actions CI + Pages deploy (`BASE_PATH=/Stroll/`)
- [x] README + architecture docs synced with peaceful default

## Definition of “done” for integration

1. **One score** — orbs/crystals/stars + enhanced bonuses → HUD ✨  
2. **One collectible counter** — standard + enhanced → HUD 💎 and achievements  
3. **Achievements** — unlock only when described action happens  
4. **Audio** — never touches `AudioContext` before user enables sound  
5. **Resize** — composer, FXAA, weapon overlay stay aligned  
6. **Pause / journal** — show real session numbers  

## Maintenance rules

- New feature → `create` + `update` + register in `game-loop.tick` in the correct mode branch  
- New UI → id in `index.html` + styles in `css/` + logic in `hud.js` or feature module  
- New tunable → `config.js`  
- New progress flag → `game-state.js`  
- Cross-module hooks → `events.js` (`Events.PICKUP`, etc.)

## Optional next steps

- Finish remaining mini-games (memory, rhythm, constellation) or remove dead code
- URL query `?quality=low|medium|high` override
- Service worker / offline shell for PWA
- Bundle size: code-split weapon module when `FEATURE_WEAPON` is false
