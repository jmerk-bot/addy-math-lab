// App state, and saving/restoring it between launches.

import { OPS } from './math.js';
import { LEVELS, PLAY_IDS, PLAYS, isValidProblem } from './plays.js';
import { freshProgress, RECENT, SEASON_RECENT } from './coach.js';

export const SHOTS_PER_QUARTER = 5;

// A full game is four quarters with halftime after the second; a quick game
// is two halves.
export const LENGTHS = {
  full: { periods: 4, label: 'Full game', desc: '4 quarters · 20 shots' },
  quick: { periods: 2, label: 'Quick game', desc: '2 halves · 10 shots' }
};

export const GAME_STATUSES = ['pregame', 'shot', 'made', 'halftime', 'final'];

function freshGame(periods = 4) {
  return {
    status: 'pregame', // one of GAME_STATUSES
    periods, // 4 quarters, or 2 halves for a quick game
    quarter: 1,
    shot: 0, // shots made so far this quarter
    points: 0,
    threes: 0, // swishes: made on the first try, worth 3
    makes: 0,
    assists: 0, // made after "Show me how", worth 1
    streak: 0, // swishes in a row
    bestStreak: 0,
    problem: null, // the shot on screen (see js/plays.js)
    misses: 0, // misses on the current shot
    help: 0, // how far up the "Ask Coach Cheryl" ladder this shot has gone
    assisted: false, // "Show me how" was used on this shot
    entries: [], // what's typed into each answer box
    box: 0, // the answer box the number pad types into
    stale: [], // per box: it holds a missed guess, so the next key starts fresh
    lastPoints: 0, // points from the latest make
    call: '', // the announcer's latest line
    headline: '', // the final-buzzer headline
    used: {}, // shots per play this game
    lastKinds: [], // the last few plays, for variety
    readingThisPeriod: 0, // story shots this quarter
    freshShots: 0, // shots from a brand-new play this game
    calm: 0, // familiar shots still to come after a rough patch
    comfort: false, // the shot on screen is a familiar one (warm-up, closer or calm-down)
    film: [], // shots that needed a rebound, for the film room
    levelUps: [], // [{ kind, level }] plays that moved up this game
    unlocked: '', // a play that unlocked at the final buzzer
    tipKind: '' // the play the halftime tip is about
  };
}

function freshSeason() {
  return {
    games: 0,
    points: 0,
    high: 0, // best full game
    highQuick: 0, // best quick game
    threes: 0,
    bestStreak: 0,
    days: {}, // 'YYYY-MM-DD' → games finished that day
    recent: [] // last 40 shots across all plays (1 = swish)
  };
}

// Progress for every play, with `unlocked` ones already open
function startingProgress(unlocked, level) {
  return Object.fromEntries(PLAY_IDS.map((id) => [id, unlocked.includes(id)
    ? { ...freshProgress(level), unlocked: true, introduced: true }
    : freshProgress(level)]));
}

export const DEFAULT_SETTINGS = {
  sound: true,
  speech: true, // read-aloud button on story shots
  length: 'full',
  autoLevel: true, // difficulty follows how shots are going
  autoUnlock: true // new plays unlock along the path
};

// A new install starts with Equations only; the rest unlock along the path
export const state = {
  mode: 'game', // 'game' | 'lab' (Practice)
  level: 'starter', // the base level; new plays start one below it
  playbook: ['equation'], // unlocked plays that are switched on
  progress: startingProgress(['equation'], 'starter'),
  ops: [...OPS], // operations the Equations play uses
  settings: { ...DEFAULT_SETTINGS },
  lab: { a: 6, b: 3, op: '+' },
  game: freshGame(),
  season: freshSeason()
};

export function resetGame(periods) {
  state.game = freshGame(periods);
}

export function resetSeason() {
  state.season = freshSeason();
}

// Local date as 'YYYY-MM-DD'
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------- Persistence ----------
// The tablet may close the app in the background, so everything (settings,
// progress, the Practice numbers, a game in progress and the season record)
// is kept in localStorage and restored on launch.

const STORAGE_KEY = 'addy-math-lab:v4';
const V3_KEY = 'addy-math-lab:v3';
const V2_KEY = 'addy-math-lab:v2';
const OLD_KEYS = ['addy-math-lab:v1', V2_KEY, V3_KEY]; // earlier layouts, cleared once v4 is saved

let oldKeysCleared = false;

const isInt = (n) => Number.isInteger(n) && n >= 0;
const isBits = (arr) => Array.isArray(arr) && arr.every((x) => x === 0 || x === 1);

export function saveState() {
  try {
    const { mode, level, playbook, progress, ops, settings, lab, game, season } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, level, playbook, progress, ops, settings, lab, game, season }));
    if (!oldKeysCleared) {
      OLD_KEYS.forEach((key) => localStorage.removeItem(key));
      oldKeysCleared = true;
    }
  } catch (e) {}
}

