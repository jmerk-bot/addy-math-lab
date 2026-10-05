// The coach: how difficulty moves, when a new play unlocks, and which shot
// comes next. Pure functions over the app state, so scripts/check-plays.mjs
// can run whole simulated seasons in Node.
//
// Difficulty is per play: a level (Rookie → MVP) and a tier (0–2) inside it.
// Three swishes in a row on a play step it up one tier (past tier 2, up a
// level); two put-backs in a row step it down, quietly. The steps are small,
// because tier 2 of a level already mixes in the next level's shots.
//
// New plays unlock one at a time along the path, only while things are going
// well: the last 40 shots were mostly swishes (so a lucky stretch doesn't
// count), the newest play is steady, and it's been at least two games since
// the last new play. A new play gets a
// worked example first (its intro), then just a couple of mid-game shots in
// its first game.
//
// Every game opens and closes with a familiar shot, and after a rough patch the
// next couple of shots are familiar ones too.

import { LEVELS, pickWeighted } from './kit.js';
import { PLAYS, PATH } from './plays.js';

export const STREAK_UP = 3; // swishes in a row → one step up
export const SLUMP_DOWN = 2; // put-backs in a row → one step down
export const RECENT = 20; // shots remembered per play
export const SEASON_RECENT = 40; // shots remembered across all plays

const FRESH_SHOTS_PER_GAME = 2; // a brand-new play's shots in its first game
const FRESH_BOOST = 2; // ...picked more often until it has had them
const READING_PER_PERIOD = 2; // story shots per quarter
const UNLOCK_OVERALL = 0.7; // swish rate over the last 40 shots needed for a new play
const UNLOCK_NEWEST = 0.6; // ...and on the newest play's last 8
const UNLOCK_GAP = 2; // games between new plays

export function freshProgress(level = 'rookie') {
  return {
    unlocked: false,
    introduced: false, // its intro (a worked example) has been shown
    fresh: 0, // games left in which it's still new (fewer shots, mid-game only)
    unlockedAt: 0, // season game count when it unlocked
    level,
    tier: 0,
    streak: 0, // swishes in a row on this play
    slump: 0, // put-backs in a row on this play
    shots: 0,
    swishes: 0,
    recent: [] // last RECENT shots: 1 = swish, 0 = needed a rebound
  };
}

// Swish rate over the last n shots, or null with fewer than `min` of them
export function swishRate(recent, n = 10, min = 5) {
  const r = recent.slice(-n);
  return r.length >= min ? r.reduce((sum, x) => sum + x, 0) / r.length : null;
}

// Records one shot on a play and moves its difficulty. Returns the change:
// 'up', 'levelUp', 'down', 'levelDown', or null.
export function recordShot(p, swish, { auto = true } = {}) {
  p.shots += 1;
  if (swish) p.swishes += 1;
  p.recent = [...p.recent, swish ? 1 : 0].slice(-RECENT);
  if (!auto) return null;

  const i = LEVELS.indexOf(p.level);
  if (swish) {
    p.slump = 0;
    p.streak += 1;
    if (p.streak < STREAK_UP) return null;
    p.streak = 0;
    if (p.tier < 2) {
      p.tier += 1;
      return 'up';
    }
    if (i < LEVELS.length - 1) {
      p.level = LEVELS[i + 1];
      p.tier = 0;
      return 'levelUp';
    }
    return null;
  }

  p.streak = 0;
  p.slump += 1;
  if (p.slump < SLUMP_DOWN) return null;
  p.slump = 0;
  if (p.tier > 0) {
    p.tier -= 1;
    return 'down';
  }
  if (i > 0) {
    p.level = LEVELS[i - 1];
    p.tier = 2;
    return 'levelDown';
  }
  return 'down'; // already as easy as it goes, but still a cue for familiar shots
}

// New plays start one level below the base level, never below Rookie
export const startLevel = (base) => LEVELS[Math.max(0, LEVELS.indexOf(base) - 1)];

export function unlockPlay(state, id) {
  const p = state.progress[id];
  if (!p || p.unlocked) return;
  Object.assign(p, freshProgress(startLevel(state.level)), { unlocked: true, fresh: 1, unlockedAt: state.season.games });
  if (!state.playbook.includes(id)) state.playbook = PATH.filter((x) => x === id || state.playbook.includes(x));
}

