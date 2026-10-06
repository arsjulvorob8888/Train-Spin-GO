import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** BB calling an SB all-in. One color: call or fold, the bigger share on the GTOBase chart. */
const DEPTHS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25, 30];

const CALLS: Record<number, string[]> = {
  5: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "94s", "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "84s", "A7o", "K7o", "Q7o", "J7o", "T7o", "97o", "87o", "77", "76s", "75s", "74s", "A6o", "K6o", "Q6o", "J6o", "T6o", "96o", "86o", "76o", "66", "65s", "64s", "63s", "A5o", "75o", "65o", "55", "54s", "53s", "A4o", "54o", "44", "43s", "A3o", "33", "22"],
  6: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "A7o", "K7o", "Q7o", "J7o", "T7o", "97o", "87o", "77", "76s", "75s", "A6o", "86o", "76o", "66", "65s", "64s", "A5o", "65o", "55", "54s", "A4o", "54o", "44", "A3o", "33", "22"],
  7: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "A7o", "K7o", "Q7o", "87o", "77", "76s", "75s", "A6o", "76o", "66", "65s", "64s", "A5o", "55", "54s", "A4o", "44", "A3o", "33", "22"],
  8: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "A7o", "87o", "77", "76s", "75s", "A6o", "66", "65s", "64s", "A5o", "55", "54s", "A4o", "44", "A3o", "33", "22"],
  9: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "A8o", "T8o", "98o", "88", "87s", "86s", "A7o", "77", "76s", "75s", "A6o", "66", "65s", "A5o", "55", "54s", "A4o", "44", "A3o", "33", "22"],
  10: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "A9o", "T9o", "99", "98s", "97s", "96s", "A8o", "98o", "88", "87s", "86s", "A7o", "77", "76s", "A6o", "66", "65s", "A5o", "55", "54s", "A4o", "44", "A3o", "33", "22"],
  11: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "A9o", "T9o", "99", "98s", "97s", "A8o", "98o", "88", "87s", "86s", "A7o", "77", "76s", "66", "65s", "A5o", "55", "A4o", "44", "33", "22"],
  12: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "87s", "A7o", "77", "76s", "66", "65s", "55", "44", "33", "22"],
  13: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "87s", "A7o", "77", "66", "55", "44", "33", "22"],
  14: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "AKo", "KK", "KQs", "KJs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "87s", "A7o", "77", "66", "55", "44", "33", "22"],
  16: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "AKo", "KK", "KQs", "KJs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "77", "66", "55", "44", "33", "22"],
  18: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "AKo", "KK", "KQs", "KJs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "87s", "A7o", "77", "66", "55", "44", "33", "22"],
  20: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "AKo", "KK", "KQs", "KJs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "87s", "A7o", "77", "66", "55", "44", "33", "22"],
  22: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "AKo", "KK", "KQs", "KJs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "A9o", "T9o", "99", "98s", "A8o", "98o", "88", "77", "66", "55", "44", "33", "22"],
  25: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "AKo", "KK", "KQs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "A9o", "T9o", "99", "98o", "88", "77", "66", "55", "44", "33", "22"],
  30: ["AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "AKo", "KK", "KQs", "KTs", "K6s", "K5s", "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "AJo", "KJo", "QJo", "JJ", "JTs", "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T9o", "99", "98o", "88", "77", "66", "55", "44", "33", "22"],
};

function nearest(bb: number): number {
  let best = DEPTHS[0]!;
  for (const key of DEPTHS) {
    const gap = Math.abs(key - bb);
    const bestGap = Math.abs(best - bb);
    if (gap < bestGap || (gap === bestGap && key > best)) best = key;
  }
  return best;
}

export function huBbJamRange(bb: number): MixRange {
  const calls = new Set(CALLS[nearest(Math.max(1, Math.min(30, Math.round(bb))))]!);
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    if (calls.has(hand)) mix.call = 100;
    else mix.fold = 100;
    out[hand] = mix;
  }
  return out;
}
