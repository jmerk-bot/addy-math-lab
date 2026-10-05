// Practice's allowed values for A and B under each operation. These cover every
// Game shot that can be sent to Practice, at every level, so "Go Practice This Play"
// never cuts a shot off (scripts/check-plays.mjs checks that).

export function limits(op, a) {
  switch (op) {
    case '×': return { aMin: 1, aMax: 999, bMin: 0, bMax: a > 99 ? 12 : 99 };
    case '÷': return { aMin: 1, aMax: 999, bMin: 1, bMax: Math.min(12, Math.max(1, a)) };
    case '-': return { aMin: 1, aMax: 1000, bMin: 0, bMax: a };
    default: return { aMin: 1, aMax: 999, bMin: 0, bMax: 1000 - a };
  }
}
