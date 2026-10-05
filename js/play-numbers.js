// Number plays: Equations (facts and the missing number), Big numbers
// (multi-digit + − × by place) and Leftovers (÷ with a remainder).
// See js/plays.js for what every play provides.

import { OPS, OP_LABEL, compute, fmt } from './math.js';
import { randInt, pickFrom, pickWeighted, randStep, rangesFor, isInt } from './kit.js';
import { manipulativeHtml, shareByPlace } from './visuals.js';

// ---------- Equation shots: A op B = result, with one of the three hidden ----------

const SLOTS = ['a', 'b', 'result'];
const SLOT_CLASS = { a: 'num-a', b: 'num-b', result: 'num-target' };
const SLOT_ROLE = { a: 'a', b: 'b', result: 'target' };

// Text of A op B = result, with "?" for the hidden number unless solved
export function equationText(p, { solved = false } = {}) {
  const show = (name) => (p.missing === name && !solved ? '?' : fmt(p[name]));
  return `${show('a')} ${OP_LABEL[p.op]} ${show('b')} = ${show('result')}`;
}

export function isValidEquation(p) {
  return OPS.includes(p.op)
    && SLOTS.every((k) => isInt(p[k]))
    && SLOTS.includes(p.missing)
    && p.a >= 1
    && (p.op !== '-' || p.b <= p.a)
    && (p.op !== '÷' || (p.b >= 1 && p.a % p.b === 0))
    && compute(p.a, p.b, p.op) === p.result;
}

// Practice starts from a baseline so the hidden number gets built, not shown:
// B starts at 0 (1 for × and ÷), and a hidden A starts low with B as given.
export function equationToLab(p) {
  if (p.missing === 'a') return { op: p.op, a: p.op === '-' || p.op === '÷' ? p.b : 1, b: p.b };
  return { op: p.op, a: p.a, b: p.op === '×' || p.op === '÷' ? 1 : 0 };
}

const equationShape = {
  layout: 'equation',
  boxes: (p) => [{ role: SLOT_ROLE[p.missing] }],
  answers: (p) => [p[p.missing]],

  // box(i) draws answer box i
  prompt(p, box) {
    const slot = (name) => (p.missing === name ? box(0) : `<span class="${SLOT_CLASS[name]}">${fmt(p[name])}</span>`);
    return `${slot('a')}<span class="op-symbol">${OP_LABEL[p.op]}</span>${slot('b')}<span class="equals">=</span>${slot('result')}`;
  },
  text: equationText,
  toLab: equationToLab,
  board: (p) => manipulativeHtml(p.a, p.b, p.op),
  isValid: isValidEquation
};

// ---------- Worked steps ----------

const PLACES = ['Ones', 'Tens', 'Hundreds', 'Thousands'];

// Working backward to a hidden A or B, as the matching fact
function backwardSteps(p) {
  const { a, b, op, result, missing } = p;
  const A = fmt(a);
  const B = fmt(b);
  const R = fmt(result);
  if (op === '+') return missing === 'a'
    ? [`? + ${B} = ${R}`, `Work backward: ${R} − ${B} = ${A}`]
    : [`${A} + ? = ${R}`, `Work backward: ${R} − ${A} = ${B}`];
  if (op === '-') return missing === 'a'
    ? [`? − ${B} = ${R}`, `Add back what was taken: ${R} + ${B} = ${A}`]
    : [`${A} − ? = ${R}`, `How far from ${R} up to ${A}? ${A} − ${R} = ${B}`];
  if (op === '×') return missing === 'a'
    ? [`? × ${B} = ${R}`, `Think: what times ${B} is ${R}?`, `${R} ÷ ${B} = ${A}`]
    : [`${A} × ? = ${R}`, `Think: ${A} times what is ${R}?`, `${R} ÷ ${A} = ${B}`];
  return missing === 'a'
    ? [`? ÷ ${B} = ${R}`, `Think multiplication: ${R} × ${B} = ${A}`]
    : [`${A} ÷ ? = ${R}`, `Think: ${R} times what is ${A}?`, `${A} ÷ ${R} = ${B}`];
}

// Column addition, one place at a time
function addColumns(a, b) {
  const steps = [];
  let carry = 0;
  for (let i = 0, x = a, y = b; x > 0 || y > 0; i++, x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    const sum = (x % 10) + (y % 10) + carry;
    const next = (PLACES[i + 1] || 'next place').toLowerCase();
    steps.push(`${PLACES[i]}: ${x % 10} + ${y % 10}${carry ? ' + 1' : ''} = ${sum}${sum >= 10 ? `, carry 1 to the ${next}` : ''}`);
    carry = sum >= 10 ? 1 : 0;
  }
  return [...steps, `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`];
}

