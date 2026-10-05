// Number helpers shared by the Game, Practice and the plays.

export const OPS = ['+', '-', '×', '÷'];

// Subtraction is stored as '-' but shown with a proper minus sign.
export const OP_LABEL = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

export function compute(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '-': return Math.max(0, a - b);
    case '×': return a * b;
    case '÷': return b === 0 ? 0 : Math.floor(a / b);
    default: return 0;
  }
}

// 3482 → "3,482"
export const fmt = (n) => n.toLocaleString('en-US');