export function loadState() {
  let saved;
  try {
    const read = (key) => JSON.parse(localStorage.getItem(key));
    saved = read(STORAGE_KEY) || fromV3(read(V3_KEY)) || fromV3(fromV2(read(V2_KEY)));
  } catch (e) {
    return;
  }
  if (!saved || typeof saved !== 'object') return;

  if (saved.mode === 'lab' || saved.mode === 'game') state.mode = saved.mode;
  if (LEVELS.includes(saved.level)) state.level = saved.level;

  if (saved.progress && typeof saved.progress === 'object') {
    for (const id of PLAY_IDS) {
      const p = loadProgress(saved.progress[id]);
      if (p) state.progress[id] = p;
    }
  }
  if (!PLAY_IDS.some((id) => state.progress[id].unlocked)) {
    Object.assign(state.progress.equation, { unlocked: true, introduced: true });
  }

  const unlocked = PLAY_IDS.filter((id) => state.progress[id].unlocked);
  if (Array.isArray(saved.playbook)) {
    const valid = unlocked.filter((id) => saved.playbook.includes(id));
    state.playbook = valid.length ? valid : unlocked;
  } else {
    state.playbook = unlocked;
  }

  if (Array.isArray(saved.ops)) {
    const valid = OPS.filter((op) => saved.ops.includes(op));
    if (valid.length) state.ops = valid;
  }

  const s = saved.settings;
  if (s && typeof s === 'object') {
    for (const key of ['sound', 'speech', 'autoLevel', 'autoUnlock']) {
      if (typeof s[key] === 'boolean') state.settings[key] = s[key];
    }
    if (LENGTHS[s.length]) state.settings.length = s.length;
  }

  const lab = saved.lab;
  if (lab && OPS.includes(lab.op) && Number.isInteger(lab.a) && Number.isInteger(lab.b)) {
    state.lab = { a: lab.a, b: lab.b, op: lab.op };
  }

  loadGame(saved.game);
  loadSeason(saved.season);
}

function loadProgress(p) {
  if (!p || typeof p !== 'object') return null;
  const ints = ['fresh', 'unlockedAt', 'streak', 'slump', 'shots', 'swishes'];
  if (typeof p.unlocked !== 'boolean' || typeof p.introduced !== 'boolean' || !LEVELS.includes(p.level)
    || ![0, 1, 2].includes(p.tier) || !ints.every((k) => isInt(p[k])) || !isBits(p.recent)) return null;
  return { ...freshProgress(p.level), ...p, recent: p.recent.slice(-RECENT) };
}

function loadGame(g) {
  const counters = ['quarter', 'shot', 'points', 'threes', 'makes', 'streak', 'bestStreak', 'misses', 'lastPoints'];
  if (!g || !GAME_STATUSES.includes(g.status) || !counters.every((k) => isInt(g[k]))) return;
  const periods = g.periods === 2 ? 2 : 4;
  if (g.quarter < 1 || g.quarter > periods) return;

  const game = freshGame(periods);
  counters.forEach((k) => { game[k] = g[k]; });
  for (const k of ['assists', 'help', 'readingThisPeriod', 'freshShots', 'calm']) {
    if (isInt(g[k])) game[k] = g[k];
  }
  game.status = g.status;
  game.assisted = g.assisted === true;
  game.comfort = g.comfort === true;
  for (const k of ['call', 'headline', 'unlocked', 'tipKind']) {
    if (typeof g[k] === 'string') game[k] = g[k];
  }
  if (g.used && typeof g.used === 'object') {
    game.used = Object.fromEntries(PLAY_IDS.filter((id) => isInt(g.used[id])).map((id) => [id, g.used[id]]));
  }
  if (Array.isArray(g.lastKinds)) game.lastKinds = g.lastKinds.filter((id) => PLAY_IDS.includes(id)).slice(-3);
  if (Array.isArray(g.film)) game.film = g.film.filter(isValidProblem).slice(0, 6);
  if (Array.isArray(g.levelUps)) {
    game.levelUps = g.levelUps.filter((u) => u && PLAY_IDS.includes(u.kind) && LEVELS.includes(u.level));
  }

  if (g.status === 'shot' || g.status === 'made') {
    if (!isValidProblem(g.problem)) return;
    const count = PLAYS[g.problem.kind].boxes(g.problem).length;
    const entries = Array.isArray(g.entries) ? g.entries : [];
    const stale = Array.isArray(g.stale) ? g.stale : [];
    game.problem = g.problem;
    game.entries = Array.from({ length: count }, (_, i) =>
      (typeof entries[i] === 'string' && /^(\d{0,5}|[<=>])$/.test(entries[i]) ? entries[i] : ''));
    game.stale = Array.from({ length: count }, (_, i) => stale[i] === true);
    game.box = Number.isInteger(g.box) && g.box >= 0 && g.box < count ? g.box : 0;
  }
  state.game = game;
}

function loadSeason(s) {
  if (!s || !['games', 'points', 'high', 'threes', 'bestStreak'].every((k) => isInt(s[k]))) return;
  const season = freshSeason();
  for (const k of ['games', 'points', 'high', 'threes', 'bestStreak']) season[k] = s[k];
  if (isInt(s.highQuick)) season.highQuick = s.highQuick;
  if (isBits(s.recent)) season.recent = s.recent.slice(-SEASON_RECENT);
  if (s.days && typeof s.days === 'object') {
    season.days = Object.fromEntries(Object.entries(s.days)
      .filter(([day, n]) => /^\d{4}-\d\d-\d\d$/.test(day) && isInt(n))
      .sort()
      .slice(-60));
  }
  state.season = season;
}

// v3 had one global level and three plays (all unlocked). They carry over as
// unlocked and already introduced, at that level; everything else starts on
// the path from there.
function fromV3(v3) {
  if (!v3 || typeof v3 !== 'object') return null;
  const level = LEVELS.includes(v3.level) ? v3.level : 'starter';
  const had = ['equation', 'bignumbers', 'leftovers'];
  const playbook = Array.isArray(v3.playbook) ? v3.playbook.filter((id) => had.includes(id)) : had;
  const game = v3.game && typeof v3.game === 'object' ? { ...v3.game, periods: 4 } : null;
  return {
    mode: v3.mode,
    level,
    ops: v3.ops,
    lab: v3.lab,
    playbook: playbook.length ? playbook : had,
    progress: startingProgress(had, level),
    season: v3.season,
    game
  };
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
