# Addy's Math Lab

Basketball-style arithmetic PWA for a young learner, installed on an Android tablet and hosted on GitHub Pages at https://jmerk-bot.github.io/addy-math-lab/. See README.md for the layout, install steps and how the game works. Personal context about the learner is in CLAUDE.local.md (gitignored, since this repo is public).

It started as a copy of `felix-math-lab` (a sibling app in `~/code/felix-math-lab`) and has since been redesigned around a Minnesota Lynx theme: black and green with pink accents, a Game with an announcer, thirteen kinds of shots on a training path, and a Practice lab. Changes made here don't carry over to the other app, and vice versa.

## Shared origin: keep storage names unique

Both apps are served from `https://jmerk-bot.github.io`, so they share the same localStorage and Cache Storage. Everything this app stores is prefixed `addy-math-lab` (the `STORAGE_KEY` in `js/state.js`, currently `addy-math-lab:v4`, and the `CACHE` name in `sw.js`). The service worker deletes only old caches with that prefix. Never broaden that cleanup or the prefix, or this app could wipe the other app's offline copy and saved state on a shared device. If the saved-state layout changes, bump the key's version, add the old key to `OLD_KEYS` (cleared once the new key is saved), and migrate the old data the way `fromV3()` does, so progress and the season record survive the update.

## Design rules: calm, progressive, predictable

These are why the coach works the way it does. Keep them when changing anything (CLAUDE.local.md says why they matter here):

- **Progressive:** one new play at a time along the path, each introduced with a worked example, and only a couple of mid-game shots in its first game. Difficulty moves in small steps (tiers inside levels), up after a streak and quietly down after struggles. Level-ups get celebrated at the final buzzer; step-downs are never announced.
- **Predictable:** every game opens and closes with a familiar shot; the pregame card lists today's plays and says when a new one is coming; the final screen says when one has unlocked.
- **Always a way forward:** misses are rebounds; hints are free; "Show me how" still scores. No timers, shot clocks or penalties, and nothing that frames a miss as failure.
- **Calm:** soft sounds (and a switch to turn them off), a breathing ball at halftime, a quick-game option, one thing per screen.

## Conventions

