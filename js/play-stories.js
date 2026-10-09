// Story plays: short basketball word problems. Story shots (one step),
// Times as many (comparing by multiplying), Leftover stories (what to do with
// a remainder) and Two-step plays. See js/plays.js for what every play provides.
//
// Templates use {a}, {b}, {c} for numbers, {r} for a known result and {s1} for
// a step-one answer, {P} and {Q} for players. In the prompt, {a} is blue, {b}
// amber and {r} pink, matching the equation colors. Names stand in for
// pronouns, and every story stays short (25 words; 32 for two-step plays).

import { compute, fmt } from './math.js';
import { randInt, pickFrom, pickWeighted, rangesFor, isInt, chance } from './kit.js';
import {
  equationText, isValidEquation, equationToLab, equationSteps,
  leftoverNumbers, LEFTOVER_LEVEL_RANGES
} from './play-numbers.js';
import { partWholeHtml, equalGroupsHtml, compareBarsHtml, tapeHtml, groupsHtml } from './visuals.js';

export const CAST = ['Addy', 'Phee', 'Kayla'];

function castPair() {
  const P = pickFrom(CAST);
  let Q;
  do Q = pickFrom(CAST); while (Q === P);
  return { P, Q };
}

const NUM_CLASS = { a: 'num-a', b: 'num-b', c: 'num-c', r: 'num-target', s1: 'num-c' };

// Fills a template; html colors the numbers
export function fillStory(text, v, { html = false } = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key === 'P' || key === 'Q') return v[key];
    const n = v[key];
    return html ? `<b class="${NUM_CLASS[key]}">${fmt(n)}</b>` : fmt(n);
  });
}

export const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

// The story, then the answer box with its unit
function storyPrompt(text, unit, box) {
  return `<p class="story-text">${text}</p><div class="answer-line">${box(0)}<span class="answer-unit">${unit}</span></div>`;
}

const validNames = (p) => CAST.includes(p.P) && (p.Q === undefined || (CAST.includes(p.Q) && p.Q !== p.P));

// A bar model for one operation. ask: which number is unknown ('result' or a slot)
function modelFor(op, x, y, result, ask, solved, names = {}) {
  if (op === '+') {
    return partWholeHtml({ total: result, parts: [{ value: x, cls: 'num-a-bg' }, { value: y, cls: 'num-b-bg' }], ask: ask === 'result' ? 'total' : ask === 'a' ? 0 : 1, solved });
  }
  if (op === '-') {
    return partWholeHtml({ total: x, parts: [{ value: result, cls: 'num-t-bg' }, { value: y, cls: 'num-gone-bg' }], ask: ask === 'result' ? 0 : ask === 'a' ? 'total' : 1, solved, caption: `${fmt(y)} taken away` });
  }
  if (op === '×') return equalGroupsHtml({ groups: x, each: y, ask: ask === 'result' ? 'total' : ask === 'a' ? 'groups' : 'each', solved });
  return names.groups
    ? equalGroupsHtml({ groups: result, each: y, ask: 'groups', solved })
    : equalGroupsHtml({ groups: y, each: result, ask: 'each', solved });
}

// ---------- Story numbers by level ----------
// add: range for the first number of + and − (addB for the second). mul: big ×
// (A from mulA, B from mulB). divQ: quotients for big ÷. fact: biggest fact.

const STORY_RANGES = {
  rookie: { add: [2, 9], sumMax: 18, fact: 5 },
  starter: { add: [10, 49], sumMax: 99, fact: 10 },
  allstar: { add: [100, 499], addB: [10, 99], sumMax: 999, fact: 12, mulA: [12, 99], mulB: [2, 9] },
  mvp: { add: [100, 499], addB: [100, 499], sumMax: 1000, fact: 12, mulA: [100, 999], mulB: [2, 9], divQ: [12, 99] },
  stretch: { add: [200, 499], addB: [100, 499], sumMax: 1000, fact: 12, mulA: [100, 999], mulB: [3, 9], divQ: [20, 110] }
};

