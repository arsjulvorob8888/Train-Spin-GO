import { evaluateBest } from "./evaluate";
import { legalActions } from "./game";
import { decideGto, gtoToEngineAction } from "./spin";
import type { GameState, PlayerAction } from "./types";

export function chooseBotAction(s: GameState): { action: PlayerAction; raiseTo?: number } {
  const idx = s.toAct;
  if (idx === null) return { action: "check" };
  const p = s.players[idx]!;
  const legal = legalActions(s);
  if (!legal || !p.hole) return { action: legal?.canCheck ? "check" : "fold" };

  if (s.street === "preflop") {
    const gto = decideGto(s, idx);
    if (gto) return gtoToEngineAction(s, gto);
  }

  const toCall = legal.callAmount;
  const potOdds = toCall / Math.max(1, s.pot + toCall);
  const made = evaluateBest([...(p.hole ?? []), ...s.board]);
  const madeCat = made.category;
  const rand = Math.random();
  const spr = s.pot > 0 ? p.stack / s.pot : 99;

  if (toCall === 0) {
    if (madeCat >= 2 || (spr < 2.5 && madeCat >= 1)) {
      if (spr < 3 && (legal.canBet || legal.canRaise)) {
        return { action: "allin", raiseTo: p.stack + p.committed };
      }
      const bet = Math.min(legal.maxRaiseTo, Math.max(legal.minBet, Math.round(s.pot * 0.33)));
      if (legal.canBet) return { action: "bet", raiseTo: bet };
    }
    if (madeCat >= 1 && rand < 0.55) {
      const bet = Math.min(legal.maxRaiseTo, Math.max(legal.minBet, Math.round(s.pot * 0.33)));
      if (legal.canBet) return { action: "bet", raiseTo: bet };
    }
    return { action: "check" };
  }
  if (madeCat >= 3 || (spr < 2 && madeCat >= 2)) {
    if (legal.canRaise) return { action: "allin", raiseTo: p.stack + p.committed };
    if (legal.canCall) return { action: "call" };
  }
  if (madeCat >= 1 && potOdds < 0.35) {
    if (legal.canCall) return { action: "call" };
  }
  if (potOdds < 0.18 && rand < 0.25 && legal.canCall) return { action: "call" };
  if (legal.canCheck) return { action: "check" };
  return { action: "fold" };
}
