// Pictures of the math, as HTML strings: the Practice manipulatives (ten-frames,
// base-ten blocks, arrays, area models, sharing) and the boards the plays show
// for "Go Practice This Play", "Show me how" and the film room (bar models, tape
// diagrams, place-value charts, rounding lines, fraction bars, rectangles,
// angles). Nothing here reads app state or touches the DOM.

import { compute, fmt } from './math.js';

const badgesHtml = (badges) => badges.map((text) => `<span class="split-badge">${text}</span>`).join('');

// The manipulative Practice shows for A op B
export function manipulativeHtml(a, b, op) {
  const result = compute(a, b, op);
  if (op === '×') return a > 12 || b > 12 ? areaModelHtml(a, b) : arrayHtml(a, b);
  if (op === '÷') return result > 12 ? shareByPlaceHtml(a, b) : sharingHtml(a, b, b > 0 ? a % b : 0);
  if (Math.max(a, op === '+' ? a + b : 0) <= 20) return tenFramesHtml(a, b, op, result);
  return op === '+' ? blocksAddHtml(a, b) : blocksSubtractHtml(a, b);
}

// ---------- Ten-frames (+ and − up to 20) ----------
// Addition: A blue circles, then B amber diamonds (filling the first frame to ten first).
// Subtraction: the circles that remain, then the ones taken away crossed out.
export function tenFramesHtml(a, b, op, result) {
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

export const placeDigits = (n) => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 });

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

