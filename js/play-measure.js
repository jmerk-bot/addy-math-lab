// Measurement plays: Measurement (converting a bigger unit to a smaller one),
// Area & perimeter, and Angles. See js/plays.js for what every play provides.

import { fmt } from './math.js';
import { randInt, pickFrom, pickWeighted, rangesFor, chance, isInt, plural } from './kit.js';
import { rectangleHtml, angleHtml, areaModelHtml, equalGroupsHtml } from './visuals.js';
import { limits } from './lab-limits.js';

// ---------- Measurement: unit conversions ----------
// Bigger unit → smaller unit only, and the fact is always shown above the
// shot ("1 foot = 12 inches"), so it's a multiplication shot with a real hook.
// levels: [min, max] amounts of the bigger unit at each level (missing = not used).

const UNITS = [
  { id: 'ft-in', one: 'foot', many: 'feet', small: 'inches', smallOne: 'inch', factor: 12, levels: { rookie: [1, 3], starter: [1, 6], allstar: [2, 12], mvp: [5, 25] } },
  { id: 'yd-ft', one: 'yard', many: 'yards', small: 'feet', smallOne: 'foot', factor: 3, levels: { rookie: [1, 5], starter: [2, 10], allstar: [5, 30], mvp: [10, 99] } },
  { id: 'wk-d', one: 'week', many: 'weeks', small: 'days', smallOne: 'day', factor: 7, levels: { rookie: [1, 4], starter: [2, 10], allstar: [5, 20], mvp: [10, 52] } },
  { id: 'dol-c', one: 'dollar', many: 'dollars', small: 'cents', smallOne: 'cent', factor: 100, levels: { rookie: [1, 5], starter: [2, 9], allstar: [5, 50], mvp: [10, 99] } },
  { id: 'gal-qt', one: 'gallon', many: 'gallons', small: 'quarts', smallOne: 'quart', factor: 4, levels: { starter: [1, 6], allstar: [2, 12], mvp: [5, 25] } },
  { id: 'hr-min', one: 'hour', many: 'hours', small: 'minutes', smallOne: 'minute', factor: 60, levels: { starter: [1, 5], allstar: [2, 10], mvp: [3, 24] } },
  { id: 'min-s', one: 'minute', many: 'minutes', small: 'seconds', smallOne: 'second', factor: 60, levels: { starter: [1, 5], allstar: [2, 10], mvp: [5, 30] } },
  { id: 'm-cm', one: 'meter', many: 'meters', small: 'centimeters', smallOne: 'centimeter', factor: 100, levels: { starter: [1, 5], allstar: [2, 20], mvp: [5, 99] } },
  { id: 'd-h', one: 'day', many: 'days', small: 'hours', smallOne: 'hour', factor: 24, levels: { allstar: [1, 5], mvp: [2, 10] } },
  { id: 'lb-oz', one: 'pound', many: 'pounds', small: 'ounces', smallOne: 'ounce', factor: 16, levels: { allstar: [1, 6], mvp: [2, 20] } },
  { id: 'km-m', one: 'kilometer', many: 'kilometers', small: 'meters', smallOne: 'meter', factor: 1000, levels: { allstar: [1, 9], mvp: [2, 50] } },
  { id: 'yd-in', one: 'yard', many: 'yards', small: 'inches', smallOne: 'inch', factor: 36, levels: { mvp: [1, 9] } }
];

// Basketball facts, used now and then in place of a plain conversion
const COURT_FACTS = [
  { id: 'hoop', unit: 'ft-in', n: 10, text: 'The hoop is 10 feet high.', from: 'starter' },
  { id: 'quarter', unit: 'min-s', n: 10, text: 'A quarter lasts 10 minutes.', from: 'allstar' },
  { id: 'halftime', unit: 'min-s', n: 15, text: 'Halftime lasts 15 minutes.', from: 'allstar' },
  { id: 'court', unit: 'ft-in', n: 94, text: 'The court is 94 feet long.', from: 'mvp' }
];

// Mixed units ("3 feet 5 inches") at MVP, for these conversions
const MIXED = ['ft-in', 'lb-oz', 'hr-min'];

const LEVEL_ORDER = ['rookie', 'starter', 'allstar', 'mvp'];
const unitById = (id) => UNITS.find((u) => u.id === id);

const MEASURE_RANGES = {
  rookie: { level: 'rookie', court: 0, mixed: 0 },
  starter: { level: 'starter', court: 0.15, mixed: 0 },
  allstar: { level: 'allstar', court: 0.15, mixed: 0 },
  mvp: { level: 'mvp', court: 0.15, mixed: 0.3 },
  stretch: { level: 'mvp', court: 0.1, mixed: 0.5 }
};

const measureAnswer = (p) => p.n * unitById(p.u).factor + (p.extra || 0);