- No build step, no dependencies, no frameworks. Plain HTML, CSS and ES modules. Keep it that way unless asked.
- Every path must be **relative** (`./sw.js`, `css/styles.css`), because the site is served from `/addy-math-lab/`, not the domain root.
- Two modes: `game` (`js/game.js`) and `lab`, shown as **Practice** (`js/lab.js`). The grown-up's settings live in the **Change the Game** panel (`js/panel.js`; its element and actions are still named `coach`). On a shot, **Ask Coach Cheryl** is the help ladder: a hint, a bit more, then "Show me how".
- **Plays** (`PLAYS` in `js/plays.js`, in path order) are the kinds of shots. The comment at the top of `js/plays.js` lists what a play provides (`generate`, `boxes`, `answers`, `prompt`, `text`, `hint`, `steps`, and optionally `input`, `equation`, `board`, `toLab`, `followUp`, `stepLabel`, `speech`). Problems are plain data so a shot survives a reload; generators never touch the DOM. Plays live in `js/play-numbers.js`, `js/play-fractions.js`, `js/play-stories.js`, `js/play-placevalue.js` and `js/play-measure.js`.
- **The coach** (`js/coach.js`, pure functions) owns pacing: per-play `level` and `tier` in `state.progress[id]` (three swishes in a row → up a step, two put-backs → down), unlocking (`readyForNewPlay`), and choosing each shot (`chooseShot`: familiar warm-ups and closers, calm-down shots after a rough patch, at most two story shots per quarter, two-step plays inside one quarter, no play three times running). Its constants are at the top of the file.
- Levels (`LEVELS` in `js/kit.js`: rookie, starter, allstar, mvp) pick each play's ranges from its `…_RANGES` table; tiers 0–2 mix in the next level's ranges (MVP's next is `stretch`). `state.level` is the base level; new plays start one level below it.
- Buttons declare `data-action` (and optionally `data-value`). Handlers live in the `actions` map in `js/main.js` (the Change the Game panel's actions come from `coachActions` in `js/panel.js`), and state is saved after every action.
- Rendering is state-driven: change `state`, then call `renderGame()` / `renderLab()`. Numbers of 1,000 and up are shown with commas through `fmt()` (`js/math.js`).
- Pictures of the math are pure HTML builders in `js/visuals.js`, shared by Practice and the sheets (`js/sheets.js`: Coach's board, Show me how, new-play intros, the film room).
- Show or hide elements with the `hidden` attribute. CSS has `[hidden] { display: none !important; }`.
- Subtraction is stored as `'-'` but always displayed via `OP_LABEL` (`−`).
- Color coding is part of the teaching and should stay consistent: blue = A / first number, amber = B / second number and remainders, pink = target/answer, grey = taken away, Lynx green = UI accent and success.
- Game scoring: swish (first try) = 3, make after a miss = 2, make after "Show me how" = 1; a miss keeps the same shot. `SHOTS_PER_QUARTER` and `LENGTHS` (full: 4 quarters, quick: 2 halves) are in `js/state.js`. The announcer's lines are in `js/lines.js`; keep them encouraging.
- Word problems (`reading: true` plays) stay at most 25 words (32 for two-step plays), use the cast's names rather than pronouns, and color the numbers like the equation.
- Practice limits in `limits()` (`js/lab-limits.js`) cover every shot a play can send there (+ to 1,000, − from up to 1,000, × up to 999 × 12 or 99 × 99, ÷ up to 999 ÷ 12). `scripts/check-plays.mjs` checks that.
- Practice shows ten-frames for + and − up to 20 and base-ten blocks (flats, rods, ones; "make a ten/hundred", "break a ten/hundred") above that; an array for × facts up to 12 × 12 and an area model past that; equal sharing for ÷ up to 12 each and sharing by place value past that; and a number line whose ticks sit at exact percentages, so the basketball lands right on its tick. The steppers go ±1, ±10 and ±100 (B's ±100 only for + and −).
- `playChime(step)` plays step `step` of an ascending C-major pentatonic scale from C4 (bigger numbers sound higher, without wrapping; everything past 20 plays the top note). Steppers pass the value itself.
- Game answers come from the on-screen pad (`pressKey()` in `js/game.js`): digits, or three big < = > keys for comparing shots. Keys fill the active answer box; ✓ moves to the next empty box and shoots once all are filled; tapping a box makes it active. After a miss, only the wrong boxes wiggle. Don't add `<input>` fields: the Android keyboard pushes the layout around.
- A quiet spell mid-shot (20 s) only pulses the answer box. Keep it that way.
- The header shows the Minnesota Lynx logo (`img/lynx-logo.svg`, a non-free file from Wikipedia). Keep the footer disclaimer (not affiliated, no rights claimed) whenever team names or logos appear.
- The app runs fullscreen (`"display": "fullscreen"` in the manifest). `js/pwa.js` also requests fullscreen on tap for copies installed before that change.

## When adding files

Add any new file the app loads to `APP_SHELL` in `sw.js`, or it won't be cached for offline use. A missing file in `APP_SHELL` makes the service worker install fail, so double-check the paths.

## Testing

- Serve locally: `python3 -m http.server 8766` from the repo root, then open http://127.0.0.1:8766. The browser pane caches modules; after editing, re-fetch them with `fetch(path, { cache: 'reload' })` before reloading.
- The Claude desktop browser pane can't register service workers. Test the UI there, but test offline and update behavior in headless Google Chrome (e.g. a small script using the DevTools protocol with `--remote-debugging-port`).
- Test at tablet size (768×1024, and landscape 1280×800) because that's where it runs. The Game shot screen must fit in landscape without scrolling; in landscape the pad sits to the right of the shot.
- A computer keyboard drives the Game (digits, < = > or , and ., Backspace, ← →, Enter), which makes scripted play-throughs easy. In the console, `await import('./js/state.js')` gives the live state (same module instance as the page).
- After changing a play, a range table or the coach, run `node scripts/check-plays.mjs` (Node 22+). It generates 1,500 shots per play, level and tier and checks answers, text, hints, steps, boards, word counts, ceilings and the fit in Practice; checks a v3 save migrates; and plays simulated seasons through the real game code (warm-ups and closers, new-play pacing, story limits, two-step plays, difficulty rising for a strong player and easing for a struggling one).

## Deploying

Committing and pushing to `main` deploys (`.github/workflows/deploy.yml`). The workflow copies the site to `_site/`, replaces `__APP_VERSION__` in `sw.js` and `js/version.js` with `YYYY.MM.DD-HHMM-<sha>`, and writes `version.json`. Never hard-code a version. Check the run with `gh run list --limit 1` / `gh run watch`.
