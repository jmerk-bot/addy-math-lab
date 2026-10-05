// App state, levels, shared helpers, and saving/restoring between launches.

export const OPS = ['+', '-', '×', '÷'];

// Subtraction is stored as '-' but shown with a proper minus sign.
export const OP_LABEL = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

// Difficulty levels for Game shots, picked in the Coach panel.
// sumMax: + and − stay within this total. factMax: × and ÷ facts go up to this.
export const LEVELS = {
  rookie: { name: 'Rookie', sumMax: 20, factMax: 5 },
  starter: { name: 'Starter', sumMax: 50, factMax: 10 },
  allstar: { name: 'All-Star', sumMax: 100, factMax: 12 }
};

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
    problem: null,
    misses: 0, // misses on the current shot
    entry: '', // digits typed on the number pad
    replaceOnType: false, // after a miss, the next digit starts a fresh answer
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
  ops: [...OPS], // operations allowed in the Game
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

export function compute(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '-': return Math.max(0, a - b);
    case '×': return a * b;
    case '÷': return b === 0 ? 0 : Math.floor(a / b);
    default: return 0;
  }
}

// ---------- Persistence ----------
// The tablet may close the app in the background, so everything (settings, the
// Practice numbers, a game in progress and the season record) is kept in
// localStorage and restored on launch.

const STORAGE_KEY = 'addy-math-lab:v2';
const OLD_KEYS = ['addy-math-lab:v1']; // earlier layouts, cleared on load

const isInt = (n) => Number.isInteger(n) && n >= 0;

export function saveState() {
  try {
    const { mode, level, ops, lab, game, season } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, level, ops, lab, game, season }));
  } catch (e) {}
}

export function loadState() {
  let saved;
  try {
    OLD_KEYS.forEach((key) => localStorage.removeItem(key));
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return;
  }
  if (!saved || typeof saved !== 'object') return;

  if (saved.mode === 'lab' || saved.mode === 'game') state.mode = saved.mode;
  if (LEVELS[saved.level]) state.level = saved.level;

  if (Array.isArray(saved.ops)) {
    const valid = OPS.filter((op) => saved.ops.includes(op));
    if (valid.length) state.ops = valid;
  }

  const lab = saved.lab;
  if (lab && OPS.includes(lab.op) && Number.isInteger(lab.a) && Number.isInteger(lab.b)) {
    state.lab = { a: lab.a, b: lab.b, op: lab.op };
  }

  const g = saved.game;
  const counters = ['quarter', 'shot', 'points', 'threes', 'makes', 'streak', 'bestStreak', 'misses', 'lastPoints'];
  if (g && GAME_STATUSES.includes(g.status) && counters.every((k) => isInt(g[k]))) {
    const midShot = g.status === 'shot' || g.status === 'made';
    if (!midShot || isValidProblem(g.problem)) {
      const game = freshGame();
      counters.forEach((k) => { game[k] = g[k]; });
      game.status = g.status;
      game.problem = midShot ? g.problem : null;
      game.entry = typeof g.entry === 'string' ? g.entry : '';
      game.replaceOnType = !!g.replaceOnType;
      game.call = typeof g.call === 'string' ? g.call : '';
      game.headline = typeof g.headline === 'string' ? g.headline : '';
      state.game = game;
    }
  }

  const s = saved.season;
  if (s && ['games', 'points', 'high', 'threes', 'bestStreak'].every((k) => isInt(s[k]))) {
    state.season = { games: s.games, points: s.points, high: s.high, threes: s.threes, bestStreak: s.bestStreak };
  }
}

function isValidProblem(p) {
  return !!p
    && OPS.includes(p.op)
    && ['a', 'b', 'target', 'expected'].every((k) => Number.isInteger(p[k]))
    && (p.missing === 'b' || p.missing === 'result');
}
