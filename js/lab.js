// Practice: steppers, operation picker, the manipulative for A op B (drawn by
// js/visuals.js) and the number line.

import { state } from './state.js';
import { compute, fmt, OP_LABEL } from './math.js';
import { playChime } from './audio.js';
import { limits } from './lab-limits.js';
import { manipulativeHtml } from './visuals.js';

const $ = (id) => document.getElementById(id);

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

  // Ten-frames up to 20 and base-ten blocks past that; an array for × facts
  // and an area model past 12; sharing into groups for ÷, by place value once
  // each group gets more than 12
  $('manipulative-card').innerHTML = manipulativeHtml(a, b, op);

  renderNumberLine(a, b, op, result);
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

  // Each tick sits at the same percentage as the ball would for that value, so
  // the ball always lands right on its tick
  let ticks = '';
  for (let val = 0; val <= range; val += step) {
    const target = val === result ? 'target' : '';
    ticks += `
      <div class="tick-col" style="left: ${(val / range) * 100}%">
        <div class="tick-line ${target}"></div>
        <span class="tick-label ${target}">${val % labelEvery === 0 ? fmt(val) : ''}</span>
      </div>
    `;
  }
  $('vector-ticks').innerHTML = ticks;
}
