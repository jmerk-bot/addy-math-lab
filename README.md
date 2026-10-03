# Addy's Math Lab

A visual, hands-on arithmetic app: ten-frames, arrays, equal-sharing buckets and a number line for +, −, × and ÷, plus "Mystery Quest" problems with one hidden number.

It's a Progressive Web App (PWA). Install it once on a tablet and it opens full-screen from the home screen, works offline, and updates itself whenever a new version is pushed.

**Live app:** https://jmerk-bot.github.io/addy-math-lab/

## Install on an Android tablet

1. Open the live app link in **Chrome** on the tablet.
2. Tap the **⋮** menu → **Add to home screen** → **Install**. (Chrome may also show an "Install app" banner.)
3. Open it from the **Math Lab** icon on the home screen.

## How updates reach the tablet

- Pushing to `main` deploys automatically through GitHub Actions (`.github/workflows/deploy.yml`) in about a minute.
- When the app opens, or comes back to the foreground, it checks for a newer version and reloads itself. The Lab settings and any unsolved quest are saved and come back after the reload.
- The version number is in tiny text at the bottom of the screen. Use it to check which version the tablet is running.
- Offline, the app runs from the last version it downloaded.

## Run it locally

No build step and no dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8766
```

Then open http://localhost:8766. The footer shows `dev` locally.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup. Buttons use `data-action` / `data-value` instead of inline handlers. |
| `css/styles.css` | All styles. Colors are CSS variables at the top. |
| `js/main.js` | Entry point: wires buttons, switches Explore / Mystery Quest, boots the app. |
| `js/lab.js` | Explore Lab: limits, steppers, ten-frames, arrays, sharing buckets, number line. |
| `js/quest.js` | Mystery Quest: problem generator, answer checking. |
| `js/state.js` | Shared state, `compute()`, and save/restore via `localStorage`. |
| `js/audio.js` | Web Audio tones (an ascending pentatonic scale) and the success chord. |
| `js/pwa.js` | Service worker registration and the update check. |
| `js/version.js` | Version placeholder, stamped at deploy time. |
| `sw.js` | Service worker: network-first with offline fallback. |
| `manifest.webmanifest` | App name, colors, icons. |
| `icons/` | `icon.svg` / `icon-maskable.svg` sources plus rendered PNGs. |
| `scripts/make-icons.sh` | Re-renders the PNG icons from the SVGs (needs Google Chrome). |

## Making changes

- **Adding a new file the app loads** (a new JS module, image, sound, font): also add it to `APP_SHELL` in `sw.js` so it's available offline.
- **Changing the icon:** edit `icons/icon.svg` and `icons/icon-maskable.svg`, then run `scripts/make-icons.sh`. Android caches home-screen icons, so the tablet may keep the old icon until the app is reinstalled.
- **Changing the name or colors on the home screen:** edit `manifest.webmanifest`.
- Leave the `__APP_VERSION__` placeholders in `sw.js` and `js/version.js` alone. The deploy workflow fills them in.