// The next play on the path, when it's time for a new one (else null)
export function readyForNewPlay(state) {
  const next = PATH.find((id) => !state.progress[id].unlocked);
  if (!next) return null;
  // One new thing at a time: a play that's still new (and switched on) has to settle in first
  const settling = (id) => state.progress[id].unlocked && state.playbook.includes(id)
    && (!state.progress[id].introduced || state.progress[id].fresh > 0);
  if (PATH.some(settling)) return null;

  const overall = swishRate(state.season.recent, SEASON_RECENT, SEASON_RECENT);
  if (overall === null || overall < UNLOCK_OVERALL) return null;

  const on = PATH.filter((id) => state.progress[id].unlocked && state.playbook.includes(id));
  const newest = on.reduce((best, id) =>
    (!best || state.progress[id].unlockedAt >= state.progress[best].unlockedAt ? id : best), null);
  if (newest) {
    const p = state.progress[newest];
    if (state.season.games - p.unlockedAt < UNLOCK_GAP) return null;
    const rate = swishRate(p.recent, 8, 8);
    if (rate === null || rate < UNLOCK_NEWEST) return null;
  }
  return next;
}

// After the final buzzer: new plays that got their shots settle in, and maybe
// the next play unlocks. Returns the unlocked play's id, or null.
export function afterGame(state, game) {
  for (const id of PATH) {
    const p = state.progress[id];
    if (p.fresh > 0 && game.used[id]) p.fresh -= 1;
  }
  if (!state.settings.autoUnlock) return null;
  const next = readyForNewPlay(state);
  if (next) unlockPlay(state, next);
  return next;
}

// The play to warm up (or settle down) with: the one going best lately,
// never a story or a play that's still new
function comfortPlay(state, ids) {
  const calm = ids.filter((id) => !PLAYS[id].reading && !(state.progress[id].fresh > 0));
  const candidates = calm.length ? calm : ids.filter((id) => !PLAYS[id].followUp);
  let best = null;
  let bestRate = -1;
  for (const id of candidates) {
    const rate = swishRate(state.progress[id].recent, 10);
    if (rate !== null && rate > bestRate) {
      best = id;
      bestRate = rate;
    }
  }
  return best || (candidates.includes('equation') ? 'equation' : candidates[0] || ids[0]);
}

// Which play the next shot comes from, at what tier, and whether it's a
// familiar "comfort" shot. game.quarter / game.shot say where we are.
export function chooseShot(state, game, { periods, shotsPerPeriod }) {
  const on = PATH.filter((id) => state.progress[id]?.unlocked && state.playbook.includes(id));
  const ids = on.length ? on : ['equation'];
  const index = (game.quarter - 1) * shotsPerPeriod + game.shot;
  const total = periods * shotsPerPeriod;
  const left = shotsPerPeriod - game.shot;
  const tierOf = (id) => (state.settings.autoLevel ? state.progress[id].tier : 0);

  // Open and close the game on something familiar, and settle down after a rough patch
  if (index === 0 || index === total - 1 || game.calm > 0) {
    const kind = comfortPlay(state, ids);
    return { kind, tier: Math.max(0, tierOf(kind) - 1), comfort: true };
  }

  const last = game.lastKinds[game.lastKinds.length - 1];
  const pool = ids.filter((id) => {
    const play = PLAYS[id];
    if (state.progress[id].fresh > 0) {
      // A new play only mid-game, a couple of times, never twice in a row
      if (index < 2 || index > total - 3 || game.freshShots >= FRESH_SHOTS_PER_GAME || last === id) return false;
    }
    if (play.reading && game.readingThisPeriod >= READING_PER_PERIOD) return false;
    // A two-step play needs both steps in this quarter, before the game's
    // closing shot, and takes the quarter's whole story allowance
    if (play.followUp && (left < 2 || index > total - 3 || game.readingThisPeriod > 0)) return false;
    // Not the same play three times running
    if (game.lastKinds.length >= 2 && game.lastKinds.slice(-2).every((k) => k === id)) return false;
    return true;
  });

  const fallback = ids.filter((id) => !PLAYS[id].reading && !(state.progress[id].fresh > 0));
  const choices = pool.length ? pool : fallback.length ? fallback : [comfortPlay(state, ids)];
  const weights = Object.fromEntries(choices.map((id) =>
    [id, PLAYS[id].weight * (state.progress[id].fresh > 0 ? FRESH_BOOST : 1)]));
  const kind = pickWeighted(weights);
  return { kind, tier: tierOf(kind), comfort: false };
}
