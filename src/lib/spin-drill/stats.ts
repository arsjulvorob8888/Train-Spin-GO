const KEY = "spin-drill-stats-v3";

export type Grade = "correct" | "mix" | "wrong";

export type HandStat = {
  total: number;
  correct: number;
  /** Consecutive pure-correct answers. */
  streak: number;
  /** SM-2-style ease. Higher = longer gaps after a correct answer. */
  ease: number;
  /** Other hands to deal before this one is due again. */
  interval: number;
  /** Global rep count when this hand should return. */
  due: number;
};

export type SpotStat = { overall: HandStatLite; hands: Record<string, HandStat> };
export type HandStatLite = { total: number; correct: number };
export type Store = { spots: Record<string, SpotStat>; reps: number };

const EASE_MIN = 1.3;
const EASE_MAX = 2.8;

function emptySpot(): SpotStat {
  return { overall: { total: 0, correct: 0 }, hands: {} };
}

function emptyStore(): Store {
  return { spots: {}, reps: 0 };
}

/** Old saves only had total/correct. Errors become due immediately. */
export function normalizeHand(raw: Partial<HandStat> | undefined, reps: number): HandStat | null {
  if (!raw?.total) return null;
  const correct = raw.correct ?? 0;
  if (typeof raw.due === "number") {
    return {
      total: raw.total,
      correct,
      streak: raw.streak ?? 0,
      ease: raw.ease ?? 2.5,
      interval: raw.interval ?? 0,
      due: raw.due,
    };
  }
  const misses = raw.total - correct;
  if (misses > 0) {
    return { total: raw.total, correct, streak: 0, ease: 2.3, interval: 2, due: reps };
  }
  return { total: raw.total, correct, streak: correct, ease: 2.5, interval: 8, due: reps + 12 };
}

export function loadStore(): Store {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.spots) return { spots: raw.spots, reps: raw.reps ?? 0 };
  } catch {
    /* ignore */
  }
  return emptyStore();
}

export function saveStore(s: Store): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

function schedule(prev: HandStat | null, grade: Grade, reps: number): HandStat {
  const base = prev ?? { total: 0, correct: 0, streak: 0, ease: 2.5, interval: 0, due: 0 };
  const total = base.total + 1;
  const correct = base.correct + (grade === "wrong" ? 0 : 1);
  let ease = base.ease || 2.5;
  let streak = base.streak || 0;
  let interval = base.interval || 0;

  if (grade === "wrong") {
    streak = 0;
    ease = Math.max(EASE_MIN, ease - 0.15);
    interval = 2;
  } else if (grade === "mix") {
    streak = 0;
    interval = 3;
  } else {
    streak += 1;
    ease = Math.min(EASE_MAX, ease + 0.05);
    interval =
      streak === 1 ? 5 : Math.min(40, Math.max(interval + 1, Math.round((interval || 4) * ease)));
  }

  return { total, correct, streak, ease, interval, due: reps + interval };
}

export function record(store: Store, spotId: string, hand: string, grade: Grade): Store {
  const reps = (store.reps ?? 0) + 1;
  const spots = { ...store.spots };
  const cur = spots[spotId] ?? emptySpot();
  const hands = { ...cur.hands };
  const prev = normalizeHand(hands[hand], store.reps ?? 0);
  hands[hand] = schedule(prev, grade, reps);
  const ok = grade !== "wrong";
  spots[spotId] = {
    overall: {
      total: cur.overall.total + 1,
      correct: cur.overall.correct + (ok ? 1 : 0),
    },
    hands,
  };
  const next = { spots, reps };
  saveStore(next);
  return next;
}

export function resetSpot(store: Store, spotId: string): Store {
  const next = { spots: { ...store.spots, [spotId]: emptySpot() }, reps: store.reps ?? 0 };
  saveStore(next);
  return next;
}

export function spotStat(store: Store, spotId: string): SpotStat {
  return store.spots[spotId] ?? emptySpot();
}

export function isDue(stat: SpotStat, hand: string, reps: number): boolean {
  const rec = normalizeHand(stat.hands[hand], reps);
  return !!rec && rec.due <= reps;
}

function weightedPick(hands: string[], weight: (h: string) => number, avoid?: string): string {
  const filtered = hands.length > 1 && avoid ? hands.filter((h) => h !== avoid) : hands;
  const use = filtered.length ? filtered : hands;
  const weights = use.map((h) => Math.max(0.05, weight(h)));
  let t = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < use.length; i++) {
    t -= weights[i]!;
    if (t <= 0) return use[i]!;
  }
  return use[use.length - 1]!;
}

/** Prefer due leaks, then unseen hands, then the weakest of the rest. */
export function chooseHand(
  pool: string[],
  stat: SpotStat,
  reps: number,
  avoid?: string,
): { hand: string; review: boolean } {
  if (!pool.length) return { hand: "AA", review: false };
  const weakness = (h: string) => {
    const rec = normalizeHand(stat.hands[h], reps);
    if (!rec) return 1;
    const misses = rec.total - rec.correct;
    const acc = rec.correct / rec.total;
    const overdue = Math.max(0, reps - rec.due);
    return 1 + misses * 5 + (1 - acc) * 4 + overdue * 0.2;
  };
  const due = pool.filter((h) => isDue(stat, h, reps));
  const fresh = pool.filter((h) => !normalizeHand(stat.hands[h], reps));
  const hadMiss = (h: string) => {
    const rec = normalizeHand(stat.hands[h], reps);
    return !!rec && rec.correct < rec.total;
  };

  if (due.length && (fresh.length === 0 || Math.random() < 0.82)) {
    const hand = weightedPick(due, weakness, avoid);
    return { hand, review: hadMiss(hand) };
  }
  if (fresh.length) return { hand: weightedPick(fresh, () => 1, avoid), review: false };
  const hand = weightedPick(pool, weakness, avoid);
  return { hand, review: hadMiss(hand) };
}

export function dueInPool(stat: SpotStat, pool: string[], reps: number): number {
  return pool.filter((h) => isDue(stat, h, reps)).length;
}

export function leakHands(
  stat: SpotStat,
  limit = 6,
): { hand: string; total: number; correct: number }[] {
  return Object.entries(stat.hands)
    .filter(([, rec]) => rec.total > 0 && rec.correct < rec.total)
    .sort((a, b) => {
      const ma = a[1].total - a[1].correct;
      const mb = b[1].total - b[1].correct;
      if (mb !== ma) return mb - ma;
      return a[1].correct / a[1].total - b[1].correct / b[1].total;
    })
    .slice(0, limit)
    .map(([hand, rec]) => ({ hand, total: rec.total, correct: rec.correct }));
}
