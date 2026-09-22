import { MATH_HANDS } from "./math-hands";

const KEY = "spin-drill-math-v1";

export type MathRec = { total: number; correct: number };
export type MathStore = {
  overall: MathRec;
  questions: Record<string, MathRec>;
};

function empty(): MathStore {
  return { overall: { total: 0, correct: 0 }, questions: {} };
}

export function loadMath(): MathStore {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.overall && raw?.questions) return raw;
  } catch {
    /* ignore */
  }
  return empty();
}

export function saveMath(s: MathStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function recordMath(store: MathStore, qid: string, ok: boolean): MathStore {
  const rec = store.questions[qid] ?? { total: 0, correct: 0 };
  const next: MathStore = {
    overall: {
      total: store.overall.total + 1,
      correct: store.overall.correct + (ok ? 1 : 0),
    },
    questions: {
      ...store.questions,
      [qid]: { total: rec.total + 1, correct: rec.correct + (ok ? 1 : 0) },
    },
  };
  saveMath(next);
  return next;
}

export function resetMath(): MathStore {
  const next = empty();
  saveMath(next);
  return next;
}

export function mathCoverage(store: MathStore): { seen: number; total: number } {
  const total = MATH_HANDS.reduce((n, h) => n + h.questions.length, 0);
  const seen = Object.keys(store.questions).length;
  return { seen, total };
}
