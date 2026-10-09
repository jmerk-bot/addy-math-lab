// Game: quarters of five shots (four quarters, or two halves in a quick game).
// js/coach.js picks each shot's play and moves the difficulty; js/plays.js
// draws and checks the shot. A swish (right on the first try) is 3 points, a
// make after a miss is 2, a make after "Show me how" is 1, and a miss is an
// offensive rebound: same shot, keep the ball. "I don't know this yet" swaps
// the shot for a different one, with no points and no miss.

import { state, resetGame, isPaused, SHOTS_PER_QUARTER, LENGTHS } from './state.js';
import { dayKey } from './kit.js';
import { fmt } from './math.js';
import { PLAYS, PATH, LEVEL_NAMES, conceptOf } from './plays.js';
import { chooseShot, recordShot, stepDown, afterGame, SEASON_RECENT } from './coach.js';
import { playChime, playSuccessChord, playBuzzer, canSpeak, stopSpeaking } from './audio.js';
import { callMake, callMiss, callAssist, callSkip, finalHeadline } from './lines.js';
import { shotRecord, logGame, SKIP_REASONS } from './log.js';

const $ = (id) => document.getElementById(id);

// Answers stay under 100,000, so five digits is enough
const MAX_DIGITS = 5;
const CHOICES = ['<', '=', '>'];
const FILM_MAX = 6;
const HELP_LABELS = ['Ask Coach Cheryl', 'More help', 'Show me how', 'Show me again'];

export const maxPoints = (game) => game.periods * SHOTS_PER_QUARTER * 3;
const inputOf = (p) => PLAYS[p.kind].input?.(p) || 'keypad';
const show = (x) => (typeof x === 'number' || /^\d+$/.test(x) ? fmt(Number(x)) : x);

// A shot of `kind` that isn't about a paused concept, or null if a few dozen
// tries all were
function drawShot(kind, tier) {
  const play = PLAYS[kind];
  for (let tries = 0; tries < 40; tries++) {
    const p = play.generate({ level: state.progress[kind].level, tier, ops: state.ops });
    if (!isPaused(kind, conceptOf(p).key)) return p;
  }
  return null;
}

// The coach's call, with a shot drawn for it. A play with nothing left to
// shoot but paused concepts drops out of the call and the coach calls again
// (so the usual rules still pick among what's left). Only if nothing at all
// is left does a paused concept come up.
function callShot(game) {
  const blank = new Set();
  const opts = { periods: game.periods, shotsPerPeriod: SHOTS_PER_QUARTER, exclude: blank };
  let first = null;
  for (let tries = 0; tries <= PATH.length; tries++) {
    const pick = chooseShot(state, game, opts);
    first = first || pick;
    const problem = drawShot(pick.kind, pick.tier);
    if (problem) return { ...pick, problem };
    blank.add(pick.kind);
  }
  const { level } = state.progress[first.kind];
  return { ...first, problem: PLAYS[first.kind].generate({ level, tier: first.tier, ops: state.ops }) };
}

// The next shot: a two-step play's second step, or whatever the coach calls
function newProblem() {
  const game = state.game;
  const prev = game.problem;
  const follow = prev ? PLAYS[prev.kind].followUp?.(prev) : null;
  let kind;
  game.comfort = false;
  if (follow) {
    kind = prev.kind;
    game.problem = follow;
  } else {
    const pick = callShot(game);
    kind = pick.kind;
    game.problem = pick.problem;
    game.comfort = pick.comfort;
    game.skipped = '';
    if (pick.comfort && game.calm > 0) game.calm -= 1;
  }
  // Both steps of a two-step play count toward a new play's shots
  if (state.progress[kind].fresh > 0) game.freshShots += 1;
  if (PLAYS[kind].reading) game.readingThisPeriod += 1;
  game.used[kind] = (game.used[kind] || 0) + 1;
  game.lastKinds = [...game.lastKinds, kind].slice(-3);

  const count = PLAYS[kind].boxes(game.problem).length;
  game.entries = Array(count).fill('');
  game.stale = Array(count).fill(false);
  game.box = 0;
  game.misses = 0;
  game.help = 0;
  game.assisted = false;
  game.call = '';
  stopSpeaking();
}

export function tipOff() {
  resetGame(LENGTHS[state.settings.length].periods);
  state.game.status = 'shot';
  state.game.start = Date.now();
  newProblem();
  renderGame();
}

