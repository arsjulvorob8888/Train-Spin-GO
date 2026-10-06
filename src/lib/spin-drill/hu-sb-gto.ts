import { ALL } from "./legacy-ranges";
import { emptyMix, type MixAction, type MixRange } from "./mix";

/**
 * Heads-up SB open, Spin & Go, read off GTOBase (HU, one player, pot 1.5).
 * Cell color is the main action on that chart. Limp is call. Min-raise and 2.5x are both raise.
 * Depths on the slider snap to the nearest pictured stack: 5, 7, 9, 11, 13, 16, 20, 22, 25, 30.
 */
const DEPTHS = [5, 7, 9, 11, 13, 16, 20, 22, 25, 30] as const;

const FOLD5 = offs(
  "32 42 52 62 72 82 92 T2 J2 Q2 K2 43 53 63 73 83 93 T3 J3 Q3 54 64 74 84 94 65 75 85 95 76 A6 K6",
);
const FOLD7 = offs("32 42 52 62 72 82 92 T2 J2 Q2 K2 43 53 63 73 83 93 T3 J3 Q3 54 64 74 84 94 65 75 76");
const FOLD9 = offs("32 42 52 62 72 82 92 T2 J2 Q2 K2 43 53 63 73 83 93 54");
const FOLD11 = offs("32 42 52 62 72 82 92 43 53 63");
const FOLD13 = ["44", ...offs("32 42 52 62 72")];
const FOLD16 = FOLD13;
const FOLD20 = offs("32 42 52 62 72 82");
const FOLD22 = FOLD20;
const FOLD25 = ["22", ...offs("32 42 52 62 72 82")];
const FOLD30 = offs("32 42 52 62 72 82 92 83");

const BROAD = offs("AK AQ AJ AT KQ KJ KT QJ QT JT");
const SUITED_TOP = suited("A K Q J T");
const CONNECTORS = ["98s", "87s", "76s", "65s", "54s"];

export function huSbAt(bb: number): MixRange {
  const depth = nearest(bb);
  return CHARTS[depth]!;
}

export function huSbDepth(bb: number): number {
  return nearest(bb);
}

const CHARTS: Record<number, MixRange> = {
  5: chart({ jam: except(ALL, FOLD5) }),
  7: chart({
    fold: FOLD7,
    limp: [...suited("Q J T 9 8 7 6 5 4 3 2"), ...suitedKick("A", "8765432"), "98o", "J9o", "T9o", "QTo", "JTo"],
    jam: ["rest"],
  }),
  9: chart({
    fold: FOLD9,
    jam: [...pairs(), ...SUITED_TOP, ...CONNECTORS, ...suited("9"), ...BROAD],
    limp: ["rest"],
  }),
  11: chart({
    fold: FOLD11,
    jam: [...pairs(), ...suited("A"), "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "J9s", "T9s", "98s", "76s", "AKo", "AQo", "AJo", "ATo", "KQo"],
    limp: ["rest"],
  }),
  13: chart({
    fold: FOLD13,
    jam: ["22", "33"],
    raise: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "ATs", "AKo"],
    limp: ["rest"],
  }),
  16: chart({
    fold: FOLD16,
    jam: ["AA", "KK", "QQ", "22", "33"],
    raise: [
      ...pairs().filter((h) => !["AA", "KK", "QQ", "22", "33", "44"].includes(h)),
      ...suited("A K Q"),
      "JTs",
      "J9s",
      "T9s",
      "98s",
      ...BROAD,
    ],
    limp: ["rest"],
  }),
  20: chart({
    fold: FOLD20,
    raise: [...pairs(), ...allSuited(), "AKo", "AQo", "AJo"],
    limp: ["rest"],
  }),
  22: chart({
    fold: FOLD22,
    raise: [...pairs(), ...allSuited(), ...BROAD.slice(0, 8)],
    limp: ["rest"],
  }),
  25: chart({
    fold: FOLD25,
    raise: [...pairs().filter((h) => h !== "22"), ...allSuited(), ...offs("AK AQ AJ AT A9 A8 A7 A6 A5 KQ KJ KT QJ QT JT T9 98")],
    limp: ["rest"],
  }),
  30: chart({
    fold: FOLD30,
    raise: [...pairs(), ...allSuited(), ...offs("AK AQ AJ AT A9 A8 A7 A6 A5 A4 KQ KJ KT K9 QJ QT Q9 JT J9 T9 T8 98")],
    limp: ["rest"],
  }),
};

function chart(layers: { fold?: string[]; limp?: string[]; raise?: string[]; jam?: string[] }): MixRange {
  const actionOf = new Map<string, MixAction>();
  paint(actionOf, layers.fold ?? [], "fold");
  paint(actionOf, layers.limp ?? [], "call");
  paint(actionOf, layers.raise ?? [], "raise");
  paint(actionOf, layers.jam ?? [], "allin");
  if (layers.jam?.includes("rest") || layers.limp?.includes("rest") || layers.raise?.includes("rest")) {
    const rest = (layers.jam?.includes("rest") && "allin") || (layers.raise?.includes("rest") && "raise") || "call";
    for (const hand of ALL) if (!actionOf.has(hand)) actionOf.set(hand, rest);
  }
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    mix[actionOf.get(hand) ?? "fold"] = 100;
    out[hand] = mix;
  }
  return out;
}

function paint(into: Map<string, MixAction>, hands: string[], action: MixAction) {
  for (const hand of hands) {
    if (hand === "rest") continue;
    into.set(hand, action);
  }
}

function nearest(bb: number): number {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  return DEPTHS.reduce((best, item) => (Math.abs(item - depth) < Math.abs(best - depth) ? item : best));
}

function pairs(): string[] {
  return ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22"];
}

function allSuited(): string[] {
  return ALL.filter((hand) => hand.endsWith("s"));
}

function suited(highRanks: string): string[] {
  const ranks = "AKQJT98765432";
  const out: string[] = [];
  for (const high of highRanks.split(" ")) {
    for (const low of ranks) {
      if (low === high) continue;
      if (ranks.indexOf(high) < ranks.indexOf(low)) out.push(high + low + "s");
    }
  }
  return out;
}

function suitedKick(high: string, lows: string): string[] {
  return [...lows].filter((low) => low !== high).map((low) => high + low + "s");
}

function offs(spec: string): string[] {
  return spec.split(" ").map((hand) => (hand.length === 2 ? hand + "o" : hand));
}

function except(hands: string[], drop: string[]): string[] {
  const gone = new Set(drop);
  return hands.filter((hand) => !gone.has(hand));
}
