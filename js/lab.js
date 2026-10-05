// Practice: steppers, operation picker, manipulatives and the number line.

import { state } from './state.js';
import { compute, fmt, OP_LABEL } from './math.js';
import { playChime } from './audio.js';

const $ = (id) => document.getElementById(id);

// Allowed values for A and B under each operation. These cover every Game shot
// at every level, so any shot can be sent here without being cut off
// (scripts/check-plays.mjs checks that).
export function limits(op, a) {
  switch (op) {
    case '×': return { aMin: 1, aMax: 999, bMin: 0, bMax: a > 99 ? 12 : 99 };
    case '÷': return { aMin: 1, aMax: 999, bMin: 1, bMax: Math.min(12, Math.max(1, a)) };
    case '-': return { aMin: 1, aMax: 1000, bMin: 0, bMax: a };
    default: return { aMin: 1, aMax: 999, bMin: 0, bMax: 1000 - a };
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

// delta is ±1, ±10 or ±100
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
  $('display-a').textContent = fmt(a);
  $('display-op').textContent = OP_LABEL[op];
  $('display-b').textContent = fmt(b);
  $('display-result').textContent = fmt(result);
  $('val-a').textContent = fmt(a);
  $('val-b').textContent = fmt(b);

  $('label-a').textContent = op === '÷' ? 'Total (A)' : 'First (A)';
  $('label-b').textContent = op === '÷' ? 'Groups (B)' : 'Second (B)';

  // B only goes past 99 for + and −
  document.querySelectorAll('[data-action="step-b"][data-value$="100"]').forEach((btn) => {
    btn.hidden = op === '×' || op === '÷';
  });

  // ÷ always shows its remainder, so "R 0" reads as an answer too
  const remBadge = $('display-remainder');
  remBadge.hidden = op !== '÷';
  remBadge.textContent = `R ${remainder}`;

  document.querySelectorAll('.op-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });

  // Active manipulative: ten-frames up to 20 and base-ten blocks past that;
  // an array for × facts and an area model past 12; sharing into groups for ÷,
  // by place value once each group gets more than 12
  const card = $('manipulative-card');
  if (op === '×') card.innerHTML = a > 12 || b > 12 ? areaModelHtml(a, b) : arrayHtml(a, b);
  else if (op === '÷') card.innerHTML = result > 12 ? shareByPlaceHtml(a, b) : sharingHtml(a, b, remainder);
  else if (Math.max(a, op === '+' ? a + b : 0) <= 20) card.innerHTML = tenFramesHtml(a, b, op, result);
  else card.innerHTML = op === '+' ? blocksAddHtml(a, b) : blocksSubtractHtml(a, b);

  renderNumberLine(a, b, op, result);
}

const badgesHtml = (badges) => badges.map((text) => `<span class="split-badge">${text}</span>`).join('');

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

// ---------- Base-ten blocks (+ and − past 20, and ÷ by place value) ----------
// A rod is a column of ten unit cells and a flat is ten rods side by side, so
// a "made" ten or hundred can show which pieces it came from. Cell classes:
// blue (A), amber (B), gone (taken away).

const placeDigits = (n) => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 });

const cellsHtml = (classes) => classes.map((c) => `<div class="cell ${c}"></div>`).join('');
const tenOf = (cells) => (Array.isArray(cells) ? cells : Array(10).fill(cells));

// cells: one color, or ten cell colors
function rodHtml(cells, extra = '') {
  return `<div class="rod ${extra}">${cellsHtml(tenOf(cells))}</div>`;
}

// rods: one color, or ten rods (each one color or ten cell colors)
function flatHtml(rods, extra = '') {
  return `<div class="flat ${extra}">${cellsHtml(tenOf(rods).flatMap(tenOf))}</div>`;
}

function unitsHtml(classes) {
  if (!classes.length) return '';
  return `<div class="units">${cellsHtml(classes)}</div>`;
}

// n in one color, as flats, rods and ones
function numberBlocks(n, color) {
  const { h, t, o } = placeDigits(n);
  return flatHtml(color).repeat(h) + rodHtml(color).repeat(t) + unitsHtml(Array(o).fill(color));
}

function rowHtml(label, labelClass, blocks, extra = '') {
  return `
    <div class="blocks-row ${extra}">
      <span class="blocks-label ${labelClass}">${label}</span>
      <div class="blocks">${blocks}</div>
    </div>
  `;
}

// Smaller blocks once a row would hold a couple of hundreds
const compactClass = (...numbers) => (Math.max(...numbers) >= 200 ? 'compact' : '');

