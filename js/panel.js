// The "Change the Game" panel, for the grown-up: the playbook and
// training path, a shot chart and the week, and settings (including the
// journey log's backup copies).

import { state, resetSeason, resetGame, tidyPaused, LENGTHS, backupCopy, readBackup, restoreBackup } from './state.js';
import { OPS, OP_LABEL } from './math.js';
import { PLAYS, PATH, LEVELS, LEVEL_NAMES, ZONES, CAMPS } from './plays.js';
import { swishRate, unlockPlay, RECENT } from './coach.js';
import { setSound } from './audio.js';
import { renderGame, weekHtml } from './game.js';
import { dayKey } from './kit.js';
import { logEvent, logStatus } from './log.js';

const $ = (id) => document.getElementById(id);

let tab = 'playbook';

// Big changes (a new base level, unlocking a play, resetting the season) ask
// first, right where the tap was, with Yes and Cancel. Not the browser's
// confirm(): some browsers and webviews block it, which would make these
// buttons do nothing. { action, value } while a question is showing.
let pending = null;
let notice = ''; // a line under the backup buttons: what just happened

export function openCoach(open) {
  pending = null;
  notice = '';
  $('coach').hidden = !open;
  if (open) renderCoach();
}

export function renderCoach() {
  tidyPaused();
  document.querySelectorAll('.coach-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.value === tab));
  $('coach-body').innerHTML = { playbook: playbookHtml, stats: statsHtml, settings: settingsHtml }[tab]();
}

const pct = (rate) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

// The question for a pending change, shown when it matches action (and value)
function confirmHtml(action, value) {
  if (!pending || pending.action !== action || (value !== undefined && pending.value !== value)) return '';
  const { ask, yes } = GUARDED[action];
  return `
    <div class="confirm-bar" role="alertdialog">
      <p>${ask(pending.value)}</p>
      <div class="confirm-actions">
        <button class="quiet-btn small" data-action="confirm-no">Cancel</button>
        <button class="confirm-yes" data-action="confirm-yes">${yes(pending.value)}</button>
      </div>
    </div>`;
}

// ---------- Playbook tab ----------

function playbookHtml() {
  const next = PATH.find((id) => !state.progress[id].unlocked);
  const rows = PATH.map((id) => {
    const play = PLAYS[id];
    const p = state.progress[id];
    if (!p.unlocked) {
      return `
        <div class="play-item locked">
          <span class="play-lock" aria-hidden="true">🔒</span>
          <div class="play-info">
            <span class="play-name">${play.label}</span>
            <span class="play-meta">${id === next ? 'Unlocks next, when shots are going well' : 'Later on the path'}</span>
          </div>
          <button class="quiet-btn small" data-action="unlock" data-value="${id}">Unlock</button>
        </div>${confirmHtml('unlock', id)}`;
    }
    const on = state.playbook.includes(id);
    const status = !p.introduced ? ' <span class="new-badge">New</span>' : '';
    const rate = swishRate(p.recent, 10);
    return `
      <div class="play-item ${on ? '' : 'off'}">
        <button class="play-toggle ${on ? 'active' : ''}" data-action="play" data-value="${id}" aria-label="${on ? 'Turn off' : 'Turn on'} ${play.label}">${on ? '✓' : ''}</button>
        <div class="play-info">
          <span class="play-name">${play.label}${status}</span>
          <span class="play-meta">${p.shots ? `${pct(rate)} swishes lately · ${p.shots} shots` : 'No shots yet'}</span>
        </div>
        <div class="level-stepper">
          <button data-action="play-level" data-value="${id}:-1" aria-label="Easier">◀</button>
          <span>${LEVEL_NAMES[p.level]}</span>
          <button data-action="play-level" data-value="${id}:1" aria-label="Harder">▶</button>
        </div>
      </div>`;
  }).join('');

  const camps = Object.entries(CAMPS).map(([key, camp]) =>
    `<button class="camp-btn" data-action="camp" data-value="${key}">${camp.label}</button>`).join('');
  const ops = OPS.map((op) =>
    `<button class="filter-pill ${state.ops.includes(op) ? 'active' : ''}" data-action="op" data-value="${op}">${OP_LABEL[op]}</button>`).join('');

  return `
    ${pausedHtml()}
    <div class="coach-section">
      <h3>Camps</h3>
      <div class="camp-row">${camps}</div>
    </div>
    <div class="coach-section">
      <h3>Training path</h3>
      <p class="coach-note">New plays unlock one at a time, each with a worked example first. ◀ ▶ sets a play's level; it also moves on its own as shots go.</p>
      <div class="play-list">${rows}</div>
    </div>
    <div class="coach-section ${state.playbook.includes('equation') ? '' : 'muted'}">
      <h3>Equations use</h3>
      <div class="op-row">${ops}</div>
    </div>
  `;
}

// Concepts paused from a shot ("I'm not ready for … yet"), until turned back on
function pausedHtml() {
  if (!state.paused.length) return '';
  const rows = state.paused.map((x, i) => `
    <div class="play-item">
      <div class="play-info">
        <span class="play-name">${x.label[0].toUpperCase()}${x.label.slice(1)}</span>
        <span class="play-meta">${x.key === '*' ? 'The whole play' : PLAYS[x.kind].label} · paused ${showDay(x.day)}</span>
      </div>
      <button class="quiet-btn small" data-action="resume-concept" data-value="${i}">Turn back on</button>
    </div>`).join('');
  return `
    <div class="coach-section">
      <h3>Paused for later</h3>
      <p class="coach-note">"I'm not ready for … yet" on a shot pauses just that part of a play. Turn it back on when it's time.</p>
      <div class="play-list">${rows}</div>
    </div>`;
}

// ---------- Stats tab ----------

// Each zone's swish rate over its plays' recent shots (null without enough)
function zoneRate(zone) {
  const ids = PATH.filter((id) => PLAYS[id].family === zone.id && state.progress[id].unlocked);
  if (!ids.length) return { locked: true, rate: null };
  const recent = ids.flatMap((id) => state.progress[id].recent);
  return { locked: false, rate: swishRate(recent, RECENT * ids.length, 5) };
}

const heat = ({ locked, rate }) => (locked ? 'locked' : rate === null ? 'cold-none' : rate >= 0.8 ? 'hot' : rate >= 0.5 ? 'warm' : 'cool');

// A half court with one zone per kind of play, colored by how it's going
function shotChartHtml() {
  const z = Object.fromEntries(ZONES.map((zone) => [zone.id, zoneRate(zone)]));
  const label = (id, x, y) => {
    const zone = ZONES.find((zn) => zn.id === id);
    const { locked, rate } = z[id];
    return `<text x="${x}" y="${y}" text-anchor="middle" class="chart-name">${zone.label}</text>`
      + `<text x="${x}" y="${y + 15}" text-anchor="middle" class="chart-rate">${locked ? '🔒' : pct(rate)}</text>`;
  };
  // The corners are narrow, so their labels run up the side
  const sideLabel = (id, x, y) => {
    const zone = ZONES.find((zn) => zn.id === id);
    const { locked, rate } = z[id];
    return `<text x="${x}" y="${y}" text-anchor="middle" transform="rotate(-90 ${x} ${y})" class="chart-name">${zone.label} · ${locked ? '🔒' : pct(rate)}</text>`;
  };
  return `
    <svg class="shot-chart" viewBox="0 0 300 262" aria-label="Shot chart">
      <rect x="2" y="2" width="296" height="258" rx="10" class="court"/>
      <path d="M 8 74 L 8 2 L 292 2 L 292 74 A 160 160 0 0 1 8 74 Z" class="zone ${heat(z.top)}"/>
      <rect x="8" y="74" width="30" height="180" class="zone ${heat(z.leftcorner)}"/>
      <rect x="262" y="74" width="30" height="180" class="zone ${heat(z.rightcorner)}"/>
      <path d="M 40 254 L 40 82 A 158 158 0 0 0 108 168 L 108 254 Z" class="zone ${heat(z.leftwing)}"/>
      <path d="M 260 254 L 260 82 A 158 158 0 0 1 192 168 L 192 254 Z" class="zone ${heat(z.rightwing)}"/>
      <rect x="110" y="150" width="80" height="104" class="zone ${heat(z.paint)}"/>
      <circle cx="150" cy="150" r="30" class="zone ${heat(z.ft)}"/>
      <circle cx="150" cy="238" r="7" class="hoop"/>
      ${label('top', 150, 34)}
      ${sideLabel('leftcorner', 27, 164)}
      ${sideLabel('rightcorner', 281, 164)}
      ${label('leftwing', 72, 214)}
      ${label('rightwing', 228, 214)}
      ${label('ft', 150, 144)}
      ${label('paint', 150, 204)}
    </svg>
    <p class="chart-legend"><span class="key hot"></span>80%+ <span class="key warm"></span>50–79% <span class="key cool"></span>under 50% <span class="key cold-none"></span>not enough shots yet</p>
  `;
}

function statsHtml() {
  const s = state.season;
  return `
    <div class="coach-section">
      <h3>Shot chart · swishes lately</h3>
      ${shotChartHtml()}
    </div>
    <div class="coach-section">
      <h3>This week</h3>
      ${weekHtml(s)}
    </div>
    <div class="coach-section">
      <h3>Season</h3>
      <p class="coach-season">${s.games} games · ${s.points} points · season high ${s.high}${s.highQuick ? ` · quick-game high ${s.highQuick}` : ''} · ${s.threes} swishes · best streak ${s.bestStreak}</p>
      <button class="quiet-btn" data-action="reset-season">Reset season</button>
      ${confirmHtml('reset-season')}
    </div>
  `;
}

// ---------- Settings tab ----------

const toggleHtml = (key, label, desc) => `
  <button class="setting-row ${state.settings[key] ? 'active' : ''}" data-action="setting" data-value="${key}">
    <span class="setting-text"><span class="setting-label">${label}</span><span class="setting-desc">${desc}</span></span>
    <span class="switch" aria-hidden="true"></span>
  </button>`;

function settingsHtml() {
  const lengths = Object.entries(LENGTHS).map(([key, len]) => `
    <button class="level-btn ${state.settings.length === key ? 'active' : ''}" data-action="length" data-value="${key}">
      <span class="level-name">${len.label}</span><span class="level-desc">${len.desc}</span>
    </button>`).join('');
  const levels = LEVELS.map((level) =>
    `<button class="level-btn ${state.level === level ? 'active' : ''}" data-action="level" data-value="${level}"><span class="level-name">${LEVEL_NAMES[level]}</span></button>`).join('');
  return `
    <div class="coach-section">
      <h3>Game length</h3>
      <div class="level-row">${lengths}</div>
    </div>
    <div class="coach-section">
      <h3>Coaching</h3>
      ${toggleHtml('autoLevel', 'Adjust difficulty on its own', 'Up a step after 3 swishes in a row; quietly down after 2 put-backs')}
      ${toggleHtml('autoUnlock', 'Add new plays on its own', 'One at a time, when shots are going well')}
    </div>
    <div class="coach-section">
      <h3>Sound</h3>
      ${toggleHtml('sound', 'Sounds', 'Chimes, cheers and the final horn')}
      ${toggleHtml('speech', 'Read stories aloud', 'A 🔊 button on story shots')}
    </div>
    <div class="coach-section">
      <h3>Base level</h3>
      <p class="coach-note">Sets every unlocked play to this level. New plays start one level below it.</p>
      <div class="level-row four">${levels}</div>
      ${confirmHtml('level')}
    </div>
    ${backupHtml()}
  `;
}

// ---------- Journey log and backup copies ----------

// 'YYYY-MM-DD' as a short date, e.g. "Oct 9, 2026"
const showDay = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const backupName = () => `addy-math-lab-${dayKey()}.json`;
const backupFile = () => new File([JSON.stringify(backupCopy())], backupName(), { type: 'application/json' });

function canShareFiles() {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'copy.json', { type: 'application/json' })] });
  } catch (e) {
    return false;
  }
}

