// Checks the Game's plays and coach. Run before deploying (Node 22+):
//
//   node scripts/check-plays.mjs
//
// 1. Every play, at every level and tier, many times: problems are valid and
//    survive a save, have one right answer per box, read cleanly (no
//    undefined / NaN / leftover {placeholders}), stay short, stay inside each
//    level's ceilings, and fit in Practice.
// 2. Whole simulated seasons through the real game code (with a stub DOM):
//    games open and close on familiar shots, new plays arrive one at a time
//    and only mid-game, story shots stay at two per quarter, two-step plays
//    finish inside their quarter, difficulty climbs for a strong player and
//    eases off for one who's struggling, and v3 saves carry over.
// 3. The journey log: it starts with where things stood, records every shot of
//    every game (a game in progress survives a save), replays to exactly the
//    progress the coach ended with, stays small, and round-trips through a
//    backup copy (including one from an older save layout).
// 4. "I don't know this yet": every shot names its concept; skipping never
//    costs a shot or a point; "tired" rests the play for the game, "too hard"
//    steps it down, "not ready" pauses the concept (and nothing paused is
//    served again until it's turned back on); skips are logged and replay.

// ---------- A stub DOM, so the game modules run in Node ----------

const stubElement = () => new Proxy({
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  style: {},
  dataset: {},
  querySelectorAll: () => [],
  querySelector: () => null
}, {
  get: (target, key) => (key in target ? target[key] : ''),
  set: (target, key, value) => { target[key] = value; return true; }
});
const store = new Map();
globalThis.document = {
  getElementById: () => stubElement(),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {},
  visibilityState: 'visible'
};
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};

const { PLAYS, PLAY_IDS, LEVELS, isValidProblem, conceptOf } = await import('../js/plays.js');
const { OPS, compute, fmt } = await import('../js/math.js');
const { limits } = await import('../js/lab-limits.js');
const { regroups } = await import('../js/play-numbers.js');
const { wordCount } = await import('../js/play-stories.js');
const S = await import('../js/state.js');
const G = await import('../js/game.js');
const L = await import('../js/log.js');
const { startLevel } = await import('../js/coach.js');
const P = await import('../js/panel.js');

const RUNS = 1500;
const TIERS = [0, 1, 2];

let failures = 0;
function fail(where, message, detail = {}) {
  failures += 1;
  if (failures <= 30) console.error(`FAIL ${where}: ${message}\n  ${JSON.stringify(detail)}`);
}

const isInt = (n) => Number.isInteger(n) && n >= 0;
const dirty = (s) => typeof s !== 'string' || /undefined|NaN|\{[a-zA-Z0-9]+\}/.test(s);

// Tier-0 ceilings, written from the level descriptions rather than copied from
// the generator tables, so a slip in one shows up here.
const CEILINGS = {
  equation: {
    rookie: { sum: 20, fact: 5 }, starter: { sum: 50, fact: 10 },
    allstar: { sum: 100, fact: 12 }, mvp: { sum: 100, fact: 12 }
  },
  bignumbers: {
    rookie: { sum: 99, mulA: 50, mulB: 5 }, starter: { sum: 100, mulA: 25, mulB: 5 },
    allstar: { sum: 999, mulA: 99, mulB: 9 }, mvp: { sum: 1000, mulA: 999, mulB: 9 }
  },
  leftovers: {
    rookie: { a: 29, b: 5, q: 5 }, starter: { a: 89, b: 9, q: 9 },
    allstar: { a: 99, b: 9 }, mvp: { a: 999, b: 9 }
  },
  placevalue: { rookie: 99, starter: 999, allstar: 9999, mvp: 99999 },
  roundcompare: { rookie: 99, starter: 999, allstar: 9999, mvp: 99999 }
};

function checkCeilings(id, level, p, where) {
  const c = CEILINGS[id]?.[level];
  if (!c) return;
  const over = (value, max, what) => value > max && fail(where, `${what} ${value} is over ${max}`, p);
  if (id === 'equation' || id === 'bignumbers') {
    if (p.op === '+') over(p.result, c.sum, 'sum');
    if (p.op === '-') over(p.a, c.sum, 'first number');
    if (id === 'equation' && p.op === '×') { over(p.a, c.fact, 'factor'); over(p.b, c.fact, 'factor'); }
    if (id === 'equation' && p.op === '÷') { over(p.b, c.fact, 'divisor'); over(p.result, c.fact, 'quotient'); }
    if (id === 'bignumbers' && p.op === '×') { over(p.a, c.mulA, 'first factor'); over(p.b, c.mulB, 'second factor'); }
  } else if (id === 'leftovers') {
    over(p.a, c.a, 'dividend');
    over(p.b, c.b, 'divisor');
    if (c.q) over(p.result, c.q, 'quotient');
  } else if (id === 'placevalue') {
    over(p.n, c, 'number');
  } else if (id === 'roundcompare') {
    for (const n of [p.n, p.x, p.y].filter((v) => v !== undefined)) over(n, c, 'number');
  }
}