function storyNumbers(op, r) {
  const pair = () => {
    for (;;) {
      const x = randInt(...r.add);
      const y = randInt(...(r.addB || r.add));
      if (x + y <= r.sumMax) return [x, y];
    }
  };
  if (op === '+') {
    const [a, b] = pair();
    return { a, b, op, result: a + b };
  }
  if (op === '-') {
    const [x, y] = pair();
    return { a: x + y, b: y, op, result: x };
  }
  if (op === '×') {
    const [a, b] = r.mulA ? [randInt(...r.mulA), randInt(...r.mulB)] : [randInt(2, r.fact), randInt(2, r.fact)];
    return { a, b, op, result: a * b };
  }
  const b = randInt(2, r.divQ ? 9 : r.fact);
  const q = r.divQ ? randInt(...r.divQ) : randInt(2, r.fact);
  return { a: b * q, b, op, result: q };
}

// ---------- Story shots: one step ----------
// model: the bar model the board draws. small: only with fact-sized numbers.

const STORIES = [
  { id: 'add-points', op: '+', ask: 'result', unit: 'points', text: '{P} scored {a} points at home and {b} on the road. How many points in all?', hint: '"In all" means put them together: add.' },
  { id: 'add-fans', op: '+', ask: 'result', unit: 'fans', text: '{a} fans came Friday and {b} came Saturday. How many fans in all?', hint: '"In all" means put them together: add.' },
  { id: 'add-cards', op: '+', ask: 'b', unit: 'cards', text: '{P} had {a} trading cards. After a trade, {P} had {r}. How many cards did {P} get?', hint: 'Start at {a}. How many more make {r}?' },
  { id: 'sub-jerseys', op: '-', ask: 'result', unit: 'jerseys', text: 'The team store had {a} jerseys. Fans bought {b}. How many jerseys are left?', hint: '"Left" means take away: subtract.' },
  { id: 'sub-more', op: '-', ask: 'result', unit: 'more points', compare: true, text: '{P} scored {a} points. {Q} scored {b}. How many more points did {P} score?', hint: '"How many more" means find the difference: subtract.' },
  { id: 'sub-seats', op: '-', ask: 'b', unit: 'seats', text: 'The arena had {a} empty seats. Fans filled some. Now {r} are empty. How many seats were filled?', hint: 'From {a} down to {r}: how many?' },
  { id: 'mul-rows', op: '×', ask: 'result', unit: 'seats', small: true, text: 'There are {a} rows with {b} seats in each row. How many seats?', hint: '{a} rows of {b}: that is {a} groups of {b}. Multiply.' },
  { id: 'mul-bags', op: '×', ask: 'result', unit: 'basketballs', small: true, text: 'Coach Cheryl has {a} bags with {b} basketballs in each. How many basketballs?', hint: '{a} groups of {b}: multiply.' },
  { id: 'mul-nights', op: '×', ask: 'result', unit: 'tickets', text: 'The arena sold {a} tickets each night for {b} nights. How many tickets in all?', hint: '{b} nights of {a}: multiply.' },
  { id: 'div-share', op: '÷', ask: 'result', unit: 'each', text: '{a} water bottles are shared equally by {b} players. How many does each player get?', hint: '"Shared equally" means divide.' },
  { id: 'div-teams', op: '÷', ask: 'result', unit: 'teams', groups: true, text: '{a} players split into teams of {b}. How many teams?', hint: 'How many groups of {b} fit in {a}? Divide.' }
];

const findTemplate = (list, id) => list.find((tpl) => tpl.id === id);

// Variables for filling a template from an equation-shaped problem
const varsOf = (p) => ({ a: p.a, b: p.b, r: p.result, P: p.P, Q: p.Q });

function storyText(p, tpl, html) {
  return fillStory(tpl.text, varsOf(p), { html });
}

