# Addy's Math Lab

A basketball-style arithmetic app in Minnesota Lynx colors. **Game** mode is four quarters of five shots: each shot is a problem with one hidden number, a swish (right on the first try) is 3 points, a make after a miss is 2, and a miss is just a rebound. **Practice** mode is a hands-on lab: ten-frames, base-ten blocks, arrays, equal-sharing buckets and a number line for +, −, × and ÷.

It's a Progressive Web App (PWA). Install it once on a tablet and it opens full-screen from the home screen, works offline, and updates itself whenever a new version is pushed.

**Live app:** https://jmerk-bot.github.io/addy-math-lab/

## Install on an Android tablet

1. Open the live app link in **Chrome** on the tablet.
2. Tap the **⋮** menu → **Add to home screen** → **Install**. (Chrome may also show an "Install app" banner.)
3. Open it from the **Math Lab** icon on the home screen.

## Playing

- **Game:** tap **Tip-off**, answer each shot on the number pad and tap ✓. The scoreboard shows points, the quarter and the shots left. Halftime comes after the second quarter; the final buzzer shows a stat line and the season record (games, points, season high).
- **Need a look?** sends the current shot to Practice with the hidden number left blank, so it can be built with the blocks, then it's back to the game to shoot.
- **Ask Coach Cheryl** (top right) sets the level (Rookie: within 20 and facts to 5; Starter: within 50 and facts to 10; All-Star: within 100 and facts to 12), which operations the game uses, and can reset the season.

## How updates reach the tablet

- Pushing to `main` deploys automatically through GitHub Actions (`.github/workflows/deploy.yml`) in about a minute.
- When the app opens, or comes back to the foreground, it checks for a newer version and reloads itself. Settings, the Practice numbers, a game in progress and the season record are saved and come back after the reload.
- The version number is in tiny text at the bottom of the screen. Use it to check which version the tablet is running.
- Offline, the app runs from the last version it downloaded.

## Run it locally

No build step and no dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8766
```

Then open http://localhost:8766. The footer shows `dev` locally. A computer keyboard works in the Game: digits, Backspace, and Enter to shoot or move on.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup, including the footer disclaimer. Buttons use `data-action` / `data-value` instead of inline handlers. |
| `css/styles.css` | All styles. Colors are CSS variables at the top. |
| `js/main.js` | Entry point: wires buttons, switches Game / Practice, runs the Coach panel, boots the app. |
| `js/game.js` | Game: problem generator by level, scoring, quarters, halftime and the final. |
| `js/lines.js` | The announcer's lines for makes, misses, streaks and the final headline. |
| `js/lab.js` | Practice: limits, steppers, ten-frames, base-ten blocks, arrays, sharing buckets, number line. |
| `js/state.js` | Shared state, levels, `compute()`, and save/restore via `localStorage`. |
| `js/audio.js` | Web Audio tones (an ascending pentatonic scale), the success chord and the buzzer. |
| `js/pwa.js` | Service worker registration, fullscreen, and the update check. |
| `js/version.js` | Version placeholder, stamped at deploy time. |
| `sw.js` | Service worker: network-first with offline fallback. |
| `manifest.webmanifest` | App name, colors, icons. |
| `img/lynx-logo.svg` | Team logo in the header (from Wikipedia; see the disclaimer). |
| `icons/` | `icon.svg` / `icon-maskable.svg` sources plus rendered PNGs. |
| `scripts/make-icons.sh` | Re-renders the PNG icons from the SVGs (needs Google Chrome). |

## Making changes

- **Adding a new file the app loads** (a new JS module, image, sound, font): also add it to `APP_SHELL` in `sw.js` so it's available offline.
- **Changing the icon:** edit `icons/icon.svg` and `icons/icon-maskable.svg`, then run `scripts/make-icons.sh`. Android caches home-screen icons, so the tablet may keep the old icon until the app is reinstalled.
- **Changing the name or colors on the home screen:** edit `manifest.webmanifest`.
- **Changing the announcer's lines:** edit `js/lines.js`.
- Leave the `__APP_VERSION__` placeholders in `sw.js` and `js/version.js` alone. The deploy workflow fills them in.