// Solves an equation-shaped shot for its hidden slot from the other two numbers
function solveFor(p) {
  const { a, b, op, result } = p;
  if (p.missing === 'result') return compute(a, b, op);
  if (p.missing === 'a') return { '+': result - b, '-': result + b, '×': result / b, '÷': result * b }[op];
  return { '+': result - a, '-': a - result, '×': result / a, '÷': a / result }[op];
}

function fitsPractice({ op, a, b }) {
  const lim = limits(op, a);
  return OPS.includes(op) && a >= lim.aMin && a <= lim.aMax && b >= lim.bMin && b <= lim.bMax;
}

// ---------- 1. Every play ----------

for (const id of PLAY_IDS) {
  const play = PLAYS[id];
  for (const key of ['label', 'blurb', 'tip']) if (dirty(play[key])) fail(id, `${key} is missing`);
  for (const level of LEVELS) {
    for (const tier of TIERS) {
      const where = `${id}/${level}/tier ${tier}`;
      const seen = { regroup: 0, addSub: 0, even: 0, missing: {}, variants: {} };

      for (let i = 0; i < RUNS; i++) {
        let p = play.generate({ level, tier, ops: OPS });
        // Two-step plays: check both steps
        const steps = [p];
        if (play.followUp) {
          const second = play.followUp(p);
          if (!second || second.step !== 2) fail(where, 'no step 2 after step 1', p);
          else {
            steps.push(second);
            if (play.followUp(second) !== null) fail(where, 'step 2 has a follow-up', second);
          }
        }
        for (p of steps) {
          if (p.kind !== id) fail(where, `kind is ${p.kind}`, p);
          if (!play.isValid(p)) fail(where, 'isValid() rejects it', p);
          if (!isValidProblem(JSON.parse(JSON.stringify(p)))) fail(where, 'does not survive a save', p);

          // Answers: one per box; whole numbers up to five digits, or < = > for choice shots
          const choice = play.input?.(p) === 'choice';
          const answers = play.answers(p);
          const boxes = play.boxes(p);
          if (answers.length !== boxes.length) fail(where, 'answers and boxes differ in count', p);
          for (const answer of answers) {
            const ok = choice ? ['<', '=', '>'].includes(answer) : isInt(answer) && answer <= 99999;
            if (!ok) fail(where, `bad answer ${answer}`, p);
          }

          // Equation-shaped shots: the hidden number is the only one that works
          if (p.missing && 'result' in p) {
            const solved = solveFor(p);
            if (solved !== p[p.missing]) fail(where, `solving gives ${solved}`, p);
            seen.missing[p.missing] = (seen.missing[p.missing] || 0) + 1;
          }

          // Every shot names what it practices, for "I'm not ready for … yet"
          const concept = conceptOf(p);
          if (typeof concept?.key !== 'string' || !concept.key || dirty(concept.label) || !concept.label) fail(where, `concept ${JSON.stringify(concept)}`, p);
          if (id === 'equation' && concept.key !== p.op) fail(where, `concept key ${concept.key} is not the operation`, p);

          // Text and prompt read cleanly
          const text = play.text(p);
          const solvedText = play.text(p, { solved: true });
          if (dirty(text) || dirty(solvedText)) fail(where, `text "${text}" / "${solvedText}"`, p);
          if (play.layout === 'equation') {
            const marks = text.split(/\s+/).join(' ').match(/(^|[\s/])\?($|[\s/])/g) || [];
            if (marks.length < 1) fail(where, `text "${text}" shows no ?`, p);
            if (/(^|\s)\?(\s|$)|\?\//.test(solvedText)) fail(where, `solved text "${solvedText}" still has a ?`, p);
          }
          const prompt = play.prompt(p, (n) => `[[box ${n}]]`);
          boxes.forEach((_, n) => {
            if (prompt.split(`[[box ${n}]]`).length !== 2) fail(where, `prompt draws box ${n} wrong`, p);
          });
          if (dirty(prompt)) fail(where, 'prompt has undefined/NaN/{placeholder}', p);

          // Word problems stay short
          if (play.reading) {
            const words = wordCount(text);
            if (words > (play.followUp ? 32 : 25)) fail(where, `${words} words: "${text}"`, p);
          }

          // Help: a hint, worked steps, the math behind it, a picture
          if (dirty(play.hint(p)) || !play.hint(p)) fail(where, 'hint', p);
          const worked = play.steps(p);
          if (!Array.isArray(worked) || !worked.length || worked.some(dirty)) fail(where, `steps ${JSON.stringify(worked)}`, p);
          if (play.equation) {
            const open = play.equation(p);
            const done = play.equation(p, { solved: true });
            if (dirty(open) || dirty(done) || !open.includes('?') || done.includes('?')) fail(where, `equation "${open}" / "${done}"`, p);
            if (answers.length === 1 && !choice && !done.includes(fmt(answers[0]))) fail(where, `solved equation "${done}" lacks the answer ${answers[0]}`, p);
          }
          if (play.board) {
            for (const solved of [false, true]) {
              const html = play.board(p, { solved });
              if (dirty(html) || !html) fail(where, `board (solved ${solved})`, p);
            }
          }

          // Practice can show it
          const lab = play.toLab?.(p);
          if (lab && !fitsPractice(lab)) fail(where, `toLab ${JSON.stringify(lab)} does not fit Practice`, p);
          if (play.layout === 'equation' && play.toLab && !fitsPractice(p)) fail(where, 'the shot does not fit Practice', p);

          if (tier === 0) checkCeilings(id, level, p, where);
          if (id === 'bignumbers' && (p.op === '+' || p.op === '-')) {
            seen.addSub += 1;
            if (regroups(p.a, p.b, p.op)) seen.regroup += 1;
          }
          if (id === 'leftovers' && p.remainder === 0) seen.even += 1;
          if (id === 'leftoverstories' && p.r < 1) fail(where, 'a leftover story with no leftover', p);
          const variant = p.variant || p.mode || p.t || p.type || p.op;
          seen.variants[variant] = (seen.variants[variant] || 0) + 1;
        }
      }

      // Mix checks
      if (id === 'bignumbers' && level !== 'rookie' && tier === 0) {
        const share = seen.regroup / seen.addSub;
        if (share < 0.45 || share > 0.75) fail(where, `regrouping in ${(share * 100).toFixed(0)}% of + and − shots`);
      }
      if (id === 'leftovers') {
        const share = seen.even / RUNS;
        if (share < 0.1 || share > 0.3) fail(where, `remainder 0 in ${(share * 100).toFixed(0)}% of shots`);
      }
      if (id === 'equation' && tier === 0) {
        for (const slot of ['a', 'b', 'result']) if (!seen.missing[slot]) fail(where, `the ${slot} slot is never hidden`);
      }
      if (id === 'leftoverstories' && ['up', 'drop', 'left'].some((m) => !seen.variants[m])) fail(where, `modes seen: ${Object.keys(seen.variants)}`);
    }
  }
}
const generated = PLAY_IDS.length * LEVELS.length * TIERS.length * RUNS;
console.log(`Plays: ${generated} shots across ${PLAY_IDS.length} plays × ${LEVELS.length} levels × ${TIERS.length} tiers.`);

// ---------- 2. Migration: a v3 save carries over ----------

store.clear();
const V3_SAVE = JSON.stringify({
  mode: 'game', level: 'allstar', playbook: ['equation', 'leftovers'], ops: ['+', '×'],
  lab: { a: 47, b: 38, op: '+' },
  game: { status: 'shot', quarter: 2, shot: 3, points: 21, threes: 6, makes: 8, streak: 2, bestStreak: 4,
    problem: { kind: 'bignumbers', a: 347, b: 285, op: '+', result: 632, missing: 'result' },
    misses: 1, entries: ['63'], box: 0, stale: [false], lastPoints: 3, call: '', headline: '' },
  season: { games: 5, points: 212, high: 51, threes: 61, bestStreak: 9 }
});
store.set('addy-math-lab:v3', V3_SAVE);
S.loadState();
S.saveState();
L.loadLog();
L.logStart(S.state);
{
  const st = S.state;
  const where = 'migration v3 → v4';
  if (st.season.games !== 5 || st.season.high !== 51 || st.season.points !== 212) fail(where, 'season record', st.season);
  if (st.level !== 'allstar') fail(where, `level ${st.level}`);
  const unlocked = PLAY_IDS.filter((id) => st.progress[id].unlocked);
  if (unlocked.join() !== 'equation,bignumbers,leftovers') fail(where, `unlocked ${unlocked}`);
  if (!unlocked.every((id) => st.progress[id].introduced && st.progress[id].level === 'allstar')) fail(where, 'unlocked plays not introduced at All-Star');
  if (st.playbook.join() !== 'equation,leftovers') fail(where, `playbook ${st.playbook}`);
  if (st.game.status !== 'shot' || st.game.problem?.result !== 632 || st.game.entries[0] !== '63' || st.game.periods !== 4) fail(where, 'game in progress', st.game);
  if (store.has('addy-math-lab:v3') || !store.has('addy-math-lab:v4')) fail(where, 'old key not swapped for v4', [...store.keys()]);
  const start = L.logEvents()[0];
  if (L.logEvents().length !== 1 || start.e !== 'start' || Object.keys(start.plays).join() !== 'equation,bignumbers,leftovers'
    || start.plays.leftovers.join() !== 'allstar,0' || start.base !== 'allstar' || start.season.games !== 5) fail('log start', 'starting point', start);
  L.logStart(S.state);
  if (L.logEvents().length !== 1) fail('log start', 'logged twice');
}
console.log('Migration: v3 save checked.');

// ---------- 3. Simulated seasons through the real game code ----------

const SPQ = S.SHOTS_PER_QUARTER;

// Plays one game. skill: chance of a swish on each shot. skip(game) can return
// a reason to tap "I don't know this yet" ('tired' | 'hard' | 'notready').
// Returns what happened.
function playGame(skill, { skip = () => null } = {}) {
  const st = S.state;
  // What the intro sheet does at tip-off
  for (const id of PLAY_IDS) {
    const p = st.progress[id];
    if (p.unlocked && !p.introduced && st.playbook.includes(id)) p.introduced = true;
  }
  const freshBefore = PLAY_IDS.filter((id) => st.progress[id].fresh > 0);
  G.tipOff();
  const shots = [];
  const skips = [];
  let afterSkip = false;
  let justSkipped = ''; // the play just skipped sits out the next pick, even ahead of resting plays
  for (let guard = 0; guard < 800 && st.game.status !== 'final'; guard++) {
    const game = st.game;
    if (game.status === 'halftime') { G.resumeHalf(); continue; }
    if (game.status === 'made') { G.nextShot(); continue; }
    const p = game.problem;
    const play = PLAYS[p.kind];
    // Plays the coach could really call: switched on, not resting, nothing paused
    const options = st.playbook.filter((id) => st.progress[id].unlocked && !game.resting.includes(id)
      && !st.paused.some((x) => x.kind === id)).length;
    // Nothing paused is served, and a resting play sits out while another
    // settled, non-story play with nothing paused can take the shot (one with
    // paused concepts may have nothing left to shoot)
    if (S.isPaused(p.kind, conceptOf(p).key)) fail('skips', `served a paused concept: ${p.kind} ${conceptOf(p).key}`, p);
    const others = st.playbook.filter((id) => st.progress[id].unlocked && !game.resting.includes(id)
      && !PLAYS[id].reading && !(st.progress[id].fresh > 0) && id !== justSkipped
      && !st.paused.some((x) => x.kind === id));
    if (game.resting.includes(p.kind) && !p.step && others.length) fail('skips', `${p.kind} played while resting`, game.resting);
    const reason = skip(game);
    if (reason) {
      const before = { shot: game.shot, quarter: game.quarter, points: game.points, kind: p.kind, prog: { ...st.progress[p.kind] } };
      const canPause = G.skipChoices().canPause;
      G.skipShot(reason);
      const swapped = game.problem !== p;
      skips.push({ reason, swapped, ...before });
      if (game.shot !== before.shot || game.quarter !== before.quarter || game.points !== before.points) fail('skips', 'a skip cost a shot or points');
      // Only "not ready" with nothing left to pause to leaves the shot up (the sheet doesn't offer it then)
      if (swapped === (reason === 'notready' && !canPause)) fail('skips', `${reason} ${swapped ? 'swapped' : 'kept'} the shot`);
      if (swapped) {
        afterSkip = true;
        justSkipped = p.kind;
      }
      continue;
    }
    shots.push({ kind: p.kind, quarter: game.quarter, shot: game.shot, step: p.step, comfort: game.comfort, options, afterSkip });
    afterSkip = false;
    justSkipped = '';
    const answers = play.answers(p);
    const type = (values) => {
      values.forEach((v) => {
        for (const ch of String(v)) G.pressKey(ch);
        G.pressKey('solve');
      });
    };
    if (Math.random() > skill) {
      // A miss first; now and then all the way up the help ladder
      type(answers.map((v) => (typeof v === 'number' ? v + 1 : v === '<' ? '>' : '<')));
      if (Math.random() < 0.15) for (let k = 0; k < 3; k++) G.askCoach();
    }
    type(answers);
  }
  return { shots, skips, freshBefore, game: st.game };
}

function checkGame({ shots, freshBefore, game }, where) {
  const periods = game.periods;
  const total = periods * SPQ;
  if (shots.length !== total) fail(where, `${shots.length} shots, expected ${total}`);
  const index = (s) => (s.quarter - 1) * SPQ + s.shot;
  shots.forEach((s, i) => {
    const play = PLAYS[s.kind];
    if (i === 0 || i === total - 1) {
      if (play.reading || freshBefore.includes(s.kind)) fail(where, `shot ${i + 1} should be familiar, got ${s.kind}`);
    }
    if (freshBefore.includes(s.kind) && (index(s) < 2 || index(s) > total - 3)) fail(where, `new play ${s.kind} at shot ${i + 1}`);
    if (s.step === 1) {
      const next = shots[i + 1];
      // (unless its second step was swapped out with "I don't know this yet")
      if (!next || (!next.afterSkip && (next.kind !== s.kind || next.step !== 2 || next.quarter !== s.quarter))) fail(where, 'two-step play split up', [s, next]);
    }
    // Variety: a called (not familiar) shot never makes three of a play in a row
    // when there's another play to choose (a two-step's second step is part of its first)
    if (i >= 2 && !s.comfort && !s.step && s.options >= 3 && shots[i - 1].kind === s.kind && shots[i - 2].kind === s.kind) {
      fail(where, `${s.kind} three times running`, shots.slice(i - 2, i + 1));
    }
  });
  for (let q = 1; q <= periods; q++) {
    const reading = shots.filter((s) => s.quarter === q && PLAYS[s.kind].reading).length;
    if (reading > 2) fail(where, `${reading} story shots in period ${q}`);
  }
  for (const id of freshBefore) {
    const count = shots.filter((s) => s.kind === id).length;
    if (count > 2) fail(where, `new play ${id} had ${count} shots in its first game`);
  }
}

function newSeason(level = 'starter', unlocked = ['equation']) {
  store.clear();
  const st = S.state;
  st.level = level;
  for (const id of PLAY_IDS) {
    const open = unlocked.includes(id);
    st.progress[id] = { unlocked: open, introduced: open, fresh: 0, unlockedAt: 0,
      level, tier: 0, streak: 0, slump: 0, shots: 0, swishes: 0, recent: [] };
  }
  st.playbook = [...unlocked];
  st.ops = [...OPS];
  st.paused = [];
  st.settings = { ...S.DEFAULT_SETTINGS };
  S.resetSeason();
  S.resetGame();
  L.loadLog();
  L.logStart(st);
}

// Replays the log from its starting point, checking that each shot was taken
// at the level and tier the log says the play was at. Returns where each play
// ends up, which should be exactly where the coach left it.
function replayLog(where) {
  const prog = {};
  let base = 'starter';
  for (const e of L.logEvents()) {
    if (e.e === 'start') {
      base = e.base;
      for (const [id, [level, tier]] of Object.entries(e.plays)) prog[id] = { level, tier };
    } else if (e.e === 'base') {
      base = e.level;
      for (const id of Object.keys(prog)) prog[id] = { level: e.level, tier: 0 };
    } else if (e.e === 'set') {
      prog[e.kind] = { level: e.level, tier: 0 };
    } else if (e.e === 'unlock') {
      prog[e.kind] = { level: startLevel(base), tier: 0 };
    } else if (e.e === 'game') {
      // Skips replay in order, before the shot that went in after them
      const skips = e.skips || [];
      const move = ([kind, level, tier, change], what) => {
        const now = prog[kind];
        if (!now || now.level !== level || now.tier !== tier) fail(where, `game ${e.n}: ${what} on ${kind} logged at ${level}/${tier}, replay has it at ${JSON.stringify(now)}`);
        const step = L.stepOf(level, tier) + change;
        prog[kind] = { level: LEVELS[Math.floor(step / 3)], tier: step % 3 };
      };
      e.shots.forEach(([kind, level, tier, , , , change], i) => {
        for (const [at, sk, sl, st, , sc] of skips) if (at === i) move([sk, sl, st, sc], 'a skip');
        move([kind, level, tier, change], 'a shot');
      });
      if (e.unlocked) prog[e.unlocked] = { level: startLevel(base), tier: 0 };
    }
  }
  return prog;
}

// Every finished game is in the log, whole, and the log replays to the
// progress the coach ended with
function checkLog(where, { games, shotsPerGame }) {
  const events = L.logEvents();
  const logged = events.filter((e) => e.e === 'game');
  if (logged.length !== games) fail(where, `${logged.length} games logged, expected ${games}`);
  logged.forEach((e, i) => {
    if (e.shots.length !== shotsPerGame) fail(where, `game ${i + 1} logged ${e.shots.length} shots`);
    if (!e.shots.every(L.isShotRecord)) fail(where, `game ${i + 1} has a bad shot record`, e.shots);
    const points = e.shots.reduce((sum, r) => sum + r[3], 0);
    if (points !== e.pts) fail(where, `game ${i + 1}: shots add up to ${points}, logged ${e.pts}`);
    if (i > 0 && (e.n !== logged[i - 1].n + 1 || e.start <= logged[i - 1].start)) fail(where, `game ${i + 1} out of order`);
  });
  const prog = replayLog(where);
  for (const id of PLAY_IDS.filter((x) => S.state.progress[x].unlocked)) {
    const p = S.state.progress[id];
    if (prog[id]?.level !== p.level || prog[id]?.tier !== p.tier) fail(where, `${id}: replay ends at ${JSON.stringify(prog[id])}, coach at ${p.level}/${p.tier}`);
  }
  const perGame = JSON.stringify({ v: L.LOG_VERSION, events }).length / Math.max(1, games);
  if (perGame > 1500) fail(where, `${Math.round(perGame)} bytes per game`);
  if (JSON.parse(store.get(L.LOG_KEY)).events.length !== events.length) fail(where, 'the saved log is behind');
  return perGame;
}

// A strong player: new plays keep coming, one at a time, and levels climb
newSeason('starter');
const unlockGames = [];
for (let g = 1; g <= 90; g++) {
  const before = PLAY_IDS.filter((id) => S.state.progress[id].unlocked).length;
  const result = playGame(0.93);
  checkGame(result, `strong season, game ${g}`);
  const after = PLAY_IDS.filter((id) => S.state.progress[id].unlocked).length;
  if (after - before > 1) fail('strong season', `${after - before} plays unlocked in game ${g}`);
  if (after > before) unlockGames.push(g);
}
{
  const st = S.state;
  const unlocked = PLAY_IDS.filter((id) => st.progress[id].unlocked);
  if (unlocked.length < PLAY_IDS.length) fail('strong season', `only ${unlocked.length} plays unlocked after 90 games`, unlockGames);
  const gaps = unlockGames.slice(1).map((g, i) => g - unlockGames[i]);
  if (gaps.some((gap) => gap < 2)) fail('strong season', 'new plays less than two games apart', unlockGames);
  if (st.progress.equation.level === 'starter' && st.progress.equation.tier === 0) fail('strong season', 'Equations never moved up');
  const unlockedLogged = L.logEvents().filter((e) => e.e === 'game' && e.unlocked).length;
  if (unlockedLogged !== unlockGames.length) fail('strong season log', `${unlockedLogged} unlocks logged, ${unlockGames.length} happened`);
  const perGame = checkLog('strong season log', { games: 90, shotsPerGame: 4 * SPQ });
  console.log(`Strong season: all ${unlocked.length} plays unlocked by game ${unlockGames[unlockGames.length - 1]}; Equations at ${st.progress.equation.level}. Log: about ${Math.round(perGame)} bytes a game.`);
}

// A struggling player: no new plays, and difficulty eases off to Rookie
newSeason('allstar', ['equation', 'bignumbers']);
for (let g = 1; g <= 20; g++) checkGame(playGame(0.4), `struggling season, game ${g}`);
{
  const st = S.state;
  const unlocked = PLAY_IDS.filter((id) => st.progress[id].unlocked);
  if (unlocked.length !== 2) fail('struggling season', `unlocked ${unlocked}`);
  if (st.progress.equation.level === 'allstar') fail('struggling season', 'Equations never eased off', st.progress.equation);
  checkLog('struggling season log', { games: 20, shotsPerGame: 4 * SPQ });
  const downs = L.logEvents().flatMap((e) => e.shots || []).filter((r) => r[6] === -1).length;
  if (!downs) fail('struggling season log', 'no step-downs logged');
  console.log(`Struggling season: still ${unlocked.length} plays; Equations eased to ${st.progress.equation.level}.`);
}

// A quick game is two halves of five
newSeason('starter');
S.state.settings.length = 'quick';
checkGame(playGame(0.8), 'quick game');
checkLog('quick game log', { games: 1, shotsPerGame: 2 * SPQ });
if (L.logEvents().at(-1).len !== 'quick') fail('quick game log', 'not logged as quick');

// ---------- 5. "I don't know this yet" ----------

// Puts a particular shot on screen
function setShot(problem) {
  const g = S.state.game;
  const n = PLAYS[problem.kind].boxes(problem).length;
  Object.assign(g, { status: 'shot', problem, entries: Array(n).fill(''), stale: Array(n).fill(false), box: 0, misses: 0, help: 0, assisted: false });
}
const sameShot = (a, b) => JSON.stringify(a) === JSON.stringify(b);

{
  const where = "I don't know this yet";
  newSeason('allstar', ['equation', 'leftovers', 'fractions']);
  const st = S.state;
  G.tipOff();

  // tired: no level change; the play rests for the rest of the game
  const fr = PLAYS.fractions.generate({ level: 'allstar', tier: 0 });
  setShot(fr);
  st.progress.fractions.tier = 1;
  G.skipShot('tired');
  if (st.progress.fractions.level !== 'allstar' || st.progress.fractions.tier !== 1) fail(where, 'tired changed the level');
  if (!st.game.resting.includes('fractions') || st.game.problem.kind === 'fractions' || sameShot(st.game.problem, fr)) fail(where, 'tired did not swap the shot and rest the play');
  if (!st.game.call) fail(where, 'no call after a skip');

  // too hard: two steps down (All-Star tier 1 → Starter tier 2), familiar shots next, a different play
  const eq = { kind: 'equation', a: 84, b: 7, op: '÷', result: 12, missing: 'result' };
  setShot(eq);
  st.progress.equation.tier = 1;
  G.skipShot('hard');
  if (st.progress.equation.level !== 'starter' || st.progress.equation.tier !== 2) fail(where, 'too hard did not step down two tiers', st.progress.equation);
  if (st.game.problem.kind === 'equation' || !st.game.comfort) fail(where, 'too hard: the next shot should be a familiar one from another play', st.game.problem);

  // not ready: the operation comes out of Equations and is paused
  setShot(eq);
  const choices = G.skipChoices();
  if (choices.concept !== 'division' || !choices.canPause) fail(where, 'choices for a division shot', choices);
  G.skipShot('notready');
  if (st.ops.includes('÷') || !S.isPaused('equation', '÷') || st.paused[0]?.label !== 'division') fail(where, 'division not paused', { ops: st.ops, paused: st.paused });

  // The whole play: pausing Leftovers switches it off
  const lo = PLAYS.leftovers.generate({ level: 'allstar', tier: 0 });
  setShot(lo);
  G.skipShot('notready');
  if (st.playbook.includes('leftovers') || !S.isPaused('leftovers', '*')) fail(where, 'Leftovers not paused', st.playbook);

  // Nothing left to pause to: the last operation can't be paused
  st.ops = ['+'];
  setShot({ kind: 'equation', a: 4, b: 5, op: '+', result: 9, missing: 'result' });
  if (G.skipChoices().canPause) fail(where, 'offered to pause the last operation');
  const before = st.game.problem;
  G.skipShot('notready');
  if (st.game.problem !== before) fail(where, 'paused the last operation anyway');
  st.ops = ['+', '-', '×'];

  // Saved and restored with everything else
  S.saveState();
  S.loadState();
  if (st.paused.length !== 2 || st.game.skips.length !== 4 || !st.game.resting.includes('fractions')) fail(where, 'skips and pauses lost in a reload', { paused: st.paused, skips: st.game.skips });

  // Turning one back on in Change the Game
  const i = st.paused.findIndex((x) => x.key === '÷');
  P.coachActions['resume-concept'](String(i));
  if (!st.ops.includes('÷') || S.isPaused('equation', '÷')) fail(where, 'division not turned back on', { ops: st.ops, paused: st.paused });
  if (L.logEvents().at(-1).e !== 'resume') fail(where, 'turning back on not logged');
  S.resetGame();
}

// A season with skips now and then: shots and points never lost, nothing
// paused comes back, and the log (skips included) still replays exactly
{
  const where = 'season with skips';
  newSeason('starter', ['equation', 'bignumbers', 'leftovers', 'fractions', 'stories', 'placevalue', 'measure']);
  const reasons = ['tired', 'hard', 'notready'];
  let skipped = 0;
  for (let g = 1; g <= 30; g++) {
    const result = playGame(0.75, { skip: () => (Math.random() < 0.08 ? reasons[Math.floor(Math.random() * 3)] : null) });
    checkGame(result, `${where}, game ${g}`);
    const swapped = result.skips.filter((s) => s.swapped);
    skipped += swapped.length;
    // Every skip that swapped the shot is in the log
    const logged = L.logEvents().at(-1).skips || [];
    if (logged.length !== swapped.length) fail(where, `game ${g}: ${logged.length} skips logged for ${swapped.length}`);
  }
  checkLog(`${where} log`, { games: 30, shotsPerGame: 4 * SPQ });
  console.log(`Skips: ${skipped} taps over 30 games; ${S.state.paused.length} concepts paused; log replays.`);
}

// ---------- 4. The journey log: a game in progress, manual changes, backups ----------

// A game in progress keeps its shots through a save and reload
newSeason('starter');
G.tipOff();
for (let k = 0; k < 3; k++) {
  const p = S.state.game.problem;
  PLAYS[p.kind].answers(p).forEach((v) => {
    for (const ch of String(v)) G.pressKey(ch);
    G.pressKey('solve');
  });
  G.nextShot();
}
S.saveState();
S.resetGame();
S.loadState();
if (S.state.game.shotLog.length !== 3 || S.state.game.status !== 'shot' || !S.state.game.start) fail('game in progress', 'shots not kept through a reload', S.state.game.shotLog);
S.resetGame();

// Changes by hand are logged, and the log still replays to the real progress
newSeason('starter');
playGame(0.9);
S.state.level = 'allstar';
for (const id of PLAY_IDS) if (S.state.progress[id].unlocked) Object.assign(S.state.progress[id], { level: 'allstar', tier: 0 });
L.logEvent('base', { level: 'allstar' });
playGame(0.9);
checkLog('log with changes by hand', { games: 2, shotsPerGame: 4 * SPQ });

// A backup copy reads back, junk doesn't, and restoring brings everything back
{
  const where = 'backup';
  const copy = S.readBackup(JSON.stringify(S.backupCopy()));
  if (!copy) fail(where, 'a fresh copy does not read back');
  const good = S.backupCopy();
  for (const junk of ['', 'not json', '{}', JSON.stringify({ ...good, app: 'felix-math-lab' }), JSON.stringify({ ...good, stateKey: 'somewhere-else:v1' }), JSON.stringify({ ...good, log: null })]) {
    if (S.readBackup(junk)) fail(where, `accepted ${junk.slice(0, 50)}`);
  }
  const games = S.state.season.games;
  const events = L.logEvents().length;
  S.resetSeason();
  store.delete(L.LOG_KEY);
  if (!S.restoreBackup(copy)) fail(where, 'restore failed');
  S.loadState();
  L.loadLog();
  if (S.state.season.games !== games || L.logEvents().length !== events) fail(where, `restored ${S.state.season.games} games and ${L.logEvents().length} events, expected ${games} and ${events}`);
  S.saveState(); // saves wait for the reload after a restore
  if (JSON.parse(store.get('addy-math-lab:v4')).season.games !== games) fail(where, 'a save overwrote the restored copy');

  // A copy from an older layout goes through its migration
  if (!S.restoreBackup({ ...copy, stateKey: 'addy-math-lab:v3', state: JSON.parse(V3_SAVE) })) fail(where, 'restore of an old copy failed');
  if (store.has('addy-math-lab:v4')) fail(where, 'the newer save was left in the way');
  S.loadState();
  if (S.state.level !== 'allstar' || S.state.season.games !== 5) fail(where, 'an old copy did not migrate', { level: S.state.level, games: S.state.season.games });
}
console.log('Journey log: replays exactly, keeps a game in progress, logs changes by hand, and round-trips through a backup.');

// The Change the Game panel's actions share one namespace with the game's
// (js/main.js spreads them in), so a repeated name would quietly lose one
{
  const { readFileSync } = await import('node:fs');
  const source = (file) => readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
  const names = (src, start) => [...src.slice(src.indexOf(start)).split('\n};')[0].matchAll(/^ {2}'([a-z-]+)':/gm)].map((m) => m[1]);
  const game = names(source('main.js'), 'const actions = {');
  const panel = names(source('panel.js'), 'const ACTIONS = {');
  if (game.length < 10 || panel.length < 10) fail('actions', `found ${game.length} game and ${panel.length} panel actions`);
  const both = game.filter((name) => panel.includes(name));
  if (both.length) fail('actions', `used by both the game and the panel: ${both}`);
}

if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
console.log('OK');
