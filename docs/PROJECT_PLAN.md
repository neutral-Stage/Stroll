# Stroll — product & engineering plan

## Vision

A **calm 3D city walk** in the browser: exploration first, optional playful systems (collectibles, photo mode, meditation, light combat). The frontend should feel **cohesive** (one visual language, one progress model) and **reliable** (no init crashes, achievements that match player actions).

## Current architecture (summary)

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for module map and runtime flow.

| Layer | Responsibility |
|-------|----------------|
| `index.html` | DOM shells for HUD, overlays, import map |
| `css/tokens.css` + `css/style.css` | Theme tokens + component styles |
| `js/config.js` | Tunables |
| `js/game-state.js` | Session flags + stats builders for challenges / pause |
| `js/main.js` | Boot, loop, wiring |
| Feature modules | `create*` at init, `update*` in `animate()` |

## Phase 1 — Integration & correctness ✅ (in progress)

- [x] ES module boot timing, WebGL guard, single Three.js import map
- [x] Audio only after user gesture; ambient deferred
- [x] Unified pickup counts + score for HUD / Completionist
- [x] FXAA resize with window
- [x] `game-state.js` for shared session stats
- [x] Achievements: First Steps after intro; Photographer on photo mode entry
- [x] Pause menu live stats
- [x] CSS design tokens

## Phase 2 — Frontend polish ✅

- [x] Split `style.css` into `base.css`, `hud.css`, `overlays.css`, `reduced-motion.css` (keep `tokens.css`)
- [x] Mini-game UI uses `#minigame-ui` CSS classes (no inline panel styles)
- [x] Focus trap in journal / pause (`focus-trap.js`)
- [x] `prefers-reduced-motion` for breathing guide & toasts (`accessibility.js` + CSS)
- [x] Loading error state with **Try again** (reload) when WebGL fails

## Phase 3 — Gameplay fit & performance

- [ ] Spawn collectibles only on walkable tiles (`isInsideBuilding` + park rules)
- [ ] NPC / traffic culling already partial — profile on low-end mobile
- [ ] Optional quality preset in `config` (shadow size, bloom, particle counts)
- [ ] Feature flag: hide weapon UI for “peaceful only” builds

## Phase 4 — Quality & shipping

- [ ] Playwright: load page, no console errors, canvas visible
- [ ] Optional Vite build for production CDN pinning
- [ ] GitHub Pages / static deploy script
- [ ] Keep README controls table in sync with `index.html` hints

## Definition of “done” for integration

1. **One score** — orbs/crystals/stars + enhanced bonuses → HUD ✨  
2. **One collectible counter** — standard + enhanced → HUD 💎 and achievements  
3. **Achievements** — unlock only when described action happens  
4. **Audio** — never touches `AudioContext` before user enables sound  
5. **Resize** — composer, FXAA, weapon overlay stay aligned  
6. **Pause / journal** — show real session numbers  

## Maintenance rules

- New feature → `create` + `update` + register in `main.animate` in the correct mode branch  
- New UI → id in `index.html` + styles in `css/` + logic in `hud.js` or feature module  
- New tunable → `config.js`  
- New progress flag → `game-state.js`
