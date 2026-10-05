// Fractions: equivalent fractions, comparing with < = >, a whole number times
// a fraction, and adding or subtracting with like denominators.
// See js/plays.js for what every play provides.

import { randInt, pickFrom, pickWeighted, rangesFor, chance, isInt } from './kit.js';
import { fracHtml, fractionBarsHtml } from './visuals.js';

const PIECES = ['', 'wholes', 'halves', 'thirds', 'fourths', 'fifths', 'sixths', 'sevenths', 'eighths', 'ninths', 'tenths', 'elevenths', 'twelfths'];
const pieces = (d) => PIECES[d] || `${d}ths`;

const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const lcm = (x, y) => (x * y) / gcd(x, y);
const symbolFor = (x, y) => (x > y ? '>' : x < y ? '<' : '=');

// dens: denominators to use. factors: what equivalent fractions scale by.
// simplify: share of equivalent shots that go to fewer pieces (6/8 = ?/4).
// compare: 'unit' (1/a vs 1/b), 'same' (same top or same bottom) or 'any'.
// k: the whole number in k × n/d. nMax: biggest top for k × n/d.
// improper: sums and products can go past one whole.
const FRACTION_RANGES = {
  rookie: { variants: { equiv: 50, compare: 25, times: 25 }, dens: [2, 3, 4], factors: [2], simplify: 0, compare: 'unit', k: [2, 4], nMax: 1 },
  starter: { variants: { equiv: 40, compare: 30, times: 30 }, dens: [2, 3, 4, 5, 6], factors: [2, 3], simplify: 0, compare: 'same', k: [2, 5], nMax: 3 },
  allstar: { variants: { equiv: 30, compare: 25, add: 25, times: 20 }, dens: [2, 3, 4, 5, 6, 8, 10, 12], factors: [2, 3, 4], simplify: 0.4, compare: 'any', k: [2, 6], nMax: 5 },
  mvp: { variants: { equiv: 15, compare: 25, add: 20, sub: 15, times: 25 }, dens: [3, 4, 5, 6, 8, 10, 12], factors: [2, 3, 4, 5], simplify: 0.5, compare: 'any', k: [2, 9], nMax: 9, improper: true },
  stretch: { variants: { equiv: 15, compare: 25, add: 20, sub: 15, times: 25 }, dens: [3, 4, 5, 6, 8, 10, 12], factors: [2, 3, 4, 5], simplify: 0.5, compare: 'any', k: [3, 9], nMax: 11, improper: true }
};

function equivNumbers(r) {
  const d = pickFrom(r.dens);
  const n = randInt(1, d - 1);
  const f = pickFrom(r.factors);
  // To fewer pieces: start from the scaled-up fraction and ask for the simple one
  if (chance(r.simplify)) return { variant: 'equiv', n1: n * f, d1: d * f, n2: n, d2: d, missing: 'n2' };
  const missing = r.dens.length > 3 && chance(0.3) ? 'd2' : 'n2';
  return { variant: 'equiv', n1: n, d1: d, n2: n * f, d2: d * f, missing };
}

function compareNumbers(r) {
  if (r.compare === 'unit') {
    const d1 = randInt(2, 8);
    let d2;
    do d2 = randInt(2, 8); while (d2 === d1);
    return { variant: 'compare', n1: 1, d1, n2: 1, d2 };
  }
  if (r.compare === 'same') {
    if (chance(0.5)) {
      const d = randInt(3, 12);
      const n1 = randInt(1, d - 1);
      let n2;
      do n2 = randInt(1, d - 1); while (n2 === n1);
      return { variant: 'compare', n1, d1: d, n2, d2: d };
    }
    const n = randInt(1, 3);
    const d1 = randInt(n + 1, 10);
    let d2;
    do d2 = randInt(n + 1, 10); while (d2 === d1);
    return { variant: 'compare', n1: n, d1, n2: n, d2 };
  }
  // Different bottoms; now and then the two are equal, so "=" is a real answer
  if (chance(0.1)) {
    const d = pickFrom([2, 3, 4, 5, 6]);
    const n = randInt(1, d - 1);
    const f = randInt(2, 3);
    return chance(0.5)
      ? { variant: 'compare', n1: n, d1: d, n2: n * f, d2: d * f }
      : { variant: 'compare', n1: n * f, d1: d * f, n2: n, d2: d };
  }
  for (;;) {
    const d1 = pickFrom(r.dens);
    const d2 = pickFrom(r.dens);
    if (d1 === d2) continue;
    const n1 = randInt(1, d1 - 1);
    const n2 = randInt(1, d2 - 1);
    if (n1 * d2 !== n2 * d1) return { variant: 'compare', n1, d1, n2, d2 };
  }
}