export const stories = {
  label: 'Story shots',
  blurb: 'Short basketball stories. Read the story, find the math, take the shot.',
  family: 'top',
  layout: 'story',
  reading: true,
  weight: 3,
  tip: 'Find the question first, then the numbers you need.',

  concept: (p) => {
    const op = findTemplate(STORIES, p.t).op;
    return { key: op, label: { '+': 'addition stories', '-': 'subtraction stories', '×': 'multiplication stories', '÷': 'division stories' }[op] };
  },
  generate({ level, tier }) {
    const r = rangesFor(STORY_RANGES, level, tier);
    const big = !!r.mulA;
    const tpl = pickFrom(STORIES.filter((s) => !(big && s.small)));
    return { kind: 'stories', t: tpl.id, ...storyNumbers(tpl.op, r), missing: tpl.ask, ...castPair() };
  },
  boxes: (p) => [{ role: p.missing === 'b' ? 'b' : 'target' }],
  answers: (p) => [p[p.missing]],
  prompt(p, box) {
    const tpl = findTemplate(STORIES, p.t);
    return storyPrompt(storyText(p, tpl, true), tpl.unit, box);
  },
  text: (p) => storyText(p, findTemplate(STORIES, p.t), false),
  equation: equationText,
  hint: (p) => fillStory(findTemplate(STORIES, p.t).hint, varsOf(p)),
  steps: (p) => [`Write it as math: ${equationText(p)}`, ...equationSteps(p)],
  board(p, { solved = false } = {}) {
    const tpl = findTemplate(STORIES, p.t);
    if (tpl.compare) return compareBarsHtml({ big: p.a, small: p.b, bigName: p.P, smallName: p.Q, ask: 'diff', solved });
    return modelFor(p.op, p.a, p.b, p.result, p.missing, solved, { groups: tpl.groups });
  },
  toLab: equationToLab,
  isValid: (p) => !!findTemplate(STORIES, p.t) && findTemplate(STORIES, p.t).ask === p.missing
    && findTemplate(STORIES, p.t).op === p.op && isValidEquation(p) && validNames(p)
};

// ---------- Times as many: comparing by multiplying ----------
// "More than" (adding) shows up too, so the two don't get mixed up.

const TIMES = [
  { id: 'tam-product', op: '×', ask: 'result', unit: 'rebounds', text: '{P} grabbed {a} rebounds. {Q} grabbed {b} times as many. How many rebounds did {Q} grab?', hint: '"Times as many" means multiply.' },
  { id: 'tam-multiplier', op: '×', ask: 'b', unit: 'times as many', text: '{P} scored {a} points. {Q} scored {r}. How many times as many points did {Q} score?', hint: 'How many {a}s make {r}? Divide.' },
  { id: 'tam-smaller', op: '×', ask: 'a', unit: 'posters', text: '{Q} has {r} posters. That is {b} times as many as {P} has. How many posters does {P} have?', hint: 'Work backward: divide {r} by {b}.' },
  { id: 'tam-more', op: '+', ask: 'result', unit: 'jerseys', text: '{P} has {a} jerseys. {Q} has {b} more than {P}. How many jerseys does {Q} have?', hint: '"More than" means add. "Times as many" would mean multiply.' },
  { id: 'tam-pow10', op: '×', ask: 'b', unit: 'times as heavy', text: 'A truck weighs {r} pounds. A bike weighs {a} pounds. How many times as heavy is the truck?', hint: 'Count the zeros: each × 10 adds one more zero.' }
];

// mix: template weights. fact: facts for a and b. mulA: a big first number for
// the product. pow: powers of ten for "times as heavy".
const TIMES_RANGES = {
  rookie: { mix: { 'tam-product': 40, 'tam-more': 30, 'tam-multiplier': 15, 'tam-smaller': 15 }, fact: [2, 5] },
  starter: { mix: { 'tam-product': 30, 'tam-more': 20, 'tam-multiplier': 25, 'tam-smaller': 25 }, fact: [2, 10] },
  allstar: { mix: { 'tam-product': 25, 'tam-more': 15, 'tam-multiplier': 25, 'tam-smaller': 25, 'tam-pow10': 10 }, fact: [2, 12], pow: [10, 100] },
  mvp: { mix: { 'tam-product': 25, 'tam-more': 10, 'tam-multiplier': 25, 'tam-smaller': 25, 'tam-pow10': 15 }, fact: [2, 12], mulA: [12, 99], pow: [10, 100, 1000] },
  stretch: { mix: { 'tam-product': 30, 'tam-more': 5, 'tam-multiplier': 25, 'tam-smaller': 25, 'tam-pow10': 15 }, fact: [3, 12], mulA: [12, 99], pow: [10, 100, 1000] }
};

