// Practice: steppers, operation picker, manipulatives and the number line.

import { state, compute, OP_LABEL } from './state.js';
import { playChime } from './audio.js';

const $ = (id) => document.getElementById(id);

// Allowed values for A and B under each operation. These cover every Game shot
// at the All-Star level, so any shot can be sent here without being cut off.
function limits(op, a) {
  switch (op) {
    case '×': return { aMin: 1, aMax: 12, bMin: 0, bMax: 12 };
    case '÷': return { aMin: 1, aMax: 144, bMin: 1, bMax: Math.min(12, Math.max(1, a)) };
    case '-': return { aMin: 1, aMax: 100, bMin: 0, bMax: a };
    default: return { aMin: 1, aMax: 99, bMin: 0, bMax: 100 - a };
  }
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Keeps A and B inside the limits for the current operation. B is re-checked
// after A changes, so moving A can never leave B outside its range.
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
    if (lab.a > 12) lab.a = 4;
    if (lab.b > 12 || lab.b === 0) lab.b = 1;
  } else if (op === '÷') {
    if (lab.b === 0) lab.b = 1;
    if (lab.b > 12) lab.b = 12;
    if (lab.a < lab.b) lab.a = lab.b * 2;
  } else if (op === '-') {
    if (lab.b > lab.a) lab.b = 0;
  }
  clampLab();
  renderLab();
  playChime(4);
}

// delta is ±1 or ±10
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

  // Active manipulative: ten-frames up to 20, base-ten blocks beyond that
  const card = $('manipulative-card');
  if (op === '×') card.innerHTML = arrayHtml(a, b);
  else if (op === '÷') card.innerHTML = sharingHtml(a, b, remainder);
  else if (Math.max(a, op === '+' ? a + b : 0) <= 20) card.innerHTML = tenFramesHtml(a, b, op, result);
  else card.innerHTML = op === '+' ? blocksAddHtml(a, b) : blocksSubtractHtml(a, b);

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

// ---------- Base-ten blocks (+ and − past 20) ----------
// A rod is ten unit cells stacked, so a "made ten" can show which units it
// came from. Cell classes: blue (A), amber (B), gone (taken away).

const tens = (n) => Math.floor(n / 10);
const ones = (n) => n % 10;

function rodHtml(cells, extra = '') {
  const classes = Array.isArray(cells) ? cells : Array(10).fill(cells);
  return `<div class="rod ${extra}">${classes.map((c) => `<div class="cell ${c}"></div>`).join('')}</div>`;
}

function unitsHtml(classes) {
  if (!classes.length) return '';
  return `<div class="units">${classes.map((c) => `<div class="cell ${c}"></div>`).join('')}</div>`;
}

function rowHtml(label, labelClass, blocks, extra = '') {
  return `
    <div class="blocks-row ${extra}">
      <span class="blocks-label ${labelClass}">${label}</span>
      <div class="blocks">${blocks}</div>
    </div>
  `;
}

// A and B each as rods and ones, then both together. When the ones add up to
// ten or more, ten of them snap into a new rod (outlined in pink).
function blocksAddHtml(a, b) {
  const ta = tens(a), ua = ones(a), tb = tens(b), ub = ones(b);
  const rowA = rodHtml('blue').repeat(ta) + unitsHtml(Array(ua).fill('blue'));
  const rowB = rodHtml('amber').repeat(tb) + unitsHtml(Array(ub).fill('amber'));

  const madeTen = ua + ub >= 10;
  let total = rodHtml('blue').repeat(ta) + rodHtml('amber').repeat(tb);
  if (madeTen) {
    total += rodHtml([...Array(ua).fill('blue'), ...Array(10 - ua).fill('amber')], 'made');
    total += unitsHtml(Array(ua + ub - 10).fill('amber'));
  } else {
    total += unitsHtml([...Array(ua).fill('blue'), ...Array(ub).fill('amber')]);
  }

  const badge = madeTen
    ? `<span class="split-badge">Make a ten: ${ua} + ${ub} = 10 + ${ua + ub - 10}</span>`
    : '';

  return `
    <div class="card-header-bar">
      <span>BASE-TEN BLOCKS</span>
      ${badge}
    </div>
    <div class="blocks-rows">
      ${rowHtml(a, 'num-a', rowA)}
      ${rowHtml(`+ ${b}`, 'num-b', rowB)}
      ${rowHtml(`= ${a + b}`, 'num-target', total, 'total')}
    </div>
  `;
}

