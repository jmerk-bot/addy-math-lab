// Checks every Game play at every level and tier: problems are well-formed,
// have one right answer, stay inside the level's ranges, and fit in Practice.
// Run before deploying:  node scripts/check-plays.mjs

import { PLAYS, PLAY_IDS, LEVELS, isValidProblem, regroups } from '../js/plays.js';
import { OPS, compute } from '../js/math.js';
import { limits } from '../js/lab.js';

const RUNS = 2000;
const TIERS = [0, 1, 2];

// Tier-0 ceilings, written from the level descriptions rather than copied from
// the generator tables, so a slip in one shows up here.
const CEILINGS = {
  equation: {
    rookie: { sum: 20, fact: 5 },
    starter: { sum: 50, fact: 10 },
    allstar: { sum: 100, fact: 12 },
    mvp: { sum: 100, fact: 12 }
  },
  bignumbers: {
    rookie: { sum: 99, mulA: 50, mulB: 5 },
    starter: { sum: 100, mulA: 25, mulB: 5 },
    allstar: { sum: 999, mulA: 99, mulB: 9 },
    mvp: { sum: 1000, mulA: 999, mulB: 9 }
  },
  leftovers: {
    rookie: { a: 29, b: 5, q: 5 },
    starter: { a: 89, b: 9, q: 9 },
    allstar: { a: 99, b: 9 },
    mvp: { a: 999, b: 9 }
  }
};

let failures = 0;
function fail(where, message, problem) {
  failures += 1;
  if (failures <= 25) console.error(`FAIL ${where}: ${message}\n  ${JSON.stringify(problem)}`);
}

const isInt = (n) => Number.isInteger(n) && n >= 0;

// Solves an equation shot for its hidden slot from the other two numbers
function solveFor(p) {
  const { a, b, op, result } = p;
  if (p.missing === 'result') return compute(a, b, op);
  if (p.missing === 'a') {
    return { '+': result - b, '-': result + b, '×': result / b, '÷': result * b }[op];
  }
  return { '+': result - a, '-': a - result, '×': result / a, '÷': a / result }[op];
}

function fitsPractice({ op, a, b }) {
  const lim = limits(op, a);
  return OPS.includes(op) && a >= lim.aMin && a <= lim.aMax && b >= lim.bMin && b <= lim.bMax;
}

function checkCeilings(id, level, p, where) {
  const c = CEILINGS[id][level];
  const over = (value, max, what) => value > max && fail(where, `${what} ${value} is over ${max}`, p);
  if (id === 'equation') {
    if (p.op === '+') over(p.result, c.sum, 'sum');
    if (p.op === '-') over(p.a, c.sum, 'first number');
    if (p.op === '×') { over(p.a, c.fact, 'factor'); over(p.b, c.fact, 'factor'); }
    if (p.op === '÷') { over(p.b, c.fact, 'divisor'); over(p.result, c.fact, 'quotient'); }
  } else if (id === 'bignumbers') {
    if (p.op === '+') over(p.result, c.sum, 'sum');
    if (p.op === '-') over(p.a, c.sum, 'first number');
    if (p.op === '×') { over(p.a, c.mulA, 'first factor'); over(p.b, c.mulB, 'second factor'); }
  } else {
    over(p.a, c.a, 'dividend');
    over(p.b, c.b, 'divisor');
    if (c.q) over(p.result, c.q, 'quotient');
  }
}

for (const id of PLAY_IDS) {
  const play = PLAYS[id];
  for (const level of LEVELS) {
    for (const tier of TIERS) {
      const where = `${id}/${level}/tier ${tier}`;
      const seen = { regroup: 0, addSub: 0, even: 0, missing: {} };

      for (let i = 0; i < RUNS; i++) {
        const p = play.generate({ level, tier, ops: OPS });

        if (p.kind !== id) fail(where, `kind is ${p.kind}`, p);
        if (!play.isValid(p)) fail(where, 'isValid() rejects it', p);
        if (!isValidProblem(JSON.parse(JSON.stringify(p)))) fail(where, 'does not survive a save', p);

        // Answers: one per box, whole numbers, at most five digits
        const answers = play.answers(p);
        const boxes = play.boxes(p);
        if (answers.length !== boxes.length) fail(where, 'answers and boxes differ in count', p);
        for (const answer of answers) {
          if (!isInt(answer) || answer > 99999) fail(where, `bad answer ${answer}`, p);
        }

        // Equation shots: the hidden number is the only one that works
        if (p.missing) {
          const solved = solveFor(p);
          if (solved !== p[p.missing]) fail(where, `solving gives ${solved}`, p);
          if (p.missing === 'a' && p.a < 1) fail(where, 'hidden A is below 1', p);
          seen.missing[p.missing] = (seen.missing[p.missing] || 0) + 1;
        }
        if (p.op === '÷' && p.b < 1) fail(where, 'divides by zero', p);

        // Text: "?" for each hidden box, and the solved version fully filled in
        const text = play.text(p);
        const solvedText = play.text(p, { solved: true });
        if ((text.match(/\?/g) || []).length !== boxes.length) fail(where, `text "${text}"`, p);
        if (/\?|undefined|NaN/.test(solvedText)) fail(where, `solved text "${solvedText}"`, p);

        // The prompt draws each answer box exactly once
        const prompt = play.prompt(p, (n) => `[[box ${n}]]`);
        boxes.forEach((_, n) => {
          if (prompt.split(`[[box ${n}]]`).length !== 2) fail(where, `prompt draws box ${n} wrong`, p);
        });
        if (/undefined|NaN/.test(prompt)) fail(where, 'prompt has undefined/NaN', p);

        // Practice can show the shot itself, and where "Need a look?" starts
        if (!fitsPractice(p)) fail(where, 'the shot does not fit Practice', p);
        const lab = play.toLab(p);
        if (!fitsPractice(lab)) fail(where, `toLab ${JSON.stringify(lab)} does not fit Practice`, p);

        if (tier === 0) checkCeilings(id, level, p, where);

        if (id === 'bignumbers' && (p.op === '+' || p.op === '-')) {
          seen.addSub += 1;
          if (regroups(p.a, p.b, p.op)) seen.regroup += 1;
        }
        if (id === 'leftovers' && p.remainder === 0) seen.even += 1;
      }

      // Mix checks
      if (id === 'bignumbers' && level !== 'rookie' && tier === 0) {
        const share = seen.regroup / seen.addSub;
        if (share < 0.45 || share > 0.75) fail(where, `regrouping in ${(share * 100).toFixed(0)}% of + and − shots`, {});
      }
      if (id === 'leftovers') {
        const share = seen.even / RUNS;
        if (share < 0.1 || share > 0.3) fail(where, `remainder 0 in ${(share * 100).toFixed(0)}% of shots`, {});
      }
      if (id === 'equation' && tier === 0) {
        for (const slot of ['a', 'b', 'result']) {
          if (!seen.missing[slot]) fail(where, `the ${slot} slot is never hidden`, {});
        }
      }
    }
  }
}

const total = PLAY_IDS.length * LEVELS.length * TIERS.length * RUNS;
if (failures) {
  console.error(`\n${failures} problem(s) out of ${total} generated shots.`);
  process.exit(1);
}
console.log(`OK: ${total} shots across ${PLAY_IDS.length} plays × ${LEVELS.length} levels × ${TIERS.length} tiers.`);