function timesNumbers(tpl, r) {
  if (tpl.id === 'tam-pow10') {
    const a = randInt(2, 9) * 10;
    const b = pickFrom(r.pow);
    return { a, b, op: '×', result: a * b };
  }
  if (tpl.id === 'tam-more') {
    const a = randInt(r.fact[0], r.fact[1] * 3);
    const b = randInt(r.fact[0], r.fact[1]);
    return { a, b, op: '+', result: a + b };
  }
  const a = tpl.id === 'tam-product' && r.mulA ? randInt(...r.mulA) : randInt(...r.fact);
  const b = randInt(Math.max(2, r.fact[0]), Math.min(9, r.fact[1]));
  return { a, b, op: '×', result: a * b };
}

export const timesasmany = {
  label: 'Times as many',
  blurb: '"Times as many" means multiply. "More than" means add. This play has both.',
  family: 'top',
  layout: 'story',
  reading: true,
  weight: 3,
  tip: '"3 times as many" means 3 groups of the same amount.',

  generate({ level, tier }) {
    const r = rangesFor(TIMES_RANGES, level, tier);
    const tpl = findTemplate(TIMES, pickWeighted(r.mix));
    return { kind: 'timesasmany', t: tpl.id, ...timesNumbers(tpl, r), missing: tpl.ask, ...castPair() };
  },
  boxes: (p) => [{ role: p.missing === 'a' ? 'a' : p.missing === 'b' ? 'b' : 'target' }],
  answers: (p) => [p[p.missing]],
  prompt(p, box) {
    const tpl = findTemplate(TIMES, p.t);
    return storyPrompt(fillStory(tpl.text, varsOf(p), { html: true }), tpl.unit, box);
  },
  text: (p) => fillStory(findTemplate(TIMES, p.t).text, varsOf(p)),
  equation: equationText,
  hint: (p) => fillStory(findTemplate(TIMES, p.t).hint, varsOf(p)),
  steps(p) {
    const { a, b, result } = p;
    if (p.t === 'tam-more') return [`"${b} more than" means add ${b}`, `${a} + ${b} = ${result}`];
    if (p.t === 'tam-pow10') {
      const steps = [];
      for (let x = a; x < result; x *= 10) steps.push(`${fmt(x)} × 10 = ${fmt(x * 10)}`);
      return [...steps, `That's ${steps.length} times × 10, so × ${fmt(b)}`];
    }
    if (p.t === 'tam-product') return [`${b} times as many: ${b} groups of ${a}`, `${a} × ${b} = ${fmt(result)}`];
    if (p.t === 'tam-multiplier') return [`How many ${a}s make ${fmt(result)}?`, `${a} × ? = ${fmt(result)}`, `${fmt(result)} ÷ ${a} = ${b}`];
    return [`${fmt(result)} is ${b} times as many as ${p.P} has`, `? × ${b} = ${fmt(result)}`, `${fmt(result)} ÷ ${b} = ${a}`];
  },
  board(p, { solved = false } = {}) {
    if (p.t === 'tam-more') return compareBarsHtml({ big: p.result, small: p.a, bigName: p.Q, smallName: p.P, ask: 'big', solved });
    if (p.t === 'tam-pow10') {
      const rungs = [];
      for (let x = p.a; x <= p.result; x *= 10) rungs.push(`<span class="pow-rung">${fmt(x)}</span>`);
      return `<div class="pow-ladder">${rungs.join('<span class="pow-step">× 10</span>')}</div>`
        + `<p class="bar-caption">${solved ? `× ${fmt(p.b)} in all` : 'How many × 10 steps?'}</p>`;
    }
    const ask = p.missing === 'result' ? 'total' : p.missing === 'b' ? 'k' : 'unit';
    return tapeHtml({ unit: p.a, k: p.b, smallName: p.P, bigName: p.Q, ask, solved });
  },
  toLab: equationToLab,
  isValid: (p) => !!findTemplate(TIMES, p.t) && findTemplate(TIMES, p.t).ask === p.missing
    && findTemplate(TIMES, p.t).op === p.op && isValidEquation(p) && validNames(p)
};

// ---------- Leftover stories: what the remainder means ----------
// mode 'up': the leftovers need one more (round up); 'drop': only whole ones
// count; 'left': the leftovers are the answer. one: a single unit, for steps.

