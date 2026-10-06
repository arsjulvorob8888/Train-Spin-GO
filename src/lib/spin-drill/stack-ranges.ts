import { huSbAt } from "./hu-sb-gto";
import { huBbLimpRange } from "./hu-bb-limp";
import { huBbRaiseRange } from "./hu-bb-raise";
import { ALL, handAt } from "./legacy-ranges";
import { emptyMix, mixOf, primary, type MixAction, type MixRange } from "./mix";

const ORDER = "AKQJT98765432";

function rankIndex(card: string): number {
  return ORDER.indexOf(card);
}

function isPair(hand: string): boolean {
  return hand.length === 2;
}

function isSuited(hand: string): boolean {
  return hand.endsWith("s");
}

/** Higher = stronger hand. Used only to grow and shrink a range smoothly. */
export function handPower(hand: string): number {
  const hi = 14 - rankIndex(hand[0]!);
  const lo = 14 - rankIndex(hand[1]!);
  if (isPair(hand)) return 200 + hi * 10;
  let score = hi * 8 + lo;
  if (isSuited(hand)) score += 14;
  const gap = rankIndex(hand[1]!) - rankIndex(hand[0]!) - 1;
  if (gap === 0) score += 8;
  else if (gap === 1) score += 4;
  if (hi === 14) score += 10;
  return score;
}

function isPremium(hand: string): boolean {
  if (isPair(hand) && rankIndex(hand[0]!) <= rankIndex("T")) return true;
  return hand === "AKs" || hand === "AKo" || hand === "AQs" || hand === "AQo";
}

function lerp(bb: number, points: [number, number][]): number {
  if (bb <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (bb >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i]!;
    const right = points[i + 1]!;
    if (bb >= left[0] && bb <= right[0]) {
      const t = (bb - left[0]) / (right[0] - left[0]);
      return left[1] + (right[1] - left[1]) * t;
    }
  }
  return last[1];
}

function suitedFrom(hi: string, lo: string): string[] {
  const start = rankIndex(hi) + 1;
  const end = rankIndex(lo);
  const out: string[] = [];
  for (let i = start; i <= end; i++) out.push(`${hi}${ORDER[i]}s`);
  return out;
}

function offsuitFrom(hi: string, lo: string): string[] {
  const start = rankIndex(hi) + 1;
  const end = rankIndex(lo);
  const out: string[] = [];
  for (let i = start; i <= end; i++) out.push(`${hi}${ORDER[i]}o`);
  return out;
}

function pairsFrom(low: string): string[] {
  const end = rankIndex(low);
  const out: string[] = [];
  for (let i = 0; i <= end; i++) out.push(`${ORDER[i]}${ORDER[i]}`);
  return out;
}

/** 25bb BTN min-raise core, from published 3-max descriptions (GTO Gecko / PokerStars Learn). */
const BTN_DEEP = new Set<string>([
  ...pairsFrom("2"),
  ...suitedFrom("A", "2"),
  ...suitedFrom("K", "4"),
  ...suitedFrom("Q", "6"),
  ...suitedFrom("J", "7"),
  ...suitedFrom("T", "7"),
  ...suitedFrom("9", "7"),
  ...suitedFrom("8", "6"),
  ...suitedFrom("7", "5"),
  "65s",
  ...offsuitFrom("A", "8"),
  ...offsuitFrom("K", "8"),
  ...offsuitFrom("Q", "9"),
  ...offsuitFrom("J", "9"),
  "T9o",
]);

function paint(hands: string[], action: MixAction, into: MixRange) {
  for (const hand of hands) {
    const mix = emptyMix();
    mix[action] = 100;
    into[hand] = mix;
  }
}

function blank(): MixRange {
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    mix.fold = 100;
    out[hand] = mix;
  }
  return out;
}

function topHands(score: (hand: string) => number, count: number): string[] {
  return [...ALL].sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, Math.min(169, count)));
}

function playFraction(bb: number): number {
  return lerp(bb, [
    [1, 0.96],
    [5, 0.7],
    [7, 0.52],
    [10, 0.38],
    [12, 0.42],
    [20, 0.42],
    [25, 0.4],
    [30, 0.36],
  ]);
}

function jamFraction(bb: number): number {
  return lerp(bb, [
    [1, 1],
    [8, 1],
    [10, 0.88],
    [12, 0.5],
    [18, 0.14],
    [22, 0.05],
    [25, 0],
    [30, 0],
  ]);
}

function jamBias(hand: string, bb: number): number {
  if (bb >= 20) return isPremium(hand) ? 400 + handPower(hand) : handPower(hand) - 200;
  if (isPremium(hand)) return 350 + handPower(hand);
  if (isPair(hand) || (isSuited(hand) && hand.startsWith("A"))) return 250;
  if (isSuited(hand) && rankIndex(hand[1]!) - rankIndex(hand[0]!) === 1) return 220;
  return handPower(hand);
}

