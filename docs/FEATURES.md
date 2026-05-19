# Stroll — feature reference

Quick reference for players and maintainers. Default build is **peaceful** (`FEATURE_WEAPON = false` in `config.js`).

## Controls

| Key | Action |
|-----|--------|
| W A S D / arrows | Walk |
| Mouse | Look (click to lock pointer) |
| Right click | Bloom nearby flowers |
| M | Toggle ambient sound |
| P | Photo mode (orbit, filters, screenshot) |
| N | Meditation / breathing |
| B | Cycle ambient mood (calm → nature → meditative → dreamy) |
| J | Discovery journal |
| R | Toggle rain |
| G | Treasure hunt or breathing mini-game (random) |
| Esc | Pause (or close journal) |

When `FEATURE_WEAPON` is `true`: left click shoots; ammo HUD appears.

## Mini-games

Only **treasure hunt** and **breathing** are fully wired in the update loop. Press **G** again to end and see your score.

## Achievements

Tracked in `challenges.js` using stats from `game-state.js` (distance, night seen, photos, flowers, collectibles, waypoints).

## Build & deploy

```bash
npm install
npm run dev          # Vite dev server
npm run build        # dist/ for static hosting
BASE_PATH=/Stroll/ npm run build   # GitHub Pages (neutral-Stage/Stroll)
npm test             # Playwright smoke tests
```

Raw `index.html` still works without a build (CDN import map for Three.js).

## Feature flags (`config.js`)

| Flag | Default | Effect |
|------|---------|--------|
| `FEATURE_WEAPON` | `false` | FPS weapon, destructibles, ammo pickups |
| `FEATURE_MINIGAMES` | `true` | **G** key treasure / breathing |
