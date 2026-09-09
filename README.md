# Nocturnals-Dashboard

Nocturnals is a dark-themed daily production and performance dashboard for night-shift teams.

## Run locally

Open `https://ierwin013.github.io/Nocturnals-Dashboard/` in a browser.

Dashboard edits are saved to Firebase Realtime Database when Firebase is configured, with localStorage retained as offline fallback. If Firebase is unavailable or not configured, the dashboard continues in localStorage-only mode. The bundled `data.json` file is still used as a starting snapshot when no saved dashboard data exists yet.

## Enable real-time sync (Firebase Realtime Database)

1. Create a Firebase project and enable **Realtime Database**.
2. In your page bootstrap (before `script.js` runs), define `window.__FIREBASE_CONFIG` with your Firebase web app config:

```html
<script>
  window.__FIREBASE_CONFIG = {
    apiKey: '...',
    authDomain: '...',
    databaseURL: '...',
    projectId: '...',
    appId: '...'
  };
  window.__FIREBASE_DB_PATH = 'nocturnals-dashboard/state'; // optional override
</script>
```

When configured, dashboard changes (goals, roster, records, metrics) sync through Firebase in real time to all connected clients, while still writing to localStorage for graceful offline behavior.

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
