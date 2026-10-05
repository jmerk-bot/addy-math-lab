# Addy's Math Lab

A basketball-style arithmetic app in Minnesota Lynx colors. **Game** mode is four quarters of five shots: each shot is a problem with a hidden number, a swish (right on the first try) is 3 points, a make after a miss is 2, and a miss is just a rebound. **Practice** mode is a hands-on lab for +, −, × and ÷: ten-frames, base-ten blocks with hundreds, arrays, an area model, sharing into groups, and a number line.

It's a Progressive Web App (PWA). Install it once on a tablet and it opens full-screen from the home screen, works offline, and updates itself whenever a new version is pushed.

**Live app:** https://jmerk-bot.github.io/addy-math-lab/

## Install on an Android tablet

1. Open the live app link in **Chrome** on the tablet.
2. Tap the **⋮** menu → **Add to home screen** → **Install**. (Chrome may also show an "Install app" banner.)
3. Open it from the **Math Lab** icon on the home screen.

## Playing

- **Game:** tap **Tip-off**, answer each shot on the number pad and tap ✓. The scoreboard shows points, the quarter and the shots left. Halftime comes after the second quarter; the final buzzer shows a stat line and the season record (games, points, season high).
- **Plays:** each shot comes from one of the plays in the playbook. **Equations** are facts with the missing number in any spot (`? + 38 = 85`). **Big numbers** are 2- and 3-digit + and − with regrouping and multi-digit × (`215 × 8`). **Leftovers** are division with a remainder, answered in two boxes (`32 ÷ 5 = 6 R 2`); ✓ moves from the first box to the second. Every game opens with an Equations shot as a warm-up.
- **Need a look?** sends the current shot to Practice with the hidden number left blank, so it can be built with the blocks, then it's back to the game to shoot.
- **Ask Coach Cheryl** (top right) sets the level (Rookie, Starter, All-Star, MVP), which plays are in the playbook, which operations Equations uses, and can reset the season.

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

Then open http://localhost:8766. The footer shows `dev` locally. A computer keyboard works in the Game: digits, Backspace, ← → between answer boxes, and Enter to shoot or move on.

Before deploying a change to the plays, run the generator check (needs Node 22 or newer):

```bash
node scripts/check-plays.mjs
```

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup, including the footer disclaimer. Buttons use `data-action` / `data-value` instead of inline handlers. |
| `css/styles.css` | All styles. Colors are CSS variables at the top. |
| `js/main.js` | Entry point: wires buttons, switches Game / Practice, runs the Coach panel, boots the app. |
| `js/game.js` | Game: shots from the playbook, the number pad and answer boxes, scoring, quarters, halftime and the final. |
| `js/plays.js` | The plays (Equations, Big numbers, Leftovers): ranges per level, problem generators, prompts, answers, and the Practice hand-off. |
| `js/lines.js` | The announcer's lines for makes, misses, streaks and the final headline. |
| `js/lab.js` | Practice: limits, steppers, ten-frames, base-ten blocks, arrays, the area model, sharing, number line. |
| `js/state.js` | Shared state, and save/restore via `localStorage`. |
| `js/math.js` | Number helpers: operations, `compute()`, and `fmt()` for commas. |
| `js/audio.js` | Web Audio tones (an ascending pentatonic scale), the success chord and the buzzer. |
| `js/pwa.js` | Service worker registration, fullscreen, and the update check. |
| `js/version.js` | Version placeholder, stamped at deploy time. |
| `sw.js` | Service worker: network-first with offline fallback. |
| `manifest.webmanifest` | App name, colors, icons. |
| `img/lynx-logo.svg` | Team logo in the header (from Wikipedia; see the disclaimer). |
| `icons/` | `icon.svg` / `icon-maskable.svg` sources plus rendered PNGs. |
| `scripts/make-icons.sh` | Re-renders the PNG icons from the SVGs (needs Google Chrome). |
| `scripts/check-plays.mjs` | Generates thousands of shots from every play and level and checks them (needs Node). |

## Making changes

- **Adding a new file the app loads** (a new JS module, image, sound, font): also add it to `APP_SHELL` in `sw.js` so it's available offline.
- **Changing the icon:** edit `icons/icon.svg` and `icons/icon-maskable.svg`, then run `scripts/make-icons.sh`. Android caches home-screen icons, so the tablet may keep the old icon until the app is reinstalled.
- **Changing the name or colors on the home screen:** edit `manifest.webmanifest`.
- **Changing the announcer's lines:** edit `js/lines.js`.
- **Changing difficulty:** each play's ranges per level are tables near the top of its section in `js/plays.js`. Keep Practice's `limits()` in `js/lab.js` wide enough for them, and run `node scripts/check-plays.mjs`.
- Leave the `__APP_VERSION__` placeholders in `sw.js` and `js/version.js` alone. The deploy workflow fills them in.
