import { ALL } from "./legacy-ranges";
import { emptyMix, primary, type MixRange } from "./mix";
import { HU_SB_KNOWN, type Cell } from "./hu-sb-data";

/** Pictured GTOBase depths. Every other stack is a blend of the two neighbors. */
const KNOWN = [5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25, 30];

export function huSbAt(bb: number): MixRange {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  if (HU_SB_KNOWN[depth]) return solid(materialize(HU_SB_KNOWN[depth]));
  if (depth < KNOWN[0]!) return solid(materialize(HU_SB_KNOWN[KNOWN[0]!]!));
  let lo = KNOWN[0]!;
  let hi = KNOWN[KNOWN.length - 1]!;
  for (const key of KNOWN) if (key <= depth) lo = key;
  for (const key of KNOWN) if (key >= depth) {
    hi = key;
    break;
  }
  const t = (depth - lo) / (hi - lo);
  return solid(blend(HU_SB_KNOWN[lo]!, HU_SB_KNOWN[hi]!, t));
}

function solid(range: MixRange): MixRange {
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    mix[primary(range[hand]!)] = 100;
    out[hand] = mix;
  }
  return out;
}

function materialize(src: Record<string, Cell>): MixRange {
  const out: MixRange = {};
  for (const hand of ALL) {
    const cell = src[hand] ?? [100, 0, 0, 0];
    const mix = emptyMix();
    mix.fold = cell[0];
    mix.call = cell[1];
    mix.raise = cell[2];
    mix.allin = cell[3];
    out[hand] = mix;
  }
  return out;
}

function blend(left: Record<string, Cell>, right: Record<string, Cell>, t: number): MixRange {
  const out: MixRange = {};
  for (const hand of ALL) {
    const a = left[hand] ?? [100, 0, 0, 0];
    const b = right[hand] ?? [100, 0, 0, 0];
    const raw = [0, 1, 2, 3].map((i) => a[i]! * (1 - t) + b[i]! * t);
    const ints = raw.map((value) => Math.round(value));
    const top = raw.indexOf(Math.max(...raw));
    ints[top] = (ints[top] ?? 0) + (100 - ints.reduce((sum, value) => sum + value, 0));
    const mix = emptyMix();
    mix.fold = ints[0] ?? 0;
    mix.call = ints[1] ?? 0;
    mix.raise = ints[2] ?? 0;
    mix.allin = ints[3] ?? 0;
    out[hand] = mix;
  }
  return out;
}
