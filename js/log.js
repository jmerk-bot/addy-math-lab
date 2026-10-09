// The journey log: a dated record of every finished game, kept on the tablet
// under its own key. Entries are only ever added. Anything the journey shows
// (seasons, highest levels, goals) is worked out from the log, so it can be
// redesigned later and recomputed over the whole history.
//
// Events (each also has d: 'YYYY-MM-DD' and at: ms when it was logged):
//   start   where things stood when logging began: base level, each unlocked
//           play's level and tier, and the season record so far
//   game    a finished game: n (season game count), len ('full' | 'quick'),
//           start (ms at tip-off), pts, unlocked (a play that unlocked at the
//           buzzer), shots: one SHOT record per shot, in order, and skips:
//           one SKIP record per "I don't know this yet" (when there were any)
//   set     a play's level changed by hand in Change the Game (kind, level)
//   base    the base level changed by hand (level)
//   unlock  a play unlocked by hand (kind)
//   reset   the season record was reset
//   resume  a concept paused from a shot was turned back on (kind, key)
//
// A SHOT record is [kind, level, tier, points, misses, help, change, comfort]:
// the play's level and tier when it was shot, points (3 swish, 2 put-back,
// 1 after "Show me how"), misses before the make, how far up the "Ask Coach
// Cheryl" ladder it went (0–3), the difficulty step it caused (-1, 0 or 1),
// and 1 for a familiar warm-up, closer or calm-down shot.
//
// A SKIP record is [at, kind, level, tier, reason, change, key]: at = how many
// shots had gone in before it (so it replays in order), the play's level and
// tier then, the reason ('tired' | 'hard' | 'notready'), the difficulty steps
// it caused (0, or negative for "too hard"), and the concept key it was about
// ('*' for the whole play; see conceptOf() in js/plays.js).

import { LEVELS, dayKey } from './kit.js';
import { PLAY_IDS } from './plays.js';

export const LOG_KEY = 'addy-math-lab:log';
export const LOG_VERSION = 1;

let events = [];
let writable = true; // false once a write has failed (storage full)

const isInt = (n) => Number.isInteger(n) && n >= 0;
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d);

// Difficulty as one number: three tiers per level, so every change is ±1
export const stepOf = (level, tier) => LEVELS.indexOf(level) * 3 + tier;

export function isShotRecord(r) {
  return Array.isArray(r) && r.length === 8
    && PLAY_IDS.includes(r[0]) && LEVELS.includes(r[1]) && [0, 1, 2].includes(r[2])
    && [1, 2, 3].includes(r[3]) && isInt(r[4]) && [0, 1, 2, 3].includes(r[5])
    && [-1, 0, 1].includes(r[6]) && (r[7] === 0 || r[7] === 1);
}

export const SKIP_REASONS = ['tired', 'hard', 'notready'];

export function isSkipRecord(r) {
  return Array.isArray(r) && r.length === 7 && isInt(r[0])
    && PLAY_IDS.includes(r[1]) && LEVELS.includes(r[2]) && [0, 1, 2].includes(r[3])
    && SKIP_REASONS.includes(r[4]) && Number.isInteger(r[5]) && r[5] <= 0 && r[5] >= -6 && typeof r[6] === 'string';
}

// Keeps any well-formed event (including kinds a newer version may add);
// a game keeps only its well-formed shots
function cleanEvent(e) {
  if (!e || typeof e !== 'object' || typeof e.e !== 'string' || !isDay(e.d)) return null;
  if (e.e !== 'game') return e;
  const shots = Array.isArray(e.shots) ? e.shots.filter(isShotRecord) : [];
  const skips = Array.isArray(e.skips) ? e.skips.filter(isSkipRecord) : [];
  return { ...e, shots, ...(skips.length ? { skips } : {}) };
}

export function isLog(log) {
  return !!log && typeof log === 'object' && Array.isArray(log.events);
}

export function loadLog() {
  events = [];
  writable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(LOG_KEY));
    if (isLog(saved)) events = saved.events.map(cleanEvent).filter(Boolean);
  } catch (e) {}
}

function writeLog() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify({ v: LOG_VERSION, events }));
    writable = true;
  } catch (e) {
    writable = false; // kept in memory; the panel suggests saving a copy
  }
}

export const logEvents = () => events;
export const logFull = () => !writable;

export function logEvent(type, fields = {}) {
  events.push({ e: type, d: dayKey(), at: Date.now(), ...fields });
  writeLog();
}

// The starting point, once, when there's nothing logged yet
export function logStart(state) {
  if (events.length) return;
  const plays = Object.fromEntries(PLAY_IDS.filter((id) => state.progress[id].unlocked)
    .map((id) => [id, [state.progress[id].level, state.progress[id].tier]]));
  const { games, points, high, highQuick } = state.season;
  logEvent('start', { base: state.level, plays, season: { games, points, high, highQuick } });
}

// One shot, taken just after it went in. before: the play's level and tier
// when it was shot; p: its progress now.
export function shotRecord(kind, before, p, game) {
  const change = Math.sign(stepOf(p.level, p.tier) - stepOf(before.level, before.tier));
  return [kind, before.level, before.tier, game.lastPoints, game.misses, Math.min(game.help, 3), change, game.comfort ? 1 : 0];
}

// A finished game. A game already logged (same tip-off time) isn't logged twice.
export function logGame(game, n) {
  const last = events[events.length - 1];
  if (game.start && last?.e === 'game' && last.start === game.start) return;
  logEvent('game', {
    n,
    len: game.periods === 2 ? 'quick' : 'full',
    start: game.start,
    pts: game.points,
    ...(game.unlocked ? { unlocked: game.unlocked } : {}),
    shots: game.shotLog,
    ...(game.skips.length ? { skips: game.skips } : {})
  });
}

// For the panel: when logging began and how many games are in it
export function logStatus() {
  const start = events.find((e) => e.e === 'start');
  return { since: start?.d || '', games: events.filter((e) => e.e === 'game').length, full: !writable };
}
