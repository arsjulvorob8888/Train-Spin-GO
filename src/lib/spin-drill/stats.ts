const KEY = "spin-drill-stats-v3";

export type HandStat = { total: number; correct: number };
export type SpotStat = { overall: HandStat; hands: Record<string, HandStat> };
export type Store = { spots: Record<string, SpotStat> };

function emptySpot(): SpotStat {
  return { overall: { total: 0, correct: 0 }, hands: {} };
}

export function loadStore(): Store {
  if (typeof localStorage === "undefined") return { spots: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.spots) return raw;
  } catch {
    /* ignore */
  }
  return { spots: {} };
}

export function saveStore(s: Store): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function record(store: Store, spotId: string, hand: string, ok: boolean): Store {
  const spots = { ...store.spots };
  const cur = spots[spotId] ?? emptySpot();
  const hands = { ...cur.hands };
  const h = hands[hand] ?? { total: 0, correct: 0 };
  hands[hand] = { total: h.total + 1, correct: h.correct + (ok ? 1 : 0) };
  spots[spotId] = {
    overall: { total: cur.overall.total + 1, correct: cur.overall.correct + (ok ? 1 : 0) },
    hands,
  };
  const next = { spots };
  saveStore(next);
  return next;
}

export function resetSpot(store: Store, spotId: string): Store {
  const next = { spots: { ...store.spots, [spotId]: emptySpot() } };
  saveStore(next);
  return next;
}

export function spotStat(store: Store, spotId: string): SpotStat {
  return store.spots[spotId] ?? emptySpot();
}
