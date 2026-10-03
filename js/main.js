// Entry point: wires up buttons, switches between Explore and Mystery Quest,
// and boots the app.

import { state, loadState, saveState } from './state.js';
import { playChime } from './audio.js';
import { clampLab, renderLab, setLabOp, stepA, stepB } from './lab.js';
import { generateNewQuest, pressKey, renderQuest, toggleQuestFilter } from './quest.js';
import { initPwa } from './pwa.js';

const $ = (id) => document.getElementById(id);

function switchMode(newMode, { boot = false } = {}) {
  state.mode = newMode;
  $('tab-lab').classList.toggle('active', newMode === 'lab');
  $('tab-quest').classList.toggle('active', newMode === 'quest');

  $('view-lab').hidden = newMode !== 'lab';
  $('view-quest').hidden = newMode !== 'quest';

  // Remind Addy of the open quest while in the Lab
  // (not on launch, before the quest has been seen)
  const q = state.quest.problem;
  const showBanner = !boot && newMode === 'lab' && !!q && state.quest.status !== 'correct';
  $('lab-quest-banner').hidden = !showBanner;
  if (showBanner) $('banner-target-val').textContent = q.target;

  if (newMode === 'quest' && !q) {
    generateNewQuest();
  }
  if (!boot) playChime(3);
}

function sendQuestToLab() {
  const q = state.quest.problem;
  if (!q) return;

  state.lab.op = q.op;
  state.lab.a = q.a;
  // Do NOT solve it: set b to baseline (0 or 1) so Addy tests and discovers it
  state.lab.b = (q.op === '×' || q.op === '÷') ? 1 : 0;
  clampLab();

  renderLab();
  switchMode('lab');
}

// Every button declares what it does with data-action (and data-value).
const actions = {
  'mode': (value) => switchMode(value),
  'lab-op': (value) => setLabOp(value),
  'step-a': (value) => stepA(Number(value)),
  'step-b': (value) => stepB(Number(value)),
  'quest-filter': (value) => toggleQuestFilter(value),
  'quest-new': () => generateNewQuest(),
  'quest-to-lab': () => sendQuestToLab(),
  'key': (value) => pressKey(value)
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  actions[el.dataset.action]?.(el.dataset.value);
  saveState();
});

// A physical keyboard drives the number pad too (handy when testing on a computer)
document.addEventListener('keydown', (event) => {
  if (state.mode !== 'quest' || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = /^[0-9]$/.test(event.key) ? event.key
    : event.key === 'Backspace' ? 'back'
    : event.key === 'Enter' ? 'solve'
    : null;
  if (!key) return;
  event.preventDefault();
  pressKey(key);
  saveState();
});

// Boot
loadState();
clampLab();
renderLab();
if (state.quest.problem) renderQuest();
else generateNewQuest();
switchMode(state.mode, { boot: true });
initPwa();
saveState();
