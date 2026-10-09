// Sheets that slide over the game: Coach's board ("Go Practice This Play"), "Show me
// how" (a worked example, one step at a time), a new play's intro, "I don't
// know this yet" (what to do instead), and the film room after the final
// buzzer. Nothing here changes the score.

import { state } from './state.js';
import { fmt } from './math.js';
import { PLAYS } from './plays.js';

const $ = (id) => document.getElementById(id);

// { kind: 'board' | 'showme' | 'intro' | 'skip' | 'film', problem, steps, shown, ... }
let sheet = null;

export const sheetIsOpen = () => sheet !== null;

const show = (x) => (typeof x === 'number' ? fmt(x) : x);

// A shot as a picture: its prompt with the answer boxes as plain boxes (not
// tappable), showing "?" or, once solved, the answers in green
function promptHtml(p, { solved = false } = {}) {
  const play = PLAYS[p.kind];
  const boxes = play.boxes(p);
  const answers = play.answers(p);
  const box = (i) => `<span class="mystery-box role-${boxes[i].role} ${solved ? 'correct' : ''}">${solved ? show(answers[i]) : '?'}</span>`;
  const layout = play.layout === 'story' ? 'shot-story' : 'shot-equation';
  return `<div class="sheet-prompt ${layout}">${play.prompt(p, box)}</div>`;
}

const stepsHtml = (steps, count) =>
  `<ol class="steps">${steps.slice(0, count).map((s) => `<li>${s}</li>`).join('')}</ol>`;

const boardHtml = (p, opts) => {
  const html = PLAYS[p.kind].board?.(p, opts);
  return html ? `<div class="sheet-board">${html}</div>` : '';
};

const RENDER = {
  // "Go Practice This Play": the picture, with the hidden number still hidden
  board() {
    const p = sheet.problem;
    const lab = PLAYS[p.kind].toLab?.(p);
    return `
      <div class="sheet-head"><h2>Coach's board</h2></div>
      ${promptHtml(p)}
      ${boardHtml(p, { solved: false })}
      <div class="sheet-actions">
        ${lab ? '<button class="link-btn" data-action="board-practice">Build it in Practice</button>' : ''}
        <button class="big-btn" data-action="sheet-close">Back to the shot</button>
      </div>
    `;
  },

  // "Show me how": one step at a time, then the picture with the answer
  showme() {
    const { problem: p, steps, shown } = sheet;
    const done = shown >= steps.length;
    return `
      <div class="sheet-head"><h2>Coach Cheryl shows you how</h2></div>
      ${promptHtml(p)}
      ${stepsHtml(steps, shown)}
      ${done ? boardHtml(p, { solved: true }) : ''}
      <div class="sheet-actions">
        ${done
          ? '<button class="big-btn" data-action="sheet-close">Got it. My shot!</button>'
          : '<button class="big-btn" data-action="sheet-next">Next step ➔</button>'}
      </div>
    `;
  },

  // A new play: what it is, a sample shot, the worked steps, then play
  intro() {
    const { problem: p, steps, shown, id } = sheet;
    const play = PLAYS[id];
    const done = shown >= steps.length;
    return `
      <div class="sheet-head"><span class="new-badge">⭐ New play</span><h2>${play.label}</h2></div>
      <p class="sheet-blurb">${play.blurb}</p>
      <p class="sheet-label">Here's one. Watch how Coach Cheryl does it:</p>
      ${promptHtml(p, { solved: done })}
      ${stepsHtml(steps, shown)}
      ${done ? boardHtml(p, { solved: true }) : ''}
      <div class="sheet-actions">
        ${done
          ? '<button class="big-btn" data-action="sheet-close">Let\'s play! 🏀</button>'
          : `<button class="big-btn" data-action="sheet-next">${shown === 0 ? 'Show me ➔' : 'Next step ➔'}</button>`}
      </div>
    `;
  },

  // "I don't know this yet": three answers, least change first, each saying
  // what happens next
  skip() {
    const { play, concept, canPause } = sheet.choices;
    const choice = (reason, say, then) => `
      <button class="skip-choice" data-action="skip-choose" data-value="${reason}">
        <span class="skip-say">${say}</span>
        <span class="skip-then">${then}</span>
      </button>`;
    return `
      <div class="sheet-head"><h2>That's OK!</h2></div>
      <p class="sheet-label">Every player is still learning some shots. Which one fits?</p>
      <div class="skip-choices">
        ${choice('tired', `I'm tired of ${play} for now`, 'Coach switches to other plays for the rest of this game.')}
        ${choice('hard', 'This one is too hard', 'Coach makes the next ones a little easier.')}
        ${canPause ? choice('notready', `I'm not ready for ${concept} yet`, 'Coach saves it for later.') : ''}
      </div>
      <div class="sheet-actions">
        <button class="link-btn" data-action="sheet-close">Back to the shot</button>
      </div>
    `;
  },

  // The film room: each shot that needed a rebound, worked through
  film() {
    const { film, index } = sheet;
    const p = film[index];
    const last = index === film.length - 1;
    return `
      <div class="sheet-head"><h2>Film room 🎬</h2><span class="sheet-count">${index + 1} of ${film.length}</span></div>
      ${promptHtml(p, { solved: true })}
      ${stepsHtml(PLAYS[p.kind].steps(p), Infinity)}
      ${boardHtml(p, { solved: true })}
      <div class="sheet-actions">
        ${index > 0 ? '<button class="link-btn" data-action="sheet-prev">◀ Back</button>' : ''}
        ${last
          ? '<button class="big-btn" data-action="sheet-close">Done</button>'
          : '<button class="big-btn" data-action="sheet-next">Next ▶</button>'}
      </div>
    `;
  }
};

function render() {
  $('sheet').hidden = !sheet;
  if (!sheet) return;
  $('sheet-card').innerHTML = RENDER[sheet.kind]();
  $('sheet-card').scrollTop = 0;
}

export function openBoard(problem) {
  sheet = { kind: 'board', problem };
  render();
}

export function openShowMe(problem) {
  sheet = { kind: 'showme', problem, steps: PLAYS[problem.kind].steps(problem), shown: 1 };
  render();
}

// onDone runs when "Let's play!" is tapped
export function openIntro(id, onDone) {
  const play = PLAYS[id];
  const problem = play.generate({ level: state.progress[id].level, tier: 0, ops: state.ops });
  sheet = { kind: 'intro', id, problem, steps: play.steps(problem), shown: 0, onDone };
  render();
}

// choices: { play, concept, canPause } from skipChoices() in js/game.js
export function openSkip(choices) {
  if (!choices) return;
  sheet = { kind: 'skip', choices };
  render();
}

export function openFilm(film) {
  if (!film.length) return;
  sheet = { kind: 'film', film, index: 0 };
  render();
}

export function sheetNext() {
  if (!sheet) return;
  if (sheet.kind === 'film') sheet.index = Math.min(sheet.film.length - 1, sheet.index + 1);
  else sheet.shown += 1;
  render();
}

export function sheetPrev() {
  if (!sheet || sheet.kind !== 'film') return;
  sheet.index = Math.max(0, sheet.index - 1);
  render();
}

export function closeSheet() {
  const done = sheet?.onDone;
  sheet = null;
  render();
  done?.();
}
