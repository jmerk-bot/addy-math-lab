// Shared helpers for the plays: levels, random picks, and number words.

import { fmt } from './math.js';

export const LEVELS = ['rookie', 'starter', 'allstar', 'mvp'];
export const LEVEL_NAMES = { rookie: 'Rookie', starter: 'Starter', allstar: 'All-Star', mvp: 'MVP' };

export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
export const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const isInt = (n) => Number.isInteger(n) && n >= 0;

// Local date as 'YYYY-MM-DD'
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// A multiple of `step` in [min, max], or null when there isn't one
export function randStep(min, max, step = 1) {
  const lo = Math.ceil(min / step);
  const hi = Math.floor(max / step);
  return lo > hi ? null : step * randInt(lo, hi);
}

// Picks a key from { key: weight }
export function pickWeighted(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

// Tiers 0–2 ramp difficulty inside a level: at tier 1 about a third of shots,
// and at tier 2 about two thirds, use the next level's ranges (past MVP, the
// play's "stretch" ranges). So moving up a level is a small step: by tier 2,
// most shots already come from the next level.
const NEXT_LEVEL_SHARE = [0, 0.3, 0.6];

export function rangesFor(table, level, tier = 0) {
  const next = table[LEVELS[LEVELS.indexOf(level) + 1]] || table.stretch || table[level];
  return Math.random() < NEXT_LEVEL_SHARE[tier] ? next : table[level];
}

// ---------- Number words: 2060 → "two thousand, sixty" ----------

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n) {
  if (n < 20) return ONES[n];
  const ones = n % 10;
  return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[Math.floor(n / 10)];
}

function under1000(n) {
  const parts = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
  if (n % 100) parts.push(under100(n % 100));
  return parts.join(' ');
}

// Up to 99,999
export function numberWords(n) {
  if (n === 0) return 'zero';
  const parts = [];
  if (n >= 1000) parts.push(`${under1000(Math.floor(n / 1000))} thousand`);
  if (n % 1000) parts.push(under1000(n % 1000));
  return parts.join(', ');
}

// "1 foot", "3 feet", "1,200 feet"
export const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