// A as rods and ones with B's worth crossed out from the right, then what's
// left. When there aren't enough ones, one rod breaks into ten ones first.
function blocksSubtractHtml(a, b) {
  const ta = tens(a), ua = ones(a), tb = tens(b), ub = ones(b);
  const borrow = ua < ub;
  const rods = borrow ? ta - 1 : ta;
  const units = borrow ? ua + 10 : ua;
  const result = a - b;

  let start = '';
  for (let i = 0; i < rods; i++) start += rodHtml(i >= rods - tb ? 'gone' : 'blue');
  start += unitsHtml(Array.from({ length: units }, (_, i) => (i >= units - ub ? 'gone' : 'blue')));

  const left = rodHtml('blue').repeat(tens(result)) + unitsHtml(Array(ones(result)).fill('blue'));

  const badge = borrow
    ? `<span class="split-badge">Break a ten: ${ua} ones → ${ua + 10} ones</span>`
    : '';

  return `
    <div class="card-header-bar">
      <span>BASE-TEN BLOCKS</span>
      ${badge}
    </div>
    <div class="blocks-rows">
      ${rowHtml(`${a} − ${b}`, 'num-a', start)}
      ${rowHtml(`= ${result}`, 'num-target', left, 'total')}
    </div>
  `;
}

// ---------- Array (×) ----------
// The last cell of each row shows the running total, for skip counting.
function arrayHtml(a, b) {
  const size = b <= 6 ? 38 : b <= 9 ? 32 : 26;
  const gap = b <= 6 ? 8 : 5;
  let cells = '';
  for (let r = 1; r <= a; r++) {
    for (let c = 1; c <= b; c++) {
      cells += `<div class="matrix-cell">${c === b ? r * b : ''}</div>`;
    }
  }
  return `
    <div class="card-header-bar">
      <span>ARRAY: ${a} ROWS × ${b} COLUMNS</span>
      <span class="array-total">Total: ${a * b}</span>
    </div>
    <div class="matrix-wrapper">
      <div class="matrix-grid" style="--cell: ${size}px; --gap: ${gap}px; grid-template-columns: repeat(${Math.max(1, b)}, var(--cell));">
        ${cells}
      </div>
    </div>
  `;
}

// ---------- Equal sharing (÷) ----------
function sharingHtml(a, b, remainder) {
  const perGroup = Math.floor(a / b);
  const small = perGroup > 6 ? 'small' : '';
  let buckets = '';
  for (let g = 1; g <= b; g++) {
    buckets += `
      <div class="bucket">
        <span class="bucket-title">GROUP ${g}</span>
        <div class="bucket-items ${small}">${'<div class="share-dot"></div>'.repeat(perGroup)}</div>
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

  const cols = b <= 6 ? b : 6;
  return `
    <div class="card-header-bar">
      <span>EQUAL SHARING: ${a} DIVIDED INTO ${b} GROUPS</span>
      <span class="each-gets">Each gets: ${perGroup}</span>
    </div>
    <div class="buckets-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
      ${buckets}
    </div>
    ${remHtml}
  `;
}

// ---------- Number line ----------
// The range grows with the numbers: 0–20 or 0–100 for + and −, 0–36 or 0–144
// for × and ÷. A landing marker sits at the result even between ticks.
function renderNumberLine(a, b, op, result) {
  let range, step, labelEvery;
  if (op === '+' || op === '-') {
    const big = Math.max(a, op === '+' ? a + b : 0) > 20;
    range = big ? 100 : 20;
    step = big ? 5 : 1;
    labelEvery = big ? 10 : 2;
  } else {
    const big = (op === '×' ? a * b : a) > 36;
    range = big ? 144 : 36;
    step = big ? 12 : 3;
    labelEvery = big ? 24 : 6;
  }

  const pct = Math.min(100, (result / range) * 100);
  const segment = $('vector-segment');
  segment.style.width = `${pct}%`;
  segment.classList.toggle('multiply', op === '×');

  const landing = $('vector-landing');
  landing.style.left = `${pct}%`;
  landing.textContent = result;

  const hint = $('vector-hint');
  if (op === '+') hint.textContent = `Hop forward +${b}`;
  else if (op === '-') hint.textContent = `Hop backward −${b}`;
  else if (op === '×') hint.textContent = `${a} hops of ${b}`;
  else hint.textContent = `Landing: ${result}`;

  let ticks = '';
  for (let val = 0; val <= range; val += step) {
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
