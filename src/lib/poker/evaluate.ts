import {
  RANK_NAMES,
  RANK_PLURAL,
  type Card,
} from "./cards";

export const CATEGORY = {
  HIGH: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

const COMBOS: Record<number, number[][]> = {
  5: [[0, 1, 2, 3, 4]],
  6: [
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 5],
    [0, 1, 2, 4, 5],
    [0, 1, 3, 4, 5],
    [0, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
  ],
  7: [
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 5],
    [0, 1, 2, 3, 6],
    [0, 1, 2, 4, 5],
    [0, 1, 2, 4, 6],
    [0, 1, 2, 5, 6],
    [0, 1, 3, 4, 5],
    [0, 1, 3, 4, 6],
    [0, 1, 3, 5, 6],
    [0, 1, 4, 5, 6],
    [0, 2, 3, 4, 5],
    [0, 2, 3, 4, 6],
    [0, 2, 3, 5, 6],
    [0, 2, 4, 5, 6],
    [0, 3, 4, 5, 6],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 6],
    [1, 2, 3, 5, 6],
    [1, 2, 4, 5, 6],
    [1, 3, 4, 5, 6],
    [2, 3, 4, 5, 6],
  ],
};

function pack(category: number, values: number[]): number {
  const padded = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0, values[4] ?? 0];
  return (
    ((((category * 13 + padded[0]) * 13 + padded[1]) * 13 + padded[2]) * 13 + padded[3]) * 13 +
    padded[4]
  );
}

export function unpack(score: number): { category: number; values: number[] } {
  const v4 = score % 13;
  const v3 = Math.floor(score / 13) % 13;
  const v2 = Math.floor(score / 169) % 13;
  const v1 = Math.floor(score / 2197) % 13;
  const v0 = Math.floor(score / 28561) % 13;
  const category = Math.floor(score / 371293);
  return { category, values: [v0, v1, v2, v3, v4] };
}

export function evaluate5(cards: Card[]): number {
  const ranks = [cards[0]!.rank, cards[1]!.rank, cards[2]!.rank, cards[3]!.rank, cards[4]!.rank];
  const suits = [cards[0]!.suit, cards[1]!.suit, cards[2]!.suit, cards[3]!.suit, cards[4]!.suit];
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const r of ranks) counts[r]! += 1;

  const flush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];
  const unique = [...new Set(ranks)].sort((a, b) => b - a);

  let straightHigh = -1;
  if (unique.length === 5) {
    if (unique[0]! - unique[4]! === 4) straightHigh = unique[0]!;
    else if (
      unique[0] === 12 &&
      unique[1] === 3 &&
      unique[2] === 2 &&
      unique[3] === 1 &&
      unique[4] === 0
    ) {
      straightHigh = 3;
    }
  }

  if (flush && straightHigh >= 0) {
    return pack(CATEGORY.STRAIGHT_FLUSH, [straightHigh]);
  }

  let quads = -1;
  let trips = -1;
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]!;
    if (n === 4) quads = r;
    else if (n === 3) trips = r;
    else if (n === 2) pairs.push(r);
    else if (n === 1) singles.push(r);
  }

  if (quads >= 0) {
    return pack(CATEGORY.QUADS, [quads, singles[0] ?? 0]);
  }
  if (trips >= 0 && pairs.length > 0) {
    return pack(CATEGORY.FULL_HOUSE, [trips, pairs[0]!]);
  }
  if (flush) {
    const sorted = ranks.slice().sort((a, b) => b - a);
    return pack(CATEGORY.FLUSH, sorted);
  }
  if (straightHigh >= 0) {
    return pack(CATEGORY.STRAIGHT, [straightHigh]);
  }
  if (trips >= 0) {
    return pack(CATEGORY.TRIPS, [trips, singles[0] ?? 0, singles[1] ?? 0]);
  }
  if (pairs.length >= 2) {
    return pack(CATEGORY.TWO_PAIR, [pairs[0]!, pairs[1]!, singles[0] ?? 0]);
  }
  if (pairs.length === 1) {
    return pack(CATEGORY.PAIR, [pairs[0]!, singles[0] ?? 0, singles[1] ?? 0, singles[2] ?? 0]);
  }
  return pack(CATEGORY.HIGH, unique);
}

