// Explore Lab: steppers, operation picker, manipulatives and the number line.

import { state, compute, OP_LABEL } from './state.js';
import { playChime } from './audio.js';

const $ = (id) => document.getElementById(id);

// Allowed values for A and B under each operation. Subtraction and division go
// up to 20 so every Mystery Quest can be sent to the Lab without being cut off.
function limits(op, a) {
  switch (op) {
    case '×': return { aMin: 1, aMax: 6, bMin: 0, bMax: 6 };
    case '÷': return { aMin: 1, aMax: 20, bMin: 1, bMax: Math.max(1, a) };
    case '-': return { aMin: 1, aMax: 20, bMin: 0, bMax: a };
    default: return { aMin: 1, aMax: 10, bMin: 0, bMax: 10 };
  }
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Keeps A and B inside the limits for the current operation. B is re-checked
// after A changes, so lowering A can never leave B bigger than it's allowed.
export function clampLab() {
  const lab = state.lab;
  const { aMin, aMax } = limits(lab.op, lab.a);
  lab.a = clamp(lab.a, aMin, aMax);
  const { bMin, bMax } = limits(lab.op, lab.a);
  lab.b = clamp(lab.b, bMin, bMax);
}

export function setLabOp(op) {
  const lab = state.lab;
  lab.op = op;
  if (op === '×') {
    if (lab.a > 6) lab.a = 4;
    if (lab.b > 6 || lab.b === 0) lab.b = 1;
  } else if (op === '÷') {
    if (lab.b === 0) lab.b = 1;
    if (lab.a < lab.b) lab.a = 6;
  } else if (op === '-') {
    if (lab.b > lab.a) lab.b = 0;
  }
  clampLab();
  renderLab();
  playChime(4);
}

export function stepA(delta) {
  state.lab.a += delta;
  clampLab();
  renderLab();
  playChime(state.lab.a);
}

export function stepB(delta) {
  state.lab.b += delta;
  clampLab();
  renderLab();
  playChime(state.lab.b);
}

export function renderLab() {
  const { a, b, op } = state.lab;
  const result = compute(a, b, op);
  const remainder = op === '÷' && b > 0 ? a % b : 0;

  // Symbolic equation
  $('display-a').textContent = a;
  $('display-op').textContent = OP_LABEL[op];
  $('display-b').textContent = b;
  $('display-result').textContent = result;
  $('val-a').textContent = a;
  $('val-b').textContent = b;

  $('label-a').textContent = op === '÷' ? 'Total (A)' : 'First (A)';
  $('label-b').textContent = op === '÷' ? 'Groups (B)' : 'Second (B)';

  const remBadge = $('display-remainder');
  remBadge.hidden = !(op === '÷' && remainder > 0);
  remBadge.textContent = `R ${remainder}`;

  document.querySelectorAll('.op-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });

  // Active manipulative
  const card = $('manipulative-card');
  if (op === '+' || op === '-') card.innerHTML = tenFramesHtml(a, b, op, result);
  else if (op === '×') card.innerHTML = arrayHtml(a, b);
  else card.innerHTML = sharingHtml(a, b, remainder);

  renderNumberLine(a, b, op, result);
}

// Two ten-frames covering positions 1–20.
// Addition: A blue circles, then B amber diamonds (filling the first frame to ten first).
// Subtraction: the circles that remain, then the ones taken away crossed out.
function tenFramesHtml(a, b, op, result) {
  const tokenAt = (p) => {
    if (op === '-') {
      if (p <= result) return '<div class="token-blue-circle"></div>';
      if (p <= a) return '<div class="token-subtracted">✕</div>';
      return '';
    }
    if (p <= a) return '<div class="token-blue-circle"></div>';
    if (p <= a + b) return '<div class="token-amber-diamond"></div>';
    return '';
  };

  let f1Slots = '';
  let f2Slots = '';
  for (let i = 1; i <= 10; i++) {
    f1Slots += `<div class="slot">${tokenAt(i)}</div>`;
    f2Slots += `<div class="slot">${tokenAt(i + 10)}</div>`;
  }

  const splitTag = (op === '+' && a + b > 10 && a < 10)
    ? `<span class="split-badge">10-Split: ${b} is ${10 - a} + ${b - (10 - a)}</span>`
    : '';

  return `
    <div class="card-header-bar">
      <span>TEN-FRAME 1 (1 – 10)</span>
      ${splitTag}
      <span>TEN-FRAME 2 (11 – 20)</span>
    </div>
    <div class="ten-frames-container">
      <div class="ten-frame">${f1Slots}</div>
      <div class="ten-frame">${f2Slots}</div>
    </div>
  `;
}

function arrayHtml(a, b) {
  let cells = '';
  for (let i = 1; i <= a * b; i++) {
    cells += `<div class="matrix-cell">${i}</div>`;
  }
  return `
    <div class="card-header-bar">
      <span>MULTIPLICATION ARRAY: ${a} ROWS × ${b} COLUMNS</span>
      <span class="array-total">Total: ${a * b}</span>
    </div>
    <div class="matrix-wrapper">
      <div class="matrix-grid" style="grid-template-rows: repeat(${a}, 1fr); grid-template-columns: repeat(${b}, 1fr);">
        ${cells}
      </div>
    </div>
  `;
}

function sharingHtml(a, b, remainder) {
  const perGroup = Math.floor(a / b);
  let buckets = '';
  for (let g = 1; g <= b; g++) {
    buckets += `
      <div class="bucket">
        <span class="bucket-title">GROUP ${g}</span>
        <div class="bucket-items">${'<div class="share-dot"></div>'.repeat(perGroup)}</div>
      </div>
    `;
  }

  const remHtml = remainder > 0
    ? `
      <div class="remainder-row">
        <strong>Leftover:</strong>
        <div class="leftover-dots">${'<div class="leftover-dot"></div>'.repeat(remainder)}</div>
      </div>
    `
    : '';

  return `
    <div class="card-header-bar">
      <span>EQUAL SHARING: ${a} DIVIDED INTO ${b} GROUPS</span>
      <span class="each-gets">Each gets: ${perGroup}</span>
    </div>
    <div class="buckets-grid" style="grid-template-columns: repeat(${Math.min(b, 5)}, 1fr);">
      ${buckets}
    </div>
    ${remHtml}
  `;
}

function renderNumberLine(a, b, op, result) {
  const maxRange = op === '×' ? 36 : 20;
  const segment = $('vector-segment');
  segment.style.width = `${Math.min(100, (result / maxRange) * 100)}%`;
  segment.classList.toggle('multiply', op === '×');

  const hint = $('vector-hint');
  if (op === '+') hint.textContent = `Hop forward +${b}`;
  else if (op === '-') hint.textContent = `Hop backward −${b}`;
  else if (op === '×') hint.textContent = `${a} hops of ${b} units`;
  else hint.textContent = `Landing: ${result}`;

  const count = op === '×' ? 13 : 21;
  const step = op === '×' ? 3 : 1;
  const labelEvery = op === '×' ? 6 : 2;
  let ticks = '';
  for (let i = 0; i < count; i++) {
    const val = i * step;
    const target = val === result ? 'target' : '';
    ticks += `
      <div class="tick-col">
        <div class="tick-line ${target}"></div>
        <span class="tick-label ${target}">${val % labelEvery === 0 ? val : ''}</span>
      </div>
    `;
  }
  $('vector-ticks').innerHTML = ticks;
}
