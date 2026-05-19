# 🌇 Stroll — A Peaceful City Walk

A calm, relaxing 3D browser walk through a procedurally generated city at golden hour. Built with **Three.js** and vanilla ES modules.

**Docs:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) · [`docs/FEATURES.md`](docs/FEATURES.md)

![Three.js](https://img.shields.io/badge/Three.js-0.160.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Quick start

**No install** — open `index.html` in a modern browser (Chrome, Firefox, Edge).

**With tooling:**

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
npm test         # Playwright smoke tests
```

Enable sound with **M** for the full ambient + lofi experience.

## Controls

| Key | Action |
|-----|--------|
| W A S D | Walk |
| Mouse | Look |
| Right click | Interact with flowers |
| P | Photo mode |
| N | Meditation |
| B | Ambient mood |
| J | Journal |
| R | Weather |
| G | Treasure hunt / breathing game |
| Esc | Pause |

Combat is **off by default**. Set `FEATURE_WEAPON = true` in `js/config.js` to enable shooting (left click).

## Highlights

- Procedural city, day/night cycle, NPCs, traffic, companion dog, wildlife
- Collectibles + enhanced pickups (gems, artifacts, notes)
- Achievements, waypoints, discovery journal
- Photo mode, meditation, dynamic rain
- Quality presets (auto low on mobile)
- Accessible pause/journal focus traps and reduced-motion support

## Deploy

GitHub Pages (project site): push to `main` — workflow builds with `BASE_PATH=/Stroll/` and deploys `dist/`.

Live: [neutral-Stage/Stroll](https://github.com/neutral-Stage/Stroll) (enable Pages → GitHub Actions in repo settings).

## Project structure

```
├── index.html
├── css/              Design tokens + HUD + overlays
├── js/
│   ├── main.js       Entry
│   ├── game-loop.js  Frame updates
│   ├── config.js     Tunables & feature flags
│   └── …             City, audio, collectibles, HUD, etc.
├── tests/            Playwright
└── docs/             Architecture & plan
```

## License

MIT — use and modify freely.

---

*There's nowhere to be. Just stroll.* 🌅