export function unitsHtml(classes) {
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
export function blocksAddHtml(a, b) {
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
export function blocksSubtractHtml(a, b) {
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
export function arrayHtml(a, b) {
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
export function placeParts(n) {
  const parts = [10000, 1000, 100, 10, 1].map((p) => Math.floor(n / p) % 10 * p).filter(Boolean);
  return parts.length ? parts : [0];
}

export function areaModelHtml(a, b) {
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
export function sharingHtml(a, b, remainder) {
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
export function shareByPlace(a, b) {
  const { h: H, t: T, o: O } = placeDigits(a);
  const hEach = Math.floor(H / b);
  const tens = T + 10 * (H % b);
  const tEach = Math.floor(tens / b);
  const ones = O + 10 * (tens % b);
  const oEach = Math.floor(ones / b);
  const left = ones % b;

  const steps = [];
  if (H) steps.push(`${H} hundreds: ${hEach} each` + (H % b ? `, ${H % b} left → ${10 * (H % b)} tens` : ''));
  steps.push(`${tens} tens: ${tEach} each` + (tens % b ? `, ${tens % b} left → ${10 * (tens % b)} ones` : ''));
  steps.push(`${ones} ones: ${oEach} each` + (left ? `, ${left} left over` : ''));
  return { each: 100 * hEach + 10 * tEach + oEach, left, steps };
}

export function shareByPlaceHtml(a, b) {
  const { each, left, steps } = shareByPlace(a, b);
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

// ---------- Bar models (story shots) ----------
// "?" stands in for the number being asked for, unless the board is solved.

const showNum = (value, asked, solved) => (asked && !solved ? '?' : fmt(value));

// The whole on top and its parts below, each part as wide as its share
export function partWholeHtml({ total, parts, ask, solved, caption = '' }) {
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  const partsHtml = parts.map((p, i) =>
    `<div class="bar-part ${p.cls}" style="flex: ${Math.max(p.value / sum, 0.14)}">${showNum(p.value, ask === i, solved)}</div>`).join('');
  return `
    <div class="bar-model">
      <div class="bar-whole ${ask === 'total' ? 'asked' : ''}">${showNum(total, ask === 'total', solved)}</div>
      <div class="bar-parts">${partsHtml}</div>
      ${caption ? `<p class="bar-caption">${caption}</p>` : ''}
    </div>
  `;
}

// A bar cut into equal groups. ask: 'total', 'each' or 'groups'
export function equalGroupsHtml({ groups, each, ask, solved }) {
  const total = groups * each;
  const label = showNum(each, ask === 'each', solved);
  const shown = groups <= 10 ? groups : 4;
  let cells = Array(shown).fill(`<div class="bar-part num-b-bg">${label}</div>`).join('');
  if (groups > 10) cells += '<div class="bar-gap">…</div><div class="bar-part num-b-bg">' + label + '</div>';
  const count = ask === 'groups' && !solved ? '? groups' : `${fmt(groups)} groups`;
  return `
    <div class="bar-model">
      <div class="bar-whole ${ask === 'total' ? 'asked' : ''}">${showNum(total, ask === 'total', solved)}</div>
      <div class="bar-parts">${cells}</div>
      <p class="bar-caption">${count} of ${label}</p>
    </div>
  `;
}

// Two bars side by side, lined up on the left, with the difference marked
export function compareBarsHtml({ big, small, bigName, smallName, ask, solved }) {
  const pct = Math.max(12, Math.round((small / big) * 100));
  return `
    <div class="bar-model compare">
      <div class="bar-row">
        <span class="bar-name">${bigName}</span>
        <div class="bar-track"><div class="bar-part num-a-bg" style="width: 100%">${showNum(big, ask === 'big', solved)}</div></div>
      </div>
      <div class="bar-row">
        <span class="bar-name">${smallName}</span>
        <div class="bar-track">
          <div class="bar-part num-b-bg" style="width: ${pct}%">${showNum(small, ask === 'small', solved)}</div>
          <div class="bar-diff" style="width: ${100 - pct}%">${showNum(big - small, ask === 'diff', solved)}</div>
        </div>
      </div>
    </div>
  `;
}

// "Times as many": one row with a single unit, one with k units of the same
// size. ask: 'total' (k × unit), 'k' (how many units) or 'unit' (the smaller amount)
export function tapeHtml({ unit, k, smallName, bigName, ask, solved }) {
  const unitLabel = showNum(unit, ask === 'unit', solved);
  const shown = Math.min(k, 10);
  const more = k > 10 ? '<div class="bar-gap">…</div>' : '';
  const kHidden = ask === 'k' && !solved;
  // Both rows have the same number of slots, so a unit is the same width in each
  const small = `<div class="bar-part num-a-bg">${unitLabel}</div>`
    + '<div class="bar-ghost"></div>'.repeat(shown - 1) + (more && '<div class="bar-gap"></div>');
  const big = kHidden
    ? `<div class="bar-part num-b-bg" style="flex: ${shown}">${fmt(unit * k)}</div>`
    : `<div class="bar-part num-b-bg">${unitLabel}</div>`.repeat(shown) + more;
  return `
    <div class="bar-model tape">
      <div class="bar-row">
        <span class="bar-name">${smallName}</span>
        <div class="tape-units">${small}</div>
      </div>
      <div class="bar-row">
        <span class="bar-name">${bigName}</span>
        <div class="tape-units">${big}</div>
      </div>
      <p class="bar-caption">${kHidden ? '? times as many' : `${fmt(k)} times as many`} · total ${showNum(unit * k, ask === 'total', solved)}</p>
    </div>
  `;
}

// ---------- Place value ----------

const PLACE_NAMES = ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands'];

// Each digit under its place name, its value below, and the expanded form.
// highlight: the place index (0 = ones) to mark.
export function placeChartHtml(n, { highlight = -1, places = Math.max(2, String(n).length) } = {}) {
  const digits = String(n).padStart(places, '0').split('').map(Number);
  let head = '';
  let row = '';
  let values = '';
  digits.forEach((d, i) => {
    const place = places - 1 - i;
    const mark = place === highlight ? 'hl' : '';
    head += `<div class="pv-head ${mark}">${PLACE_NAMES[place]}</div>`;
    row += `<div class="pv-digit ${mark}">${d}</div>`;
    values += `<div class="pv-value ${mark}">${fmt(d * 10 ** place)}</div>`;
  });
  const parts = placeParts(n).filter(Boolean).map(fmt);
  return `
    <div class="pv-chart" style="grid-template-columns: repeat(${places}, 1fr);">${head}${row}${values}</div>
    <p class="pv-expanded">${fmt(n)} = ${parts.join(' + ') || 0}</p>
  `;
}

// Two numbers lined up by place, with the first place where they differ marked
export function compareChartHtml(x, y) {
  const places = Math.max(String(x).length, String(y).length);
  const dx = String(x).padStart(places, '0');
  const dy = String(y).padStart(places, '0');
  const first = [...dx].findIndex((d, i) => d !== dy[i]);
  const cells = (ds, cls) => [...ds].map((d, i) => `<div class="pv-digit ${cls} ${i === first ? 'hl' : ''}">${d}</div>`).join('');
  let head = '';
  for (let i = 0; i < places; i++) head += `<div class="pv-head ${i === first ? 'hl' : ''}">${PLACE_NAMES[places - 1 - i]}</div>`;
  return `<div class="pv-chart" style="grid-template-columns: repeat(${places}, 1fr);">${head}${cells(dx, 'num-a')}${cells(dy, 'num-b')}</div>`;
}

// The stretch of number line between the two multiples of `place` around n,
// with the halfway point marked and the ball at n.
export function roundLineHtml(n, place, { solved = false } = {}) {
  const lo = Math.floor(n / place) * place;
  const hi = lo + place;
  const mid = lo + place / 2;
  const at = (v) => `${((v - lo) / place) * 100}%`;
  const answer = n >= mid ? hi : lo;
  let ticks = '';
  for (let k = 0; k <= 10; k++) {
    const v = lo + (k * place) / 10;
    const label = k === 0 || k === 5 || k === 10 ? fmt(v) : '';
    const cls = [k === 5 ? 'mid' : '', solved && v === answer ? 'target' : ''].join(' ');
    ticks += `<div class="tick-col" style="left: ${at(v)}"><div class="tick-line ${cls}"></div><span class="tick-label ${cls}">${label}</span></div>`;
  }
  return `
    <div class="round-line">
      <div class="number-line-track">
        <div class="vector-landing static" style="left: ${at(n)}">
          <span class="landing-num">${fmt(n)}</span>
          ${BALL_SVG}
        </div>
      </div>
      <div class="ticks-container">${ticks}</div>
      <p class="bar-caption">Halfway is ${fmt(mid)}${solved ? ` · ${fmt(n)} rounds to ${fmt(answer)}` : ''}</p>
    </div>
  `;
}

export const BALL_SVG = `<svg class="landing-ball" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10.5" fill="#f26b1d" stroke="#1c0f05" stroke-width="1.5"/>
  <g fill="none" stroke="#1c0f05" stroke-width="1.3" stroke-linecap="round">
    <path d="M12 1.5v21"/><path d="M1.5 12h21"/>
    <path d="M4.6 4.6c3.2 3 3.2 11.8 0 14.8"/><path d="M19.4 4.6c-3.2 3-3.2 11.8 0 14.8"/>
  </g>
</svg>`;

// ---------- Fractions ----------

// A fraction stacked: top over bottom. Either part can be an answer box.
export function fracHtml(top, bottom, cls = '') {
  return `<span class="frac ${cls}"><span class="frac-top">${top}</span><span class="frac-bottom">${bottom}</span></span>`;
}

// Each fraction as a bar cut into equal pieces, n of them filled. A fraction
// over 1 spills onto more bars.
export function fractionBarsHtml(bars) {
  const rows = bars.map(({ n, d, cls, label }) => {
    const wholes = Math.max(1, Math.ceil(n / d));
    let html = '';
    for (let w = 0; w < wholes; w++) {
      const filled = Math.min(d, Math.max(0, n - w * d));
      html += `<div class="frac-bar">${Array.from({ length: d }, (_, i) => `<div class="frac-piece ${i < filled ? cls : ''}"></div>`).join('')}</div>`;
    }
    return `<div class="frac-row"><span class="frac-label">${label}</span><div class="frac-bars">${html}</div></div>`;
  }).join('');
  return `<div class="frac-board">${rows}</div>`;
}

// ---------- Rectangles (area and perimeter) ----------
// Fits 220 × 116; unit squares are drawn when grid is on.
export function rectangleHtml({ w, h, wLabel, hLabel, grid = false, askSide = '' }) {
  const s = Math.min(220 / w, 116 / h, 28);
  const W = w * s;
  const H = h * s;
  let lines = '';
  if (grid) {
    for (let x = 1; x < w; x++) lines += `<line x1="${x * s}" y1="0" x2="${x * s}" y2="${H}"/>`;
    for (let y = 1; y < h; y++) lines += `<line x1="0" y1="${y * s}" x2="${W}" y2="${y * s}"/>`;
  }
  const wCls = askSide === 'w' ? 'svg-ask' : 'svg-a';
  const hCls = askSide === 'h' ? 'svg-ask' : 'svg-b';
  return `
    <svg class="figure-svg" viewBox="-10 -26 ${W + 70} ${H + 36}" style="max-width: ${W + 70}px" aria-hidden="true">
      <rect x="0" y="0" width="${W}" height="${H}" class="rect-fill"/>
      <g class="rect-grid">${lines}</g>
      <rect x="0" y="0" width="${W}" height="${H}" class="rect-edge"/>
      <text x="${W / 2}" y="-8" text-anchor="middle" class="${wCls}">${wLabel}</text>
      <text x="${W + 8}" y="${H / 2 + 6}" class="${hCls}">${hLabel}</text>
    </svg>
  `;
}

// ---------- Angles ----------
// type 'right' (90°), 'straight' (180°) or 'full' (360°); parts are the angle
// sizes in order, counterclockwise from the right; labels say what to write
// in each (a number of degrees or "?").
export function angleHtml({ type, parts, labels }) {
  const R = 74;
  const cx = type === 'right' ? 34 : 110;
  const cy = type === 'full' ? 100 : 96;
  const point = (deg, r = R) => {
    const t = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
  };
  const total = { right: 90, straight: 180, full: 360 }[type];
  let start = 0;
  let rays = '';
  let arcs = '';
  let texts = '';
  const bounds = [0];
  parts.forEach((p) => { start += p; bounds.push(start); });
  // One ray per boundary; around a full turn the last boundary is the first
  bounds.slice(0, type === 'full' ? -1 : undefined).forEach((deg) => {
    const [x, y] = point(deg);
    rays += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  });
  parts.forEach((p, i) => {
    const a0 = bounds[i];
    const a1 = bounds[i + 1];
    const r = 26 + (i % 2) * 6;
    const [x0, y0] = point(a0, r);
    const [x1, y1] = point(a1, r);
    arcs += `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}" class="${labels[i] === '?' ? 'arc-ask' : `arc-${i % 2 ? 'b' : 'a'}`}"/>`;
    const [tx, ty] = point((a0 + a1) / 2, 50);
    texts += `<text x="${tx}" y="${ty + 5}" text-anchor="middle" class="${labels[i] === '?' ? 'svg-ask' : `svg-${i % 2 ? 'b' : 'a'}`}">${labels[i]}</text>`;
  });
  const height = type === 'full' ? 200 : 110;
  const width = type === 'right' ? 130 : 220;
  return `
    <svg class="figure-svg angle-svg" viewBox="0 0 ${width} ${height}" style="max-width: ${width}px" aria-hidden="true">
      <g class="angle-rays">${rays}</g>
      ${arcs}
      ${texts}
      <circle cx="${cx}" cy="${cy}" r="3" class="angle-vertex"/>
      <text x="${width - 4}" y="${height - 4}" text-anchor="end" class="svg-total">${total}° in all</text>
    </svg>
  `;
}

// ---------- Groups and leftovers (remainder stories) ----------
// q full groups of b and a part-filled group of r. mode says what the story
// does with the leftovers: 'up' (they need one more group), 'drop' (only full
// groups count) or 'left' (the leftovers are the answer).
export function groupsHtml({ q, b, r, mode, solved }) {
  const dots = (n, cls) => `<div class="group-dots">${Array.from({ length: b }, (_, i) => `<span class="gdot ${i < n ? cls : 'empty'}"></span>`).join('')}</div>`;
  const shown = Math.min(q, 6);
  let full = '';
  for (let i = 0; i < shown; i++) full += `<div class="group full">${dots(b, 'blue')}</div>`;
  if (q > shown) full += `<div class="group more">… ${fmt(q - shown)} more full groups</div>`;
  const partialCls = solved ? `partial ${mode}` : 'partial';
  const note = !solved ? ''
    : mode === 'up' ? '<span class="group-note">needs one more</span>'
    : mode === 'drop' ? '<span class="group-note">not full</span>'
    : '<span class="group-note">left over</span>';
  const partial = r > 0 ? `<div class="group ${partialCls}">${dots(r, 'amber')}${note}</div>` : '';
  return `
    <div class="groups-board">${full}${partial}</div>
    <p class="bar-caption">${fmt(q)} full groups of ${b}${r ? `, and ${r} left over` : ''}</p>
  `;
}