const LEFTOVER_STORIES = [
  { id: 'up-vans', mode: 'up', one: 'van', unit: 'vans', text: '{a} fans need rides to the game. Each van holds {b}. How many vans are needed?', hint: 'Every fan needs a ride, so the leftovers need one more van.' },
  { id: 'up-benches', mode: 'up', one: 'bench', unit: 'benches', text: '{a} players need seats. Each bench fits {b}. How many benches are needed?', hint: 'Every player needs a seat, so round up.' },
  { id: 'up-boxes', mode: 'up', one: 'box', unit: 'boxes', text: '{a} jerseys go into boxes of {b}. How many boxes are needed to pack them all?', hint: 'Every jersey needs a box, so round up.' },
  { id: 'drop-tickets', mode: 'drop', one: 'ticket', unit: 'tickets', text: '{P} has {a} dollars. Tickets cost {b} dollars each. How many tickets can {P} buy?', hint: 'Only whole tickets count, so the leftover dollars don\'t buy one.' },
  { id: 'drop-bags', mode: 'drop', one: 'bag', unit: 'full bags', text: '{a} basketballs go into bags of {b}. How many bags get filled all the way?', hint: 'Only full bags count.' },
  { id: 'drop-drills', mode: 'drop', one: 'drill', unit: 'drills', text: 'Coach Cheryl has {a} minutes. Each drill takes {b} minutes. How many whole drills fit?', hint: 'Only whole drills count.' },
  { id: 'left-wristbands', mode: 'left', unit: 'left over', text: '{a} wristbands are shared equally by {b} players. How many are left over?', hint: 'The question asks for the leftovers: the R.' },
  { id: 'left-snacks', mode: 'left', unit: 'left over', text: '{a} snacks go into {b} equal bags. How many snacks are left over?', hint: 'The question asks for the leftovers: the R.' },
  { id: 'left-extra', mode: 'left', unit: 'extra players', text: '{a} players make teams of {b}. How many extra players are there?', hint: 'The extra players are the leftovers: the R.' }
];

const leftoverAnswer = (p) => (p.mode === 'up' ? p.q + 1 : p.mode === 'drop' ? p.q : p.r);

export const leftoverstories = {
  label: 'Leftover stories',
  blurb: 'Divide, then decide: do the leftovers need one more, get dropped, or are they the answer?',
  family: 'top',
  layout: 'story',
  reading: true,
  weight: 2,
  tip: 'Ask what the leftovers mean: one more van, or not enough for another ticket?',

  generate({ level, tier }) {
    // Never even here, so there's always a leftover to think about
    const n = leftoverNumbers(rangesFor(LEFTOVER_LEVEL_RANGES, level, tier), 0);
    const tpl = pickFrom(LEFTOVER_STORIES);
    return { kind: 'leftoverstories', t: tpl.id, mode: tpl.mode, a: n.a, b: n.b, q: n.result, r: n.remainder, P: pickFrom(CAST) };
  },
  boxes: () => [{ role: 'target' }],
  answers: (p) => [leftoverAnswer(p)],
  prompt(p, box) {
    const tpl = findTemplate(LEFTOVER_STORIES, p.t);
    return storyPrompt(fillStory(tpl.text, p, { html: true }), tpl.unit, box);
  },
  text: (p) => fillStory(findTemplate(LEFTOVER_STORIES, p.t).text, p),
  equation: (p, { solved = false } = {}) => (solved
    ? `${fmt(p.a)} ÷ ${p.b} = ${fmt(p.q)} R ${p.r}, so ${fmt(leftoverAnswer(p))}`
    : `${fmt(p.a)} ÷ ${p.b} = ? R ?`),
  hint: (p) => findTemplate(LEFTOVER_STORIES, p.t).hint,
  steps(p) {
    const tpl = findTemplate(LEFTOVER_STORIES, p.t);
    const div = `${fmt(p.a)} ÷ ${p.b} = ${fmt(p.q)} R ${p.r}`;
    if (p.mode === 'up') return [div, `The ${p.r} left over still need a ${tpl.one}`, `${fmt(p.q)} + 1 = ${fmt(p.q + 1)} ${tpl.unit}`];
    if (p.mode === 'drop') return [div, `The ${p.r} left over isn't enough for another ${tpl.one}`, `So ${fmt(p.q)} ${tpl.unit}`];
    return [div, `The leftover is the R: ${p.r}`];
  },
  board: (p, { solved = false } = {}) => groupsHtml({ q: p.q, b: p.b, r: p.r, mode: p.mode, solved }),
  toLab: (p) => ({ op: '÷', a: p.a, b: 1 }),
  isValid: (p) => {
    const tpl = findTemplate(LEFTOVER_STORIES, p.t);
    return !!tpl && tpl.mode === p.mode && ['a', 'b', 'q', 'r'].every((k) => isInt(p[k]))
      && p.b >= 2 && p.r >= 1 && p.r < p.b && p.a === p.q * p.b + p.r && CAST.includes(p.P);
  }
};

