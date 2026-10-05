// Place-value plays: Place value (expanded form, the value of a digit, which
// digit is in a place, word form) and Round & compare (rounding, and < = >).
// See js/plays.js for what every play provides.

import { fmt } from './math.js';
import { randInt, pickFrom, pickWeighted, rangesFor, chance, isInt, numberWords } from './kit.js';
import { placeChartHtml, compareChartHtml, roundLineHtml, placeParts } from './visuals.js';

const PLACE_WORDS = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
const PLACE_ONE = ['one', 'ten', 'hundred', 'thousand', 'ten thousand'];

const digitAt = (n, place) => Math.floor(n / 10 ** place) % 10;
const placesOf = (n) => String(n).length;

// A number with `digits` digits; zeros: chance of a 0 in a middle place
function numberWithDigits(digits, zeros = 0) {
  let n = randInt(10 ** (digits - 1), 10 ** digits - 1);
  if (digits >= 3 && chance(zeros)) {
    const place = randInt(1, digits - 2);
    n -= digitAt(n, place) * 10 ** place;
  }
  return n;
}

// A place (0 = ones) whose digit isn't 0
function nonzeroPlace(n) {
  const places = Array.from({ length: placesOf(n) }, (_, i) => i).filter((p) => digitAt(n, p) > 0);
  return pickFrom(places);
}

// ---------- Place value ----------
// digits: how many digits. zeros: chance of a 0 inside the number (306, 4,056).
// mix: variant weights.

const PLACE_RANGES = {
  rookie: { digits: 2, zeros: 0, mix: { expanded: 40, value: 30, digit: 30 } },
  starter: { digits: 3, zeros: 0.3, mix: { expanded: 30, missingpart: 25, value: 25, digit: 20 } },
  allstar: { digits: 4, zeros: 0.3, mix: { expanded: 30, missingpart: 25, value: 25, digit: 20 } },
  mvp: { digits: 5, zeros: 0.3, mix: { expanded: 20, missingpart: 20, value: 20, digit: 15, words: 25 } },
  stretch: { digits: 5, zeros: 0.4, mix: { expanded: 15, missingpart: 25, value: 15, digit: 15, words: 30 } }
};

function placeAnswer(p) {
  if (p.variant === 'value') return digitAt(p.n, p.place) * 10 ** p.place;
  if (p.variant === 'digit') return digitAt(p.n, p.place);
  if (p.variant === 'missingpart') return digitAt(p.n, p.place) * 10 ** p.place;
  return p.n;
}

// The parts of the expanded form, with the asked-for one as a box
function expandedHtml(p, box) {
  return placeParts(p.n).map((part) => {
    const isAsked = p.variant === 'missingpart' && part === placeAnswer(p);
    return isAsked ? box(0) : `<span class="num-a">${fmt(part)}</span>`;
  }).join('<span class="op-symbol">+</span>');
}

// The number with one digit marked
function markedNumber(p) {
  const digits = fmt(p.n).split('');
  let place = -1;
  return digits.reverse().map((ch) => {
    if (ch === ',') return ch;
    place += 1;
    return place === p.place ? `<span class="digit-mark">${ch}</span>` : ch;
  }).reverse().join('');
}