function backupHtml() {
  const { since, games, full } = logStatus();
  const logged = `${games === 1 ? '1 game' : `${games} games`} logged`;
  return `
    <div class="coach-section">
      <h3>Journey log</h3>
      <p class="coach-note">Every game is recorded on this tablet${since ? `, starting ${showDay(since)}` : ''} · ${logged}. Save a copy now and then: it's a backup of the log, plays, levels and season.</p>
      ${full ? '<p class="backup-notice">This tablet is out of room for the log. Save a copy so nothing is lost.</p>' : ''}
      <div class="backup-row">
        <button class="quiet-btn" data-action="backup-download">Download a copy</button>
        ${canShareFiles() ? '<button class="quiet-btn" data-action="backup-share">Share a copy</button>' : ''}
        <button class="quiet-btn" data-action="backup-restore">Restore from a copy</button>
      </div>
      ${notice ? `<p class="backup-notice">${notice}</p>` : ''}
      ${confirmHtml('restore')}
    </div>`;
}

function downloadBackup() {
  const file = backupFile();
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  notice = `Downloaded ${file.name}.`;
}

function shareBackup() {
  notice = '';
  // Cancelling the share sheet rejects; nothing to do then
  navigator.share({ files: [backupFile()], title: 'Math Lab backup' }).catch(() => {});
}

