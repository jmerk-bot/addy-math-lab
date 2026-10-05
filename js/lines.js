// The announcer: Lynx-flavored calls for makes, misses, streaks and the final.
// A miss is always a rebound, never a turnover.

const SWISH = [
  'McBuckets for 3!',
  'Addy shoots, nothing but net, baby!',
  'Nothing but net!',
  'Swish! For three!',
  'Bang! Three!',
  'Count it! Three points!'
];

const MAKE = [
  'She shoots, she scores!',
  'Rebound, put-back, good!',
  'Buckets!',
  'Count it!',
  'Second-chance points for Addy!'
];

const MISS = [
  'Off the rim... rebound, Lynx ball!',
  'Rattles out. Still Lynx ball!',
  'Back iron. Grab it, go again!',
  'Blocked! Get it back and go again!'
];

const HEATING_UP = 'Heating up! 🔥';
const ON_FIRE = 'ON FIRE! M V Phee!';

// A random line from the pool, never the same one twice in a row
function pick(pool, last) {
  const options = pool.filter((line) => line !== last);
  return options[Math.floor(Math.random() * options.length)];
}

// Three swishes in a row is heating up; from five on, every other make is on fire.
export function callMake({ three, streak, last }) {
  if (three && streak === 3) return HEATING_UP;
  if (three && streak >= 5 && streak % 2 === 1) return ON_FIRE;
  return pick(three ? SWISH : MAKE, last);
}

export function callMiss(last) {
  return pick(MISS, last);
}

export function finalHeadline({ points, maxPoints, newHigh }) {
  if (points === maxPoints) return 'PERFECT GAME! M V Phee!';
  if (newHigh) return 'New season high! M V Phee!';
  if (points >= maxPoints * 0.75) return 'Lynx roll! Addy led the way.';
  if (points >= maxPoints * 0.5) return 'Big game, Addy!';
  return 'Every shot counts. Nice game!';
}
