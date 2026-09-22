import { RANK_CHARS, handClass, type Card } from "../cards";

const IDX: Record<string, number> = Object.fromEntries(RANK_CHARS.map((r, i) => [r, i]));

export type GtoAction = "fold" | "limp" | "raise" | "call" | "jam" | "check";

export type RangeSpec = {
  jam?: string[];
  raise?: string[];
  call?: string[];
  limp?: string[];
  check?: string[];
};

function parseKlass(hand: string): { hi: number; lo: number; suited: boolean; pair: boolean } | null {
  if (hand.length === 2) {
    const a = IDX[hand[0]!];
    const b = IDX[hand[1]!];
    if (a === undefined || b === undefined || a !== b) return null;
    return { hi: a, lo: b, suited: false, pair: true };
  }
  if (hand.length !== 3) return null;
  const a = IDX[hand[0]!];
  const b = IDX[hand[1]!];
  const suited = hand[2] === "s";
  if (a === undefined || b === undefined) return null;
  return { hi: Math.max(a, b), lo: Math.min(a, b), suited, pair: a === b };
}

function parseTok(tok: string): { hi: number; lo: number; suited: boolean; pair: boolean } | null {
  return parseKlass(tok.replace("+", "").split("-")[0]!);
}

/** Standard chart notation: 22+, A2s+, A7o+, KTo+, 54s, 98s+, QQ+, A2s-A9s */
export function matchesSpec(hand: string, spec: string): boolean {
  const h = parseKlass(hand);
  if (!h) return false;
  const plus = spec.endsWith("+");
  const body = plus ? spec.slice(0, -1) : spec;
  if (body.includes("-")) {
    const [a, b] = body.split("-");
    const lo = parseTok(a!);
    const hi = parseTok(b!);
    if (!lo || !hi) return false;
    if (h.pair !== lo.pair) return false;
    if (!h.pair && h.suited !== lo.suited) return false;
    if (h.pair) return h.hi >= Math.min(lo.hi, hi.hi) && h.hi <= Math.max(lo.hi, hi.hi);
    if (lo.hi !== hi.hi) {
      // connector chain e.g. 54s-98s
      if (!h.suited || h.hi - h.lo !== 1) return false;
      return h.lo >= Math.min(lo.lo, hi.lo) && h.lo <= Math.max(lo.lo, hi.lo);
    }
    return h.hi === lo.hi && h.lo >= Math.min(lo.lo, hi.lo) && h.lo <= Math.max(lo.lo, hi.lo);
  }
  const t = parseTok(body);
  if (!t) return false;
  if (!plus) {
    return h.hi === t.hi && h.lo === t.lo && h.pair === t.pair && (h.pair || h.suited === t.suited);
  }
  if (t.pair) return h.pair && h.hi >= t.hi;
  if (h.pair || h.suited !== t.suited) return false;
  if (h.hi !== t.hi) {
    // 54s+ / 87s+ → better suited connectors
    if (t.hi - t.lo === 1 && h.hi - h.lo === 1) return h.lo >= t.lo;
    return false;
  }
  return h.lo >= t.lo;
}

export function inAny(hand: string, specs: string[] | undefined): boolean {
  if (!specs?.length) return false;
  return specs.some((s) => matchesSpec(hand, s));
}

export function actionFromSpec(hand: string, spec: RangeSpec): GtoAction {
  if (inAny(hand, spec.jam)) return "jam";
  if (inAny(hand, spec.raise)) return "raise";
  if (inAny(hand, spec.call)) return "call";
  if (inAny(hand, spec.limp)) return "limp";
  if (inAny(hand, spec.check)) return "check";
  return "fold";
}

export function klassOf(hole: [Card, Card]): string {
  return handClass(hole[0], hole[1]);
}

export function allHands(): string[] {
  const out: string[] = [];
  for (let i = 12; i >= 0; i--) {
    for (let j = 12; j >= 0; j--) {
      const a = RANK_CHARS[i]!;
      const b = RANK_CHARS[j]!;
      if (i === j) out.push(`${a}${b}`);
      else if (i > j) out.push(`${a}${b}s`);
      else out.push(`${b}${a}o`);
    }
  }
  return out;
}

export function comboCount(hand: string): number {
  if (hand.length === 2) return 6;
  return hand.endsWith("s") ? 4 : 12;
}

export function rangePercent(spec: RangeSpec, actions: GtoAction[]): number {
  let n = 0;
  for (const h of allHands()) {
    if (actions.includes(actionFromSpec(h, spec))) n += comboCount(h);
  }
  return (n / 1326) * 100;
}
