import { handClass, type Card } from "./cards";

export type Position = "UTG" | "MP" | "CO" | "BTN" | "SB" | "BB";

export type ChartAction = "fold" | "open" | "call" | "3bet";

/**
 * Compact 6-max cash opening ranges (~100bb).
 * Suited hands listed as XYs, offsuit XYo, pairs XX.
 * These are training heuristics, not a solver dump.
 */
const OPEN: Record<Exclude<Position, "BB">, string[]> = {
  UTG: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs", "AKo", "AQo",
    "KQs", "KJs", "QJs", "JTs", "T9s", "98s",
  ],
  MP: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
    "AKs", "AQs", "AJs", "ATs", "A9s", "AKo", "AQo", "AJo",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s",
  ],
  CO: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s",
    "AKo", "AQo", "AJo", "ATo",
    "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "J9s",
    "T9s", "T8s", "98s", "87s", "76s", "65s", "KQo",
  ],
  BTN: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "AKo", "AQo", "AJo", "ATo", "A9o",
    "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s",
    "T8s", "98s", "97s", "87s", "76s", "65s", "54s",
    "KQo", "KJo", "QJo",
  ],
  SB: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s",
    "AKo", "AQo", "AJo", "ATo",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s",
    "KQo",
  ],
};

const THREE_BET = new Set([
  "AA", "KK", "QQ", "JJ", "AKs", "AKo", "AQs",
]);

const BB_DEFEND = new Set([
  ...OPEN.BTN,
  "K7s", "K6s", "Q8s", "J8s", "T7s", "96s", "86s", "75s", "64s", "53s",
  "A8o", "KTo", "QTo", "JTo", "K9o", "Q9o",
]);

export const RANK_ORDER = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

export function chartGrid(): string[][] {
  return RANK_ORDER.map((row, i) =>
    RANK_ORDER.map((col, j) => {
      if (i === j) return `${row}${col}`;
      if (i < j) return `${row}${col}s`;
      return `${col}${row}o`;
    }),
  );
}

export function inList(hand: string, list: string[]): boolean {
  return list.includes(hand);
}

export function preflopChartAction(
  hole: [Card, Card],
  position: Position,
  facingRaise: boolean,
  inBlinds: boolean,
): ChartAction {
  const klass = handClass(hole[0], hole[1]);
  if (facingRaise) {
    if (THREE_BET.has(klass)) return "3bet";
    if (position === "BB" && BB_DEFEND.has(klass)) return "call";
    if (position === "BTN" && inList(klass, OPEN.CO)) return "call";
    return "fold";
  }
  if (position === "BB") {
    return inBlinds ? "call" : "fold";
  }
  const range = OPEN[position];
  return inList(klass, range) ? "open" : "fold";
}

export function isInOpenRange(klass: string, position: Position): boolean {
  if (position === "BB") return BB_DEFEND.has(klass);
  return inList(klass, OPEN[position]);
}

export function cellKind(hand: string): "pair" | "suited" | "offsuit" {
  if (hand.length === 2) return "pair";
  return hand.endsWith("s") ? "suited" : "offsuit";
}
