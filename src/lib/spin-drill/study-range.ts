import type { BbSize } from "@/lib/spin-drill/hu-bb-limp";
import { huBbLimpPaint } from "@/lib/spin-drill/hu-bb-limp";
import { huBbRaisePaint } from "@/lib/spin-drill/hu-bb-raise";
import type { MixRange } from "@/lib/spin-drill/mix";
import { findSpot } from "@/lib/spin-drill/spots";
import { rangeAtStack } from "@/lib/spin-drill/stack-ranges";

/** Same chart the study screens show: published strategy if there is one, otherwise the spot chart. */
export function studyRange(
  spotId: string,
  bb: number,
  live?: { ranges?: Record<string, MixRange> } | null,
): MixRange {
  const spot = findSpot(spotId);
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  return rangeAtStack(live?.ranges?.[spotId] ?? spot.range, spotId, depth);
}

/** Raise-size colors. Null means the cell color is the action itself. */
export function studyPaint(spotId: string, bb: number): Record<string, BbSize> | null {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  if (spotId === "hu_bb_limp") return huBbLimpPaint(depth);
  if (spotId === "hu_bb_raise") return huBbRaisePaint(depth);
  return null;
}
