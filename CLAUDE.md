# Addy's Math Lab

Visual arithmetic PWA for a young learner, installed on an Android tablet and hosted on GitHub Pages at https://jmerk-bot.github.io/addy-math-lab/. See README.md for the layout and install steps. Personal context about the learner is in CLAUDE.local.md (gitignored, since this repo is public).

This is a copy of `felix-math-lab` (a sibling app in `~/code/felix-math-lab`) with a pink color scheme. Changes made here don't carry over to the other app, and vice versa.

## Shared origin: keep storage names unique

Both apps are served from `https://jmerk-bot.github.io`, so they share the same localStorage and Cache Storage. Everything this app stores is prefixed `addy-math-lab` (the `STORAGE_KEY` in `js/state.js` and the `CACHE` name in `sw.js`). The service worker deletes only old caches with that prefix. Never broaden that cleanup or the prefix, or this app could wipe the other app's offline copy and saved state on a shared device.

## Conventions

- No build step, no dependencies, no frameworks. Plain HTML, CSS and ES modules. Keep it that way unless asked.
- Every path must be **relative** (`./sw.js`, `css/styles.css`), because the site is served from `/addy-math-lab/`, not the domain root.
- Buttons declare `data-action` (and optionally `data-value`). Handlers live in the `actions` map in `js/main.js`, and state is saved after every action.
- Rendering is state-driven: change `state`, then call `renderLab()` / `renderQuest()`.
- Show or hide elements with the `hidden` attribute. CSS has `[hidden] { display: none !important; }`.
- Subtraction is stored as `'-'` but always displayed via `OP_LABEL` (`−`).
- Color coding is part of the teaching and should stay consistent: blue = A / first number, amber = B / second number, green = target/answer, rose = taken away, pink = UI accent.
- `playChime(step)` plays step `step` of an ascending C-major pentatonic scale from C4 (bigger numbers sound higher, without wrapping). Steppers pass the value itself.
- Quest answers come from the on-screen number pad (`pressKey()` in `js/quest.js`), which fills the mystery box directly. Don't add `<input>` fields: the Android keyboard pushes the layout around. Digits chime their own pentatonic note.
- The app runs fullscreen (`"display": "fullscreen"` in the manifest). `js/pwa.js` also requests fullscreen on tap for copies installed before that change.
- Lab limits per operation are in `limits()` in `js/lab.js`. Quests must stay within those limits so "Test in the Lab" can show them. A − B and A ÷ B go up to 20.

## When adding files

Add any new file the app loads to `APP_SHELL` in `sw.js`, or it won't be cached for offline use. A missing file in `APP_SHELL` makes the service worker install fail, so double-check the paths.

## Testing

- Serve locally: `python3 -m http.server 8766` from the repo root, then open http://127.0.0.1:8766.
- The Claude desktop browser pane can't register service workers. Test the UI there, but test offline and update behavior in headless Google Chrome (e.g. a small script using the DevTools protocol with `--remote-debugging-port`).
- Test at tablet size (768×1024, and landscape) because that's where it runs.

## Deploying

Committing and pushing to `main` deploys (`.github/workflows/deploy.yml`). The workflow copies the site to `_site/`, replaces `__APP_VERSION__` in `sw.js` and `js/version.js` with `YYYY.MM.DD-HHMM-<sha>`, and writes `version.json`. Never hard-code a version. Check the run with `gh run list --limit 1` / `gh run watch`.
