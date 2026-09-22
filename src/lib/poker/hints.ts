import { formatCard, handClass } from "./cards";
import { analyzeDraws, evaluateBest } from "./evaluate";
import { monteCarloEquity, potOdds } from "./equity";
import { activeOpponentCount, effectiveStack, legalActions, positionOf, toCallFor } from "./game";
import { decideGto, describeGto, type GtoAction } from "./spin";
import type { GameState, Hint, HintAction } from "./types";

const GTO_HINT: Record<GtoAction, HintAction> = {
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  limp: "LIMP",
  raise: "RAISE",
  jam: "JAM",
};

export function computeHint(s: GameState, iterations = 800): Hint | null {
  const hero = s.players.find((p) => p.isHero);
  if (!hero?.hole || s.street === "waiting") return null;

  const start = performance.now();
  const heroIndex = s.players.indexOf(hero);
  const opponents = Math.max(1, activeOpponentCount(s, heroIndex));
  const toCall = toCallFor(s, heroIndex);
  const odds = potOdds(toCall, s.pot);
  const eq = monteCarloEquity(hero.hole, s.board, opponents, iterations);
  const spr = s.pot > 0 ? effectiveStack(s, heroIndex) / s.pot : 99;
  const pos = positionOf(s, heroIndex);
  const klass = handClass(hero.hole[0], hero.hole[1]);
  const made =
    s.board.length >= 3 ? evaluateBest([...hero.hole, ...s.board]) : { name: klass, category: 0 };
  const draws = s.board.length >= 3 ? analyzeDraws(hero.hole, s.board) : null;
  const legal = legalActions(s);
  const facing = toCall > 0;
  const edge = eq.equity - odds;

  let action: HintAction = "CHECK";
  let reason = "";
  let sizing: number | null = null;
  let gtoSpot: string | undefined;
  let gtoWhen: string | undefined;
  let gtoStack: number | undefined;
  let gtoRangePct: number | undefined;
  let gtoContinuePct: number | undefined;
  let gtoLine: string | undefined;
  let gtoReady: boolean | undefined;

  if (s.street === "preflop") {
    const gto = decideGto(s, heroIndex);
    if (gto) {
      action = gto.ready ? GTO_HINT[gto.action] : "CHECK";
      reason = describeGto(gto);
      sizing =
        gto.action === "jam"
          ? hero.stack + hero.committed
          : gto.action === "raise" && gto.sizingBb
            ? Math.round(gto.sizingBb * s.blinds.bb)
            : null;
      gtoSpot = gto.spotLabel;
      gtoWhen = gto.when;
      gtoStack = gto.stack;
      gtoRangePct = gto.rangePct;
      gtoContinuePct = gto.continuePct;
      gtoLine = gto.line;
      gtoReady = gto.ready;
    }
  } else {
    const drawText = draws
      ? [
          draws.flushDraw ? "flush draw" : null,
          draws.oesd ? "open-ended straight" : null,
          draws.gutshot ? "gutshot" : null,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    if (!facing) {
      if (spr < 2.5 && (eq.equity >= 0.52 || made.category >= 2)) {
        action = "JAM";
        sizing = hero.stack + hero.committed;
        reason = `Short SPR (${spr.toFixed(1)}). Jam ${klass}. ${made.name}.`;
      } else if (eq.equity >= 0.62 || made.category >= 3) {
        action = "BET";
        sizing = Math.round(s.pot * 0.33);
        reason = `Value. ${made.name}. Equity ${(eq.equity * 100).toFixed(0)}% — Spin c-bet ~1/3 pot.`;
      } else if (eq.equity >= 0.48 && spr < 6) {
        action = "BET";
        sizing = Math.round(s.pot * 0.33);
        reason = `Small SPR (${spr.toFixed(1)}). Stab ${sizing}.`;
      } else {
        action = "CHECK";
        reason = `Check. ${made.name}${drawText ? ` with ${drawText}` : ""}. Equity ${(eq.equity * 100).toFixed(0)}%.`;
      }
    } else if (spr < 2.2 && eq.equity >= odds && (made.category >= 2 || eq.equity >= 0.55) && legal?.canRaise) {
      action = "JAM";
      sizing = hero.stack + hero.committed;
      reason = `Jam over. SPR ${spr.toFixed(1)}, ${made.name}, equity ${(eq.equity * 100).toFixed(0)}%.`;
    } else if (eq.equity >= odds + 0.12 && made.category >= 2 && legal?.canRaise) {
      action = "RAISE";
      sizing = Math.round(Math.min(hero.stack + hero.committed, s.currentBet * 2.6));
      reason = `Raise for value. ${made.name}, equity ${(eq.equity * 100).toFixed(0)}%.`;
    } else if (eq.equity >= odds - 0.01 || (draws?.flushDraw && odds < 0.28) || (draws?.oesd && odds < 0.25)) {
      action = "CALL";
      reason = `Call ${toCall}. ${made.name}${drawText ? ` + ${drawText}` : ""}. Equity ${(eq.equity * 100).toFixed(0)}% vs odds ${(odds * 100).toFixed(0)}%.`;
    } else {
      action = "FOLD";
      reason = `Fold. Need ${(odds * 100).toFixed(0)}% to continue, holding ${(eq.equity * 100).toFixed(0)}%.`;
    }
  }

  return {
    action,
    reason,
    equity: eq.equity,
    potOdds: odds,
    toCall,
    pot: s.pot,
    spr,
    handClass: klass,
    handName: s.board.length >= 3 ? made.name : `${formatCard(hero.hole[0])} ${formatCard(hero.hole[1])}`,
    position: pos,
    edge,
    sizing,
    opponents,
    elapsedMs: eq.elapsedMs + (performance.now() - start - eq.elapsedMs),
    iterations: eq.iterations,
    gtoSpot,
    gtoWhen,
    gtoStack,
    gtoRangePct,
    gtoContinuePct,
    gtoLine,
    gtoReady,
  };
}

export function serializeGame(s: GameState) {
  const hero = s.players.find((p) => p.isHero);
  const heroIndex = hero ? s.players.indexOf(hero) : 0;
  const gto = hero?.hole && s.street === "preflop" ? decideGto(s, heroIndex) : null;
  return {
    hand: s.handNumber,
    format: "Spin&Go 3-max",
    street: s.street,
    stackBb: s.stackBb,
    blinds: `${s.blinds.sb} | ${s.blinds.bb}`,
    pot: s.pot,
    board: s.board.map((c) => `${c.rank}-${c.suit}`),
    gto: gto
      ? {
          spot: gto.spot,
          label: gto.spotLabel,
          when: gto.when,
          action: gto.action,
          line: gto.line,
        }
      : null,
    hero: hero
      ? {
          position: positionOf(s, heroIndex),
          stack: hero.stack,
          hole: hero.hole,
          committed: hero.committed,
        }
      : null,
    players: s.players.map((p, i) => ({
      name: p.name,
      position: positionOf(s, i),
      stack: p.stack,
      bet: p.committed,
      folded: p.folded,
      allIn: p.allIn,
      active: p.sitting && !p.folded,
    })),
    toAct: s.toAct === null ? null : s.players[s.toAct]?.name ?? null,
    winners: s.winners?.map((i) => s.players[i]?.name) ?? null,
  };
}
