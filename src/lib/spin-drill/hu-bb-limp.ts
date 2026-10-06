import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** One color per cell: the action with the biggest share on the GTOBase chart. */
export type BbSize = "x" | "2" | "2.5" | "3" | "3.5" | "4" | "4.5" | "5" | "6" | "6.5" | "8" | "ai";

export const SIZE_ORDER: BbSize[] = ["x", "2", "2.5", "3", "3.5", "4", "4.5", "5", "6", "6.5", "8", "ai"];

/** Check stays the app's call green. Raises step from amber to red. All-in is the dark red. */
export const SIZE_HEX: Record<BbSize, string> = {
  x: "#2f9e73",
  "2": "#ff9f1a",
  "2.5": "#ff7a1a",
  "3": "#f2552a",
  "3.5": "#e23b3b",
  "4": "#d12a4a",
  "4.5": "#c01e58",
  "5": "#a81868",
  "6": "#8c1460",
  "6.5": "#741458",
  "8": "#5c1048",
  ai: "#7d1f1f",
};

const KNOWN: Record<number, Record<string, BbSize>> = {
  // 30bb, SB limp, pixel read. A cell is its largest slice, not the mix.
  30: {
    AA: "3",
    AKs: "3",
    AQs: "3",
    AJs: "3",
    ATs: "5",
    A9s: "5",
    A8s: "3",
    A7s: "3",
    A6s: "3",
    KK: "3",
    KQs: "5",
    KJs: "3",
    KTs: "3",
    KQo: "3",
    KJo: "3",
    QQ: "5",
    QJs: "5",
    QTs: "3",
    QJo: "3",
    JJ: "5",
    TT: "5",
    "99": "3",
    "88": "3",
    "77": "5",
    "66": "5",
    "74s": "3",
    "42s": "3",
    "32s": "3",
    AKo: "5",
    AQo: "5",
    AJo: "ai",
    ATo: "ai",
    A9o: "ai",
    A8o: "ai",
    A7o: "5",
    "85s": "ai",
    "76s": "ai",
    "65s": "ai",
    "55": "ai",
    "44": "ai",
    "33": "ai",
    "22": "ai",
  },
};

export function huBbLimpPaint(bb: number): Record<string, BbSize> | null {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  const src = KNOWN[depth];
  if (!src) return null;
  const out: Record<string, BbSize> = {};
  for (const hand of ALL) out[hand] = src[hand] ?? "x";
  return out;
}

export function huBbLimpRange(bb: number): MixRange | null {
  const paint = huBbLimpPaint(bb);
  if (!paint) return null;
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
  if (size === "x" || size === "call") return "Check";
  if (size === "ai" || size === "allin") return `All-in ${bb}`;
  if (size === "fold") return "Fold";
  if (size === "raise") return "Raise";
  return `Raise ${size}`;
}

export function sizeMark(size: string): string {
  if (size === "ai") return "AI";
  if (SIZE_HEX[size as BbSize] && size !== "x") return size;
  return "";
}

export function paintHex(action: string): string | null {
  return SIZE_HEX[action as BbSize] ?? null;
}