// Number pad and choice keys: '0'–'9', '<' '=' '>', 'back' or 'solve'.
// Keys go into the active answer box.
export function pressKey(key) {
  const game = state.game;
  if (game.status !== 'shot' || !game.problem) return;

  if (key === 'solve') {
    solve();
    return;
  }

  const choice = inputOf(game.problem) === 'choice';
  const i = game.box;
  if (key === 'back') {
    if (game.entries[i]) {
      game.entries[i] = choice ? '' : game.entries[i].slice(0, -1);
      game.stale[i] = false;
      playChime(0);
    } else if (i > 0) {
      game.box = i - 1; // an empty box steps back to the one before it
    } else {
      return;
    }
  } else if (CHOICES.includes(key)) {
    if (!choice) return;
    game.entries[i] = key;
    game.stale[i] = false;
    playChime(CHOICES.indexOf(key) + 3);
  } else {
    if (choice || !/^\d$/.test(key)) return;
    if (game.stale[i] || game.entries[i] === '0') game.entries[i] = '';
    game.stale[i] = false;
    if (game.entries[i].length >= MAX_DIGITS) return;
    game.entries[i] += key;
    playChime(Number(key));
  }
  renderGame();
}

// Tapping an answer box makes it the one the keys type into
export function selectBox(i) {
  const game = state.game;
  if (game.status !== 'shot' || !Number.isInteger(i) || i < 0 || i >= game.entries.length) return;
  game.box = i;
  renderGame();
}

// The "Ask Coach Cheryl" ladder: a hint, then a bit more, then "Show me how" (a
// worked example; the shot is then worth 1). Returns true when the worked
// example should open.
export function askCoach() {
  const game = state.game;
  if (game.status !== 'shot') return false;
  if (game.help < 2) {
    game.help += 1;
    playChime(6);
    renderGame();
    return false;
  }
  game.help = 3;
  game.assisted = true;
  renderGame();
  return true;
}

// ---------- "I don't know this yet" ----------
// Three answers, from least to most change:
//   tired     this play sits out the rest of the game; levels stay put
//   hard      the play steps down a couple of tiers (when difficulty adjusts
//             on its own), and the next shots are familiar ones
//   notready  the concept (e.g. Equations' division) is paused until a
//             grown-up turns it back on in Change the Game
// Either way the shot is swapped for a different one: no points, no miss,
// and the streak carries on. The skip goes in the journey log.

// Pausing must leave something familiar to play (a settled play that isn't a
// story, with a shot that isn't paused), so games can still open and close on
// one and keep to two stories a quarter. Equations keeps at least one operation.
function canPause(p) {
  const { key } = conceptOf(p);
  if (p.kind === 'equation' && !(state.ops.length > 1 && state.ops.includes(key))) return false;
  const paused = [...state.paused, { kind: p.kind, key }];
  const ops = p.kind === 'equation' ? state.ops.filter((op) => op !== key) : state.ops;
  const playbook = key === '*' ? state.playbook.filter((id) => id !== p.kind) : state.playbook;
  return playbook.some((id) => {
    const prog = state.progress[id];
    if (!prog.unlocked || PLAYS[id].reading || prog.fresh > 0) return false;
    for (let tries = 0; tries < 40; tries++) {
      const c = conceptOf(PLAYS[id].generate({ level: prog.level, tier: prog.tier, ops })).key;
      if (!paused.some((x) => x.kind === id && (x.key === c || x.key === '*'))) return true;
    }
    return false;
  });
}

// What the "I don't know this yet" sheet offers for the shot on screen
export function skipChoices() {
  const p = state.game.problem;
  if (state.game.status !== 'shot' || !p) return null;
  return { play: PLAYS[p.kind].label, concept: conceptOf(p).label, canPause: canPause(p) };
}

function pauseConcept(kind, { key, label }) {
  if (key === '*') state.playbook = state.playbook.filter((id) => id !== kind);
  else if (kind === 'equation') state.ops = state.ops.filter((op) => op !== key);
  if (!state.paused.some((x) => x.kind === kind && x.key === key)) {
    state.paused = [...state.paused, { kind, key, label, day: dayKey() }];
  }
}

