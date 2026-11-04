import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** SB facing a BTN open to 2bb. One color: the biggest slice on the GTOBase chart. */
const DEPTHS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25];

const KNOWN: Record<number, Record<string, "f" | "c" | "r" | "ai">> = {
  8: {44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"ai",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5o:"ai",A5s:"ai",A6o:"ai",A6s:"ai",A7o:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTo:"ai",KTs:"ai",QJs:"ai",QTs:"ai"},
  9: {55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"ai",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3o:"ai",A3s:"ai",A4o:"ai",A4s:"ai",A5o:"ai",A5s:"ai",A6s:"ai",A7o:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",QJs:"ai",QTs:"ai"},
  10: {44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"ai",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4o:"ai",A4s:"ai",A5o:"ai",A5s:"ai",A6s:"ai",A7o:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",JTs:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",QJs:"ai",QTs:"ai"},
  11: {33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"ai",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4o:"ai",A4s:"ai",A5o:"ai",A5s:"ai",A6s:"ai",A7o:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",QJo:"ai",QJs:"ai",QTs:"ai"},
  12: {33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5o:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJo:"ai",QJs:"ai",QTs:"ai"},
  13: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"ai",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJo:"ai",QJs:"ai",QTs:"ai"},
  14: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJs:"ai",QTs:"ai",T9s:"ai"},
  16: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai","98s":"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8o:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJs:"ai",QTs:"ai",T9s:"ai"},
  18: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"ai",QQ:"ai",TT:"ai","98s":"ai",A2s:"ai",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJs:"ai",QTs:"ai",T9s:"ai"},
  20: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"r",QQ:"ai",TT:"ai","98s":"ai",A2s:"r",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8s:"ai",A9o:"ai",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"ai",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"ai",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJs:"ai",QTs:"ai",T9s:"ai"},
  22: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"ai",KK:"r",QQ:"r",TT:"ai","98s":"ai",A2s:"r",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8s:"ai",A9o:"r",A9s:"ai",AJo:"ai",AJs:"ai",AKo:"ai",AKs:"ai",AQo:"ai",AQs:"ai",ATo:"ai",ATs:"r",J9s:"ai",JTs:"ai",K9s:"ai",KJo:"r",KJs:"ai",KQo:"ai",KQs:"ai",KTs:"ai",Q9s:"ai",QJs:"ai",QTs:"ai",T9s:"ai"},
  25: {22:"ai",33:"ai",44:"ai",55:"ai",66:"ai",77:"ai",88:"ai",99:"ai",AA:"r",JJ:"r",KK:"r",QQ:"r",TT:"ai","98s":"ai",A2s:"r",A3s:"ai",A4s:"ai",A5s:"ai",A6s:"ai",A7s:"ai",A8s:"ai",A9o:"r",A9s:"ai",AJo:"r",AJs:"r",AKo:"r",AKs:"r",AQo:"r",AQs:"r",ATo:"r",ATs:"r",J9s:"ai",JTs:"r",K9s:"ai",KJo:"r",KJs:"r",KQo:"r",KQs:"r",KTs:"r",Q9s:"ai",QJs:"r",QTs:"r",T9s:"r"},
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