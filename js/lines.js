// The announcer: Lynx-flavored calls for makes, misses, streaks and the final.
// A miss is always a rebound, never a turnover.

const SWISH = [
  'McBuckets for 3!',
  'Addy shoots, nothing but net, baby!',
  'Pass from Liv — Addy buries the three!',
  'Kick-out from Phe — Addy drains the 3!',
  'Olivia Miles finds Addy on the wing — swish for 3!',
  'Napheesa Collier screens, Addy hits from deep!',
  'Nothing but net!',
  'Swish! For three!',
  'Bang! Three!',
  'Count it! Three points!'
];

const MAKE = [
  'She shoots, she scores!',
  'Rebound, put-back, good!',
  'No-look dime from Liv to Addy — buckets!',
  'Phe grabs the board and dishes to Addy — count it!',
  'Olivia Miles sets it up, Addy finishes!',
  'Napheesa Collier with the outlet, Addy scores!',
  'Buckets!',
  'Count it!',
  'Second-chance points for Addy!'
];

const MISS = [
  'Off the rim... rebound, Lynx ball!',
  'Off the rim — Phe tips the rebound back to Addy!',
  'In and out — Liv tracks down the board, still Lynx ball!',
  'Rattles out. Still Lynx ball!',
  'Back iron. Grab it, go again!',
  'So close! Grab the rebound, go again!'
];

// After "Show me how": still a basket, worth 1
const ASSIST = [
  'Assist from Coach Cheryl!',
  'Coach Cheryl, Liv, and Phe draw it up — Addy finishes!',
  'Coach drew it up, Addy finished it!',
  'Great teamwork with Phe and Liv. Count it!'
];

// After "I don't know this yet": no points, no fuss, a new shot
const SKIP = {
  tired: ['Fresh legs! New play coming in.', 'Switching it up. Next play!'],
  hard: ["Good call. Let's run one you know.", 'No problem. Coach is drawing up a different one.'],
  notready: (label) => [`Got it. We'll save ${label} for later.`]
};

const HEATING_UP = 'Heating up! 🔥';
const ON_FIRE = [
  'ON FIRE! M V Phee!',
  'ON FIRE! Addy, Liv, and Phe are unstoppable!',
  'ON FIRE! Liv to Phe to Addy — Lynx basketball!'
];

// A random line from the pool, never the same one twice in a row
function pick(pool, last) {
  const options = pool.filter((line) => line !== last);
  return options[Math.floor(Math.random() * options.length)];
}

// Three swishes in a row is heating up; from five on, every other make is on fire.
export function callMake({ three, streak, last }) {
  if (three && streak === 3) return HEATING_UP;
  if (three && streak >= 5 && streak % 2 === 1) return pick(ON_FIRE, last);
  return pick(three ? SWISH : MAKE, last);
}

export function callMiss(last) {
  return pick(MISS, last);
}

export function callAssist(last) {
  return pick(ASSIST, last);
}

export function callSkip(reason, label, last) {
  const pool = reason === 'notready' ? SKIP.notready(label) : SKIP[reason];
  return pick(pool, last) || pool[0];
}

export function finalHeadline({ points, maxPoints, newHigh, opponent }) {
  const vs = opponent ? ` against the ${opponent}` : '';
  if (points === maxPoints) return `PERFECT GAME${vs}! Addy, Liv & Phe — M V Phee!`;
  if (newHigh) return `New season high${vs}! Addy, Liv & Phe — M V Phee!`;
  if (points >= maxPoints * 0.75) {
    return opponent
      ? `Lynx roll past the ${opponent}! Addy, Liv, and Phe led the way.`
      : 'Lynx roll! Addy, Liv, and Phe led the way.';
  }
  if (points >= maxPoints * 0.5) return `Big game${vs}, Addy! Liv and Phe are hyped!`;
  return `Every shot counts${vs}. Nice game, Addy!`;
}
