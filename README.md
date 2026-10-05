# Addy's Math Lab

A basketball-style arithmetic app in Minnesota Lynx colors. **Game** mode is four quarters of five shots (or two halves for a quick game): each shot is a problem with a hidden number, a swish (right on the first try) is 3 points, a make after a miss is 2, a make after "Show me how" is 1, and a miss is just a rebound. **Practice** mode is a hands-on lab for +, −, × and ÷: ten-frames, base-ten blocks with hundreds, arrays, an area model, sharing into groups, and a number line.

It's a Progressive Web App (PWA). Install it once on a tablet and it opens full-screen from the home screen, works offline, and updates itself whenever a new version is pushed.

**Live app:** https://jmerk-bot.github.io/addy-math-lab/

## Install on an Android tablet

1. Open the live app link in **Chrome** on the tablet.
2. Tap the **⋮** menu → **Add to home screen** → **Install**. (Chrome may also show an "Install app" banner.)
3. Open it from the **Math Lab** icon on the home screen.

## Playing

- **Game:** tap **Tip-off**, answer each shot on the number pad (or the big < = > keys for comparing) and tap ✓. The scoreboard shows points, the quarter and the shots left. Halftime comes in the middle, with a basketball to breathe along with and a tip from Coach Cheryl; the final buzzer shows a stat line, any plays that moved up a level, and the season record.
- **Plays:** each shot comes from one of thirteen plays: Equations, Big numbers, Leftovers, Fractions, Story shots, Place value, Measurement, Times as many, Round & compare, Area & perimeter, Leftover stories, Two-step plays and Angles. Story shots have a 🔊 button that reads them aloud.
- **The training path:** a new install starts with Equations; the other plays unlock one at a time, in that order, when shots are going well (70% swishes over the last 40 shots, the newest play steady, and at least two games since the last new play). A new play starts with a worked example from Coach Cheryl at tip-off, then appears just twice, mid-game, in its first game.
- **Difficulty moves in small steps, per play:** three swishes in a row move a play up a step; two put-backs in a row move it down a step, quietly. Every game opens and closes with a familiar shot, and after a rough patch the next shot or two are familiar too.
- **Help is always there:** **Go Practice This Play** builds the shot in Practice, or opens a picture of it (which can also send it to Practice). **Ask Coach Cheryl** gives a hint, then a bit more, then **Show me how**, a worked example step by step; the shot is still worth 1 after that.
- **Film room 🎬:** after the final buzzer, each shot that needed a rebound, worked through. Nothing there is scored.
- **Change the Game** (top right), for the grown-up: **Playbook** (camps, the training path with each play's level, unlocking a play early, the operations Equations uses), **Stats** (a shot chart by kind of play, this week, the season) and **Settings** (full or quick game, automatic difficulty and new plays, sounds, read-aloud, and a base level for every play).

## How updates reach the tablet

- Pushing to `main` deploys automatically through GitHub Actions (`.github/workflows/deploy.yml`) in about a minute.
- When the app opens, or comes back to the foreground, it checks for a newer version and reloads itself. Settings, progress on every play, the Practice numbers, a game in progress and the season record are saved and come back after the reload.
- The version number is in tiny text at the bottom of the screen. Use it to check which version the tablet is running.
- Offline, the app runs from the last version it downloaded.

## Run it locally

No build step and no dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8766
```

Then open http://localhost:8766. The footer shows `dev` locally. A computer keyboard works in the Game: digits, Backspace, ← → between answer boxes, and Enter to shoot or move on.

Before deploying a change to the plays or the coach, run the checks (needs Node 22 or newer). They generate thousands of shots from every play and level, and play simulated seasons through the real game code:

```bash
node scripts/check-plays.mjs
```

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup, including the footer disclaimer. Buttons use `data-action` / `data-value` instead of inline handlers. |
| `css/styles.css` | All styles. Colors are CSS variables at the top. |
| `js/main.js` | Entry point: wires buttons and keys, switches Game / Practice, boots the app. |
| `js/game.js` | Game flow: shots, the number pad and answer boxes, the help ladder, scoring, quarters, halftime and the final. |
| `js/coach.js` | The coach: per-play difficulty, unlocking new plays, and choosing each shot (warm-ups, closers, variety). |
| `js/plays.js` | The playbook: every play in path order, shot-chart zones, camps. |
| `js/play-numbers.js` | Equations, Big numbers, Leftovers. |
| `js/play-fractions.js` | Fractions. |
| `js/play-stories.js` | Story shots, Times as many, Leftover stories, Two-step plays. |
| `js/play-placevalue.js` | Place value, Round & compare. |
| `js/play-measure.js` | Measurement, Area & perimeter, Angles. |
| `js/visuals.js` | Pictures of the math: Practice manipulatives and the boards (bar models, tape diagrams, place-value charts, fraction bars, shapes). |
| `js/sheets.js` | Sheets over the game: Coach's board, Show me how, new-play intros, the film room. |
| `js/panel.js` | The "Change the Game" panel: playbook, stats and shot chart, settings. |
| `js/lab.js` | Practice: steppers, the manipulative, the number line. |
| `js/lab-limits.js` | Practice's limits for A and B. |
| `js/state.js` | Shared state, and save/restore via `localStorage` (with migration from older saves). |
| `js/kit.js` | Helpers for the plays: levels, random picks, number words. |
| `js/math.js` | Number helpers: operations, `compute()`, and `fmt()` for commas. |
| `js/lines.js` | The announcer's lines for makes, misses, assists, streaks and the final headline. |
| `js/audio.js` | Web Audio tones (an ascending pentatonic scale), the success chord, the final horn, and read-aloud. |
| `js/pwa.js` | Service worker registration, fullscreen, and the update check. |
| `js/version.js` | Version placeholder, stamped at deploy time. |
| `sw.js` | Service worker: network-first with offline fallback. |
| `manifest.webmanifest` | App name, colors, icons. |
| `img/lynx-logo.svg` | Team logo in the header (from Wikipedia; see the disclaimer). |
| `icons/` | `icon.svg` / `icon-maskable.svg` sources plus rendered PNGs. |
| `scripts/make-icons.sh` | Re-renders the PNG icons from the SVGs (needs Google Chrome). |
| `scripts/check-plays.mjs` | Checks every play and simulates seasons through the coach (needs Node). |

## Making changes

- **Adding a new file the app loads** (a new JS module, image, sound, font): also add it to `APP_SHELL` in `sw.js` so it's available offline.
- **Changing the icon:** edit `icons/icon.svg` and `icons/icon-maskable.svg`, then run `scripts/make-icons.sh`. Android caches home-screen icons, so the tablet may keep the old icon until the app is reinstalled.
- **Changing the name or colors on the home screen:** edit `manifest.webmanifest`.
- **Changing the announcer's lines:** edit `js/lines.js`.
- **Changing difficulty:** each play's ranges per level are the `…_RANGES` tables in its `js/play-*.js` file; the pacing rules (steps, unlocks, warm-ups) are constants at the top of `js/coach.js`. Keep Practice's `limits()` in `js/lab-limits.js` wide enough for the ranges, and run `node scripts/check-plays.mjs`.
- **Adding a play:** write it in a `js/play-*.js` file (see the list of what a play provides at the top of `js/plays.js`), add it to `PLAYS` in path order, give it a zone and camp, add the file to `APP_SHELL`, and run the checks.
- Leave the `__APP_VERSION__` placeholders in `sw.js` and `js/version.js` alone. The deploy workflow fills them in.
