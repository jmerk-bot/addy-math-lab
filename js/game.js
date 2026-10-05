// Game: four quarters of five shots. Each shot is a problem with one hidden
// number. A swish (right on the first try) is 3 points, a make after a miss is
// 2, and a miss is an offensive rebound: same shot, keep the ball.

import { state, resetGame, LEVELS, QUARTERS, SHOTS_PER_QUARTER, OP_LABEL } from './state.js';
import { playChime, playSuccessChord, playBuzzer } from './audio.js';
import { callMake, callMiss, finalHeadline } from './lines.js';

const $ = (id) => document.getElementById(id);

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const MAX_POINTS = QUARTERS * SHOTS_PER_QUARTER * 3;

// Every answer is 144 or less, so three digits is enough
const MAX_DIGITS = 3;

// A new shot within the current level. Rookie keeps + and − within 20 (sums
// of single digits); the bigger levels use two-digit numbers.
function newProblem() {
  const game = state.game;
  const { sumMax, factMax } = LEVELS[state.level];
  const op = pickFrom(state.ops.length ? state.ops : ['+']);
  let a, b, ans;

  if (op === '+') {
    if (sumMax <= 20) {
      a = randInt(2, 9);
      b = randInt(2, 8);
    } else {
      ans = randInt(20, sumMax);
      a = randInt(10, ans - 2);
      b = ans - a;
    }
    ans = a + b;
  } else if (op === '-') {
    if (sumMax <= 20) {
      ans = randInt(1, 8);
      b = randInt(2, 7);
      a = ans + b;
    } else {
      a = randInt(20, sumMax);
      b = randInt(2, a - 1);
      ans = a - b;
    }
  } else if (op === '×') {
    a = randInt(2, factMax);
    b = randInt(2, factMax);
    ans = a * b;
  } else {
    b = randInt(2, factMax);
    ans = randInt(1, factMax);
    a = ans * b;
  }

  const hideAns = Math.random() > 0.35;
  game.problem = {
    a,
    b,
    op,
    target: ans,
    missing: hideAns ? 'result' : 'b',
    expected: hideAns ? ans : b
  };
  game.misses = 0;
  game.entry = '';
  game.replaceOnType = false;
  game.call = '';
}

export function tipOff() {
  resetGame();
  state.game.status = 'shot';
  newProblem();
  renderGame();
}

// Number pad: key is '0'–'9', 'back' or 'solve'
export function pressKey(key) {
  const game = state.game;
  if (game.status !== 'shot' || !game.problem) return;

  if (key === 'solve') {
    submitAnswer();
    return;
  }

  if (key === 'back') {
    if (!game.entry) return;
    game.entry = game.entry.slice(0, -1);
    game.replaceOnType = false;
    playChime(0);
  } else {
    if (game.replaceOnType || game.entry === '0') game.entry = '';
    game.replaceOnType = false;
    if (game.entry.length >= MAX_DIGITS) return;
    game.entry += key;
    playChime(Number(key));
  }
  renderGame();
}

function submitAnswer() {
  const game = state.game;
  if (!game.entry) return; // ignore an empty Solve tap

  if (parseInt(game.entry, 10) === game.problem.expected) {
    const three = game.misses === 0;
    game.lastPoints = three ? 3 : 2;
    game.points += game.lastPoints;
    game.makes += 1;
    if (three) {
      game.threes += 1;
      game.streak += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
    } else {
      game.streak = 0;
    }
    game.shot += 1;
    game.status = 'made';
    game.call = callMake({ three, streak: game.streak, last: game.call });
    playSuccessChord();
    renderGame();
  } else {
    game.misses += 1;
    game.streak = 0;
    game.replaceOnType = true; // keep the guess on screen until the next digit
    game.call = callMiss(game.call);
    playChime(1);
    renderGame();
    $('shot-equation').querySelector('.mystery-box')?.classList.add('wiggle');
  }
}

