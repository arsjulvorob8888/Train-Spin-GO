import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** SB facing a BTN open to 2bb. One color: the biggest slice on the GTOBase chart. */
const DEPTHS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25];

const KNOWN: Record<number, Record<string, "f" | "c" | "r" | "ai">> = {
  8: {"AA":"ai","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","AJo":"ai","KJo":"ai","JJ":"ai","ATo":"ai","KTo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","A7o":"ai","77":"ai","A6o":"ai","66":"ai","A5o":"ai","55":"ai","44":"ai"},
  9: {"AA":"ai","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","AJo":"ai","KJo":"ai","JJ":"ai","ATo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","A7o":"ai","77":"ai","66":"ai","A5o":"ai","55":"ai","A4o":"ai","A3o":"ai"},
  10: {"AA":"ai","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","AJo":"ai","KJo":"ai","JJ":"ai","JTs":"ai","ATo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","A7o":"ai","77":"ai","66":"ai","A5o":"ai","55":"ai","A4o":"ai","44":"ai"},
  11: {"AA":"ai","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","AJo":"ai","KJo":"ai","QJo":"ai","JJ":"ai","JTs":"ai","ATo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","A7o":"ai","77":"ai","66":"ai","A5o":"ai","55":"ai","A4o":"ai","44":"ai","33":"ai"},
  12: {"AA":"r","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"ai","QJo":"ai","JJ":"ai","JTs":"ai","ATo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","77":"ai","66":"ai","A5o":"ai","55":"ai","44":"ai","33":"ai"},
  13: {"AA":"ai","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"ai","QJo":"ai","JJ":"ai","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  14: {"AA":"r","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"ai","JJ":"ai","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","A9o":"ai","99":"ai","A8o":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  16: {"AA":"r","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"ai","JJ":"ai","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","A9o":"ai","99":"ai","98s":"ai","A8o":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  18: {"AA":"r","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","A2s":"ai","AKo":"ai","KK":"ai","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"ai","JJ":"ai","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","A9o":"ai","99":"ai","98s":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  20: {"AA":"r","AKs":"ai","AQs":"ai","AJs":"ai","ATs":"ai","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","A3s":"ai","AKo":"ai","KK":"r","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"ai","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","JJ":"ai","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","A9o":"ai","99":"ai","98s":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  22: {"AA":"r","AQs":"ai","AJs":"ai","ATs":"r","A9s":"ai","A8s":"ai","A7s":"ai","A6s":"ai","A5s":"ai","A4s":"ai","AKo":"ai","KK":"r","KQs":"ai","KJs":"ai","KTs":"ai","K9s":"ai","AQo":"ai","KQo":"ai","QQ":"r","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"r","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","99":"ai","98s":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  25: {"AA":"r","AKs":"r","AQs":"ai","AJs":"ai","ATs":"r","A9s":"c","A7s":"ai","A5s":"ai","A3s":"r","AKo":"ai","KK":"r","KQs":"ai","KJs":"ai","AQo":"ai","KQo":"ai","QQ":"r","QJs":"ai","QTs":"ai","Q9s":"ai","AJo":"ai","KJo":"r","JJ":"r","JTs":"ai","J9s":"ai","ATo":"ai","TT":"ai","T9s":"ai","A9o":"r","99":"ai","98s":"ai","88":"ai","77":"ai","66":"ai","55":"ai","44":"ai","22":"ai"},
};


export function sbVsBtnRaiseRange(bb: number): MixRange {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  let best = DEPTHS[0]!;
  for (const key of DEPTHS) {
    const gap = Math.abs(key - depth);
    const bestGap = Math.abs(best - depth);
    if (gap < bestGap || (gap === bestGap && key > best)) best = key;
  }
  const src = KNOWN[best]!;
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    const act = src[hand] ?? "f";
    if (act === "ai") mix.allin = 100;
    else if (act === "r") mix.raise = 100;
    else if (act === "c") mix.call = 100;
    else mix.fold = 100;
    out[hand] = mix;
  }
  return out;
}