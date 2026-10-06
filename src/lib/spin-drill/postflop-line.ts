import type { Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";

export type Seat = "BTN" | "SB" | "BB";
export type StreetId = "flop" | "turn" | "river";
export type LineAction = "check" | "bet33" | "bet66" | "fold" | "call" | "raise" | "allin";

export const OPEN_ACTIONS: { id: LineAction; label: string }[] = [
  { id: "check", label: "Check" },
  { id: "bet33", label: "Bet 33%" },
  { id: "bet66", label: "Bet 66%" },
  { id: "allin", label: "All-in" },
];

export const FACING_ACTIONS: { id: LineAction; label: string }[] = [
  { id: "fold", label: "Fold" },
  { id: "call", label: "Call" },
  { id: "raise", label: "Raise" },
  { id: "allin", label: "All-in" },
];

const LABEL: Record<LineAction, string> = {
  check: "Check",
  bet33: "Bet 33%",
  bet66: "Bet 66%",
  fold: "Fold",
  call: "Call",
  raise: "Raise",
  allin: "All-in",
};

export type StreetLine = Partial<Record<Seat, LineAction>>;
export type Line = Record<StreetId, StreetLine>;

export function emptyLine(): Line {
  return { flop: {}, turn: {}, river: {} };
}

/** Postflop acting order. Heads-up is BB then SB. Three-handed is SB, BB, BTN. */
export function seatsInHand(spotId: string): Seat[] {
  if (
    spotId.startsWith("hu_") ||
    spotId === "sb_fold" ||
    spotId.startsWith("bb_vs_sb") ||
    spotId === "sb_iso" ||
    spotId === "sb_vs_bb_jam"
  ) {
    return ["BB", "SB"];
  }
  if (spotId.startsWith("bb_vs_btn")) return ["BB", "BTN"];
  return ["SB", "BB", "BTN"];
}

export function seatStack(seat: Seat, bb: number): number {
  const left = seat === "SB" ? bb - 0.5 : seat === "BB" ? bb - 1 : bb;
  return Math.round(Math.max(0.5, left) * 10) / 10;
}

const AGGRESSIVE: LineAction[] = ["bet33", "bet66", "raise", "allin"];

/** The bet the hero still has to answer. A shove on an earlier street still counts. */
export function heroFacing(
  line: Line,
  hero: Seat,
  boardLength: number,
  order: Seat[],
): { street: StreetId; seat: Seat; action: LineAction } | null {
  const streets: StreetId[] = [];
  if (boardLength >= 3) streets.push("flop");
  if (boardLength >= 4) streets.push("turn");
  if (boardLength >= 5) streets.push("river");
  let found: { street: StreetId; seat: Seat; action: LineAction } | null = null;
  for (const street of streets) {
    if (line[street][hero] === "fold" || line[street][hero] === "call" || line[street][hero] === "raise" || line[street][hero] === "allin") {
      continue;
    }
    for (const seat of order) {
      if (seat === hero) continue;
      const action = line[street][seat];
      if (action && AGGRESSIVE.includes(action)) found = { street, seat, action };
    }
  }
  return found;
}

export function lineActive(line: Line): boolean {
  return (["flop", "turn", "river"] as const).some((street) => Object.keys(line[street]).length > 0);
}

export function lineNote(line: Line): string {
  const bits: string[] = [];
  for (const street of ["flop", "turn", "river"] as const) {
    const names = (["SB", "BB", "BTN"] as const)
      .filter((seat) => line[street][seat])
      .map((seat) => `${seat} ${LABEL[line[street][seat]!]}`);
    if (names.length) bits.push(`${street === "flop" ? "флоп" : street === "turn" ? "тёрн" : "ривер"} ${names.join(", ")}`);
  }
  return bits.join(" · ");
}

export function callSize(action: LineAction, pot: number | null, stackBb: number): number | null {
  if (action === "check" || action === "fold") return 0;
  if (action === "call") return null;
  if (action === "allin") return stackBb;
  if (pot == null || pot <= 0) return null;
  if (action === "bet33") return roundBb(pot / 3);
  if (action === "bet66") return roundBb(pot * 0.66);
  return roundBb(pot);
}

function roundBb(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Pot the hero is calling, and how much he must add. User-typed pot wins. */
export function facingPrice(
  facing: { seat: Seat; action: LineAction },
  hero: Seat,
  bb: number,
  typedPot: number | null,
): { toCall: number; pot: number } {
  const heroLeft = seatStack(hero, bb);
  const oppLeft = seatStack(facing.seat, bb);
  if (facing.action === "allin") {
    const toCall = Math.min(heroLeft, oppLeft);
    const pot = typedPot != null && typedPot > 0 ? typedPot : roundBb(1.5 + oppLeft);
    return { toCall, pot };
  }
  const base = typedPot != null && typedPot > 0 ? typedPot : 1.5;
  const bet = callSize(facing.action, base, heroLeft) ?? Math.min(heroLeft, base);
  const toCall = Math.min(heroLeft, bet);
  const pot = typedPot != null && typedPot > 0 ? typedPot : roundBb(base + toCall);
  return { toCall, pot };
}

function keep(category: number, draw: boolean, action: LineAction): number {
  const pair = category === 1;
  const two = category === 2;
  const nuts = category >= 3;
  const air = category === 0 && !draw;
  if (action === "fold") return 0;
  if (action === "check") return nuts ? 0.1 : two ? 0.35 : 1;
  if (action === "bet33") return air ? 0.45 : 1;
  if (action === "bet66") {
    if (nuts || two || draw) return 1;
    if (pair) return 0.3;
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

export function narrowSeat<T extends { a: Card; b: Card; w: number }>(
  combos: T[],
  board: Card[],
  line: Line,
  seat: Seat,
): T[] {
  let current = combos;
  const steps: { action: LineAction; cards: Card[] }[] = [];
  if (line.flop[seat] && board.length >= 3) steps.push({ action: line.flop[seat]!, cards: board.slice(0, 3) });
  if (line.turn[seat] && board.length >= 4) steps.push({ action: line.turn[seat]!, cards: board.slice(0, 4) });
  if (line.river[seat] && board.length >= 5) steps.push({ action: line.river[seat]!, cards: board.slice(0, 5) });
  for (const step of steps) {
    if (step.action === "fold") return [];
    current = current
      .map((combo) => {
        const made = evaluateBest([combo.a, combo.b, ...step.cards]).category;
        const draws = analyzeDraws([combo.a, combo.b], step.cards);
        return { ...combo, w: combo.w * keep(made, draws.flushDraw || draws.oesd, step.action) };
      })
      .filter((combo) => combo.w > 0.03);
  }
  return current;
}
