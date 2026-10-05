// Game: four quarters of five shots. Each shot comes from one of the plays in
// the playbook (js/plays.js). A swish (right on the first try) is 3 points, a
// make after a miss is 2, and a miss is an offensive rebound: same shot, keep
// the ball.

import { state, resetGame, QUARTERS, SHOTS_PER_QUARTER } from './state.js';
import { fmt } from './math.js';
import { PLAYS, choosePlay } from './plays.js';
import { playChime, playSuccessChord, playBuzzer } from './audio.js';
import { callMake, callMiss, finalHeadline } from './lines.js';

const $ = (id) => document.getElementById(id);

export const MAX_POINTS = QUARTERS * SHOTS_PER_QUARTER * 3;

// Answers stay under 100,000, so five digits is enough
const MAX_DIGITS = 5;

// A new shot from the playbook. The game opens with an Equations shot as a
// warm-up when that play is on.
function newProblem({ warmUp = false } = {}) {
  const game = state.game;
  const kind = warmUp && state.playbook.includes('equation') ? 'equation' : choosePlay(state.playbook);
  const play = PLAYS[kind];
  game.problem = play.generate({ level: state.level, tier: 0, ops: state.ops });
  const count = play.boxes(game.problem).length;
  game.entries = Array(count).fill('');
  game.stale = Array(count).fill(false);
  game.box = 0;
  game.misses = 0;
  game.call = '';
}

export function tipOff() {
  resetGame();
  state.game.status = 'shot';
  newProblem({ warmUp: true });
  renderGame();
}

// Number pad: key is '0'–'9', 'back' or 'solve'. Digits go into the active box.
export function pressKey(key) {
  const game = state.game;
  if (game.status !== 'shot' || !game.problem) return;

  if (key === 'solve') {
    solve();
    return;
  }

  const i = game.box;
  if (key === 'back') {
    if (game.entries[i]) {
      game.entries[i] = game.entries[i].slice(0, -1);
      game.stale[i] = false;
      playChime(0);
    } else if (i > 0) {
      game.box = i - 1; // an empty box steps back to the one before it
    } else {
      return;
    }
  } else {
    if (game.stale[i] || game.entries[i] === '0') game.entries[i] = '';
    game.stale[i] = false;
    if (game.entries[i].length >= MAX_DIGITS) return;
    game.entries[i] += key;
    playChime(Number(key));
  }
  renderGame();
}

// Tapping an answer box makes it the one the number pad types into
export function selectBox(i) {
  const game = state.game;
  if (game.status !== 'shot' || !Number.isInteger(i) || i < 0 || i >= game.entries.length) return;
  game.box = i;
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
  const answers = PLAYS[game.problem.kind].answers(game.problem);
  const wrong = answers.map((answer, i) => parseInt(game.entries[i], 10) !== answer);

  if (!wrong.includes(true)) {
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
    return `<button class="${classes.join(' ')}" data-action="box" data-value="${i}" aria-label="Answer ${i + 1}">${entry ? fmt(Number(entry)) : '?'}</button>`;
  };

  const prompt = $('shot-prompt');
  prompt.innerHTML = play.prompt(q, box);
  // Long equations get a smaller font so they stay on one line
  const answers = play.answers(q);
  const extra = game.entries.reduce((sum, entry, i) =>
    sum + Math.max(0, (entry ? fmt(Number(entry)) : '?').length - fmt(answers[i]).length), 0);
  const length = play.text(q, { solved: true }).length + extra;
  prompt.classList.toggle('long', length > 17 && length <= 20);
  prompt.classList.toggle('xlong', length > 20);

  const cue = boxes[game.box]?.cue;
  $('shot-cue').hidden = !(cue && !made && game.misses === 0 && !game.entries[game.box]);
  $('shot-cue').textContent = cue || '';

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
