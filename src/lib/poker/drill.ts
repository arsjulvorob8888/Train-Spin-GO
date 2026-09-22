import { exploitSpec, type Villain } from "./exploit";
import { actionFromSpec, allHands, comboCount, type GtoAction, type RangeSpec } from "./spin/notation";
import { SPOTS, chartFor, type SpotId, type StackDepth } from "./spin/charts";

export type DrillQ = {
  klass: string;
  stack: StackDepth;
  spot: SpotId;
  pos: "BTN" | "SB" | "BB";
  villain: Villain;
  facing: boolean;
  spec: RangeSpec;
  gto: GtoAction;
  buttons: GtoAction[];
  potBb: number;
  toCallBb: number;
};

const OPEN_SPOTS = new Set<SpotId>(["btn_rfi", "sb_rfi", "hu_sb_rfi"]);

export function isFacing(spot: SpotId): boolean {
  return !OPEN_SPOTS.has(spot);
}

export function buttonsFor(spot: SpotId, spec: RangeSpec): GtoAction[] {
  if (spot.includes("jam") && !spot.includes("rfi")) {
    return ["fold", "call"];
  }
  const set = new Set<GtoAction>(["fold"]);
  if (spec.check?.length || (spot.includes("limp") && spot.startsWith("bb"))) set.add("check");
  if (spec.limp?.length || (spot.includes("rfi") && spot.startsWith("sb"))) set.add("limp");
  if (spec.call?.length || spot.includes("raise")) set.add("call");
  if (spec.raise?.length || spot.includes("rfi") || spot.includes("limp")) set.add("raise");
  if (spec.jam?.length || spot.includes("rfi") || spot.includes("limp") || spot.includes("raise")) set.add("jam");
  return (["fold", "check", "limp", "call", "raise", "jam"] as GtoAction[]).filter((a) => set.has(a));
}

function weightedHand(spec: RangeSpec): string {
  const hands = allHands();
  const weights = hands.map((h) => {
    const act = actionFromSpec(h, spec);
    const c = comboCount(h);
    return act === "fold" ? c : c * 2.2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < hands.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return hands[i]!;
  }
  return hands[0]!;
}

function potFor(spot: SpotId, stack: StackDepth): { potBb: number; toCallBb: number } {
  if (spot.includes("jam")) {
    return { potBb: stack + 1.5, toCallBb: stack - 1 };
  }
  if (spot.includes("raise")) return { potBb: 4.5, toCallBb: 1 };
  if (spot.includes("limp")) return { potBb: 2.5, toCallBb: 0 };
  return { potBb: 1.5, toCallBb: 0 };
}

export function nextDrill(opts: {
  stack: StackDepth;
  pos: "BTN" | "SB" | "BB" | "ANY";
  villain: Villain;
}): DrillQ {
  const pool = SPOTS.filter((s) => opts.pos === "ANY" || s.pos === opts.pos);
  const meta = pool[Math.floor(Math.random() * pool.length)]!;
  const gtoSpec = chartFor(opts.stack, meta.id);
  const facing = isFacing(meta.id);
  const spec = exploitSpec(gtoSpec, opts.villain, facing);
  const klass = weightedHand(spec);
  const gto = actionFromSpec(klass, spec);
  const { potBb, toCallBb } = potFor(meta.id, opts.stack);
  return {
    klass,
    stack: opts.stack,
    spot: meta.id,
    pos: meta.pos,
    villain: opts.villain,
    facing,
    spec,
    gto,
    buttons: buttonsFor(meta.id, spec),
    potBb,
    toCallBb,
  };
}

export const ACTION_RU: Record<GtoAction, string> = {
  fold: "FOLD",
  check: "CHECK",
  limp: "LIMP",
  call: "CALL",
  raise: "RAISE",
  jam: "JAM",
};