function openRange(base: MixRange, bb: number, limp: boolean): MixRange {
  const out = blank();
  const count = Math.round(169 * playFraction(bb));
  const selected = topHands((hand) => {
    const known = primary(mixOf(base, hand)) !== "fold" ? 800 : 0;
    const deep = BTN_DEEP.has(hand) ? 200 : 0;
    return known + deep + handPower(hand);
  }, count);
  const jamCount = Math.round(selected.length * jamFraction(bb));
  const jams = new Set([...selected].sort((a, b) => jamBias(b, bb) - jamBias(a, bb)).slice(0, jamCount));
  const rest = selected.filter((hand) => !jams.has(hand));
  paint([...jams], "allin", out);
  if (!limp || bb < 14) {
    paint(rest, "raise", out);
    return out;
  }
  const raises = [...rest].sort((a, b) => handPower(b) - handPower(a));
  const raiseCount = Math.max(1, Math.round(raises.length * 0.45));
  paint(raises.slice(0, raiseCount), "raise", out);
  paint(raises.slice(raiseCount), "call", out);
  return out;
}

function callRange(base: MixRange, bb: number): MixRange {
  const called = ALL.filter((hand) => primary(mixOf(base, hand)) === "call");
  const scale = lerp(bb, [
    [1, 2.1],
    [5, 1.55],
    [7, 1.35],
    [10, 1.15],
    [20, 0.82],
    [25, 0.68],
    [30, 0.55],
  ]);
  const count = Math.round(Math.min(169, Math.max(1, called.length * scale)));
  const picked = topHands((hand) => {
    const known = primary(mixOf(base, hand)) === "call" ? 800 : 0;
    return known + handPower(hand);
  }, count);
  const out = blank();
  paint(picked, "call", out);
  return out;
}

function shiftRange(base: MixRange, bb: number): MixRange {
  const out = blank();
  for (const hand of ALL) {
    let action = primary(mixOf(base, hand));
    if (bb < 15) {
      if (action === "raise") action = "allin";
      if (action === "fold" && bb <= 8 && handPower(hand) >= 90 + bb * 3) action = "allin";
      if (action === "call" && bb <= 8 && isPremium(hand)) action = "allin";
    } else if (action === "allin" && (!isPremium(hand) || bb >= 26)) {
      action = "raise";
    }
    const mix = emptyMix();
    mix[action] = 100;
    out[hand] = mix;
  }
  return out;
}

export function stackNote(bb: number): string {
  if (bb <= 6) return "Пуш или фолд. Минрейза почти нет: стек слишком мал, чтобы видеть флоп.";
  if (bb <= 10) return "Пуш — главное действие. Рейз остаётся только у самых сильных рук.";
  if (bb === 15) return "Это ваш точный чарт. Рейз и пуш вместе: пуш — пары, тузы и руки, которые плохо играются на флопе.";
  if (bb <= 15) return "Рейз и пуш вместе. Пуш — пары, тузы и руки, которые плохо играются на флопе.";
  if (bb <= 25) return "Почти всё играбельное открывается рейзом. Пуш только премиум.";
  return "Глубже 25bb пуш с баттона почти пропадает. Открытие — минрейз, чуть аккуратнее.";
}

/**
 * 15bb is the app chart, unchanged.
 * Other depths are a study model: the same hands breathe with stack size,
 * anchored to published 3-max breakpoints (push/fold under ~7bb, min-raise from ~16bb).
 */
export function rangeAtStack(base: MixRange, spotId: string, bb: number): MixRange {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  if (spotId === "hu_sb") return huSbAt(depth);
  if (spotId === "hu_bb_limp") {
    const sized = huBbLimpRange(depth);
    if (sized) return sized;
  }
  if (spotId === "hu_bb_raise") return huBbRaiseRange(depth);
  if (depth === 15) return base;
  if (spotId === "btn") return openRange(base, depth, false);
  if (spotId === "sb_fold") return openRange(base, depth, true);
  if (spotId.includes("jam") || spotId === "sb_push") return callRange(base, depth);
  return shiftRange(base, depth);
}

export function cellDistance(a: string, b: string): number {
  const pa = pos(a);
  const pb = pos(b);
  return Math.max(Math.abs(pa.r - pb.r), Math.abs(pa.c - pb.c));
}

const POS: Record<string, { r: number; c: number }> = {};
for (let r = 0; r < 13; r++) {
  for (let c = 0; c < 13; c++) POS[handAt(r, c)] = { r, c };
}

function pos(hand: string): { r: number; c: number } {
  return POS[hand] ?? { r: 0, c: 0 };
}

export function nearestOpen(origin: string, open: string[], count: number): string[] {
  return [...open].sort((a, b) => cellDistance(origin, a) - cellDistance(origin, b) || handPower(b) - handPower(a)).slice(0, count);
}
