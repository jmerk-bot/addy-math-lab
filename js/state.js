// App state, and saving/restoring it between launches.

import { OPS } from './math.js';
import { LEVELS, PLAY_IDS, PLAYS, isValidProblem } from './plays.js';

// A game is four quarters of five shots, with halftime after the second.
export const QUARTERS = 4;
export const SHOTS_PER_QUARTER = 5;

export const GAME_STATUSES = ['pregame', 'shot', 'made', 'halftime', 'final'];

function freshGame() {
  return {
    status: 'pregame', // one of GAME_STATUSES
    quarter: 1,
    shot: 0, // shots made so far this quarter
    points: 0,
    threes: 0, // swishes: made on the first try, worth 3
    makes: 0,
    streak: 0, // swishes in a row
    bestStreak: 0,
    problem: null, // the shot on screen (see js/plays.js)
    misses: 0, // misses on the current shot
    entries: [], // digits typed into each answer box
    box: 0, // the answer box the number pad types into
    stale: [], // per box: it holds a missed guess, so the next digit starts fresh
    lastPoints: 0, // points from the latest make
    call: '', // the announcer's latest line
    headline: '' // the final-buzzer headline
  };
}

function freshSeason() {
  return { games: 0, points: 0, high: 0, threes: 0, bestStreak: 0 };
}

export const state = {
  mode: 'game', // 'game' | 'lab' (Practice)
  level: 'starter',
  playbook: [...PLAY_IDS], // plays the Game calls
  ops: [...OPS], // operations the Equations play uses
  lab: { a: 6, b: 3, op: '+' },
  game: freshGame(),
  season: freshSeason()
};

export function resetGame() {
  state.game = freshGame();
}

export function resetSeason() {
  state.season = freshSeason();
}

// ---------- Persistence ----------
// The tablet may close the app in the background, so everything (settings, the
// Practice numbers, a game in progress and the season record) is kept in
// localStorage and restored on launch.

const STORAGE_KEY = 'addy-math-lab:v3';
const V2_KEY = 'addy-math-lab:v2';
const OLD_KEYS = ['addy-math-lab:v1', V2_KEY]; // earlier layouts, cleared once v3 is saved

let oldKeysCleared = false;

const isInt = (n) => Number.isInteger(n) && n >= 0;

export function saveState() {
  try {
    const { mode, level, playbook, ops, lab, game, season } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, level, playbook, ops, lab, game, season }));
    if (!oldKeysCleared) {
      OLD_KEYS.forEach((key) => localStorage.removeItem(key));
      oldKeysCleared = true;
    }
  } catch (e) {}
}

export function loadState() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      || fromV2(JSON.parse(localStorage.getItem(V2_KEY)));
  } catch (e) {
    return;
  }
  if (!saved || typeof saved !== 'object') return;

  if (saved.mode === 'lab' || saved.mode === 'game') state.mode = saved.mode;
  if (LEVELS.includes(saved.level)) state.level = saved.level;

  if (Array.isArray(saved.playbook)) {
    const valid = PLAY_IDS.filter((id) => saved.playbook.includes(id));
    if (valid.length) state.playbook = valid;
  }

  if (Array.isArray(saved.ops)) {
    const valid = OPS.filter((op) => saved.ops.includes(op));
    if (valid.length) state.ops = valid;
  }

  const lab = saved.lab;
  if (lab && OPS.includes(lab.op) && Number.isInteger(lab.a) && Number.isInteger(lab.b)) {
    state.lab = { a: lab.a, b: lab.b, op: lab.op };
  }

  loadGame(saved.game);

  const s = saved.season;
  if (s && ['games', 'points', 'high', 'threes', 'bestStreak'].every((k) => isInt(s[k]))) {
    state.season = { games: s.games, points: s.points, high: s.high, threes: s.threes, bestStreak: s.bestStreak };
  }
}

function loadGame(g) {
  const counters = ['quarter', 'shot', 'points', 'threes', 'makes', 'streak', 'bestStreak', 'misses', 'lastPoints'];
  if (!g || !GAME_STATUSES.includes(g.status) || !counters.every((k) => isInt(g[k]))) return;

  const game = freshGame();
  counters.forEach((k) => { game[k] = g[k]; });
  game.status = g.status;
  game.call = typeof g.call === 'string' ? g.call : '';
  game.headline = typeof g.headline === 'string' ? g.headline : '';

  if (g.status === 'shot' || g.status === 'made') {
    if (!isValidProblem(g.problem)) return;
    const count = PLAYS[g.problem.kind].boxes(g.problem).length;
    const entries = Array.isArray(g.entries) ? g.entries : [];
    const stale = Array.isArray(g.stale) ? g.stale : [];
    game.problem = g.problem;
    game.entries = Array.from({ length: count }, (_, i) =>
      (typeof entries[i] === 'string' && /^\d{0,5}$/.test(entries[i]) ? entries[i] : ''));
    game.stale = Array.from({ length: count }, (_, i) => stale[i] === true);
    game.box = Number.isInteger(g.box) && g.box >= 0 && g.box < count ? g.box : 0;
  }
  state.game = game;
}

// The v2 layout had one answer per shot and equation problems only. Its
// settings, Practice numbers, game in progress and season record carry over.
function fromV2(v2) {
  if (!v2 || typeof v2 !== 'object') return null;
  const { mode, level, ops, lab, season, game: g } = v2;
  if (!g || typeof g !== 'object') return { mode, level, ops, lab, season };

  const p = g.problem;
  const problem = p && (p.missing === 'b' || p.missing === 'result')
    ? { kind: 'equation', a: p.a, b: p.b, op: p.op, result: p.target, missing: p.missing }
    : null;
  const game = {
    ...g,
    problem,
    entries: [typeof g.entry === 'string' ? g.entry : ''],
    box: 0,
    stale: [g.replaceOnType === true]
  };
  return { mode, level, ops, lab, season, game };
}
