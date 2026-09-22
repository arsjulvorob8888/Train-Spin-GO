import { actionFromSpec, allHands, chartFor, type SpotId } from "@/lib/poker/spin";
import { emptyMix, type Mix, type MixRange } from "./mix";

export function rangeFromChart(spot: SpotId): MixRange {
  const spec = chartFor(15, spot);
  const out: MixRange = {};
  for (const h of allHands()) {
    const a = actionFromSpec(h, spec);
    if (a === "fold") continue;
    const m = emptyMix();
    if (a === "jam") m.allin = 100;
    else if (a === "raise") m.raise = 100;
    else m.call = 100;
    out[h] = m;
  }
  return out;
}

/** Overlay solver-style mix frequencies on a majority-action chart. */
export function overlayMix(base: MixRange, mixes: Record<string, Partial<Mix>>): MixRange {
  const out: MixRange = { ...base };
  for (const [h, parts] of Object.entries(mixes)) {
    const m = emptyMix();
    Object.assign(m, parts);
    out[h] = m;
  }
  return out;
}

export function fromChart(spot: SpotId, mixes: Record<string, Partial<Mix>> = {}): MixRange {
  return overlayMix(rangeFromChart(spot), mixes);
}
