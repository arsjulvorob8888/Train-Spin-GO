import { legalActions, positionOf } from "../game";
import type { GameState, PlayerAction } from "../types";
import { chartFor, nearestStack, SPOTS, type SpotId, type StackDepth } from "./charts";
import { actionFromSpec, klassOf, rangePercent, type GtoAction } from "./notation";
import { detectSpot, formatLine, isSpotDetermined } from "./spots";

export { SPOTS, chartFor, nearestStack, type SpotId, type StackDepth, STACKS } from "./charts";
export { actionFromSpec, klassOf, rangePercent, type GtoAction, type RangeSpec, allHands } from "./notation";
export { detectSpot, formatLine, preflopLines, isSpotDetermined } from "./spots";

export type GtoDecision = {
  action: GtoAction;
  spot: SpotId;
  spotLabel: string;
  when: string;
  stack: StackDepth;
  klass: string;
  position: "BTN" | "SB" | "BB";
  rangePct: number;
  continuePct: number;
  sizingBb: number | null;
  line: string;
  ready: boolean;
};

const VERB: Record<GtoAction, string> = {
  jam: "Jam",
  raise: "Raise",
  call: "Call",
  limp: "Limp",
  check: "Check",
  fold: "Fold",
};

export function decideGto(s: GameState, playerIndex: number): GtoDecision | null {
  const p = s.players[playerIndex];
  if (!p?.hole) return null;
  const bb = s.blinds.bb;
  const stackBb = nearestStack((p.stack + p.committed) / bb);
  const ready = isSpotDetermined(s, playerIndex);
  const spot = detectSpot(s, playerIndex);
  const meta = SPOTS.find((x) => x.id === spot)!;
  const spec = chartFor(stackBb, spot);
  const klass = klassOf(p.hole);
  let action = actionFromSpec(klass, spec);

  const legal = s.toAct === playerIndex ? legalActions(s) : null;
  if (action === "check" && legal && !legal.canCheck) action = "limp";
  if (action === "limp" && legal && legal.callAmount === 0) action = "check";
  if (action === "raise" && legal && !legal.canRaise && !legal.canBet) {
    action = legal.canCall ? "call" : "jam";
  }
  if (action === "call" && legal && legal.callAmount === 0) action = "check";

  const pos = positionOf(s, playerIndex);
  const seat = pos === "SB" || pos === "BB" || pos === "BTN" ? pos : "BTN";

  let sizingBb: number | null = null;
  if (action === "jam") sizingBb = (p.stack + p.committed) / bb;
  else if (action === "raise") sizingBb = spot.includes("bb_vs") ? 3 : 2;

  return {
    action,
    spot,
    spotLabel: meta.label,
    when: meta.when,
    stack: stackBb,
    klass,
    position: seat,
    rangePct: rangePercent(spec, [action]),
    continuePct: rangePercent(spec, ["jam", "raise", "call", "limp", "check"]),
    sizingBb,
    line: formatLine(s),
    ready,
  };
}

export function describeGto(d: GtoDecision): string {
  const size =
    d.action === "jam"
      ? ` all-in (${d.stack}bb)`
      : d.action === "raise" && d.sizingBb
        ? ` to ${d.sizingBb}bb`
        : "";
  if (!d.ready) {
    return `Waiting. GTO for ${d.klass} depends on how BTN/SB act. Current line: ${d.line}.`;
  }
  return `${d.stack}bb Spin GTO · ${d.spotLabel}. ${VERB[d.action]}${size} ${d.klass}. ${d.when}. This action is ${d.rangePct.toFixed(0)}% of hands; continue ${d.continuePct.toFixed(0)}%.`;
}

export function gtoToEngineAction(
  s: GameState,
  decision: GtoDecision,
): { action: PlayerAction; raiseTo?: number } {
  const legal = legalActions(s);
  if (!legal) return { action: "check" };
  const p = s.players[s.toAct ?? 0]!;
  switch (decision.action) {
    case "fold":
      return { action: legal.canCheck ? "check" : "fold" };
    case "check":
      return { action: legal.canCheck ? "check" : "fold" };
    case "limp":
    case "call":
      if (legal.canCheck) return { action: "check" };
      if (legal.canCall) return { action: "call" };
      return { action: "fold" };
    case "raise": {
      const to = Math.min(
        legal.maxRaiseTo,
        Math.max(legal.minRaiseTo, Math.round((decision.sizingBb ?? 2) * s.blinds.bb)),
      );
      if (legal.canBet) return { action: "bet", raiseTo: to };
      if (legal.canRaise) return { action: "raise", raiseTo: to };
      if (legal.canCall) return { action: "call" };
      return { action: "fold" };
    }
    case "jam":
      return { action: "allin", raiseTo: p.stack + p.committed };
    default:
      return { action: "fold" };
  }
}