export const measure = {
  label: 'Measurement',
  blurb: 'Turn bigger units into smaller ones. Coach shows the fact, then you multiply.',
  family: 'rightcorner',
  layout: 'story',
  weight: 3,
  tip: 'Bigger unit to smaller unit: you need more of them, so multiply.',

  generate({ level, tier }) {
    const r = rangesFor(MEASURE_RANGES, level, tier);
    const facts = COURT_FACTS.filter((f) => LEVEL_ORDER.indexOf(f.from) <= LEVEL_ORDER.indexOf(r.level));
    if (facts.length && chance(r.court)) {
      const f = pickFrom(facts);
      return { kind: 'measure', u: f.unit, n: f.n, extra: 0, court: f.id };
    }
    const unit = pickFrom(UNITS.filter((u) => u.levels[r.level]));
    const n = randInt(...unit.levels[r.level]);
    const extra = MIXED.includes(unit.id) && chance(r.mixed) ? randInt(1, unit.factor - 1) : 0;
    return { kind: 'measure', u: unit.id, n, extra };
  },
  boxes: () => [{ role: 'target' }],
  answers: (p) => [measureAnswer(p)],

  prompt(p, box) {
    const u = unitById(p.u);
    const court = p.court ? `<p class="story-text">${COURT_FACTS.find((f) => f.id === p.court).text}</p>` : '';
    const amount = `<b class="num-a">${plural(p.n, u.one, u.many)}</b>${p.extra ? ` <b class="num-b">${plural(p.extra, u.smallOne, u.small)}</b>` : ''}`;
    return `<p class="fact-line">1 ${u.one} = ${fmt(u.factor)} ${u.small}</p>${court}`
      + `<div class="answer-line">${amount}<span class="equals">=</span>${box(0)}<span class="answer-unit">${u.small}</span></div>`;
  },
  text(p, { solved = false } = {}) {
    const u = unitById(p.u);
    return `${plural(p.n, u.one, u.many)}${p.extra ? ` ${plural(p.extra, u.smallOne, u.small)}` : ''} = ${solved ? fmt(measureAnswer(p)) : '?'} ${u.small}`;
  },
  equation(p, { solved = false } = {}) {
    const u = unitById(p.u);
    const extra = p.extra ? ` + ${p.extra}` : '';
    return `${fmt(p.n)} × ${fmt(u.factor)}${extra} = ${solved ? fmt(measureAnswer(p)) : '?'}`;
  },
  hint(p) {
    const u = unitById(p.u);
    return `Each ${u.one} is ${fmt(u.factor)} ${u.small}: multiply by ${fmt(u.factor)}.${p.extra ? ` Then add the extra ${p.extra}.` : ''}`;
  },
  steps(p) {
    const u = unitById(p.u);
    const product = p.n * u.factor;
    const steps = [`1 ${u.one} = ${fmt(u.factor)} ${u.small}`, `${plural(p.n, u.one, u.many)} = ${fmt(p.n)} × ${fmt(u.factor)} = ${fmt(product)} ${u.small}`];
    if (p.extra) steps.push(`${fmt(product)} + ${p.extra} = ${fmt(product + p.extra)} ${u.small}`);
    return steps;
  },
  board(p, { solved = false } = {}) {
    const u = unitById(p.u);
    if (p.n <= 10) return equalGroupsHtml({ groups: p.n, each: u.factor, ask: 'total', solved });
    return areaModelHtml(p.n, u.factor);
  },
  // Practice can build n × factor when it fits there
  toLab(p) {
    const u = unitById(p.u);
    const lim = limits('×', p.n);
    return u.factor <= lim.bMax ? { op: '×', a: p.n, b: 1 } : null;
  },
  isValid: (p) => !!unitById(p.u) && isInt(p.n) && p.n >= 1 && isInt(p.extra || 0)
    && (p.extra || 0) < unitById(p.u).factor && measureAnswer(p) <= 99999
    && (!p.court || COURT_FACTS.some((f) => f.id === p.court))
};

// ---------- Area & perimeter ----------
// side: [min, max] for each side (long: a longer side for perimeter). grid:
// draw unit squares when the area is at most this. mix: variant weights.

const AREA_RANGES = {
  rookie: { side: [2, 5], grid: 25, mix: { area: 100 } },
  starter: { side: [2, 10], grid: 60, mix: { area: 55, perimeter: 45 } },
  allstar: { side: [2, 12], long: [10, 25], grid: 0, mix: { area: 40, perimeter: 40, sidearea: 20 } },
  mvp: { side: [2, 9], long: [12, 50], grid: 0, mix: { area: 30, perimeter: 30, sidearea: 20, sideperim: 20 } },
  stretch: { side: [3, 9], long: [15, 50], grid: 0, mix: { area: 30, perimeter: 25, sidearea: 25, sideperim: 20 } }
};