// ---------- Two-step plays ----------
// Two linked shots, "Step 1 of 2" and "Step 2 of 2". Each step scores like a
// normal shot, and step 2's question uses the answer from step 1.
// step1 / step2: [x, op, y] for each step's equation, from the numbers and s1.

const TWO_STEPS = [
  {
    id: 'ts-more-total', unit1: 'points', unit2: 'points',
    context: '{P} scored {a} points. {Q} scored {b} more than {P}.',
    q1: 'How many points did {Q} score?',
    q2: '{Q} scored {s1}. How many points did they score together?',
    step1: (v) => [v.a, '+', v.b], step2: (v, s1) => [v.a, '+', s1]
  },
  {
    id: 'ts-rows-empty', unit1: 'seats', unit2: 'seats filled',
    context: 'The arena has {a} rows of {b} seats. {c} seats are empty.',
    q1: 'How many seats are there in all?',
    q2: 'There are {s1} seats. How many are filled?',
    step1: (v) => [v.a, '×', v.b], step2: (v, s1) => [s1, '-', v.c]
  },
  {
    id: 'ts-packs-gave', unit1: 'cards', unit2: 'cards left',
    context: '{P} bought {a} packs of {b} trading cards, then gave away {c}.',
    q1: 'How many cards did {P} buy?',
    q2: '{P} bought {s1}. How many cards are left?',
    step1: (v) => [v.a, '×', v.b], step2: (v, s1) => [s1, '-', v.c]
  },
  {
    id: 'ts-fans-rows', unit1: 'fans', unit2: 'rows',
    context: '{a} fans came Friday and {b} came Saturday. They sat in rows of {c}.',
    q1: 'How many fans came in all?',
    q2: '{s1} fans sat in rows of {c}. How many rows did they fill?',
    step1: (v) => [v.a, '+', v.b], step2: (v, s1) => [s1, '÷', v.c]
  },
  {
    id: 'ts-quarters-diff', unit1: 'points', unit2: 'more points',
    context: 'The Lynx scored {a} points in each of {b} quarters. The other team scored {c} in all.',
    q1: 'How many points did the Lynx score?',
    q2: 'The Lynx scored {s1}. How many more than the other team?',
    step1: (v) => [v.a, '×', v.b], step2: (v, s1) => [s1, '-', v.c]
  }
];

// add: [min, max] for parts that get added. fact: facts for rows × seats.
// mul: a bigger first factor. rows: [divisor max, quotient range] for rows of c.
// perQuarter: points per quarter.
const TWO_STEP_RANGES = {
  rookie: { add: [2, 9], more: [1, 5], fact: [2, 5], rows: [5, [2, 5]], perQuarter: [2, 5] },
  starter: { add: [10, 40], more: [2, 20], fact: [2, 10], rows: [10, [2, 10]], perQuarter: [5, 25] },
  allstar: { add: [100, 400], more: [10, 99], fact: [2, 9], mul: [12, 30], rows: [9, [10, 40]], perQuarter: [12, 30] },
  mvp: { add: [100, 450], more: [50, 300], fact: [2, 9], mul: [20, 99], rows: [9, [20, 110]], perQuarter: [15, 40] },
  stretch: { add: [200, 450], more: [100, 300], fact: [3, 9], mul: [40, 99], rows: [9, [40, 110]], perQuarter: [20, 40] }
};

function twoStepNumbers(id, r) {
  if (id === 'ts-more-total') return { a: randInt(...r.add), b: randInt(...r.more), c: 0 };
  if (id === 'ts-fans-rows') {
    const c = randInt(2, r.rows[0]);
    const total = c * randInt(...r.rows[1]);
    const a = randInt(1, total - 1);
    return { a, b: total - a, c };
  }
  if (id === 'ts-quarters-diff') {
    const a = randInt(...r.perQuarter);
    const s1 = a * 4;
    return { a, b: 4, c: randInt(Math.ceil(s1 / 2), s1 - 1) };
  }
  // rows × seats, or packs × cards, then some taken away
  const a = r.mul ? randInt(...r.mul) : randInt(...r.fact);
  const b = randInt(...r.fact);
  return { a, b, c: randInt(1, Math.max(1, Math.floor((a * b) / 2))) };
}