export const placevalue = {
  label: 'Place value',
  blurb: 'Every digit has a place: ones, tens, hundreds and up. Its place tells its value.',
  family: 'leftcorner',
  layout: 'story',
  weight: 3,
  tip: 'In 3,482 the 4 is worth 400, because it sits in the hundreds place.',

  generate({ level, tier }) {
    const r = rangesFor(PLACE_RANGES, level, tier);
    const variant = pickWeighted(r.mix);
    const n = numberWithDigits(r.digits, r.zeros);
    const p = { kind: 'placevalue', variant, n };
    if (variant === 'value' || variant === 'digit' || variant === 'missingpart') {
      p.place = nonzeroPlace(n);
      // A missing part needs at least two parts around it
      if (variant === 'missingpart' && placeParts(n).length < 2) p.variant = 'value';
    }
    return p;
  },
  boxes: () => [{ role: 'target' }],
  answers: (p) => [placeAnswer(p)],

  prompt(p, box) {
    const line = (html) => `<div class="answer-line big">${html}</div>`;
    if (p.variant === 'expanded') return line(`${expandedHtml(p, box)}<span class="equals">=</span>${box(0)}`);
    if (p.variant === 'missingpart') return line(`<span class="num-target">${fmt(p.n)}</span><span class="equals">=</span>${expandedHtml(p, box)}`);
    if (p.variant === 'words') return `<p class="story-text words">${numberWords(p.n)}</p>${line(`<span class="equals">=</span>${box(0)}`)}`;
    const question = p.variant === 'value'
      ? 'What is the value of the marked digit?'
      : `Which digit is in the <b class="num-b">${PLACE_WORDS[p.place]}</b> place?`;
    const number = p.variant === 'value' ? markedNumber(p) : fmt(p.n);
    return `<p class="story-text">${question}</p><p class="big-figure num-a">${number}</p>${line(box(0))}`;
  },

  text(p, { solved = false } = {}) {
    const ans = solved ? fmt(placeAnswer(p)) : '?';
    const parts = placeParts(p.n).map(fmt);
    if (p.variant === 'expanded') return `${parts.join(' + ')} = ${ans}`;
    if (p.variant === 'missingpart') {
      const asked = fmt(placeAnswer(p));
      return `${fmt(p.n)} = ${parts.map((x) => (x === asked ? ans : x)).join(' + ')}`;
    }
    if (p.variant === 'words') return `${numberWords(p.n)} = ${ans}`;
    if (p.variant === 'value') return `The value of the ${digitAt(p.n, p.place)} in ${fmt(p.n)}: ${ans}`;
    return `The ${PLACE_WORDS[p.place]} digit of ${fmt(p.n)}: ${ans}`;
  },
  speech: (p) => (p.variant === 'words' ? `${numberWords(p.n)}. Write it as a number.` : null),

  hint(p) {
    if (p.variant === 'expanded') return 'Put each part in its place: thousands, hundreds, tens, ones.';
    if (p.variant === 'missingpart') return 'Which place is missing from the parts?';
    if (p.variant === 'words') return 'Write each part as a number, then put them together.';
    if (p.variant === 'value') return 'Which place is the marked digit in? Ones, tens, hundreds…';
    return 'Count places from the right: ones, tens, hundreds, thousands.';
  },
  steps(p) {
    const ans = placeAnswer(p);
    const d = digitAt(p.n, p.place);
    if (p.variant === 'expanded') {
      const named = placeParts(p.n).map((part) => {
        const place = placesOf(part) - 1;
        return `${digitAt(part, place)} ${PLACE_WORDS[place]}`;
      });
      return [named.join(', '), `Write the digits in their places: ${fmt(p.n)}`];
    }
    if (p.variant === 'missingpart') return [`${fmt(p.n)} has ${d} in the ${PLACE_WORDS[p.place]} place`, `${d} ${PLACE_WORDS[p.place]} = ${fmt(ans)}`];
    if (p.variant === 'words') {
      const thousands = Math.floor(p.n / 1000);
      const rest = p.n % 1000;
      return [`${numberWords(thousands * 1000)} → ${fmt(thousands * 1000)}`, ...(rest ? [`${numberWords(rest)} → ${fmt(rest)}`] : []), `${fmt(thousands * 1000)} + ${fmt(rest)} = ${fmt(p.n)}`];
    }
    if (p.variant === 'value') return [`The ${d} is in the ${PLACE_WORDS[p.place]} place`, `${d} ${PLACE_WORDS[p.place]} = ${fmt(ans)}`];
    return [`From the right: ${PLACE_WORDS.slice(0, p.place + 1).join(', ')}`, `The ${PLACE_WORDS[p.place]} digit is ${ans}`];
  },
  board: (p) => placeChartHtml(p.n, { highlight: p.variant === 'expanded' || p.variant === 'words' ? -1 : p.place }),
  isValid(p) {
    if (!isInt(p.n) || p.n < 10 || p.n > 99999) return false;
    if (p.variant === 'expanded' || p.variant === 'words') return true;
    if (!['value', 'digit', 'missingpart'].includes(p.variant) || !isInt(p.place) || p.place >= placesOf(p.n)) return false;
    return digitAt(p.n, p.place) > 0 && (p.variant !== 'missingpart' || placeParts(p.n).length >= 2);
  }
};

// ---------- Round & compare ----------
// digits: size of the numbers. places: which places to round to (10, 100, …).
// close: chance the two compared numbers share their first digits. same: share
// of compare shots that test "=" with an expanded form (3,000 + 482 vs 3,482).

const ROUND_RANGES = {
  rookie: { digits: 2, places: [10], mix: { round: 50, compare: 50 }, close: 0.5, same: 0 },
  starter: { digits: 3, places: [10, 100], mix: { round: 50, compare: 50 }, close: 0.6, same: 0 },
  allstar: { digits: 4, places: [10, 100, 1000], mix: { round: 50, compare: 50 }, close: 0.7, same: 0.1 },
  mvp: { digits: 5, places: [10, 100, 1000, 10000], mix: { round: 50, compare: 50 }, close: 0.8, same: 0.1 },
  stretch: { digits: 5, places: [100, 1000, 10000], mix: { round: 50, compare: 50 }, close: 0.9, same: 0.1 }
};

const roundTo = (n, place) => Math.floor((n + place / 2) / place) * place;
const symbolFor = (x, y) => (x > y ? '>' : x < y ? '<' : '=');

// Two different numbers that often agree in their first digits
function closePair(digits, close) {
  const x = numberWithDigits(digits, 0.2);
  if (!chance(close) || digits < 2) {
    let y;
    do y = numberWithDigits(digits, 0.2); while (y === x);
    return [x, y];
  }
  // Same first digits, different from some place on
  const keep = randInt(1, digits - 1);
  const unit = 10 ** (digits - keep);
  for (;;) {
    const y = Math.floor(x / unit) * unit + randInt(0, unit - 1);
    if (y !== x && y >= 10 ** (digits - 1)) return [x, y];
  }
}