const AREA_UNITS = ['feet', 'meters', 'inches'];
const SQUARE = { feet: 'square feet', meters: 'square meters', inches: 'square inches' };

function areaAnswer(p) {
  if (p.variant === 'area') return p.w * p.h;
  if (p.variant === 'perimeter') return 2 * (p.w + p.h);
  return p.h; // the missing side
}

export const area = {
  label: 'Area & perimeter',
  blurb: 'Area is the squares inside. Perimeter is the distance around.',
  family: 'rightcorner',
  layout: 'story',
  weight: 2,
  tip: 'Area: rows × columns. Perimeter: add all four sides.',

  generate({ level, tier }) {
    const r = rangesFor(AREA_RANGES, level, tier);
    const variant = pickWeighted(r.mix);
    const unit = pickFrom(AREA_UNITS);
    const longSide = (variant === 'perimeter' || variant === 'sideperim') && r.long;
    const w = randInt(...(longSide ? r.long : r.side));
    let h;
    do h = randInt(...r.side); while (h === w && chance(0.7));
    return { kind: 'area', variant, w, h, unit, grid: variant === 'area' && w * h <= r.grid };
  },
  boxes: () => [{ role: 'target' }],
  answers: (p) => [areaAnswer(p)],

  prompt(p, box) {
    const side = p.variant === 'sidearea' || p.variant === 'sideperim';
    const figure = rectangleHtml({ w: p.w, h: p.h, wLabel: `${p.w} ${p.unit}`, hLabel: side ? '?' : `${p.h} ${p.unit}`, grid: p.grid, askSide: side ? 'h' : '' });
    let question;
    if (p.variant === 'area') question = `Area = ${box(0)}<span class="answer-unit">${SQUARE[p.unit]}</span>`;
    else if (p.variant === 'perimeter') question = `Perimeter = ${box(0)}<span class="answer-unit">${p.unit}</span>`;
    else {
      const given = p.variant === 'sidearea' ? `Area is <b class="num-target">${fmt(p.w * p.h)}</b> ${SQUARE[p.unit]}.` : `Perimeter is <b class="num-target">${fmt(2 * (p.w + p.h))}</b> ${p.unit}.`;
      return `<div class="figure">${figure}</div><p class="story-text">${given}</p><div class="answer-line">? = ${box(0)}<span class="answer-unit">${p.unit}</span></div>`;
    }
    return `<div class="figure">${figure}</div><div class="answer-line">${question}</div>`;
  },
  text(p, { solved = false } = {}) {
    const ans = solved ? fmt(areaAnswer(p)) : '?';
    if (p.variant === 'area') return `A ${p.w} by ${p.h} rectangle: area = ${ans} ${SQUARE[p.unit]}`;
    if (p.variant === 'perimeter') return `A ${p.w} by ${p.h} rectangle: perimeter = ${ans} ${p.unit}`;
    if (p.variant === 'sidearea') return `Area ${fmt(p.w * p.h)}, one side ${p.w}: other side = ${ans} ${p.unit}`;
    return `Perimeter ${fmt(2 * (p.w + p.h))}, one side ${p.w}: other side = ${ans} ${p.unit}`;
  },
  equation(p, { solved = false } = {}) {
    const ans = solved ? fmt(areaAnswer(p)) : '?';
    if (p.variant === 'area') return `${p.w} × ${p.h} = ${ans}`;
    if (p.variant === 'perimeter') return `${p.w} + ${p.h} + ${p.w} + ${p.h} = ${ans}`;
    if (p.variant === 'sidearea') return `${p.w} × ${ans} = ${fmt(p.w * p.h)}`;
    return `${p.w} + ${ans} + ${p.w} + ${ans} = ${fmt(2 * (p.w + p.h))}`;
  },
  hint(p) {
    if (p.variant === 'area') return 'Area is rows × columns: multiply the two sides.';
    if (p.variant === 'perimeter') return 'Perimeter is the distance around: add all four sides.';
    if (p.variant === 'sidearea') return `Which number times ${p.w} makes ${fmt(p.w * p.h)}?`;
    return `Take away the two sides you know, then split what's left in half.`;
  },
  steps(p) {
    const { w, h } = p;
    if (p.variant === 'area') return ['Area = one side × the other side', `${w} × ${h} = ${fmt(w * h)}`, `${fmt(w * h)} ${SQUARE[p.unit]}`];
    if (p.variant === 'perimeter') return ['Perimeter = all four sides added up', `${w} + ${h} + ${w} + ${h} = ${fmt(2 * (w + h))}`, `${fmt(2 * (w + h))} ${p.unit}`];
    if (p.variant === 'sidearea') return [`${w} × ? = ${fmt(w * h)}`, `${fmt(w * h)} ÷ ${w} = ${h}`, `The other side is ${h} ${p.unit}`];
    const P = 2 * (w + h);
    return [`The two known sides: ${w} + ${w} = ${2 * w}`, `${P} − ${2 * w} = ${2 * h} for the other two`, `${2 * h} ÷ 2 = ${h} ${p.unit}`];
  },
  board(p, { solved = false } = {}) {
    const side = p.variant === 'sidearea' || p.variant === 'sideperim';
    const hLabel = side && !solved ? '?' : `${p.h}`;
    return `<div class="figure big">${rectangleHtml({ w: p.w, h: p.h, wLabel: `${p.w}`, hLabel, grid: p.w * p.h <= 144, askSide: side && !solved ? 'h' : '' })}</div>`;
  },
  toLab: (p) => (p.variant === 'area' || p.variant === 'sidearea' ? { op: '×', a: p.w, b: 1 } : null),
  isValid: (p) => ['area', 'perimeter', 'sidearea', 'sideperim'].includes(p.variant)
    && isInt(p.w) && isInt(p.h) && p.w >= 1 && p.h >= 1 && AREA_UNITS.includes(p.unit)
};

