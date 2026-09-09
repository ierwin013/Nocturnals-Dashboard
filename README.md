# Nocturnals-Dashboard

Nocturnals is a dark-themed daily production and performance dashboard for night-shift teams.

## Run locally

Open `https://ierwin013.github.io/Nocturnals-Dashboard/` in a browser.

Dashboard data loads from `data.json` so every visitor sees the same shared stats. The app still caches edits in browser `localStorage` for quick local access.

## Shared GitHub saves

GitHub Pages can read the shared `data.json` file directly, but writing back to the repository still requires an authorized GitHub user.

1. Open the dashboard and click **Shared Sync**.
2. Create a **fine-grained personal access token** for `ierwin013/Nocturnals-Dashboard`.
3. Grant the token **Contents: Read and write** permission for that repository only.
4. Paste the token into the dialog and save it for the current session or this device.
5. After that, stat changes will update `data.json` in the repository so the next GitHub Pages refresh shows the shared data to everyone.

When `data.json` changes on `main`, `.github/workflows/commit-data.yml` adds an `updatedAt` timestamp to the file and creates a follow-up commit with a UTC timestamp in the commit message.

## Deployment and cache behavior

- **Active deploy mechanism:** GitHub Pages should use **Deploy from a branch** with **`main` / (root)**.
- **Live URL:** `https://ierwin013.github.io/Nocturnals-Dashboard/`
- **Single publish path:** This repo does not include a Pages artifact/`gh-pages` deploy workflow. `.nojekyll` is included so root static files are served directly.
- **Cache-busting behavior:**
  - `index.html` adds no-cache meta directives.
  - `styles.css` and `script.js` are requested with a timestamp query string on each load.
  - `data.json` fetches use a timestamp query string plus `cache: 'no-store'` to reduce stale shared data views.
- **Workflow hygiene:** `commit-data.yml` uses `if: github.actor != 'github-actions[bot]'` to avoid recursive commit loops.

### Post-merge verification

1. Open the live URL and do a **hard refresh**.
2. Open the same URL in an **incognito/private** window.
3. Make a shared update and confirm the latest `updatedAt` timestamp in `data.json` changes on `main`.
4. Confirm roster/team-record updates appear quickly and that views are not stale due to cached assets/data.

### Security notes

- Never commit a token into the repository.
- Prefer a fine-grained token scoped to this single repository.
- Use **Remove token** in the dashboard if you no longer want this browser to publish updates.
