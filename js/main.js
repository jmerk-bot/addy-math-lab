// Entry point: wires up buttons, switches between Game and Practice, runs the
// Coach panel, and boots the app.

import { state, loadState, saveState, resetGame, resetSeason } from './state.js';
import { LEVELS, PLAYS, PLAY_IDS } from './plays.js';
import { playChime } from './audio.js';
import { clampLab, renderLab, setLabOp, stepA, stepB } from './lab.js';
import { tipOff, pressKey, selectBox, nextShot, resumeHalf, renderGame } from './game.js';
import { initPwa } from './pwa.js';

const $ = (id) => document.getElementById(id);

function switchMode(newMode, { boot = false } = {}) {
  state.mode = newMode;
  $('tab-game').classList.toggle('active', newMode === 'game');
  $('tab-lab').classList.toggle('active', newMode === 'lab');

  $('view-game').hidden = newMode !== 'game';
  $('view-lab').hidden = newMode !== 'lab';

  renderLabBanner();
  if (!boot) playChime(3);
}

// While a shot is open, Practice shows it (with the ? kept secret) and a way back
function renderLabBanner() {
  const q = state.game.problem;
  const show = state.mode === 'lab' && state.game.status === 'shot' && !!q;
  $('lab-shot-banner').hidden = !show;
  if (show) $('banner-equation').textContent = PLAYS[q.kind].text(q);
}

function sendShotToLab() {
  const q = state.game.problem;
  if (!q || state.game.status !== 'shot') return;

  // Not solved for them: the hidden number starts at a baseline, to be built up
  const { op, a, b } = PLAYS[q.kind].toLab(q);
  state.lab = { op, a, b };
  clampLab();

  renderLab();
  switchMode('lab');
}

// ---------- Coach panel: level, playbook, operations, season ----------

function openCoach(open) {
  $('coach').hidden = !open;
  if (open) renderCoach();
}

function renderCoach() {
  document.querySelectorAll('.level-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === state.level);
  });
  document.querySelectorAll('.play-btn').forEach((btn) => {
    btn.classList.toggle('active', state.playbook.includes(btn.dataset.value));
  });
  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.classList.toggle('active', state.ops.includes(pill.dataset.value));
  });
  // The operation pills only matter when Equations is in the playbook
  $('coach-ops').classList.toggle('muted', !state.playbook.includes('equation'));
  const { games, points, high, threes, bestStreak } = state.season;
  $('coach-season').textContent =
    `${games} games · ${points} points · season high ${high} · ${threes} swishes · best streak ${bestStreak}`;
}

function setLevel(level) {
  if (!LEVELS.includes(level)) return;
  state.level = level;
  renderCoach();
  playChime(4);
}

// Keep at least one play on. A shot already on screen is left alone.
function togglePlay(id) {
  if (!PLAY_IDS.includes(id)) return;
  const book = state.playbook;
  if (book.includes(id)) {
    if (book.length === 1) return;
    state.playbook = book.filter((x) => x !== id);
  } else {
    state.playbook = PLAY_IDS.filter((x) => x === id || book.includes(x));
  }
  renderCoach();
  playChime(2);
}

// Keep at least one operation on. A shot already on screen is left alone.
function toggleOp(op) {
  const ops = state.ops;
  if (ops.includes(op)) {
    if (ops.length === 1) return;
    state.ops = ops.filter((x) => x !== op);
  } else {
    state.ops = [...ops, op];
  }
  renderCoach();
  playChime(2);
}

function clearSeason() {
  if (!confirm('Reset the season record? Games, points and the season high go back to zero.')) return;
  resetSeason();
  resetGame();
  renderGame();
  renderCoach();
}

// ---------- Idle nudge ----------
// A gentle pulse on the answer box after a quiet spell mid-shot. No penalty,
// just a cue to come back. Any tap re-renders the box, which clears it.

const NUDGE_AFTER_MS = 20 * 1000;
let nudgeTimer = null;

function armNudge() {
  clearTimeout(nudgeTimer);
  if (state.mode !== 'game' || state.game.status !== 'shot') return;
  nudgeTimer = setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    document.querySelector('#shot-prompt .mystery-box:not(.idle)')?.classList.add('nudge');
  }, NUDGE_AFTER_MS);
}

// ---------- Actions ----------
// Every button declares what it does with data-action (and data-value).

const actions = {
  'mode': (value) => switchMode(value),
  'coach-open': () => openCoach(true),
  'coach-close': () => openCoach(false),
  'level': (value) => setLevel(value),
  'play': (value) => togglePlay(value),
  'op': (value) => toggleOp(value),
  'reset-season': () => clearSeason(),
  'tip-off': () => tipOff(),
  'key': (value) => pressKey(value),
  'box': (value) => selectBox(Number(value)),
  'next-shot': () => nextShot(),
  'resume': () => resumeHalf(),
  'to-lab': () => sendShotToLab(),
  'lab-op': (value) => setLabOp(value),
  'step-a': (value) => stepA(Number(value)),
  'step-b': (value) => stepB(Number(value))
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  actions[el.dataset.action]?.(el.dataset.value);
  renderLabBanner();
  saveState();
  armNudge();
});

// A physical keyboard drives the Game too (handy when testing on a computer):
// digits, Backspace, ← → between answer boxes, and Enter to shoot or move on.
document.addEventListener('keydown', (event) => {
  if (state.mode !== 'game' || event.metaKey || event.ctrlKey || event.altKey) return;
  const { status } = state.game;
  let handled = true;
  if (/^[0-9]$/.test(event.key)) pressKey(event.key);
  else if (event.key === 'Backspace') pressKey('back');
  else if (event.key === 'ArrowLeft') selectBox(state.game.box - 1);
  else if (event.key === 'ArrowRight') selectBox(state.game.box + 1);
  else if (event.key !== 'Enter') handled = false;
  else if (status === 'shot') pressKey('solve');
  else if (status === 'made') nextShot();
  else if (status === 'halftime') resumeHalf();
  else tipOff();
  if (!handled) return;
  event.preventDefault();
  saveState();
  armNudge();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') armNudge();
});

// Boot
loadState();
clampLab();
renderLab();
renderGame();
renderCoach();
switchMode(state.mode, { boot: true });
initPwa();
saveState();
armNudge();