// A and B each as flats, rods and ones, then both together. When the ones add
// up to ten or more, ten of them snap into a new rod; when the rods do, ten of
// them snap into a new flat. Both are outlined in pink.
function blocksAddHtml(a, b) {
  const A = placeDigits(a);
  const B = placeDigits(b);
  const badges = [];

  // Ones: A's then B's, ten of them making a rod
  const ones = A.o + B.o;
  const madeTen = ones >= 10;
  const onesLeft = madeTen
    ? Array(ones - 10).fill('amber')
    : [...Array(A.o).fill('blue'), ...Array(B.o).fill('amber')];
  if (madeTen) badges.push(`Make a ten: ${A.o} + ${B.o} = 10 + ${ones - 10}`);

  // Tens: A's rods, B's rods, then the made ten; ten of them making a flat
  const rods = [...Array(A.t).fill('blue'), ...Array(B.t).fill('amber')];
  if (madeTen) rods.push([...Array(A.o).fill('blue'), ...Array(10 - A.o).fill('amber')]);
  const madeHundred = rods.length >= 10;
  const rodsLeft = madeHundred ? rods.slice(10) : rods;
  if (madeHundred) badges.push(`Make a hundred: ${rods.length} tens = 1 hundred + ${rods.length - 10} tens`);

  const hundreds = A.h + B.h + (madeHundred ? 1 : 0);
  if (hundreds === 10) badges.push('10 hundreds = 1,000');

  const total = flatHtml('blue').repeat(A.h)
    + flatHtml('amber').repeat(B.h)
    + (madeHundred ? flatHtml(rods.slice(0, 10), 'made') : '')
    + rodsLeft.map((rod) => rodHtml(rod, Array.isArray(rod) ? 'made' : '')).join('')
    + unitsHtml(onesLeft);

  return `
    <div class="card-header-bar">
      <span>BASE-TEN BLOCKS</span>
      ${badgesHtml(badges)}
    </div>
    <div class="blocks-rows ${compactClass(a, b, a + b)}">
      ${rowHtml(fmt(a), 'num-a', numberBlocks(a, 'blue'))}
      ${rowHtml(`+ ${fmt(b)}`, 'num-b', numberBlocks(b, 'amber'))}
      ${rowHtml(`= ${fmt(a + b)}`, 'num-target', total, 'total')}
    </div>
  `;
}

// A with B's worth crossed out from the right, then what's left. When a place
// runs short, one piece from the next place up breaks into ten first (a
// hundred into tens, a ten into ones).
function blocksSubtractHtml(a, b) {
  let { h: H, t: T, o: O } = placeDigits(a);
  const B = placeDigits(b);
  const badges = [];

  if (O < B.o) {
    if (T === 0) {
      badges.push('Break a hundred: 0 tens → 10 tens');
      H -= 1;
      T += 10;
    }
    badges.push(`Break a ten: ${O} ones → ${O + 10} ones`);
    T -= 1;
    O += 10;
  }
  if (T < B.t) {
    badges.push(`Break a hundred: ${T} tens → ${T + 10} tens`);
    H -= 1;
    T += 10;
  }

  const crossOut = (count, takeAway) => Array.from({ length: count }, (_, i) => (i >= count - takeAway ? 'gone' : 'blue'));
  const start = crossOut(H, B.h).map((c) => flatHtml(c)).join('')
    + crossOut(T, B.t).map((c) => rodHtml(c)).join('')
    + unitsHtml(crossOut(O, B.o));

  return `
    <div class="card-header-bar">
      <span>BASE-TEN BLOCKS</span>
      ${badgesHtml(badges)}
    </div>
    <div class="blocks-rows ${compactClass(a)}">
      ${rowHtml(`${fmt(a)} − ${fmt(b)}`, 'num-a', start)}
      ${rowHtml(`= ${fmt(a - b)}`, 'num-target', numberBlocks(a - b, 'blue'), 'total')}
    </div>
  `;
}

// ---------- Array (× facts) ----------
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

// ---------- Area model (× past 12) ----------
// A splits into hundreds, tens and ones across the top; B splits into tens and
// ones down the side once it's past 12. Each box holds its partial product,
// and the partial products add up to the answer: 215 × 8 = 1,600 + 80 + 40.

// Place-value parts, biggest first and skipping zeros: 215 → [200, 10, 5]
function placeParts(n) {
  const parts = [100, 10, 1].map((p) => Math.floor(n / p) % 10 * p).filter(Boolean);
  return parts.length ? parts : [0];
}

function areaModelHtml(a, b) {
  const cols = placeParts(a);
  const rows = b > 12 ? placeParts(b) : [b];
  const weight = (n) => (n >= 100 ? 3 : n >= 10 ? 2 : 1.3);

  const products = [];
  let cells = '<div></div>' + cols.map((c) => `<div class="area-col num-a">${fmt(c)}</div>`).join('');
  for (const r of rows) {
    cells += `<div class="area-row num-b">${fmt(r)}</div>`;
    for (const c of cols) {
      products.push(r * c);
      cells += `<div class="area-cell">${fmt(r * c)}</div>`;
    }
  }

  const columns = `auto ${cols.map((c) => `${weight(c)}fr`).join(' ')}`;
  const heights = `auto ${rows.map((r) => (rows.length > 1 && r >= 10 ? '72px' : '60px')).join(' ')}`;
  const sum = products.length > 1 ? `${products.map(fmt).join(' + ')} = ` : '';

  return `
    <div class="card-header-bar">
      <span>AREA MODEL: ${fmt(a)} × ${fmt(b)}</span>
      <span class="array-total">Total: ${fmt(a * b)}</span>
    </div>
    <div class="area-grid" style="grid-template-columns: ${columns}; grid-template-rows: ${heights};">${cells}</div>
    <p class="area-sum">${sum}<strong class="num-target">${fmt(a * b)}</strong></p>
  `;
}