function timesNumbers(r) {
  const d = pickFrom(r.dens);
  const n = randInt(1, Math.min(r.nMax, d - 1));
  return { variant: 'times', k: randInt(...r.k), n, d };
}

function addNumbers(r, variant) {
  const d = pickFrom(r.dens.filter((x) => x >= 3));
  const top = r.improper ? 2 * d - 1 : d;
  if (variant === 'add') {
    const n1 = randInt(1, top - 1);
    const n2 = randInt(1, Math.max(1, Math.min(d - 1, top - n1)));
    return { variant, n1, n2, d };
  }
  const n1 = randInt(2, top);
  return { variant, n1, n2: randInt(1, n1 - 1), d };
}

function answerOf(p) {
  if (p.variant === 'equiv') return p[p.missing];
  if (p.variant === 'compare') return symbolFor(p.n1 * p.d2, p.n2 * p.d1);
  if (p.variant === 'times') return p.k * p.n;
  if (p.variant === 'add') return p.n1 + p.n2;
  return p.n1 - p.n2;
}

const t = (n, d) => `${n}/${d}`;

export const fractions = {
  label: 'Fractions',
  blurb: 'Pieces of a whole: match them, compare them, add them up.',
  family: 'ft',
  layout: 'equation',
  weight: 3,
  tip: 'The bottom number says how many equal pieces make one whole.',

  generate({ level, tier }) {
    const r = rangesFor(FRACTION_RANGES, level, tier);
    const variant = pickWeighted(r.variants);
    const numbers = variant === 'equiv' ? equivNumbers(r)
      : variant === 'compare' ? compareNumbers(r)
      : variant === 'times' ? timesNumbers(r)
      : addNumbers(r, variant);
    return { kind: 'fractions', ...numbers };
  },

  input: (p) => (p.variant === 'compare' ? 'choice' : 'keypad'),
  boxes: (p) => [{ role: p.variant === 'compare' ? 'choice' : 'target' }],
  answers: (p) => [answerOf(p)],

  prompt(p, box) {
    const a = (n, d) => fracHtml(n, d, 'num-a');
    const b = (n, d) => fracHtml(n, d, 'num-b');
    const eq = '<span class="equals">=</span>';
    if (p.variant === 'equiv') {
      const top = p.missing === 'n2' ? box(0) : p.n2;
      const bottom = p.missing === 'd2' ? box(0) : p.d2;
      return `${a(p.n1, p.d1)}${eq}${fracHtml(top, bottom, 'num-b')}`;
    }
    if (p.variant === 'compare') return `${a(p.n1, p.d1)}${box(0)}${b(p.n2, p.d2)}`;
    if (p.variant === 'times') {
      return `<span class="num-a">${p.k}</span><span class="op-symbol">×</span>${b(p.n, p.d)}${eq}${fracHtml(box(0), p.d, 'num-target')}`;
    }
    const op = p.variant === 'add' ? '+' : '−';
    return `${a(p.n1, p.d)}<span class="op-symbol">${op}</span>${b(p.n2, p.d)}${eq}${fracHtml(box(0), p.d, 'num-target')}`;
  },

  text(p, { solved = false } = {}) {
    const ans = solved ? answerOf(p) : '?';
    if (p.variant === 'equiv') {
      const right = p.missing === 'n2' ? t(ans, p.d2) : t(p.n2, ans);
      return `${t(p.n1, p.d1)} = ${right}`;
    }
    if (p.variant === 'compare') return `${t(p.n1, p.d1)} ${ans} ${t(p.n2, p.d2)}`;
    if (p.variant === 'times') return `${p.k} × ${t(p.n, p.d)} = ${t(ans, p.d)}`;
    return `${t(p.n1, p.d)} ${p.variant === 'add' ? '+' : '−'} ${t(p.n2, p.d)} = ${t(ans, p.d)}`;
  },

  hint(p) {
    if (p.variant === 'equiv') {
      return p.d2 < p.d1
        ? 'Same amount, fewer pieces: divide the top and bottom by the same number.'
        : 'Same amount, more pieces: multiply the top and bottom by the same number.';
    }
    if (p.variant === 'compare') {
      if (p.n1 === p.n2) return 'Same number of pieces: the bigger pieces win. Fewer pieces in a whole makes bigger pieces.';
      if (p.d1 === p.d2) return 'Same size pieces: more pieces is more.';
      return 'Make the bottoms match, then compare the tops.';
    }
    if (p.variant === 'times') return `${p.k} groups of ${t(p.n, p.d)}: multiply the top by ${p.k}.`;
    return p.variant === 'add' ? 'Same bottoms: add the tops.' : 'Same bottoms: subtract the tops.';
  },

  steps(p) {
    const ans = answerOf(p);
    if (p.variant === 'equiv') {
      const up = p.d2 > p.d1;
      const f = up ? p.d2 / p.d1 : p.d1 / p.d2;
      const how = up ? '×' : '÷';
      const first = p.missing === 'd2'
        ? [`Top: ${p.n1} ${how} ${f} = ${p.n2}`, `So the bottom is ${p.d1} ${how} ${f} = ${p.d2}`]
        : [`Bottom: ${p.d1} ${how} ${f} = ${p.d2}`, `So the top is ${p.n1} ${how} ${f} = ${p.n2}`];
      return [...first, `${t(p.n1, p.d1)} = ${t(p.n2, p.d2)}`];
    }
    if (p.variant === 'compare') {
      const end = `So ${t(p.n1, p.d1)} ${ans} ${t(p.n2, p.d2)}`;
      if (p.n1 === p.n2) {
        const [big, small] = p.d1 < p.d2 ? [p.d1, p.d2] : [p.d2, p.d1];
        const name = pieces(big);
        return [`Both have ${p.n1} piece${p.n1 > 1 ? 's' : ''}`, `${name[0].toUpperCase()}${name.slice(1)} are bigger pieces than ${pieces(small)}`, end];
      }
      if (p.d1 === p.d2) return [`Same size pieces: ${pieces(p.d1)}`, `${p.n1} pieces vs ${p.n2} pieces`, end];
      const L = lcm(p.d1, p.d2);
      const x = (p.n1 * L) / p.d1;
      const y = (p.n2 * L) / p.d2;
      return [`Make the bottoms match: ${t(p.n1, p.d1)} = ${t(x, L)} and ${t(p.n2, p.d2)} = ${t(y, L)}`, `${x} vs ${y}`, end];
    }
    if (p.variant === 'times') return [`${p.k} × ${t(p.n, p.d)} is ${p.k} groups of ${t(p.n, p.d)}`, `${p.k} × ${p.n} = ${ans}`, `= ${t(ans, p.d)}`];
    const op = p.variant === 'add' ? '+' : '−';
    return [`Same bottoms: ${p.variant === 'add' ? 'add' : 'subtract'} the tops`, `${p.n1} ${op} ${p.n2} = ${ans}`, `= ${t(ans, p.d)}`];
  },

  board(p, { solved = false } = {}) {
    if (p.variant === 'equiv') {
      const right = solved || p.missing === 'n2'
        ? { n: solved ? p.n2 : 0, d: p.d2, cls: 'fill-b', label: solved ? t(p.n2, p.d2) : t('?', p.d2) }
        : null;
      return fractionBarsHtml([{ n: p.n1, d: p.d1, cls: 'fill-a', label: t(p.n1, p.d1) }, ...(right ? [right] : [])]);
    }
    if (p.variant === 'compare') {
      return fractionBarsHtml([
        { n: p.n1, d: p.d1, cls: 'fill-a', label: t(p.n1, p.d1) },
        { n: p.n2, d: p.d2, cls: 'fill-b', label: t(p.n2, p.d2) }
      ]);
    }
    if (p.variant === 'times') {
      if (solved) return fractionBarsHtml([{ n: p.k * p.n, d: p.d, cls: 'fill-t', label: t(p.k * p.n, p.d) }]);
      return fractionBarsHtml(Array.from({ length: Math.min(p.k, 6) }, () => ({ n: p.n, d: p.d, cls: 'fill-b', label: t(p.n, p.d) })));
    }
    const bars = [
      { n: p.n1, d: p.d, cls: 'fill-a', label: t(p.n1, p.d) },
      { n: p.n2, d: p.d, cls: 'fill-b', label: t(p.n2, p.d) }
    ];
    if (solved) bars.push({ n: answerOf(p), d: p.d, cls: 'fill-t', label: t(answerOf(p), p.d) });
    return fractionBarsHtml(bars);
  },

  isValid(p) {
    const ints = (...keys) => keys.every((k) => isInt(p[k]) && p[k] >= 1);
    if (p.variant === 'equiv') return ints('n1', 'd1', 'n2', 'd2') && p.n1 * p.d2 === p.n2 * p.d1 && ['n2', 'd2'].includes(p.missing);
    if (p.variant === 'compare') return ints('n1', 'd1', 'n2', 'd2');
    if (p.variant === 'times') return ints('k', 'n', 'd');
    if (p.variant === 'add') return ints('n1', 'n2', 'd');
    if (p.variant === 'sub') return ints('n1', 'n2', 'd') && p.n1 > p.n2;
    return false;
  }
};
