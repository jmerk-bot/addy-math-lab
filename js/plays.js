// The playbook: every kind of shot the Game can call, listed in the order they
// unlock on the training path.
//
// Every play provides:
//   label, blurb (one sentence for its intro), family (its shot-chart zone),
//   weight (how often it's picked), tip (a halftime tip),
//   layout ('equation' or 'story'), reading (true for story text: at most two
//   per quarter, never a warm-up, and it gets a read-aloud button)
//   generate({ level, tier, ops }) → a problem: plain data, so a shot survives a reload
//   boxes(p) → answer boxes [{ role, cue? }]; answers(p) → what belongs in each
//   input?(p) → 'keypad' (default) or 'choice' (< = >)
//   prompt(p, box) → HTML, where box(i) draws answer box i
//   text(p, { solved }) → plain text; equation?(p, { solved }) → the math behind a word problem
//   hint(p) → one line; steps(p) → the worked steps for "Show me how" and the film room
//   board?(p, { solved }) → a picture for "Go Practice This Play", "Show me how" and the film room
//   toLab?(p) → { op, a, b } to build in Practice (or null)
//   followUp?(p) → the linked next shot (two-step plays); stepLabel?(p)
//   speech?(p) → what read-aloud says, when it isn't text(p)
//   concept?(p) → { key, label }: the part of the play a shot belongs to, for
//     "I'm not ready for <label> yet" (e.g. Equations' division). Without it,
//     the concept is the whole play.
//   isValid(p)
//
// Generators never touch the DOM, so scripts/check-plays.mjs can run them in Node.

import { equation, bignumbers, leftovers } from './play-numbers.js';
import { fractions } from './play-fractions.js';
import { stories, timesasmany, leftoverstories, twostep } from './play-stories.js';
import { placevalue, roundcompare } from './play-placevalue.js';
import { measure, area, angles } from './play-measure.js';

export { LEVELS, LEVEL_NAMES } from './kit.js';

// The training path: new plays unlock one at a time, in this order
export const PLAYS = {
  equation, bignumbers, leftovers, fractions, stories, placevalue, measure,
  timesasmany, roundcompare, area, leftoverstories, twostep, angles
};
export const PLAY_IDS = Object.keys(PLAYS);
export const PATH = PLAY_IDS;

// What a shot practices, as { key, label }; key '*' means the whole play
export function conceptOf(p) {
  return PLAYS[p.kind].concept?.(p) || { key: '*', label: PLAYS[p.kind].label };
}

export const isValidProblem = (p) =>
  !!p && typeof p === 'object' && PLAY_IDS.includes(p.kind) && PLAYS[p.kind].isValid(p);

// Shot-chart zones, from the paint out to the corners
export const ZONES = [
  { id: 'paint', label: 'Equations' },
  { id: 'ft', label: 'Fractions' },
  { id: 'leftwing', label: 'Big numbers' },
  { id: 'rightwing', label: 'Leftovers' },
  { id: 'top', label: 'Stories' },
  { id: 'leftcorner', label: 'Place value' },
  { id: 'rightcorner', label: 'Measurement' }
];

// One-tap presets for the playbook (only unlocked plays get switched on)
export const CAMPS = {
  numbers: { label: 'Numbers camp', plays: ['equation', 'bignumbers', 'fractions', 'placevalue', 'roundcompare'] },
  stories: { label: 'Story camp', plays: ['equation', 'leftovers', 'stories', 'timesasmany', 'leftoverstories', 'twostep'] },
  measure: { label: 'Measurement camp', plays: ['equation', 'measure', 'area', 'angles'] },
  full: { label: 'Full game', plays: PLAY_IDS }
};