// ---------- Equal sharing (÷ up to 12 each) ----------
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

// ---------- Sharing by place value (÷ past 12 each) ----------
// Share the biggest pieces first: hundreds, then tens, then ones. Whatever
// can't be shared evenly breaks into ten of the next smaller piece, and the
// ones that are still left over are the remainder: 97 ÷ 4 shares 9 tens (2
// each, 1 left), then 17 ones (4 each, 1 left), so 24 R 1.
function shareByPlaceHtml(a, b) {
  const { h: H, t: T, o: O } = placeDigits(a);
  const hEach = Math.floor(H / b);
  const tens = T + 10 * (H % b);
  const tEach = Math.floor(tens / b);
  const ones = O + 10 * (tens % b);
  const oEach = Math.floor(ones / b);
  const left = ones % b;
  const each = 100 * hEach + 10 * tEach + oEach;

  const steps = [];
  if (H) steps.push(`${H} hundreds: ${hEach} each` + (H % b ? `, ${H % b} left → ${10 * (H % b)} tens` : ''));
  steps.push(`${tens} tens: ${tEach} each` + (tens % b ? `, ${tens % b} left → ${10 * (tens % b)} ones` : ''));
  steps.push(`${ones} ones: ${oEach} each` + (left ? `, ${left} left over` : ''));

  const group = numberBlocks(each, 'blue');
  let buckets = '';
  for (let g = 1; g <= b; g++) {
    buckets += `
      <div class="bucket">
        <span class="bucket-title">GROUP ${g}</span>
        <div class="blocks">${group}</div>
      </div>
    `;
  }

  const remHtml = left > 0
    ? `<div class="remainder-row"><strong>Leftover:</strong>${unitsHtml(Array(left).fill('amber'))}</div>`
    : '';

  const cols = b <= 4 ? b : b <= 6 ? 3 : 4;
  return `
    <div class="card-header-bar">
      <span>SHARING: ${fmt(a)} INTO ${b} GROUPS</span>
      <span class="each-gets">Each gets: ${fmt(each)}</span>
    </div>
    <div class="share-steps">${badgesHtml(steps)}</div>
    <div class="buckets-grid share-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
      ${buckets}
    </div>
    ${remHtml}
  `;
}

// ---------- Number line ----------
// The range grows with the numbers: [range, tick step, label every]. + and −
// count up to 20, 100 or 1,000; × and ÷ up to 36, 144, and on into the
// thousands. A basketball marks the result, even between ticks.
const ADD_SCALES = [[20, 1, 2], [100, 5, 10], [1000, 50, 100]];
const MUL_SCALES = [
  [36, 3, 6], [144, 12, 24], [1000, 50, 100], [2000, 100, 200],
  [5000, 250, 500], [10000, 500, 1000], [12000, 1000, 2000]
];

function renderNumberLine(a, b, op, result) {
  const scales = op === '+' || op === '-' ? ADD_SCALES : MUL_SCALES;
  const biggest = op === '+' ? a + b : op === '×' ? a * b : a;
  const [range, step, labelEvery] = scales.find(([r]) => biggest <= r) || scales[scales.length - 1];

  const pct = Math.min(100, (result / range) * 100);
  const segment = $('vector-segment');
  segment.style.width = `${pct}%`;
  segment.classList.toggle('multiply', op === '×');

  // The basketball jumps to its new spot whenever the result changes
  const landing = $('vector-landing');
  landing.style.left = `${pct}%`;
  const num = $('vector-landing-num');
  if (num.textContent !== fmt(result)) {
    num.textContent = fmt(result);
    landing.classList.remove('jump');
    void landing.offsetWidth; // restart the animation
    landing.classList.add('jump');
  }

  const hint = $('vector-hint');
  if (op === '+') hint.textContent = `Jump forward +${fmt(b)}`;
  else if (op === '-') hint.textContent = `Jump backward −${fmt(b)}`;
  else if (op === '×') hint.textContent = `${fmt(a)} jumps of ${fmt(b)}`;
  else hint.textContent = `Landing: ${fmt(result)}`;

  let ticks = '';
  for (let val = 0; val <= range; val += step) {
    const target = val === result ? 'target' : '';
    ticks += `
      <div class="tick-col">
        <div class="tick-line ${target}"></div>
        <span class="tick-label ${target}">${val % labelEvery === 0 ? fmt(val) : ''}</span>
      </div>
    `;
  }
  $('vector-ticks').innerHTML = ticks;
}
