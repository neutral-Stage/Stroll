# Stroll — feature reference

Default build: `FEATURE_WEAPON = false`, `FEATURE_MINIGAMES = true` in `config.js`.

## Movement tuning (units per second)

| Entity | Speed |
|--------|-------|
| Player | ~1.8 |
| NPCs | 1.0–1.5 |
| Traffic | ~1.2–2.2 |
| Dog | ~2.0 |

NPCs use distance-based pathing (no segment sprinting). Traffic respawns off-screen, not beside the player.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look (pointer lock) |
| RMB | Flowers |
| M | Sound |
| P | Photo |
| N | Rest |
| B | Ambience preset |
| J | Journal |
| R | Rain |
| G | Activity |
| Esc | Pause / close journal |

## Build

```bash
npm install
npm run dev
npm run build
BASE_PATH=/Stroll/ npm run build   # GitHub Pages
npm test
```

Unbundled `index.html` remains valid for static hosting via the import map.
