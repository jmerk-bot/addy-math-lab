// Mystery Quest: generate a problem with one hidden number, check the answer.

import { state, OP_LABEL } from './state.js';
import { playChime, playSuccessChord } from './audio.js';

const $ = (id) => document.getElementById(id);

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export function toggleQuestFilter(op) {
  let f = state.quest.filters;
  if (f.includes(op)) {
    if (f.length === 1) return; // Keep at least one
    f = f.filter(x => x !== op);
  } else {
    f = [...f, op];
  }
  state.quest.filters = f;

  if (state.quest.problem && !f.includes(state.quest.problem.op)) {
    generateNewQuest();
  } else {
    renderQuest();
  }
}

export function generateNewQuest() {
  const pool = state.quest.filters.length ? state.quest.filters : ['+'];
  const op = pool[Math.floor(Math.random() * pool.length)];
  let qa, qb, ans;

  if (op === '+') {
    qa = randInt(2, 9);
    qb = randInt(2, 8);
    ans = qa + qb;
  } else if (op === '-') {
    ans = randInt(1, 8);
    qb = randInt(2, 7);
    qa = ans + qb;
  } else if (op === '×') {
    qa = randInt(2, 6);
    qb = randInt(2, 6);
    ans = qa * qb;
  } else {
    qb = randInt(2, 5);
    // Keep the total at 20 or less so the Lab can show it
    ans = randInt(1, Math.min(5, Math.floor(20 / qb)));
    qa = ans * qb;
  }

  const hideAns = Math.random() > 0.35;
  state.quest.problem = {
    a: qa,
    b: qb,
    op,
    target: ans,
    missing: hideAns ? 'result' : 'b',
    expected: hideAns ? ans : qb
  };
  state.quest.status = 'playing';
  state.quest.entry = '';
  state.quest.replaceOnType = false;

  renderQuest();
}

export function renderQuest() {
  const { filters, problem: q, status, entry } = state.quest;

  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', filters.includes(pill.dataset.value));
  });

  if (!q) return;

  $('quest-num-a').textContent = q.a;
  $('quest-op-badge').textContent = OP_LABEL[q.op];

  // The mystery box shows what Addy has typed on the number pad, in the
  // color of the number it stands for (amber for B, green for the answer)
  const role = q.missing === 'b' ? 'role-b' : 'role-target';
  const fill = status === 'correct' ? 'correct' : entry ? 'filled' : '';
  const box = `<span class="mystery-box ${role} ${fill}">${entry || '?'}</span>`;

  if (q.missing === 'b') {
    $('quest-slot-b').innerHTML = box;
    $('quest-slot-result').innerHTML = `<span class="num-target">${q.target}</span>`;
  } else {
    $('quest-slot-b').innerHTML = `<span class="num-b">${q.b}</span>`;
    $('quest-slot-result').innerHTML = box;
  }

  const a = `<strong class="num-a">${q.a}</strong>`;
  const target = `<strong class="num-target">${q.target}</strong>`;
  const b = (mystery) => `<strong class="num-b">${q.missing === 'b' ? mystery : q.b}</strong>`;
  const guide = $('quest-guide-text');
  if (q.op === '+') {
    guide.innerHTML = `Start with ${a} and add ${b('a mystery amount')} to make ${target}.`;
  } else if (q.op === '-') {
    guide.innerHTML = `Start with ${a} and remove ${b('a mystery amount')} until ${target} remain.`;
  } else if (q.op === '×') {
    guide.innerHTML = `A grid of ${a} rows of ${b('mystery units')} to reach ${target} total.`;
  } else {
    guide.innerHTML = `Divide ${a} into ${b('mystery groups')} equally.`;
  }

  const solved = status === 'correct';
  $('quest-active-controls').hidden = solved;
  $('quest-solved-controls').hidden = !solved;

  const tag = $('quest-tag-status');
  tag.hidden = status === 'playing';
  tag.className = `quest-tag ${status}`;
  tag.textContent = solved ? 'Brilliant! Match found! ⭐' : 'Almost! Test in Lab 👇';
}

// Every quest answer is 36 or less, so two digits is enough
const MAX_DIGITS = 2;

// Number pad: key is '0'–'9', 'back' or 'solve'
export function pressKey(key) {
  const quest = state.quest;
  if (!quest.problem || quest.status === 'correct') return;

  if (key === 'solve') {
    submitQuestAnswer();
    return;
  }

  if (key === 'back') {
    if (!quest.entry) return;
    quest.entry = quest.entry.slice(0, -1);
    quest.replaceOnType = false;
    playChime(0);
  } else {
    if (quest.replaceOnType || quest.entry === '0') quest.entry = '';
    quest.replaceOnType = false;
    if (quest.entry.length >= MAX_DIGITS) return;
    quest.entry += key;
    playChime(Number(key));
  }
  renderQuest();
}

function submitQuestAnswer() {
  const quest = state.quest;
  if (!quest.entry) return; // ignore an empty Solve tap

  if (parseInt(quest.entry, 10) === quest.problem.expected) {
    quest.status = 'correct';
    playSuccessChord();
    renderQuest();
  } else {
    quest.status = 'retry';
    quest.replaceOnType = true; // keep the guess on screen until the next digit
    playChime(1);
    renderQuest();
    document.querySelector('.quest-equation .mystery-box')?.classList.add('wiggle');
  }
}
