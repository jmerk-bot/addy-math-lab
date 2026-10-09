// Entry point: wires up buttons and keys, switches between Game and Practice,
// and boots the app.

import { state, loadState, saveState } from './state.js';
import { PLAYS, PATH } from './plays.js';
import { playChime, setSound, speak } from './audio.js';
import { clampLab, renderLab, setLabOp, stepA, stepB } from './lab.js';
import { tipOff, pressKey, selectBox, askCoach, skipChoices, skipShot, nextShot, resumeHalf, renderGame } from './game.js';
import { openBoard, openShowMe, openIntro, openSkip, openFilm, sheetNext, sheetPrev, closeSheet, sheetIsOpen } from './sheets.js';
import { openCoach, coachActions, backupPicked } from './panel.js';
import { loadLog, logStart } from './log.js';
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
  const lab = q && state.game.status === 'shot' ? PLAYS[q.kind].toLab?.(q) : null;
  if (!lab) return;

  // Not solved for them: the hidden number starts at a baseline, to be built up
  state.lab = { op: lab.op, a: lab.a, b: lab.b };
  clampLab();
  renderLab();
  switchMode('lab');
}

// "Go Practice This Play": an equation shot gets built in Practice; any other shot
// opens Coach's board (which can still send it to Practice)
function lookAtShot() {
  const q = state.game.problem;
  if (!q || state.game.status !== 'shot') return;
  const play = PLAYS[q.kind];
  if (play.layout === 'equation' && play.toLab?.(q)) sendShotToLab();
  else openBoard(q);
}

// Tip-off. A play that hasn't been introduced yet gets its worked example first.
function startGame() {
  const id = PATH.find((x) => state.progress[x].unlocked && !state.progress[x].introduced && state.playbook.includes(x));
  if (!id) {
    tipOff();
    return;
  }
  openIntro(id, () => {
    state.progress[id].introduced = true;
    tipOff();
    saveState();
  });
}

function readAloud() {
  const q = state.game.problem;
  if (!q) return;
  const play = PLAYS[q.kind];
  speak(play.speech?.(q) || play.text(q));
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
    if (document.visibilityState !== 'visible' || sheetIsOpen()) return;
    document.querySelector('#shot-prompt .mystery-box:not(.idle)')?.classList.add('nudge');
  }, NUDGE_AFTER_MS);
}

// ---------- Actions ----------
// Every button declares what it does with data-action (and data-value).

const actions = {
  'mode': (value) => switchMode(value),
  'coach-open': () => openCoach(true),
  'coach-close': () => openCoach(false),
  ...coachActions,
  'tip-off': () => startGame(),
  'key': (value) => pressKey(value),
  'box': (value) => selectBox(Number(value)),
  'help': () => { if (askCoach()) openShowMe(state.game.problem); },
  'skip': () => openSkip(skipChoices()),
  'skip-choose': (value) => { closeSheet(); skipShot(value); },
  'speak': () => readAloud(),
  'to-lab': () => lookAtShot(),
  'board-practice': () => { closeSheet(); sendShotToLab(); },
  'next-shot': () => nextShot(),
  'resume': () => resumeHalf(),
  'film': () => openFilm(state.game.film),
  'sheet-next': () => sheetNext(),
  'sheet-prev': () => sheetPrev(),
  'sheet-close': () => { closeSheet(); renderGame(); },
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
// digits, < = > (or , and .), Backspace, ← → between answer boxes, and Enter
// to shoot or move on. In a sheet, Enter taps its main button.
const KEY_MAP = { ',': '<', '.': '>', '<': '<', '>': '>', '=': '=' };

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (sheetIsOpen()) {
    if (event.key === 'Enter') $('sheet-card').querySelector('.big-btn')?.click();
    else if (event.key === 'Escape') actions['sheet-close']();
    return;
  }
  if (state.mode !== 'game' || !$('coach').hidden) return;
  const { status } = state.game;
  let handled = true;
  if (/^[0-9]$/.test(event.key)) pressKey(event.key);
  else if (KEY_MAP[event.key]) pressKey(KEY_MAP[event.key]);
  else if (event.key === 'Backspace') pressKey('back');
  else if (event.key === 'ArrowLeft') selectBox(state.game.box - 1);
  else if (event.key === 'ArrowRight') selectBox(state.game.box + 1);
  else if (event.key !== 'Enter') handled = false;
  else if (status === 'shot') pressKey('solve');
  else if (status === 'made') nextShot();
  else if (status === 'halftime') resumeHalf();
  else startGame();
  if (!handled) return;
  event.preventDefault();
  saveState();
  armNudge();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') armNudge();
});

// "Restore from a copy" in Change the Game opens this file picker
$('restore-file').addEventListener('change', (event) => backupPicked(event.target.files?.[0]));

// Boot. The journey log starts with a note of where things stand.
loadState();
loadLog();
logStart(state);
setSound(state.settings.sound);
clampLab();
renderLab();
renderGame();
switchMode(state.mode, { boot: true });
initPwa();
saveState();
armNudge();
