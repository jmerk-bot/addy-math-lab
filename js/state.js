// App state, shared helpers, and saving/restoring between launches.

export const OPS = ['+', '-', '×', '÷'];

// Subtraction is stored as '-' but shown with a proper minus sign.
export const OP_LABEL = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

export const state = {
  mode: 'lab',
  lab: {
    a: 6,
    b: 3,
    op: '+'
  },
  quest: {
    filters: [...OPS],
    problem: null,
    status: 'playing', // 'playing', 'correct', 'retry'
    entry: '', // digits typed on the number pad
    replaceOnType: false // after a miss, the next digit starts a fresh answer
  }
};

export function compute(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '-': return Math.max(0, a - b);
    case '×': return a * b;
    case '÷': return b === 0 ? 0 : Math.floor(a / b);
    default: return 0;
  }
}

// ---------- Persistence ----------
// The tablet may close the app in the background, so the Lab settings, quest
// filters and an unsolved quest are kept in localStorage and restored on launch.

const STORAGE_KEY = 'addy-math-lab:v1';

export function saveState() {
  try {
    const { mode, lab, quest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode,
      lab,
      quest: {
        filters: quest.filters,
        problem: quest.status === 'correct' ? null : quest.problem
      }
    }));
  } catch (e) {}
}

export function loadState() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return;
  }
  if (!saved || typeof saved !== 'object') return;

  if (saved.mode === 'lab' || saved.mode === 'quest') state.mode = saved.mode;

  const lab = saved.lab;
  if (lab && OPS.includes(lab.op) && Number.isInteger(lab.a) && Number.isInteger(lab.b)) {
    state.lab = { a: lab.a, b: lab.b, op: lab.op };
  }

  const filters = saved.quest?.filters;
  if (Array.isArray(filters)) {
    const valid = OPS.filter(op => filters.includes(op));
    if (valid.length) state.quest.filters = valid;
  }

  const problem = saved.quest?.problem;
  if (isValidProblem(problem) && state.quest.filters.includes(problem.op)) {
    state.quest.problem = problem;
  }
}

function isValidProblem(p) {
  return !!p
    && OPS.includes(p.op)
    && ['a', 'b', 'target', 'expected'].every(k => Number.isInteger(p[k]))
    && (p.missing === 'b' || p.missing === 'result');
}
