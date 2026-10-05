// Plays: the kinds of shots the Game calls. Each play makes its own problems,
// says how many answer boxes a shot has and what goes in them, draws its
// prompt, and maps a shot to Practice for "Need a look?".
//
// A problem is plain data ({ kind, a, b, op, result, ... }) so a shot can be
// saved mid-game. Generators don't touch the DOM, which lets
// scripts/check-plays.mjs run every play in Node.

import { OPS, OP_LABEL, compute, fmt } from './math.js';

export const LEVELS = ['rookie', 'starter', 'allstar', 'mvp'];

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isInt = (n) => Number.isInteger(n) && n >= 0;

// A multiple of `step` in [min, max], or null when there isn't one
function randStep(min, max, step = 1) {
  const lo = Math.ceil(min / step);
  const hi = Math.floor(max / step);
  return lo > hi ? null : step * randInt(lo, hi);
}

// Picks a key from { key: weight }
function pickWeighted(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

// Tiers 0–2 ramp difficulty inside a level: at tier 1 about a third of shots,
// and at tier 2 about two thirds, use the next level's ranges (past MVP, the
// play's "stretch" ranges). The Game plays tier 0.
const NEXT_LEVEL_SHARE = [0, 0.3, 0.6];

function rangesFor(table, level, tier = 0) {
  const next = table[LEVELS[LEVELS.indexOf(level) + 1]] || table.stretch;
  return Math.random() < NEXT_LEVEL_SHARE[tier] ? next : table[level];
}

// ---------- Equation shots: A op B = result, with one of the three hidden ----------

const SLOTS = ['a', 'b', 'result'];
const SLOT_CLASS = { a: 'num-a', b: 'num-b', result: 'num-target' };
const SLOT_ROLE = { a: 'a', b: 'b', result: 'target' };

const equationShape = {
  boxes: (p) => [{ role: SLOT_ROLE[p.missing] }],
  answers: (p) => [p[p.missing]],

  // box(i) draws answer box i
  prompt(p, box) {
    const slot = (name) => (p.missing === name ? box(0) : `<span class="${SLOT_CLASS[name]}">${fmt(p[name])}</span>`);
    return `${slot('a')}<span class="op-symbol">${OP_LABEL[p.op]}</span>${slot('b')}<span class="equals">=</span>${slot('result')}`;
  },

  // Plain text, with "?" for the hidden number unless solved
  text(p, { solved = false } = {}) {
    const show = (name) => (p.missing === name && !solved ? '?' : fmt(p[name]));
    return `${show('a')} ${OP_LABEL[p.op]} ${show('b')} = ${show('result')}`;
  },

  // Practice starts from a baseline so the hidden number gets built, not shown:
  // B starts at 0 (1 for × and ÷), and a hidden A starts low with B as given.
  toLab(p) {
    if (p.missing === 'a') return { op: p.op, a: p.op === '-' || p.op === '÷' ? p.b : 1, b: p.b };
    return { op: p.op, a: p.a, b: p.op === '×' || p.op === '÷' ? 1 : 0 };
  },

  isValid(p) {
    return OPS.includes(p.op)
      && SLOTS.every((k) => isInt(p[k]))
      && SLOTS.includes(p.missing)
      && p.a >= 1
      && (p.op !== '-' || p.b <= p.a)
      && (p.op !== '÷' || (p.b >= 1 && p.a % p.b === 0))
      && compute(p.a, p.b, p.op) === p.result;
  }
};

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
function equationNumbers(op, { sumMax, factMax }) {
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

const equation = {
  ...equationShape,
  weight: 4,
  generate({ level, tier, ops }) {
    const ranges = rangesFor(EQUATION_RANGES, level, tier);
    const op = pickFrom(ops?.length ? ops : ['+']);
    return { kind: 'equation', ...equationNumbers(op, ranges), missing: pickWeighted(ranges.missing) };
  }
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

function bigNumbers(op, r) {
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

const bignumbers = {
  ...equationShape,
  weight: 3,
  generate({ level, tier }) {
    const op = pickWeighted({ '+': 35, '-': 35, '×': 30 });
    const ranges = rangesFor(BIG_RANGES, level, tier)[op];
    return { kind: 'bignumbers', ...bigNumbers(op, ranges), missing: pickWeighted(ranges.missing || BIG_MISSING[op]) };
  }
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

function leftoverNumbers({ b: bRange, q: qRange, a: aRange = [0, Infinity] }) {
  for (let tries = 0; tries < 100; tries++) {
    const b = randInt(...bRange);
    const r = Math.random() < EVEN_SHARE ? 0 : randInt(1, b - 1);
    const qMin = Math.max(qRange[0], Math.ceil((aRange[0] - r) / b));
    const qMax = Math.min(qRange[1], Math.floor((aRange[1] - r) / b));
    if (qMin > qMax) continue;
    const q = randInt(qMin, qMax);
    return { a: q * b + r, b, op: '÷', result: q, remainder: r };
  }
  return { a: 17, b: 5, op: '÷', result: 3, remainder: 2 };
}

const leftovers = {
  weight: 2,
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
  // Practice starts with one group; adding groups shows the share and the leftover
  toLab: (p) => ({ op: '÷', a: p.a, b: 1 }),
  isValid: (p) => p.op === '÷'
    && ['a', 'b', 'result', 'remainder'].every((k) => isInt(p[k]))
    && p.b >= 2
    && p.remainder < p.b
    && p.a === p.result * p.b + p.remainder
};

// ---------- The playbook ----------

export const PLAYS = { equation, bignumbers, leftovers };
export const PLAY_IDS = Object.keys(PLAYS);

export const isValidProblem = (p) =>
  !!p && typeof p === 'object' && PLAY_IDS.includes(p.kind) && PLAYS[p.kind].isValid(p);

// A play from the playbook, picked by weight
export function choosePlay(playbook) {
  const ids = PLAY_IDS.filter((id) => playbook.includes(id));
  return pickWeighted(Object.fromEntries((ids.length ? ids : ['equation']).map((id) => [id, PLAYS[id].weight])));
}