const stepParts = (tpl, p) => {
  const s1 = compute(...reorder(tpl.step1(p)));
  return { s1, one: tpl.step1(p), two: tpl.step2(p, s1) };
};
// [x, op, y] → compute(x, y, op)
const reorder = ([x, op, y]) => [x, y, op];

function twoStepAnswer(p) {
  const tpl = findTemplate(TWO_STEPS, p.t);
  const { s1, two } = stepParts(tpl, p);
  return p.step === 1 ? s1 : compute(...reorder(two));
}

function twoStepText(p, html) {
  const tpl = findTemplate(TWO_STEPS, p.t);
  const { s1 } = stepParts(tpl, p);
  const v = { ...p, s1 };
  return `${fillStory(tpl.context, v, { html })} ${fillStory(p.step === 1 ? tpl.q1 : tpl.q2, v, { html })}`;
}

const stepEquation = (p) => {
  const tpl = findTemplate(TWO_STEPS, p.t);
  const { one, two } = stepParts(tpl, p);
  return p.step === 1 ? one : two;
};

export const twostep = {
  label: 'Two-step plays',
  blurb: 'Two shots that work together: the answer to step 1 helps with step 2.',
  family: 'top',
  layout: 'story',
  reading: true,
  weight: 2,
  tip: 'Two-step plays: find the first number, then use it.',

  generate({ level, tier }) {
    const r = rangesFor(TWO_STEP_RANGES, level, tier);
    const tpl = pickFrom(TWO_STEPS);
    return { kind: 'twostep', t: tpl.id, step: 1, ...twoStepNumbers(tpl.id, r), ...castPair() };
  },
  followUp: (p) => (p.step === 1 ? { ...p, step: 2 } : null),
  stepLabel: (p) => `Step ${p.step} of 2`,
  boxes: () => [{ role: 'target' }],
  answers: (p) => [twoStepAnswer(p)],
  prompt(p, box) {
    const tpl = findTemplate(TWO_STEPS, p.t);
    return storyPrompt(twoStepText(p, true), p.step === 1 ? tpl.unit1 : tpl.unit2, box);
  },
  text: (p) => twoStepText(p, false),
  equation(p, { solved = false } = {}) {
    const [x, op, y] = stepEquation(p);
    return equationText({ a: x, b: y, op, result: compute(x, y, op), missing: 'result' }, { solved });
  },
  hint(p) {
    if (p.step === 2) return 'Use your answer from step 1.';
    const [, op] = stepEquation(p);
    return op === '×' ? 'Step 1: groups of the same size. Multiply.' : 'Step 1: put the two amounts together.';
  },
  steps(p) {
    const tpl = findTemplate(TWO_STEPS, p.t);
    const { s1, one, two } = stepParts(tpl, p);
    const line = ([x, op, y]) => equationText({ a: x, b: y, op, result: compute(x, y, op), missing: 'result' }, { solved: true });
    return p.step === 1
      ? [`Step 1: ${line(one)}`, 'Step 2 will use that answer']
      : [`Step 1 gave ${fmt(s1)}`, `Step 2: ${line(two)}`];
  },
  board(p, { solved = false } = {}) {
    const [x, op, y] = stepEquation(p);
    return modelFor(op, x, y, compute(x, y, op), 'result', solved, { groups: op === '÷' });
  },
  toLab(p) {
    const [x, op, y] = stepEquation(p);
    return equationToLab({ a: x, b: y, op, result: compute(x, y, op), missing: 'result' });
  },
  isValid(p) {
    const tpl = findTemplate(TWO_STEPS, p.t);
    if (!tpl || (p.step !== 1 && p.step !== 2) || !['a', 'b', 'c'].every((k) => isInt(p[k])) || !validNames(p)) return false;
    const [x, op, y] = stepEquation(p);
    const answer = compute(x, y, op);
    return isInt(answer) && (op !== '-' || y <= x) && (op !== '÷' || (y > 0 && x % y === 0));
  }
};