// Column subtraction, regrouping from the next place up when the top is smaller
function subtractColumns(a, b) {
  const top = String(a).split('').reverse().map(Number);
  const bottom = String(b).split('').reverse().map(Number);
  const steps = [];
  for (let i = 0; i < top.length; i++) {
    const below = bottom[i] || 0;
    let note = '';
    if (top[i] < below) {
      let j = i + 1;
      while (top[j] === 0) j++;
      top[j] -= 1;
      for (let k = j - 1; k > i; k--) top[k] = 9;
      top[i] += 10;
      note = ' (regrouped)';
    }
    if (i >= bottom.length && top.slice(i).every((d) => d === 0)) break;
    steps.push(`${PLACES[i]}: ${top[i]} − ${below} = ${top[i] - below}${note}`);
  }
  return [...steps, `${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`];
}

// Partial products: split each number by place, multiply the parts, add them up
function multiplyParts(a, b) {
  if (a % 10 === 0 && a < 100 && b <= 12) {
    return [`${a} is ${a / 10} tens`, `${a / 10} tens × ${b} = ${(a / 10) * b} tens`, `= ${fmt(a * b)}`];
  }
  const split = (n) => [100, 10, 1].map((p) => Math.floor(n / p) % 10 * p).filter(Boolean);
  const as = split(a);
  const bs = b > 12 ? split(b) : [b];
  const products = bs.flatMap((y) => as.map((x) => [x, y, x * y]));
  if (products.length === 1) return [`${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}`];
  return [
    `Split by place: ${products.map(([x, y]) => `${fmt(x)} × ${fmt(y)}`).join(' + ')}`,
    `= ${products.map(([, , xy]) => fmt(xy)).join(' + ')}`,
    `= ${fmt(a * b)}`
  ];
}

// Strategy steps for an equation shot
export function equationSteps(p) {
  const { a, b, op, result } = p;
  if (p.missing !== 'result') return backwardSteps(p);
  if (op === '+') {
    if (a < 10 && b < 10 && a + b > 10) {
      const fill = 10 - a;
      return [`Make a ten: ${a} + ${fill} = 10`, `${b} is ${fill} + ${b - fill}`, `10 + ${b - fill} = ${result}`];
    }
    return a >= 10 && b >= 10 ? addColumns(a, b) : [`Count on ${b} from ${a}`, `${a} + ${b} = ${result}`];
  }
  if (op === '-') {
    return a >= 20 ? subtractColumns(a, b) : [`Count up from ${b} to ${a}`, `${b} + ${result} = ${a}, so ${a} − ${b} = ${result}`];
  }
  if (op === '×') {
    if (a > 12 || b > 12) return multiplyParts(a, b);
    const count = Array.from({ length: Math.min(a, 6) }, (_, i) => (i + 1) * b).join(', ');
    return [`${a} groups of ${b}`, `Skip count by ${b}: ${count}${a > 6 ? ', …' : ''}`, `${a} × ${b} = ${result}`];
  }
  return [`Think multiplication: ${b} × ? = ${a}`, `${b} × ${result} = ${a}`, `So ${a} ÷ ${b} = ${result}`];
}

function equationHint(p) {
  const { a, b, op, result, missing } = p;
  if (missing === 'a' || missing === 'b') return `Work backward from ${fmt(result)}.`;
  if (op === '+') return a < 10 && b < 10 && a + b > 10 ? 'Make a ten first.' : 'Add the ones first, then the tens.';
  if (op === '-') return a <= 20 ? `Count up from ${b}.` : 'Start with the ones. Regroup if the top is smaller.';
  if (op === '×') return a > 12 ? `Split ${fmt(a)} into hundreds, tens and ones.` : `Skip count by ${b}.`;
  return `Think: ${b} times what makes ${fmt(a)}?`;
}

// ---------- Equations: facts, and finding the missing number ----------
// sumMax: + and − stay within this. factMax: × and ÷ facts go up to this.

const EQUATION_RANGES = {
  rookie: { sumMax: 20, factMax: 5, missing: { result: 65, b: 25, a: 10 } },
  starter: { sumMax: 50, factMax: 10, missing: { result: 55, b: 25, a: 20 } },
  allstar: { sumMax: 100, factMax: 12, missing: { result: 50, b: 25, a: 25 } },
  mvp: { sumMax: 100, factMax: 12, missing: { result: 40, b: 30, a: 30 } },
  stretch: { sumMax: 100, factMax: 12, missing: { result: 34, b: 33, a: 33 } }
};