// After a make: the next shot, or the end of the quarter
export function nextShot() {
  const game = state.game;
  if (game.status !== 'made') return;

  if (game.shot >= SHOTS_PER_QUARTER) {
    game.shot = 0;
    game.quarter += 1;
    if (game.quarter > QUARTERS) {
      finishGame();
      return;
    }
    if (game.quarter === QUARTERS / 2 + 1) {
      game.status = 'halftime';
      game.problem = null;
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

  const newHigh = game.points > season.high;
  season.games += 1;
  season.points += game.points;
  season.high = Math.max(season.high, game.points);
  season.threes += game.threes;
  season.bestStreak = Math.max(season.bestStreak, game.bestStreak);

  game.headline = finalHeadline({ points: game.points, maxPoints: MAX_POINTS, newHigh });
  playBuzzer();
  renderGame();
}

export function renderGame() {
  const { game, season } = state;
  const { status } = game;

  // Scoreboard
  $('scoreboard').hidden = status === 'pregame';
  $('score-points').textContent = game.points;
  $('score-quarter').textContent = status === 'final' ? 'FINAL'
    : status === 'halftime' ? 'HALF'
    : `Q${game.quarter}`;
  $('shot-dots').innerHTML = Array.from({ length: SHOTS_PER_QUARTER }, (_, i) =>
    `<span class="dot ${i < game.shot ? 'done' : ''}"></span>`).join('');
  const streak = $('score-streak');
  streak.hidden = game.streak < 3;
  streak.textContent = game.streak >= 5 ? '🔥🔥' : '🔥';

  $('game-pregame').hidden = status !== 'pregame';
  $('game-shot').hidden = !(status === 'shot' || status === 'made');
  $('game-halftime').hidden = status !== 'halftime';
  $('game-final').hidden = status !== 'final';

  if (status === 'pregame') {
    $('season-pregame').innerHTML = seasonHtml(season);
  } else if (status === 'halftime') {
    $('half-points').textContent = game.points;
  } else if (status === 'final') {
    $('final-points').textContent = game.points;
    $('final-headline').textContent = game.headline;
    const putBacks = game.makes - game.threes;
    $('final-stats').textContent =
      `${plural(game.threes, 'swish', 'swishes')} · ${plural(putBacks, 'put-back', 'put-backs')} · best streak ${game.bestStreak}`;
    $('season-final').innerHTML = seasonHtml(season);
  } else {
    renderShot();
  }
}

function renderShot() {
  const game = state.game;
  const q = game.problem;
  const made = game.status === 'made';

  // The mystery box shows what's been typed on the number pad, in the color
  // of the number it stands for (amber for B, pink for the answer)
  const role = q.missing === 'b' ? 'role-b' : 'role-target';
  const fill = made ? 'correct' : game.entry ? 'filled' : '';
  const box = `<span class="mystery-box ${role} ${fill}">${game.entry || '?'}</span>`;
  const slotB = q.missing === 'b' ? box : `<span class="num-b">${q.b}</span>`;
  const slotResult = q.missing === 'b' ? `<span class="num-target">${q.target}</span>` : box;
  $('shot-equation').innerHTML =
    `<span class="num-a">${q.a}</span><span class="op-symbol">${OP_LABEL[q.op]}</span>${slotB}<span class="equals">=</span>${slotResult}`;

  const call = $('shot-call');
  call.hidden = !game.call;
  call.className = `call ${made ? 'made' : 'miss'}`;
  call.innerHTML = made
    ? `<span class="pts">+${game.lastPoints}</span>${game.call}`
    : game.call;

  $('shot-keypad').hidden = made;
  $('to-lab-btn').hidden = made;
  $('shot-made').hidden = !made;
  $('next-btn').textContent = nextLabel(game);
}

function nextLabel(game) {
  if (game.shot < SHOTS_PER_QUARTER) return 'Next shot ➔';
  return ['End of the 1st ➔', 'Halftime ➔', 'End of the 3rd ➔', 'Final buzzer ➔'][game.quarter - 1];
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function seasonHtml(s) {
  return `
    <div class="stat"><span class="stat-val">${s.games}</span><span class="stat-key">Games</span></div>
    <div class="stat"><span class="stat-val">${s.points}</span><span class="stat-key">Points</span></div>
    <div class="stat"><span class="stat-val">${s.high}</span><span class="stat-key">Season high</span></div>
  `;
}
