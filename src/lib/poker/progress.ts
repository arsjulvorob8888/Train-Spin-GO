const KEY = "felt-lab-spin-stats-v1";

export type SpotStat = { seen: number; correct: number };

export type Progress = {
  seen: number;
  correct: number;
  streak: number;
  bestStreak: number;
  byPos: Record<string, SpotStat>;
  bySpot: Record<string, SpotStat>;
  leaks: Array<{ klass: string; spot: string; pick: string; gto: string }>;
};

const EMPTY: Progress = {
  seen: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  byPos: {},
  bySpot: {},
  leaks: [],
};

export function loadProgress(): Progress {
  if (typeof localStorage === "undefined") return { ...EMPTY, byPos: {}, bySpot: {}, leaks: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, byPos: {}, bySpot: {}, leaks: [] };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY, byPos: {}, bySpot: {}, leaks: [] };
  }
}

export function saveProgress(p: Progress): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function recordAnswer(
  p: Progress,
  opts: { pos: string; spot: string; klass: string; pick: string; gto: string; ok: boolean },
): Progress {
  const byPos = { ...p.byPos };
  const bySpot = { ...p.bySpot };
  const bump = (m: Record<string, SpotStat>, k: string) => {
    const cur = m[k] ?? { seen: 0, correct: 0 };
    m[k] = { seen: cur.seen + 1, correct: cur.correct + (opts.ok ? 1 : 0) };
  };
  bump(byPos, opts.pos);
  bump(bySpot, opts.spot);
  const streak = opts.ok ? p.streak + 1 : 0;
  const leaks = opts.ok
    ? p.leaks
    : [{ klass: opts.klass, spot: opts.spot, pick: opts.pick, gto: opts.gto }, ...p.leaks].slice(0, 12);
  const next: Progress = {
    seen: p.seen + 1,
    correct: p.correct + (opts.ok ? 1 : 0),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    byPos,
    bySpot,
    leaks,
  };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress {
  const next = { ...EMPTY, byPos: {}, bySpot: {}, leaks: [] };
  saveProgress(next);
  return next;
}

export function pct(stat: SpotStat | undefined): number {
  if (!stat || stat.seen === 0) return 0;
  return (stat.correct / stat.seen) * 100;
}