// Within 20, + and − use single digits; past that, two-digit numbers.
export function equationNumbers(op, { sumMax, factMax }) {
  let a, b, result;
  if (op === '+') {
    if (sumMax <= 20) {
      a = randInt(2, 9);
      b = randInt(2, 8);
    } else {
      const sum = randInt(20, sumMax);
      a = randInt(10, sum - 2);
      b = sum - a;
    }
    result = a + b;
  } else if (op === '-') {
    if (sumMax <= 20) {
      result = randInt(1, 8);
      b = randInt(2, 7);
      a = result + b;
    } else {
      a = randInt(20, sumMax);
      b = randInt(2, a - 1);
      result = a - b;
    }
  } else if (op === '×') {
    a = randInt(2, factMax);
    b = randInt(2, factMax);
    result = a * b;
  } else {
    b = randInt(2, factMax);
    result = randInt(1, factMax);
    a = result * b;
  }
  return { a, b, op, result };
}

export const equation = {
  ...equationShape,
  label: 'Equations',
  blurb: 'Facts, and finding the missing number.',
  family: 'paint',
  weight: 4,
  tip: 'Stuck on a fact? Start from one you know: 7 × 8 is 7 × 7, plus 7.',
  generate({ level, tier, ops }) {
    const ranges = rangesFor(EQUATION_RANGES, level, tier);
    const op = pickFrom(ops?.length ? ops : ['+']);
    return { kind: 'equation', ...equationNumbers(op, ranges), missing: pickWeighted(ranges.missing) };
  },
  hint: equationHint,
  steps: equationSteps
};

// ---------- Big numbers: multi-digit + and − with regrouping, and big × ----------
// a and b are [min, max] (aStep / bStep 10 means tens only), and max caps a + b.
// zeroTens is the share of − shots whose first number has a 0 in the tens
// place, like 503 − 278, where the borrow has to cross the zero.

const BIG_RANGES = {
  rookie: {
    '+': { a: [11, 79], b: [10, 80], bStep: 10, max: 99 },
    '-': { a: [21, 99], b: [10, 80], bStep: 10 },
    '×': { a: [10, 50], aStep: 10, b: [2, 5] }
  },
  starter: {
    '+': { a: [11, 89], b: [11, 89], max: 100 },
    '-': { a: [21, 99], b: [11, 89] },
    '×': { a: [11, 25], b: [2, 5] }
  },
  allstar: {
    '+': { a: [100, 899], b: [10, 99], max: 999 },
    '-': { a: [100, 999], b: [10, 99], zeroTens: 0.15 },
    '×': { a: [12, 99], b: [2, 9] }
  },
  mvp: {
    '+': { a: [100, 899], b: [100, 899], max: 1000 },
    '-': { a: [200, 999], b: [100, 899], zeroTens: 0.2 },
    '×': { a: [100, 999], b: [2, 9] }
  },
  stretch: {
    '+': { a: [100, 899], b: [100, 899], max: 1000 },
    '-': { a: [500, 1000], b: [100, 999], zeroTens: 0.25 },
    '×': { a: [12, 99], b: [12, 99], missing: { result: 1 } }
  }
};

const BIG_MISSING = {
  '+': { result: 70, b: 20, a: 10 },
  '-': { result: 70, b: 20, a: 10 },
  '×': { result: 75, b: 25 }
};

// About 60% of + and − shots carry or borrow somewhere
const REGROUP_SHARE = 0.6;

// True when some column carries (+) or borrows (−)
export function regroups(a, b, op) {
  for (; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) {
    const da = a % 10;
    const db = b % 10;
    if (op === '+' ? da + db >= 10 : da < db) return true;
  }
  return false;
}

export function bigNumbers(op, r) {
  const wantRegroup = op !== '×' && !r.bStep && Math.random() < REGROUP_SHARE;
  let pick = null;
  for (let tries = 0; tries < 60; tries++) {
    let a = randStep(r.a[0], r.a[1], r.aStep);
    if (op === '-' && r.zeroTens && Math.random() < r.zeroTens) a -= (Math.floor(a / 10) % 10) * 10;
    const bMax = op === '+' ? Math.min(r.b[1], r.max - a)
      : op === '-' ? Math.min(r.b[1], a - 1)
      : r.b[1];
    const b = randStep(r.b[0], bMax, r.bStep);
    if (b === null) continue;
    pick = { a, b };
    if (op === '×' || r.bStep || regroups(a, b, op) === wantRegroup) break;
  }
  return { ...pick, op, result: compute(pick.a, pick.b, op) };
}

export const BIG_LEVEL_RANGES = BIG_RANGES;