export const roundcompare = {
  label: 'Round & compare',
  blurb: 'Round to the nearest ten or hundred, and tell which number is bigger with < = >.',
  family: 'leftcorner',
  layout: 'story',
  weight: 3,
  tip: 'To round, look one place to the right: 5 or more rounds up.',

  generate({ level, tier }) {
    const r = rangesFor(ROUND_RANGES, level, tier);
    if (pickWeighted(r.mix) === 'round') {
      const place = pickFrom(r.places.filter((pl) => pl < 10 ** r.digits));
      // Never a multiple already, and never rounding up past 99,999 (the pad's limit)
      let n;
      do {
        n = numberWithDigits(r.digits, 0.2);
        // Now and then exactly halfway, which rounds up
        if (chance(0.15)) n = Math.floor(n / place) * place + place / 2;
      } while (n % place === 0 || roundTo(n, place) > 99999);
      return { kind: 'roundcompare', variant: 'round', n, place };
    }
    if (chance(r.same)) {
      const y = numberWithDigits(r.digits, 0.2);
      return { kind: 'roundcompare', variant: 'compare', x: y, y, expanded: true };
    }
    const [x, y] = closePair(r.digits, r.close);
    return { kind: 'roundcompare', variant: 'compare', x, y };
  },
  input: (p) => (p.variant === 'compare' ? 'choice' : 'keypad'),
  boxes: (p) => [{ role: p.variant === 'compare' ? 'choice' : 'target' }],
  answers: (p) => [p.variant === 'round' ? roundTo(p.n, p.place) : symbolFor(p.x, p.y)],

  prompt(p, box) {
    if (p.variant === 'round') {
      return `<p class="story-text">Round <b class="num-a">${fmt(p.n)}</b> to the nearest <b class="num-b">${PLACE_ONE[placesOf(p.place) - 1]}</b>.</p><div class="answer-line">${box(0)}</div>`;
    }
    const left = p.expanded
      ? placeParts(p.x).map((part) => fmt(part)).join(' + ')
      : fmt(p.x);
    return `<div class="answer-line big compare-line"><span class="num-a">${left}</span>${box(0)}<span class="num-b">${fmt(p.y)}</span></div>`;
  },
  text(p, { solved = false } = {}) {
    if (p.variant === 'round') return `Round ${fmt(p.n)} to the nearest ${PLACE_ONE[placesOf(p.place) - 1]}: ${solved ? fmt(roundTo(p.n, p.place)) : '?'}`;
    const left = p.expanded ? placeParts(p.x).map(fmt).join(' + ') : fmt(p.x);
    return `${left} ${solved ? symbolFor(p.x, p.y) : '?'} ${fmt(p.y)}`;
  },
  hint(p) {
    if (p.variant === 'round') return `Look at the digit to the right of the ${PLACE_WORDS[placesOf(p.place) - 1]} place: 5 or more rounds up.`;
    if (p.expanded) return 'Put the parts together first, then compare.';
    return 'Compare from the biggest place first. The first place that differs decides.';
  },
  steps(p) {
    if (p.variant === 'round') {
      const lo = Math.floor(p.n / p.place) * p.place;
      const hi = lo + p.place;
      const mid = lo + p.place / 2;
      const ans = roundTo(p.n, p.place);
      const where = p.n === mid ? 'is exactly halfway, which rounds up' : p.n > mid ? 'is past halfway' : 'is before halfway';
      return [`${fmt(p.n)} is between ${fmt(lo)} and ${fmt(hi)}`, `Halfway is ${fmt(mid)}, and ${fmt(p.n)} ${where}`, `So it rounds to ${fmt(ans)}`];
    }
    const sym = symbolFor(p.x, p.y);
    if (p.expanded) return [`${placeParts(p.x).map(fmt).join(' + ')} = ${fmt(p.x)}`, `${fmt(p.x)} ${sym} ${fmt(p.y)}`];
    const places = Math.max(placesOf(p.x), placesOf(p.y));
    let place = places - 1;
    while (place > 0 && digitAt(p.x, place) === digitAt(p.y, place)) place -= 1;
    return [
      `Line up the places and start at the biggest`,
      `The first difference is in the ${PLACE_WORDS[place]}: ${digitAt(p.x, place)} vs ${digitAt(p.y, place)}`,
      `So ${fmt(p.x)} ${sym} ${fmt(p.y)}`
    ];
  },
  board: (p, { solved = false } = {}) => (p.variant === 'round'
    ? roundLineHtml(p.n, p.place, { solved })
    : compareChartHtml(p.x, p.y)),
  isValid(p) {
    if (p.variant === 'round') return isInt(p.n) && [10, 100, 1000, 10000].includes(p.place) && p.n > p.place / 2 && p.n % p.place !== 0;
    return p.variant === 'compare' && isInt(p.x) && isInt(p.y) && p.x >= 10 && p.y >= 10 && (p.x !== p.y || p.expanded === true);
  }
};