// The file picker is a hidden input in index.html (outside the panel, which redraws)
function pickBackup() {
  notice = '';
  const input = $('restore-file');
  input.value = '';
  input.click();
}

// A file picked to restore from: ask first, or say why it can't be used
export async function backupPicked(file) {
  if (!file) return;
  let text = '';
  try {
    text = await file.text();
  } catch (e) {}
  const copy = readBackup(text);
  pending = copy ? { action: 'restore', value: copy } : null;
  notice = copy ? '' : "That file isn't a Math Lab copy, so nothing changed.";
  renderCoach();
}

function restore(copy) {
  if (restoreBackup(copy)) location.reload();
  else notice = "That copy couldn't be restored, so nothing changed.";
}

// ---------- Actions ----------

// Keep at least one play on. A shot already on screen is left alone.
function togglePlay(id) {
  if (!state.progress[id]?.unlocked) return;
  const book = state.playbook;
  if (book.includes(id)) {
    if (book.length === 1) return;
    state.playbook = book.filter((x) => x !== id);
  } else {
    state.playbook = PATH.filter((x) => x === id || book.includes(x));
  }
}

function setPlayLevel(value) {
  const [id, step] = value.split(':');
  const p = state.progress[id];
  if (!p) return;
  const i = LEVELS.indexOf(p.level) + Number(step);
  if (i < 0 || i >= LEVELS.length) return;
  Object.assign(p, { level: LEVELS[i], tier: 0, streak: 0, slump: 0 });
  logEvent('set', { kind: id, level: p.level });
}

