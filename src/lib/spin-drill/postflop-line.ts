import type { Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";

export type StreetId = "flop" | "turn" | "river";
export type LineAction = "check" | "bet33" | "bet50" | "bet75" | "betpot" | "raise" | "call" | "allin";

export const LINE_ACTIONS: { id: LineAction; label: string }[] = [
  { id: "check", label: "Чек" },
  { id: "bet33", label: "Бет 33%" },
  { id: "bet50", label: "Бет 50%" },
  { id: "bet75", label: "Бет 75%" },
  { id: "betpot", label: "Бет пот" },
  { id: "raise", label: "Рейз" },
  { id: "call", label: "Колл" },
  { id: "allin", label: "Олл-ин" },
];

export type Line = Partial<Record<StreetId, LineAction>>;

const LABEL = Object.fromEntries(LINE_ACTIONS.map((item) => [item.id, item.label])) as Record<LineAction, string>;

export function lineLabel(action: LineAction): string {
  return LABEL[action];
}

export function lineNote(line: Line): string {
  const bits: string[] = [];
  if (line.flop) bits.push(`флоп ${LABEL[line.flop]}`);
  if (line.turn) bits.push(`тёрн ${LABEL[line.turn]}`);
  if (line.river) bits.push(`ривер ${LABEL[line.river]}`);
  return bits.join(" · ");
}

/** Size hero must call, in bb. Null when the pot is unknown and the size cannot be named. */
export function callSize(action: LineAction, pot: number | null, stackBb: number): number | null {
  if (action === "check") return 0;
  if (action === "call") return null;
  if (pot == null || pot <= 0) return action === "allin" ? stackBb : null;
  if (action === "bet33") return roundBb(pot / 3);
  if (action === "bet50") return roundBb(pot / 2);
  if (action === "bet75") return roundBb(pot * 0.75);
  if (action === "betpot" || action === "raise") return roundBb(pot);
  return roundBb(Math.max(pot, stackBb));
}

function roundBb(value: number): number {
  return Math.round(value * 10) / 10;
}

function keep(category: number, draw: boolean, action: LineAction): number {
  const pair = category === 1;
  const two = category === 2;
  const nuts = category >= 3;
  const air = category === 0 && !draw;
  if (action === "check") return nuts ? 0.1 : two ? 0.35 : 1;
  if (action === "bet33" || action === "bet50") return air ? 0.4 : 1;
  if (action === "bet75" || action === "betpot") {
    if (nuts || two || draw) return 1;
    if (pair) return 0.28;
    return 0.1;
  }
  if (action === "allin") {
    if (nuts || draw) return 1;
    if (two) return 0.4;
    return 0.05;
  }
  if (action === "call") {
    if (nuts) return 0.3;
    if (pair || two || draw) return 1;
    return 0.12;
  }
  if (nuts || draw) return 1;
  if (two) return 0.65;
  return 0.08;
}

export function applyLine<T extends { a: Card; b: Card; w: number }>(combos: T[], board: Card[], line: Line): T[] {
  const steps: { action: LineAction; cards: Card[] }[] = [];
  if (line.flop && board.length >= 3) steps.push({ action: line.flop, cards: board.slice(0, 3) });
  if (line.turn && board.length >= 4) steps.push({ action: line.turn, cards: board.slice(0, 4) });
  if (line.river && board.length >= 5) steps.push({ action: line.river, cards: board.slice(0, 5) });
  if (!steps.length) return combos;
  return combos
    .map((combo) => {
      let weight = combo.w;
      for (const step of steps) {
        const made = evaluateBest([combo.a, combo.b, ...step.cards]).category;
        const draws = analyzeDraws([combo.a, combo.b], step.cards);
        weight *= keep(made, draws.flushDraw || draws.oesd, step.action);
      }
      return { ...combo, w: weight };
    })
    .filter((combo) => combo.w > 0.03);
}