// ---------- Angles ----------
// type: right (90°), straight (180°), full (360°). step: angles are multiples
// of this. mix: type weights.

const ANGLE_RANGES = {
  rookie: { mix: { right: 100 }, step: 10 },
  starter: { mix: { right: 100 }, step: 5 },
  allstar: { mix: { right: 40, straight: 60 }, step: 1 },
  mvp: { mix: { right: 20, straight: 40, full: 40 }, step: 1 },
  stretch: { mix: { straight: 40, full: 60 }, step: 1 }
};

const TOTALS = { right: 90, straight: 180, full: 360 };
const ANGLE_NAMES = { right: 'a right angle', straight: 'a straight line', full: 'a full turn' };

export const angles = {
  label: 'Angles',
  blurb: 'Angles that fit together: a right angle is 90°, a straight line 180°, a full turn 360°.',
  family: 'rightcorner',
  layout: 'story',
  weight: 2,
  tip: 'A right angle is 90°, a straight line is 180°, all the way around is 360°.',

  generate({ level, tier }) {
    const r = rangesFor(ANGLE_RANGES, level, tier);
    const type = pickWeighted(r.mix);
    const total = TOTALS[type];
    const pick = (min, max) => r.step * randInt(Math.ceil(min / r.step), Math.floor(max / r.step));
    if (type === 'full') {
      const x = pick(40, 160);
      const y = pick(40, 320 - x - 40);
      return { kind: 'angles', type, known: [x, y] };
    }
    return { kind: 'angles', type, known: [pick(10, total - 10)] };
  },
  boxes: () => [{ role: 'target' }],
  answers: (p) => [TOTALS[p.type] - p.known.reduce((s, x) => s + x, 0)],

  prompt(p, box) {
    const missing = TOTALS[p.type] - p.known.reduce((s, x) => s + x, 0);
    const figure = angleHtml({ type: p.type, parts: [...p.known, missing], labels: [...p.known.map((x) => `${x}°`), '?'] });
    return `<div class="figure">${figure}</div><p class="story-text">The angles make <b class="num-b">${ANGLE_NAMES[p.type]}</b>.</p>`
      + `<div class="answer-line">? = ${box(0)}<span class="answer-unit">°</span></div>`;
  },
  text: (p, { solved = false } = {}) => `${p.known.map((x) => `${x}°`).join(' + ')} + ${solved ? `${angles.answers(p)[0]}°` : '?'} = ${TOTALS[p.type]}°`,
  equation: (p, opts) => angles.text(p, opts),
  hint: (p) => `All the angles together make ${TOTALS[p.type]}°.`,
  steps(p) {
    const total = TOTALS[p.type];
    const known = p.known.reduce((s, x) => s + x, 0);
    const lines = [`${ANGLE_NAMES[p.type][0].toUpperCase()}${ANGLE_NAMES[p.type].slice(1)} is ${total}°`];
    if (p.known.length > 1) lines.push(`${p.known.join(' + ')} = ${known}`);
    lines.push(`${total} − ${known} = ${total - known}°`);
    return lines;
  },
  board(p, { solved = false } = {}) {
    const missing = TOTALS[p.type] - p.known.reduce((s, x) => s + x, 0);
    return `<div class="figure big">${angleHtml({ type: p.type, parts: [...p.known, missing], labels: [...p.known.map((x) => `${x}°`), solved ? `${missing}°` : '?'] })}</div>`;
  },
  isValid(p) {
    if (!TOTALS[p.type] || !Array.isArray(p.known) || !p.known.every((x) => isInt(x) && x > 0)) return false;
    const missing = TOTALS[p.type] - p.known.reduce((s, x) => s + x, 0);
    return missing > 0 && p.known.length === (p.type === 'full' ? 2 : 1);
  }
};
