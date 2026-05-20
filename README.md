# Stroll

A browser-based evening walk through a procedural city. Three.js, Web Audio, no framework.

**Documentation:** [Architecture](docs/ARCHITECTURE.md) · [Plan](docs/PROJECT_PLAN.md) · [Features](docs/FEATURES.md)

## Run locally

```bash
# Static (no build)
open index.html

# Dev server
npm install
npm run dev

# Production build + tests
npm run build
npm test
```

Enable audio with **M** after the page loads (browser autoplay policy).

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse | Look (pointer lock) |
| RMB | Interact with flowers |
| P | Photo mode |
| N | Rest / breathing |
| B | Cycle ambience |
| J | Journal |
| R | Rain toggle |
| G | Activity (treasure or breathing) |
| Esc | Pause |

Combat is disabled by default. Set `FEATURE_WEAPON = true` in `js/config.js` to enable.

## Stack

- Three.js r160 (ES modules)
- Optional Vite build for deployment
- Playwright smoke tests in CI

## Deploy

GitHub Pages workflow publishes `dist/` at `/Stroll/` when `main` is pushed. Enable **Pages → GitHub Actions** in repository settings.

## License

MIT
