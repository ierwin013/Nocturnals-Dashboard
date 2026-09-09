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

### Security notes

- Never commit a token into the repository.
- Prefer a fine-grained token scoped to this single repository.
- Use **Remove token** in the dashboard if you no longer want this browser to publish updates.