function resumeConcept(value) {
  const x = state.paused[Number(value)];
  if (!x) return;
  if (x.key === '*' && state.progress[x.kind].unlocked) {
    state.playbook = PATH.filter((id) => id === x.kind || state.playbook.includes(id));
  } else if (x.kind === 'equation') {
    state.ops = OPS.filter((op) => op === x.key || state.ops.includes(op));
  }
  state.paused = state.paused.filter((y) => y !== x);
  logEvent('resume', { kind: x.kind, key: x.key });
}

function unlock(id) {
  if (!PLAYS[id] || state.progress[id].unlocked) return;
  unlockPlay(state, id);
  logEvent('unlock', { kind: id });
}

// A camp switches on its unlocked plays (keeping at least one)
function setCamp(key) {
  const wanted = CAMPS[key].plays.filter((id) => state.progress[id]?.unlocked);
  if (wanted.length) state.playbook = PATH.filter((id) => wanted.includes(id));
}

function setBaseLevel(level) {
  if (!LEVELS.includes(level)) return;
  state.level = level;
  for (const id of PATH) {
    const p = state.progress[id];
    if (p.unlocked) Object.assign(p, { level, tier: 0, streak: 0, slump: 0 });
  }
  logEvent('base', { level });
}

function toggleOp(op) {
  const ops = state.ops;
  if (ops.includes(op)) {
    if (ops.length > 1) state.ops = ops.filter((x) => x !== op);
  } else {
    state.ops = [...ops, op];
  }
}

function toggleSetting(key) {
  if (!(key in state.settings) || typeof state.settings[key] !== 'boolean') return;
  state.settings[key] = !state.settings[key];
  setSound(state.settings.sound);
  renderGame();
}

function setLength(key) {
  if (LENGTHS[key]) state.settings.length = key;
  renderGame();
}

function clearSeason() {
  logEvent('reset');
  resetSeason();
  resetGame();
  renderGame();
}

// The changes that ask first: the question, the Yes label, and what Yes does
const GUARDED = {
  level: {
    ask: (level) => `Set every unlocked play to ${LEVEL_NAMES[level]}? Each play starts that level from its first step.`,
    yes: (level) => `Set to ${LEVEL_NAMES[level]}`,
    run: setBaseLevel
  },
  unlock: {
    ask: (id) => `Unlock ${PLAYS[id].label} now? Coach Cheryl will introduce it at the next tip-off.`,
    yes: () => 'Unlock',
    run: unlock
  },
  'reset-season': {
    ask: () => 'Reset the season record? Games, points, highs and the week go back to zero. Plays and levels stay.',
    yes: () => 'Reset season',
    run: clearSeason
  },
  restore: {
    ask: (copy) => {
      const games = copy.log.events.filter((e) => e.e === 'game').length;
      const when = new Date(copy.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `Replace everything on this tablet with the copy saved ${when} (${games === 1 ? '1 game' : `${games} games`} logged)? Plays, levels, the season and the log all come from the copy.`;
    },
    yes: () => 'Restore',
    run: restore
  }
};

const ask = (action) => (value) => { pending = { action, value }; };

// Each runs, then the panel redraws
const ACTIONS = {
  'coach-tab': (value) => { tab = value; pending = null; notice = ''; },
  'play': togglePlay,
  'play-level': setPlayLevel,
  'resume-concept': resumeConcept,
  'unlock': ask('unlock'),
  'camp': setCamp,
  'level': ask('level'),
  'op': toggleOp,
  'setting': toggleSetting,
  'length': setLength,
  'reset-season': ask('reset-season'),
  'backup-download': downloadBackup,
  'backup-share': shareBackup,
  'backup-restore': pickBackup,
  'confirm-yes': () => {
    const change = pending;
    pending = null;
    if (change) GUARDED[change.action].run(change.value);
  },
  'confirm-no': () => { pending = null; }
};

export const coachActions = Object.fromEntries(Object.entries(ACTIONS).map(([name, run]) =>
  [name, (value) => { run(value); renderCoach(); }]));