export function skipShot(reason) {
  const game = state.game;
  const p = game.problem;
  if (game.status !== 'shot' || !p || !SKIP_REASONS.includes(reason)) return;
  if (reason === 'notready' && !canPause(p)) return;
  const kind = p.kind;
  const prog = state.progress[kind];
  const concept = conceptOf(p);
  const record = [game.shotLog.length, kind, prog.level, prog.tier, reason];
  let change = 0;
  if (reason === 'tired' && !game.resting.includes(kind)) game.resting = [...game.resting, kind];
  if (reason === 'hard') {
    if (state.settings.autoLevel) change = stepDown(prog);
    game.calm = Math.max(game.calm, 2);
  }
  if (reason === 'notready') {
    pauseConcept(kind, concept);
    game.calm = Math.max(game.calm, 1);
  }
  game.skips.push([...record, change, concept.key]);
  game.skipped = kind;
  // A skipped shot wasn't played: it doesn't count toward variety, or as a
  // new play's first outing (it still counts against the quarter's stories)
  game.lastKinds = game.lastKinds.slice(0, -1);
  game.used[kind] -= 1;
  if (!game.used[kind]) delete game.used[kind];
  const last = game.call;
  game.problem = null; // so a two-step play's second step doesn't follow
  newProblem();
  game.call = callSkip(reason, concept.label, last);
  playChime(4);
  renderGame();
}

// ✓ moves on to the next empty box, and shoots once every box is filled
function solve() {
  const game = state.game;
  if (!game.entries[game.box]) return; // ignore ✓ on an empty box
  const empty = game.entries.findIndex((entry) => !entry);
  if (empty !== -1) {
    game.box = empty;
    playChime(5);
    renderGame();
    return;
  }
  submitAnswer();
}

function submitAnswer() {
  const game = state.game;
  const kind = game.problem.kind;
  const answers = PLAYS[kind].answers(game.problem);
  const wrong = answers.map((answer, i) => String(answer) !== game.entries[i]);

  if (!wrong.includes(true)) {
    const swish = game.misses === 0 && !game.assisted;
    game.lastPoints = game.assisted ? 1 : swish ? 3 : 2;
    game.points += game.lastPoints;
    game.makes += 1;
    if (game.assisted) game.assists += 1;
    if (swish) {
      game.threes += 1;
      game.streak += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
    } else {
      game.streak = 0;
    }
    game.shot += 1;
    game.status = 'made';
    game.call = game.assisted ? callAssist(game.call) : callMake({ three: swish, streak: game.streak, last: game.call });
    noteShot(kind, swish);
    playSuccessChord();
    renderGame();
  } else {
    // Each missed box keeps its guess on screen until it's typed in again
    game.misses += 1;
    game.streak = 0;
    game.stale = wrong;
    game.box = wrong.indexOf(true);
    game.call = callMiss(game.call);
    playChime(1);
    renderGame();
    const boxes = $('shot-prompt').querySelectorAll('.mystery-box');
    wrong.forEach((isWrong, i) => isWrong && boxes[i]?.classList.add('wiggle'));
  }
}

// Progress on the play, the season's recent shots, the film room, a couple
// of familiar shots after a rough patch, and the shot for the journey log
function noteShot(kind, swish) {
  const game = state.game;
  const p = state.progress[kind];
  const before = { level: p.level, tier: p.tier };
  const change = recordShot(p, swish, { auto: state.settings.autoLevel });
  game.shotLog.push(shotRecord(kind, before, p, game));
  if (change === 'levelUp') game.levelUps.push({ kind, level: state.progress[kind].level });
  if (change === 'down' || change === 'levelDown') game.calm = Math.max(game.calm, 2);
  if (game.misses >= 2 || game.assisted) game.calm = Math.max(game.calm, 1);
  state.season.recent = [...state.season.recent, swish ? 1 : 0].slice(-SEASON_RECENT);
  if (!swish && game.film.length < FILM_MAX) game.film.push(game.problem);
}

// After a make: the next shot, or the end of the quarter
export function nextShot() {
  const game = state.game;
  if (game.status !== 'made') return;

  if (game.shot >= SHOTS_PER_QUARTER) {
    game.shot = 0;
    game.quarter += 1;
    game.readingThisPeriod = 0;
    if (game.quarter > game.periods) {
      finishGame();
      return;
    }
    if (game.quarter === game.periods / 2 + 1) {
      game.status = 'halftime';
      game.problem = null;
      const used = Object.keys(game.used);
      game.tipKind = used[Math.floor(Math.random() * used.length)] || 'equation';
      renderGame();
      return;
    }
  }

  game.status = 'shot';
  newProblem();
  renderGame();
}

export function resumeHalf() {
  if (state.game.status !== 'halftime') return;
  state.game.status = 'shot';
  newProblem();
  renderGame();
}