export type EvaluatedHand = {
  score: number;
  category: number;
  name: string;
};

export function describeScore(score: number): string {
  const { category, values } = unpack(score);
  const r0 = values[0] ?? 0;
  const r1 = values[1] ?? 0;
  switch (category) {
    case CATEGORY.STRAIGHT_FLUSH:
      return r0 === 12 ? "Royal flush" : `Straight flush, ${RANK_NAMES[r0]} high`;
    case CATEGORY.QUADS:
      return `Four of a kind, ${RANK_PLURAL[r0]}`;
    case CATEGORY.FULL_HOUSE:
      return `Full house, ${RANK_PLURAL[r0]} full of ${RANK_PLURAL[r1]}`;
    case CATEGORY.FLUSH:
      return `Flush, ${RANK_NAMES[r0]} high`;
    case CATEGORY.STRAIGHT:
      return `Straight, ${RANK_NAMES[r0]} high`;
    case CATEGORY.TRIPS:
      return `Three of a kind, ${RANK_PLURAL[r0]}`;
    case CATEGORY.TWO_PAIR:
      return `Two pair, ${RANK_PLURAL[r0]} and ${RANK_PLURAL[r1]}`;
    case CATEGORY.PAIR:
      return `Pair of ${RANK_PLURAL[r0]}`;
    default:
      return `${RANK_NAMES[r0]} high`;
  }
}

export function evaluateBest(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    return { score: 0, category: 0, name: "—" };
  }
  const n = Math.min(cards.length, 7);
  const combos = COMBOS[n] ?? COMBOS[7]!;
  let best = -1;
  const slice = cards.slice(0, n);
  for (const idx of combos) {
    const five: Card[] = [
      slice[idx[0]!]!,
      slice[idx[1]!]!,
      slice[idx[2]!]!,
      slice[idx[3]!]!,
      slice[idx[4]!]!,
    ];
    const score = evaluate5(five);
    if (score > best) best = score;
  }
  return {
    score: best,
    category: unpack(best).category,
    name: describeScore(best),
  };
}

export type DrawInfo = {
  flushDraw: boolean;
  oesd: boolean;
  gutshot: boolean;
  overcards: number;
};

export function analyzeDraws(hero: Card[], board: Card[]): DrawInfo {
  const all = [...hero, ...board];
  const suitCounts = [0, 0, 0, 0];
  for (const c of all) suitCounts[c.suit]! += 1;
  const flushDraw = board.length >= 3 && suitCounts.some((n) => n === 4);

  const ranks = [...new Set(all.map((c) => c.rank))].sort((a, b) => a - b);
  let oesd = false;
  let gutshot = false;
  if (board.length >= 3 && ranks.length >= 4) {
    for (let i = 0; i < ranks.length; i++) {
      const window: number[] = [];
      for (let j = i; j < ranks.length && ranks[j]! - ranks[i]! <= 4; j++) {
        window.push(ranks[j]!);
      }
      const span = window[window.length - 1]! - window[0]!;
      if (window.length === 4 && span === 3) oesd = true;
      else if (window.length === 4 && span === 4) gutshot = true;
    }
    const hasA = ranks.includes(12);
    const lows = ranks.filter((r) => r <= 3);
    if (hasA && lows.length >= 3) gutshot = true;
  }

  const boardMax = board.length ? Math.max(...board.map((c) => c.rank)) : -1;
  const overcards = hero.filter((c) => c.rank > boardMax).length;

  return { flushDraw, oesd, gutshot, overcards };
}