export const bignumbers = {
  ...equationShape,
  label: 'Big numbers',
  blurb: 'Bigger numbers, one place at a time: ones, then tens, then hundreds.',
  family: 'leftwing',
  weight: 3,
  tip: 'Line up the places: ones under ones, tens under tens.',
  generate({ level, tier }) {
    const op = pickWeighted({ '+': 35, '-': 35, '×': 30 });
    const ranges = rangesFor(BIG_RANGES, level, tier)[op];
    return { kind: 'bignumbers', ...bigNumbers(op, ranges), missing: pickWeighted(ranges.missing || BIG_MISSING[op]) };
  },
  hint(p) {
    if (p.missing !== 'result') return p.op === '×' ? 'Try a number, multiply, and adjust.' : `Work backward from ${fmt(p.result)}.`;
    if (p.op === '+') return 'Add the ones first. Ten ones make a ten.';
    if (p.op === '-') return 'Start with the ones. Regroup if the top digit is smaller.';
    return `Split ${fmt(p.a)} by place, multiply each part, then add.`;
  },
  steps: equationSteps
};

// ---------- Leftovers: division with a remainder, A ÷ B = Q R r ----------
// b and q are [min, max], and a (when given) is the range for the first number.
// About one shot in five divides evenly, so "R 0" is a real answer too.

const LEFTOVER_RANGES = {
  rookie: { b: [2, 5], q: [1, 5] },
  starter: { b: [2, 9], q: [2, 9] },
  allstar: { b: [2, 9], q: [2, 49], a: [20, 99] },
  mvp: { b: [2, 9], q: [11, 499], a: [100, 999] },
  stretch: { b: [6, 9], q: [50, 166], a: [500, 999] }
};

const EVEN_SHARE = 0.2;

// evenShare: how often the division comes out even (no remainder)
export function leftoverNumbers({ b: bRange, q: qRange, a: aRange = [0, Infinity] }, evenShare = EVEN_SHARE) {
  for (let tries = 0; tries < 100; tries++) {
    const b = randInt(...bRange);
    const r = Math.random() < evenShare ? 0 : randInt(1, b - 1);
    const qMin = Math.max(qRange[0], Math.ceil((aRange[0] - r) / b));
    const qMax = Math.min(qRange[1], Math.floor((aRange[1] - r) / b));
    if (qMin > qMax) continue;
    const q = randInt(qMin, qMax);
    return { a: q * b + r, b, op: '÷', result: q, remainder: r };
  }
  return { a: 17, b: 5, op: '÷', result: 3, remainder: 2 };
}

export const LEFTOVER_LEVEL_RANGES = LEFTOVER_RANGES;

// How a remainder division works out, step by step
export function remainderSteps(a, b) {
  const q = Math.floor(a / b);
  const r = a % b;
  if (q <= 12) {
    return [`How many ${b}s fit in ${fmt(a)}? ${b} × ${q} = ${fmt(b * q)}`, `${fmt(a)} − ${fmt(b * q)} = ${r} left over`, `${fmt(a)} ÷ ${b} = ${fmt(q)} R ${r}`];
  }
  return [...shareByPlace(a, b).steps, `${fmt(a)} ÷ ${b} = ${fmt(q)} R ${r}`];
}

export const leftovers = {
  label: 'Leftovers',
  blurb: 'Divide, then count what is left over. That part is the R.',
  family: 'rightwing',
  layout: 'equation',
  weight: 2,
  tip: 'The leftover is always smaller than the number you divide by.',
  generate({ level, tier }) {
    return { kind: 'leftovers', ...leftoverNumbers(rangesFor(LEFTOVER_RANGES, level, tier)) };
  },
  boxes: () => [{ role: 'target' }, { role: 'remainder', cue: 'Now the leftover' }],
  answers: (p) => [p.result, p.remainder],
  prompt: (p, box) =>
    `<span class="num-a">${fmt(p.a)}</span><span class="op-symbol">÷</span><span class="num-b">${fmt(p.b)}</span>`
    + `<span class="equals">=</span>${box(0)}<span class="rem-label">R</span>${box(1)}`,
  text(p, { solved = false } = {}) {
    return `${fmt(p.a)} ÷ ${fmt(p.b)} = ${solved ? fmt(p.result) : '?'} R ${solved ? p.remainder : '?'}`;
  },
  hint: (p) => `How many groups of ${p.b} fit in ${fmt(p.a)}? What's left is the R.`,
  steps: (p) => remainderSteps(p.a, p.b),
  board: (p) => manipulativeHtml(p.a, p.b, '÷'),
  // Practice starts with one group; adding groups shows the share and the leftover
  toLab: (p) => ({ op: '÷', a: p.a, b: 1 }),
  isValid: (p) => p.op === '÷'
    && ['a', 'b', 'result', 'remainder'].every((k) => isInt(p[k]))
    && p.b >= 2
    && p.remainder < p.b
    && p.a === p.result * p.b + p.remainder
};
