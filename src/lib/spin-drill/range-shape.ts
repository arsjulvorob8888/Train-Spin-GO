import { handAt } from "./legacy-ranges";
import { mixOf, primary, type MixRange } from "./mix";

export type Shape = {
  action: Record<string, string>;
  neighbors: Record<string, string[]>;
  /** How many neighbors play a different primary action. 0 = deep inside one color. */
  diffCount: Record<string, number>;
};

/** One color per hand: the most frequent action. Mixes are collapsed. */
export function buildShape(range: MixRange, paint?: Record<string, string> | null): Shape {
  const action: Record<string, string> = {};
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const h = handAt(r, c);
      action[h] = paint?.[h] ?? primary(mixOf(range, h));
    }
  }
  const neighbors: Record<string, string[]> = {};
  const diffCount: Record<string, number> = {};
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const h = handAt(r, c);
      const ns: string[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr > 12 || cc > 12) continue;
          ns.push(handAt(rr, cc));
        }
      }
      neighbors[h] = ns;
      diffCount[h] = ns.filter((n) => action[n] !== action[h]).length;
    }
  }
  return { action, neighbors, diffCount };
}

/** Open a same-color region. A zero cell also opens its edge, but never another color. */
export function floodSame(shape: Shape, start: string): string[] {
  const color = shape.action[start];
  if (!color) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const h = queue.pop()!;
    if (seen.has(h)) continue;
    seen.add(h);
    if (shape.action[h] !== color) continue;
    out.push(h);
    if (shape.diffCount[h] === 0) {
      for (const n of shape.neighbors[h] ?? []) queue.push(n);
    }
  }
  return out;
}

/** Hands that are not a fold buried in other folds. */
export function studyHands(shape: Shape): string[] {
  const hands: string[] = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const h = handAt(r, c);
      if (shape.action[h] !== "fold" || shape.diffCount[h]! > 0) hands.push(h);
    }
  }
  return hands;
}
