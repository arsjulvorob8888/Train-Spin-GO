import type { Card } from "@/lib/poker/cards";
import { analyzeDraws, evaluateBest } from "@/lib/poker/evaluate";

export type Seat = "BTN" | "SB" | "BB";
export type StreetId = "flop" | "turn" | "river";
export type LineAction = "check" | "bet33" | "bet66" | "fold" | "call" | "raise" | "allin";

export const OPEN_ACTIONS: { id: LineAction; label: string }[] = [
  { id: "check", label: "Check" },
  { id: "bet33", label: "Raise 2" },
  { id: "bet66", label: "Raise 4" },
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
  bet33: "Raise",
  bet66: "Raise",
  fold: "Fold",
  call: "Call",
  raise: "Raise",
  allin: "All-in",
};

export type StreetLine = { seat: Seat; action: LineAction }[];
export type Line = Record<StreetId, StreetLine>;

export function emptyLine(): Line {
  return { flop: [], turn: [], river: [] };
}

export function lastBySeat(acts: StreetLine): Partial<Record<Seat, LineAction>> {
  const out: Partial<Record<Seat, LineAction>> = {};
  for (const act of acts) out[act.seat] = act.action;
  return out;
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

export type StreetState = {
  closed: boolean;
  seat: Seat | null;
  facing: boolean;
  aggressor: Seat | null;
  action: LineAction | null;
};

/** Seats already all-in before the flop in this spot. */
export function preflopAllin(spotId: string): Seat[] {
  const known: Record<string, Seat[]> = {
    bb_vs_btn_jam: ["BTN"],
    bb_vs_sb_jam: ["SB"],
    hu_bb_jam: ["SB"],
    sb_push: ["BTN"],
    sb_vs_bb_jam: ["BB"],
    bb_vs_reshove: ["SB"],
    bb_vs_limp_jam: ["SB"],
    bb_vs_jam_call: ["BTN", "SB"],
  };
  return known[spotId] ?? [];
}

function previousStreets(street: StreetId): StreetId[] {
  if (street === "turn") return ["flop"];
  if (street === "river") return ["flop", "turn"];
  return [];
}

function carried(line: Line, street: StreetId, alreadyAllin: Seat[]): { folded: Set<Seat>; allin: Set<Seat> } {
  const folded = new Set<Seat>();
  const allin = new Set<Seat>(alreadyAllin);
  for (const prev of previousStreets(street)) {
    for (const act of line[prev]) {
      if (act.action === "fold") folded.add(act.seat);
      if (act.action === "allin") allin.add(act.seat);
    }
  }
  return { folded, allin };
}

/** Who acts next. Earlier folds and all-ins stay out. A raise sends the action back around. */
export function streetStatus(order: Seat[], line: Line, street: StreetId, alreadyAllin: Seat[] = []): StreetState {
  const prior = carried(line, street, alreadyAllin);
  const folded = prior.folded;
  const allin = prior.allin;
  for (const act of line[street]) {
    if (act.action === "fold") folded.add(act.seat);
    if (act.action === "allin") allin.add(act.seat);
  }
  const acts = line[street];
  const live = order.filter((seat) => !folded.has(seat));
  const canAct = live.filter((seat) => !allin.has(seat));
  if (live.length <= 1 || canAct.length === 0) {
    return { closed: true, seat: null, facing: false, aggressor: null, action: null };
  }

  let lastAgg = -1;
  acts.forEach((act, index) => {
    if (AGGRESSIVE.includes(act.action)) lastAgg = index;
  });
  if (lastAgg < 0) {
    if (canAct.length <= 1) return { closed: true, seat: null, facing: false, aggressor: null, action: null };
    const acted = new Set(acts.map((act) => act.seat));
    const seat = order.find((item) => canAct.includes(item) && !acted.has(item)) ?? null;
    return { closed: seat == null, seat, facing: false, aggressor: null, action: null };
  }

  const aggressor = acts[lastAgg]!.seat;
  const action = acts[lastAgg]!.action;
  const responded = new Set(acts.slice(lastAgg + 1).map((act) => act.seat));
  const start = Math.max(0, order.indexOf(aggressor));
  for (let step = 1; step <= order.length; step++) {
    const seat = order[(start + step) % order.length]!;
    if (!canAct.includes(seat) || seat === aggressor || responded.has(seat)) continue;
    return { closed: false, seat, facing: true, aggressor, action };
  }
  return { closed: true, seat: null, facing: false, aggressor, action };
}

/** Seats who can still bet, in postflop order. */
export function actingOrder(order: Seat[], line: Line, street: StreetId, alreadyAllin: Seat[] = []): Seat[] {
  const prior = carried(line, street, alreadyAllin);
  for (const act of line[street]) {
    if (act.action === "fold") prior.folded.add(act.seat);
    if (act.action === "allin") prior.allin.add(act.seat);
  }
  return order.filter((seat) => !prior.folded.has(seat) && !prior.allin.has(seat));
}

export function openStreet(
  line: Line,
  boardLength: number,
  order: Seat[],
  alreadyAllin: Seat[] = [],
): { street: StreetId; status: StreetState } | null {
  const streets: StreetId[] = [];
  if (boardLength >= 3) streets.push("flop");
  if (boardLength >= 4) streets.push("turn");
  if (boardLength >= 5) streets.push("river");
  for (const street of streets) {
    const status = streetStatus(order, line, street, alreadyAllin);
    if (!status.closed) return { street, status };
  }
  return null;
}

/** The bet the hero still has to answer on his turn. */
export function heroFacing(
  line: Line,
  hero: Seat,
  boardLength: number,
  order: Seat[],
  alreadyAllin: Seat[] = [],
): { street: StreetId; seat: Seat; action: LineAction } | null {
  const open = openStreet(line, boardLength, order, alreadyAllin);
  if (!open || open.status.seat !== hero || !open.status.facing || !open.status.action || !open.status.aggressor) return null;
  return { street: open.street, seat: open.status.aggressor, action: open.status.action };
}

export function lineActive(line: Line): boolean {
  return (["flop", "turn", "river"] as const).some((street) => line[street].length > 0);
}

export function lineNote(line: Line): string {
  const bits: string[] = [];
  for (const street of ["flop", "turn", "river"] as const) {
    if (!line[street].length) continue;
    const names = line[street].map((act) => `${act.seat} ${LABEL[act.action]}`);
    bits.push(`${street === "flop" ? "флоп" : street === "turn" ? "тёрн" : "ривер"} ${names.join(" → ")}`);
  }
  return bits.join(" · ");
}

export function callSize(action: LineAction, pot: number | null, stackBb: number): number | null {
  if (action === "check" || action === "fold") return 0;
  if (action === "call") return null;
  if (action === "allin") return stackBb;
  if (pot == null || pot <= 0) return null;
  if (action === "bet33") return roundMult(pot / 3);
  if (action === "bet66") return roundMult((pot * 2) / 3);
  return roundMult(pot);
}

function roundMult(value: number): number {
  return Math.max(1, Math.round(value * 2) / 2);
}

/** Size the way the charts write it: Raise 2, Raise 2.5, Raise 4.5. */
export function actionTitle(action: LineAction, pot: number | null, stackBb: number): string {
  if (action === "check") return "Check";
  if (action === "fold") return "Fold";
  if (action === "call") return "Call";
  if (action === "allin") return "All-in";
  const size = callSize(action, pot != null && pot > 0 ? pot : 6, stackBb);
  const stepped = size ?? (action === "bet33" ? 2 : action === "bet66" ? 4 : 4);
  const text = Number.isInteger(stepped) ? String(stepped) : stepped.toFixed(1);
  return `Raise ${text}`;
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
  if (board.length >= 3) {
    for (const act of line.flop) if (act.seat === seat) steps.push({ action: act.action, cards: board.slice(0, 3) });
  }
  if (board.length >= 4) {
    for (const act of line.turn) if (act.seat === seat) steps.push({ action: act.action, cards: board.slice(0, 4) });
  }
  if (board.length >= 5) {
    for (const act of line.river) if (act.seat === seat) steps.push({ action: act.action, cards: board.slice(0, 5) });
  }
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