function finishGame() {
  const { game, season } = state;
  game.status = 'final';
  game.problem = null;

  const highKey = game.periods === 2 ? 'highQuick' : 'high';
  const newHigh = game.points > season[highKey];
  season.games += 1;
  season.points += game.points;
  season[highKey] = Math.max(season[highKey], game.points);
  season.threes += game.threes;
  season.bestStreak = Math.max(season.bestStreak, game.bestStreak);
  const today = dayKey();
  season.days[today] = (season.days[today] || 0) + 1;
  season.days = Object.fromEntries(Object.entries(season.days).sort().slice(-60));

  game.unlocked = afterGame(state, game) || '';
  logGame(game, season.games);
  game.headline = finalHeadline({ points: game.points, maxPoints: maxPoints(game), newHigh });
  playBuzzer();
  renderGame();
}

// ---------- Rendering ----------

export function renderGame() {
  const { game } = state;
  const { status } = game;

  // Scoreboard
  $('scoreboard').hidden = status === 'pregame';
  $('score-points').textContent = game.points;
  $('score-quarter').textContent = status === 'final' ? 'FINAL'
    : status === 'halftime' ? 'HALF'
    : `${game.periods === 2 ? 'H' : 'Q'}${game.quarter}`;
  $('shot-dots').innerHTML = Array.from({ length: SHOTS_PER_QUARTER }, (_, i) =>
    `<span class="dot ${i < game.shot ? 'done' : ''}"></span>`).join('');
  const streak = $('score-streak');
  streak.hidden = game.streak < 3;
  streak.textContent = game.streak >= 5 ? '🔥🔥' : '🔥';

  $('game-pregame').hidden = status !== 'pregame';
  $('game-shot').hidden = !(status === 'shot' || status === 'made');
  $('game-halftime').hidden = status !== 'halftime';
  $('game-final').hidden = status !== 'final';

  if (status === 'pregame') renderPregame();
  else if (status === 'halftime') renderHalftime();
  else if (status === 'final') renderFinal();
  else renderShot();
}

// Today's plays (a new one marked), the week, the season
function renderPregame() {
  const { season } = state;
  $('pregame-sub').textContent = `${LENGTHS[state.settings.length].desc} · swish for 3`;
  const on = PATH.filter((id) => state.progress[id].unlocked && state.playbook.includes(id));
  $('pregame-plays').innerHTML = on.map((id) => {
    const isNew = !state.progress[id].introduced;
    return `<span class="play-chip ${isNew ? 'new' : ''}">${PLAYS[id].label}${isNew ? ' ⭐ New' : ''}</span>`;
  }).join('');
  const newPlay = on.find((id) => !state.progress[id].introduced);
  $('pregame-new').hidden = !newPlay;
  if (newPlay) $('pregame-new').textContent = `New play today: ${PLAYS[newPlay].label}. Coach Cheryl will show you how it works first.`;
  $('week-pregame').innerHTML = weekHtml(season);
  $('season-pregame').innerHTML = seasonHtml(season, state.settings.length === 'quick');
}

function renderHalftime() {
  const { game } = state;
  $('half-points').textContent = game.points;
  $('half-tip').textContent = (PLAYS[game.tipKind] || PLAYS.equation).tip;
}

function renderFinal() {
  const { game, season } = state;
  $('final-points').textContent = game.points;
  $('final-headline').textContent = game.headline;
  const putBacks = game.makes - game.threes - game.assists;
  const parts = [plural(game.threes, 'swish', 'swishes'), plural(putBacks, 'put-back', 'put-backs')];
  if (game.assists) parts.push(plural(game.assists, 'assist', 'assists'));
  parts.push(`best streak ${game.bestStreak}`);
  $('final-stats').textContent = parts.join(' · ');

  const ups = $('final-levelups');
  ups.hidden = !game.levelUps.length;
  ups.innerHTML = game.levelUps.map((u) => `<li>Moved up: ${PLAYS[u.kind].label} → ${LEVEL_NAMES[u.level]} ⭐</li>`).join('');

  const unlock = $('final-unlock');
  unlock.hidden = !PLAYS[game.unlocked];
  if (PLAYS[game.unlocked]) unlock.textContent = `Next game: Coach Cheryl has a new play for you, ${PLAYS[game.unlocked].label} ⭐`;

  const film = $('film-btn');
  film.hidden = !game.film.length;
  film.textContent = `Film room 🎬 (${game.film.length})`;
  $('season-final').innerHTML = seasonHtml(season, game.periods === 2);
}

