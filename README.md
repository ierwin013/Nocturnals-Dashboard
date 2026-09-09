# Nocturnals-Dashboard

Nocturnals is a dark-themed daily production and performance dashboard for night-shift teams.

## Run locally

Open `https://ierwin013.github.io/Nocturnals-Dashboard/` in a browser.

Dashboard edits are stored in that browser's `localStorage`. The bundled `data.json` file is only used as a starting snapshot when no local dashboard data exists yet.

## Deployment and cache behavior

- **Active deploy mechanism:** GitHub Pages should use **Deploy from a branch** with **`main` / (root)**.
- **Live URL:** `https://ierwin013.github.io/Nocturnals-Dashboard/`
- **Single publish path:** This repo does not include a Pages artifact/`gh-pages` deploy workflow. `.nojekyll` is included so root static files are served directly.
- **Cache-busting behavior:**
  - `index.html` adds no-cache meta directives.
  - `styles.css` and `script.js` are requested with a timestamp query string on each load.
  - `data.json` is fetched with a timestamp query string plus `cache: 'no-store'` during first-load bootstrap.
- **Workflow hygiene:** `commit-data.yml` uses `if: github.actor != 'github-actions[bot]'` to avoid recursive commit loops when `data.json` is updated in the repository.

### Post-merge verification

1. Open the live URL and do a **hard refresh**.
2. Open the same URL in an **incognito/private** window.
3. Clear site storage or open the site in a fresh private window to confirm `data.json` still seeds the dashboard on first load.
4. Confirm roster/team-record updates persist locally and that views are not stale due to cached assets/data.

### Security notes

- Do not commit browser-exported dashboard data or other sensitive local notes into the repository unintentionally.
