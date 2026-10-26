import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** One color per cell: the action with the biggest share on the GTOBase chart. */
export type BbSize =
  | "f"
  | "c"
  | "x"
  | "2"
  | "2.5"
  | "3"
  | "3.5"
  | "4"
  | "4.25"
  | "4.5"
  | "5"
  | "6"
  | "6.5"
  | "8"
  | "ai";

export const SIZE_ORDER: BbSize[] = [
  "f",
  "c",
  "x",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "4.25",
  "4.5",
  "5",
  "6",
  "6.5",
  "8",
  "ai",
];

/** Fold is the app blue, call/check the app green. Raises step from amber to red. All-in is the dark red. */
export const SIZE_HEX: Record<BbSize, string> = {
  f: "#3d7cb8",
  c: "#2f9e73",
  x: "#2f9e73",
  "2": "#ff9f1a",
  "2.5": "#ff7a1a",
  "3": "#f2552a",
  "3.5": "#e23b3b",
  "4": "#d12a4a",
  "4.25": "#c41e52",
  "4.5": "#c01e58",
  "5": "#a81868",
  "6": "#8c1460",
  "6.5": "#741458",
  "8": "#5c1048",
  ai: "#7d1f1f",
};

const DEPTHS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25, 30];

const KNOWN: Record<number, Record<string, BbSize>> = {
  5: {AKs:"ai",AQs:"ai",ATs:"ai",A9s:"ai",A8s:"ai",A7s:"ai",A6s:"ai",A5s:"ai",A4s:"ai",A3s:"ai",A2s:"ai",AKo:"ai",KQs:"ai",KJs:"ai",KTs:"ai",K9s:"ai",K8s:"ai",K7s:"ai",K6s:"ai",K5s:"ai",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"ai",KQo:"ai",QJs:"2",Q9s:"ai",Q8s:"ai",Q7s:"ai",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"ai",KJo:"ai",QJo:"ai",JJ:"2",J8s:"ai",J7s:"ai",J6s:"ai",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"ai",KTo:"ai",QTo:"ai",TT:"2",T7s:"ai",A9o:"ai",K9o:"ai",Q9o:"ai",A8o:"ai",K8o:"ai",Q8o:"ai",J8o:"ai",A7o:"ai",K7o:"ai",Q7o:"ai",J7o:"ai",T7o:"ai",A6o:"ai",K6o:"ai",Q6o:"ai",J6o:"ai",A5o:"ai",K5o:"ai",Q5o:"ai",J5o:"ai",A4o:"ai",K4o:"ai",Q4o:"ai",J4o:"ai",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai",A2o:"ai",K2o:"ai",Q2o:"ai",J2o:"ai","22":"ai"},
  6: {AA:"2",ATs:"2",A9s:"ai",A8s:"ai",A7s:"ai",A2s:"ai",AKo:"ai",KK:"2",K8s:"ai",K7s:"ai",K3s:"ai",K2s:"ai",AQo:"ai",KQo:"ai",Q7s:"ai",Q2s:"ai",AJo:"ai",KJo:"ai",J2s:"ai",ATo:"ai",KTo:"ai",QTo:"ai",TT:"2",T2s:"ai",A9o:"ai",K9o:"ai",Q9o:"ai","99":"2",A8o:"ai",K8o:"ai",Q8o:"ai",A7o:"ai",K7o:"ai",Q7o:"ai",A6o:"ai",K6o:"ai",Q6o:"ai",A5o:"ai",K5o:"ai",Q5o:"ai",J5o:"ai",T5o:"ai",A4o:"ai",K4o:"ai",Q4o:"ai",J4o:"ai",T4o:"ai",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai",T3o:"ai",A2o:"ai",K2o:"ai",Q2o:"ai",J2o:"ai",T2o:"ai"},
  7: {AA:"2",AKs:"2",AQs:"3.5",AJs:"3.5",ATs:"3.5",A9s:"3.5",A8s:"3.5",A7s:"3.5",A6s:"3.5",A5s:"3.5",A4s:"3.5",A3s:"3.5",A2s:"ai",AKo:"3.5",KK:"2",KTs:"3.5",K9s:"3.5",K8s:"3.5",K7s:"3.5",K2s:"ai",AQo:"3.5",KQo:"3.5",QQ:"2",AJo:"3.5",KJo:"3.5",JJ:"2",ATo:"3.5",KTo:"3.5",QTo:"3.5",TT:"2",A9o:"3.5",K9o:"3.5",Q9o:"3.5",J9o:"3.5",T9o:"3.5","99":"2",A8o:"3.5",K8o:"3.5",Q8o:"3.5",J8o:"3.5","88":"2",A7o:"3.5",K7o:"3.5",Q7o:"2","77":"2",A6o:"3.5",K6o:"ai","66":"3.5",A5o:"3.5",K5o:"ai",Q5o:"ai",A4o:"ai",K4o:"ai",Q4o:"ai","44":"2",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai","83o":"3.5",A2o:"ai",K2o:"ai",Q2o:"ai","82o":"3.5","72o":"3.5","62o":"3.5","22":"ai"},
  8: {AA:"2.5",AKs:"2.5",AQs:"2.5",AJs:"3.5",ATs:"3.5",A9s:"3.5",A8s:"3.5",A7s:"2.5",A6s:"3.5",A5s:"3.5",A4s:"2.5",A3s:"3.5",A2s:"ai",AKo:"3.5",KK:"2",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"3.5",K8s:"3.5",K7s:"2.5",AQo:"3.5",KQo:"3.5",QQ:"2.5",Q9s:"2.5",AJo:"3.5",KJo:"3.5",QJo:"2.5",JJ:"2.5",ATo:"3.5",KTo:"3.5",QTo:"2.5",TT:"2.5",A9o:"ai",K9o:"ai",Q9o:"3.5",J9o:"3.5","99":"2.5",A8o:"ai",K8o:"ai",Q8o:"3.5","88":"2.5","86s":"3.5",A7o:"ai",K7o:"ai","77":"2.5","76s":"3.5",A6o:"ai",K6o:"ai","66":"3.5",A5o:"ai",K5o:"ai","55":"3.5",A4o:"ai",K4o:"ai","44":"3.5",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai","33":"ai",A2o:"ai",K2o:"ai",Q2o:"ai","62o":"3.5","22":"ai"},
  9: {AA:"2.5",AKs:"2.5",AQs:"2.5",AJs:"4",ATs:"4",A9s:"4",A8s:"4",A7s:"2.5",A6s:"4",A5s:"4",A4s:"ai",A3s:"ai",A2s:"ai",AKo:"ai",KK:"2.5",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"4",K8s:"2.5",AQo:"4",KQo:"4",QQ:"2.5",QTs:"2.5",Q9s:"2.5",AJo:"4",KJo:"4",JJ:"2.5",J3s:"ai",J2s:"ai",ATo:"4",KTo:"4",TT:"2.5",T9s:"2.5",A9o:"4",K9o:"4",Q9o:"4","99":"2.5",A8o:"ai",K8o:"ai",Q8o:"2.5","88":"2.5",A7o:"ai",K7o:"ai","77":"2.5","76s":"4",A6o:"ai",K6o:"ai","76o":"4","66":"4","65s":"4",A5o:"ai","55":"4",A4o:"ai",K4o:"ai","44":"ai",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai","33":"ai",A2o:"ai",K2o:"ai",Q2o:"ai","72o":"4","22":"ai"},
  10: {AA:"2.5",AKs:"2.5",AQs:"2.5",AJs:"4",ATs:"4",A9s:"4",A8s:"4",A7s:"4",A6s:"4",A5s:"2.5",A4s:"2.5",A3s:"ai",A2s:"ai",AKo:"ai",KK:"2.5",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"4",AQo:"4",KQo:"4",QQ:"2.5",QTs:"2.5",Q9s:"2.5",AJo:"ai",KJo:"4",QJo:"4",JJ:"2.5",JTs:"2.5",ATo:"ai",KTo:"4",QTo:"4",TT:"2.5",T9s:"2.5",A9o:"ai",K9o:"ai","99":"2.5",A8o:"ai",K8o:"ai","88":"2.5","86s":"4","85s":"4",A7o:"ai",K7o:"ai","77":"4","76s":"4","75s":"4",A6o:"ai",K6o:"ai","66":"4","65s":"4",A5o:"ai","55":"4","54s":"4",A4o:"ai","44":"ai",A3o:"ai",K3o:"ai",Q3o:"ai",J3o:"ai","33":"ai",A2o:"ai",K2o:"ai",Q2o:"ai","72o":"4","22":"ai"},
  11: {AA:"2.5",AKs:"2.5",AQs:"4",AJs:"4",ATs:"4",A9s:"4",A8s:"4",A7s:"4",A6s:"4",A5s:"2.5",A4s:"2.5",A3s:"ai",A2s:"ai",AKo:"ai",KK:"2.5",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"2.5",AQo:"4",KQo:"4",QQ:"2.5",QTs:"2.5",AJo:"ai",KJo:"4",QJo:"4",JJ:"2.5",ATo:"ai",KTo:"4",TT:"2.5",A9o:"ai",K9o:"4","99":"2.5",A8o:"ai",K8o:"ai","88":"2.5","87s":"4","86s":"4",A7o:"ai",K7o:"2.5","77":"4","76s":"4","75s":"4",A6o:"ai","76o":"ai","66":"4","65s":"4","63s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai",A3o:"ai",Q3o:"ai","33":"ai",A2o:"ai",K2o:"ai","22":"ai"},
  12: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"4.5",A9s:"4.5",A8s:"3",A7s:"4.5",A6s:"4.5",A5s:"3",A3s:"ai",A2s:"ai",AKo:"4.5",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",AQo:"4.5",KQo:"3",QQ:"3",QJs:"3",AJo:"ai",KJo:"4.5",JJ:"3",JTs:"3",ATo:"ai",KTo:"4.5",TT:"3",A9o:"ai","99":"3",A8o:"ai",K8o:"3","88":"3","87s":"4.5","86s":"4.5",A7o:"ai","77":"3","76s":"4.5",A6o:"ai","66":"4.5","65s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai",A3o:"ai",Q3o:"ai","33":"ai",A2o:"ai",K2o:"ai","22":"ai"},
  13: {AA:"3",AKs:"3",AQs:"3",AJs:"4.5",ATs:"4.5",A9s:"4.5",A8s:"3",A7s:"3",A6s:"3",A5s:"3",A2s:"ai",AKo:"ai",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",AQo:"ai",KQo:"3",QQ:"3",AJo:"ai",KJo:"4.5",JJ:"3",JTs:"3",ATo:"ai",KTo:"3",TT:"3",A9o:"ai",K9o:"3","99":"3",A8o:"ai",K8o:"3","88":"3",A7o:"ai","77":"3","76s":"4.5",A6o:"ai","66":"3","65s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai",A3o:"ai",Q3o:"ai","33":"ai",A2o:"ai",K2o:"ai","22":"ai"},
  14: {AA:"3",AKs:"3",AQs:"3",AJs:"4.5",ATs:"4.5",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"3",AKo:"ai",KK:"3",KQs:"3",KJs:"3",KTs:"3",AQo:"ai",KQo:"3",QQ:"3",QJs:"3",AJo:"ai",KJo:"ai",JJ:"3",JTs:"3",ATo:"ai",KTo:"3",TT:"3",A9o:"ai",K9o:"3","99":"3",A8o:"ai",K8o:"3","88":"3","86s":"ai","85s":"ai",A7o:"ai","77":"3","76s":"ai",A6o:"ai","76o":"ai","66":"ai","65s":"ai","63s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai",A3o:"ai",Q3o:"ai","33":"ai",A2o:"ai",K2o:"ai","22":"ai"},
  16: {AA:"3",AKs:"3",AQs:"3",AJs:"5",ATs:"5",A9s:"3",A8s:"3",A7s:"3",A6s:"3",AKo:"ai",KK:"3",KQs:"3",KJs:"3",KTs:"3",AQo:"ai",KQo:"ai",QQ:"3",QJs:"3",QTs:"3",AJo:"ai",KJo:"ai",JJ:"3",JTs:"3",ATo:"ai",KTo:"3",TT:"3",A9o:"ai",K9o:"3","99":"3","98s":"5",A8o:"ai",K8o:"3","88":"3","86s":"ai","85s":"ai",A7o:"ai","77":"3","76s":"ai",A6o:"ai","66":"ai","65s":"ai","63s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai",A3o:"ai","33":"ai",A2o:"ai","22":"ai"},
  18: {AA:"3",AKs:"3",AQs:"3",AJs:"6",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",AKo:"6",KK:"3",KQs:"3",KJs:"3",KTs:"3",AQo:"6",KQo:"6",QQ:"3",QJs:"3",AJo:"ai",KJo:"6",JJ:"3",JTs:"3",ATo:"ai",KTo:"3",TT:"3",T9s:"6",A9o:"ai",K9o:"3",Q9o:"3","99":"3","98s":"6",A8o:"ai",K8o:"3","88":"3","86s":"6","85s":"ai",A7o:"ai","77":"6","76s":"6","75s":"ai",A6o:"ai","66":"ai","65s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai","33":"ai",A2o:"ai","22":"ai"},
  20: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",AKo:"6.5",KK:"3",KQs:"3",KJs:"3",KTs:"3",AQo:"6.5",KQo:"6.5",QQ:"3",QJs:"3",AJo:"ai",KJo:"3",QJo:"3",JJ:"3",JTs:"3",ATo:"ai",KTo:"3",TT:"3",T8s:"6.5",A9o:"ai",K9o:"3",Q9o:"3","99":"3","98s":"6.5",A8o:"ai",K8o:"3","88":"3","86s":"6.5","85s":"ai",A7o:"ai","77":"6.5","76s":"6.5","75s":"ai",A6o:"ai","66":"ai","65s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai","33":"ai",A2o:"ai","22":"ai"},
  22: {AA:"3",AKs:"3",AQs:"3",AJs:"4.5",ATs:"4.5",A9s:"3",A8s:"3",A7s:"3",AKo:"4.5",KK:"3",KQs:"3",KJs:"3",KTs:"3",AQo:"ai",KQo:"ai",QQ:"3",QJs:"4.5",AJo:"ai",KJo:"3",QJo:"3",JJ:"3",JTs:"4.5",ATo:"ai",TT:"3",A9o:"ai",K9o:"3",Q9o:"3","99":"3",A8o:"ai",K8o:"3","88":"3","86s":"ai","85s":"ai",A7o:"ai","77":"3","76s":"4.5","75s":"ai",A6o:"ai",Q6o:"ai","66":"ai","65s":"ai",A5o:"ai","55":"ai",A4o:"ai","44":"ai","33":"ai",A2o:"ai","22":"ai"},
  25: {AA:"4.5",AKs:"4.5",AQs:"4.5",AJs:"4.5",ATs:"4.5",A9s:"4.5",A8s:"4.5",A7s:"3",AKo:"4.5",KK:"4.5",KQs:"4.5",KJs:"4.5",KTs:"3",AQo:"4.5",KQo:"ai",QQ:"4.5",QJs:"4.5",QTs:"4.5",AJo:"ai",KJo:"4.5",JJ:"4.5",JTs:"4.5",ATo:"ai",TT:"4.5",A9o:"ai",K9o:"4.5","99":"4.5",A8o:"ai","88":"4.5","86s":"ai","85s":"ai",A7o:"ai","77":"4.5","76s":"4.5",A6o:"4.5",Q6o:"ai","66":"4.5","65s":"ai",A5o:"ai","55":"ai","44":"ai","33":"ai","22":"ai"},
  30: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"5",A9s:"5",A8s:"3",A7s:"3",A6s:"3",AKo:"5",KK:"3",KQs:"5",KJs:"3",KTs:"3",AQo:"5",KQo:"3",QQ:"5",QJs:"5",QTs:"3",AJo:"ai",KJo:"3",QJo:"3",JJ:"5",JTs:"5",ATo:"ai",TT:"5",A9o:"ai","99":"3",A8o:"ai","88":"3","85s":"ai",A7o:"5","77":"5","76s":"ai","74s":"3","66":"5","65s":"ai","63s":"3","55":"ai","44":"ai","42s":"3","33":"ai","32s":"3","22":"ai"},
};


export function huBbLimpPaint(bb: number): Record<string, BbSize> {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  let best = DEPTHS[0]!;
  for (const key of DEPTHS) {
    const gap = Math.abs(key - depth);
    const bestGap = Math.abs(best - depth);
    if (gap < bestGap || (gap === bestGap && key > best)) best = key;
  }
  const src = KNOWN[best]!;
  const out: Record<string, BbSize> = {};
  for (const hand of ALL) out[hand] = src[hand] ?? "x";
  return out;
}

export function huBbLimpRange(bb: number): MixRange {
  const paint = huBbLimpPaint(bb);
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    const size = paint[hand] ?? "x";
    if (size === "x") mix.call = 100;
    else if (size === "ai") mix.allin = 100;
    else mix.raise = 100;
    out[hand] = mix;
  }
  return out;
}

export function sizeCaption(size: string, bb: number): string {
  if (size === "x") return "Check|FOLD";
  if (size === "c" || size === "call") return "Call";
  if (size === "f" || size === "fold") return "Fold";
  if (size === "ai" || size === "allin") return `All-in ${bb}`;
  if (size === "raise") return "Raise";
  return `Raise ${size}`;
}

export function sizeMark(size: string): string {
  if (size === "ai" || size === "x" || size === "f" || size === "c") return "";
  if (SIZE_HEX[size as BbSize]) return size;
  return "";
}

export function paintHex(action: string): string | null {
  return SIZE_HEX[action as BbSize] ?? null;
}