function renderShot() {
  const game = state.game;
  const q = game.problem;
  const play = PLAYS[q.kind];
  const made = game.status === 'made';
  const boxes = play.boxes(q);
  const multi = boxes.length > 1;

  // Each answer box shows what's been typed, in the color of the number it
  // stands for. With two boxes, the one not being typed into is dimmed.
  const box = (i) => {
    const entry = game.entries[i];
    const classes = ['mystery-box', `role-${boxes[i].role}`];
    if (made) classes.push('correct');
    else {
      if (entry) classes.push('filled');
      if (multi && i !== game.box) classes.push('idle');
    }
    return `<button class="${classes.join(' ')}" data-action="box" data-value="${i}" aria-label="Answer ${i + 1}">${entry ? show(entry) : '?'}</button>`;
  };

  const prompt = $('shot-prompt');
  const story = play.layout === 'story';
  prompt.className = story ? 'shot-story' : 'shot-equation';
  prompt.innerHTML = play.prompt(q, box);
  if (!story) {
    // Long equations get a smaller font so they stay on one line
    const answers = play.answers(q);
    const extra = game.entries.reduce((sum, entry, i) =>
      sum + Math.max(0, (entry ? show(entry) : '?').length - show(answers[i]).length), 0);
    const length = play.text(q, { solved: true }).length + extra;
    prompt.classList.toggle('long', length > 17 && length <= 20);
    prompt.classList.toggle('xlong', length > 20);
  }

  const step = play.stepLabel?.(q);
  $('shot-step').hidden = !step;
  $('shot-step').textContent = step || '';
  $('speak-btn').hidden = made || !(play.reading && state.settings.speech && canSpeak());

  const cue = boxes[game.box]?.cue;
  $('shot-cue').hidden = !(cue && !made && game.misses === 0 && !game.entries[game.box]);
  $('shot-cue').textContent = cue || '';

  const call = $('shot-call');
  call.hidden = !game.call;
  call.className = `call ${made ? 'made' : 'miss'}`;
  call.innerHTML = made ? `<span class="pts">+${game.lastPoints}</span>${game.call}` : game.call;

  // Coach's note: the hint, then a little more
  let note = '';
  if (!made && game.assisted) note = 'Coach Cheryl showed you how. Your shot!';
  else if (!made && game.help >= 1) {
    note = `<b>Coach says:</b> ${play.hint(q)}`;
    if (game.help >= 2) note += `<br>${play.equation ? `Try it as math: ${play.equation(q)}` : play.steps(q)[0]}`;
  }
  $('shot-note').hidden = !note;
  $('shot-note').innerHTML = note;

  // After a make on a word problem, the math behind it
  const strip = $('shot-strip');
  strip.hidden = !(made && play.equation);
  if (made && play.equation) strip.textContent = play.equation(q, { solved: true });

  const choice = inputOf(q) === 'choice';
  $('shot-keypad').hidden = made || choice;
  $('shot-choices').hidden = made || !choice;
  $('shot-links').hidden = made;
  $('help-btn').textContent = HELP_LABELS[Math.min(game.help, 3)];
  $('shot-made').hidden = !made;
  $('next-btn').textContent = nextLabel(game);
  $('game-shot').classList.toggle('made', made);
}

function nextLabel(game) {
  if (game.shot < SHOTS_PER_QUARTER) return 'Next shot ➔';
  if (game.periods === 2) return game.quarter === 1 ? 'Halftime ➔' : 'Final buzzer ➔';
  return ['End of the 1st ➔', 'Halftime ➔', 'End of the 3rd ➔', 'Final buzzer ➔'][game.quarter - 1];
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function seasonHtml(s, quick) {
  return `
    <div class="stat"><span class="stat-val">${s.games}</span><span class="stat-key">Games</span></div>
    <div class="stat"><span class="stat-val">${fmt(s.points)}</span><span class="stat-key">Points</span></div>
    <div class="stat"><span class="stat-val">${quick ? s.highQuick : s.high}</span><span class="stat-key">${quick ? 'Quick-game high' : 'Season high'}</span></div>
  `;
}

// The last seven days, a dot for each, filled on days with a game. No streaks.
export function weekHtml(season) {
  let dots = '';
  let games = 0;
  for (let back = 6; back >= 0; back--) {
    const day = new Date();
    day.setDate(day.getDate() - back);
    const count = season.days[dayKey(day)] || 0;
    games += count;
    dots += `<span class="week-day ${count ? 'played' : ''} ${back === 0 ? 'today' : ''}"><span class="week-dot"></span>${'SMTWTFS'[day.getDay()]}</span>`;
  }
  return `<div class="week">${dots}</div><p class="week-note">${games === 1 ? '1 game' : `${games} games`} this week</p>`;
}
