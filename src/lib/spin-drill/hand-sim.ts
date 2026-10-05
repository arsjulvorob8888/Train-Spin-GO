export type Seat = "BTN" | "SB" | "BB";
export type PfAction = "fold" | "limp" | "raise" | "call" | "allin" | "check";
export type Act = { seat: Seat; action: PfAction };

export const SEATS: Seat[] = ["BTN", "SB", "BB"];

export function putsOf(stack: number, history: Act[]): { put: Record<Seat, number>; bet: number; folded: Set<Seat>; pot: number } {
  const put: Record<Seat, number> = { BTN: 0, SB: Math.min(stack, 0.5), BB: Math.min(stack, 1) };
  let bet = put.BB;
  const folded = new Set<Seat>();
  for (const act of history) {
    if (act.action === "fold") {
      folded.add(act.seat);
      continue;
    }
    if (act.action === "check") continue;
    if (act.action === "limp") put[act.seat] = Math.min(stack, 1);
    else if (act.action === "call") put[act.seat] = Math.min(stack, bet);
    else if (act.action === "raise") {
      const limped = history.some((item) => item.action === "limp");
      const target = bet <= 1 ? (limped ? 4 : 2) : Math.min(stack, Math.max(bet * 3, bet + 1));
      put[act.seat] = Math.min(stack, Math.max(target, put[act.seat]));
    } else put[act.seat] = stack;
    bet = Math.max(bet, put[act.seat]);
  }
  return { put, bet, folded, pot: round(put.BTN + put.SB + put.BB) };
}

export function nextToAct(stack: number, history: Act[]): Seat | "over" {
  const { put, bet, folded } = putsOf(stack, history);
  const live = SEATS.filter((seat) => !folded.has(seat));
  if (live.length <= 1) return "over";
  const start = history.length === 0 ? 0 : (SEATS.indexOf(history[history.length - 1]!.seat) + 1) % 3;
  for (let i = 0; i < 3; i++) {
    const seat = SEATS[(start + i) % 3]!;
    if (folded.has(seat)) continue;
    const unmatched = put[seat] < bet - 0.01;
    const fresh = !history.some((act) => act.seat === seat);
    if (unmatched || fresh) return seat;
  }
  return "over";
}

export function liveSeats(stack: number, history: Act[]): Seat[] {
  const { folded } = putsOf(stack, history);
  return SEATS.filter((seat) => !folded.has(seat));
}

export function postOrder(seats: Seat[]): Seat[] {
  if (seats.length === 2 && seats.includes("BB") && seats.includes("SB") && !seats.includes("BTN")) return ["BB", "SB"];
  if (seats.length === 2 && seats.includes("BB") && seats.includes("BTN")) return ["BB", "BTN"];
  if (seats.length === 2 && seats.includes("SB") && seats.includes("BTN")) return ["SB", "BTN"];
  return (["SB", "BB", "BTN"] as const).filter((seat) => seats.includes(seat));
}

export function toCall(stack: number, history: Act[], seat: Seat): number {
  const { put, bet } = putsOf(stack, history);
  return round(Math.max(0, bet - put[seat]));
}

export function legal(stack: number, history: Act[], seat: Seat): PfAction[] {
  const { put, bet } = putsOf(stack, history);
  const jammed = history.some((act) => act.action === "allin") && bet > put[seat] + 0.01;
  if (jammed && bet >= stack - 0.01) return ["fold", "call"];
  if (bet >= 2 && put[seat] < bet - 0.01) return ["fold", "call", "allin"];
  if (seat === "BB" && put.BB >= bet - 0.01) return ["check", "raise", "allin"];
  if (put[seat] < 1 && bet <= 1) return ["fold", "limp", "raise", "allin"];
  return ["fold", "raise", "allin"];
}

export function actionName(action: PfAction, history: Act[]): string {
  if (action === "raise" && history.some((act) => act.action === "limp")) return "Raise 4";
  if (action === "raise") return "Raise 2";
  if (action === "allin") return "All-in";
  if (action === "limp") return "Limp";
  if (action === "call") return "Call";
  if (action === "check") return "Check";
  return "Fold";
}

export function matchSpot(hero: Seat, stack: number, history: Act[]): string | null {
  if (nextToAct(stack, history) !== hero) return null;
  const last: Partial<Record<Seat, PfAction>> = {};
  for (const act of history) last[act.seat] = act.action;
  const btn = last.BTN;
  const sb = last.SB;
  const bb = last.BB;
  if (hero === "BTN") {
    if (!btn) return "btn";
    if (btn === "raise" && (sb === "allin" || bb === "allin")) return "btn_vs_jam";
    if (btn === "raise" && (sb === "raise" || bb === "raise")) return "btn_vs_3bet";
    return null;
  }
  if (hero === "SB") {
    if (btn === "fold" && !sb) return "sb_fold";
    if (btn === "limp" && !sb) return "sb_limp";
    if (btn === "raise" && !sb) return "sb_raise";
    if (btn === "allin" && !sb) return "sb_push";
    if (btn === "fold" && sb === "limp" && bb === "raise") return "sb_iso";
    if (btn === "fold" && sb === "limp" && bb === "allin") return "sb_vs_bb_jam";
    return null;
  }
  if (btn === "raise" && sb === "fold") return "bb_vs_btn_raise";
  if (btn === "allin" && sb === "fold") return "bb_vs_btn_jam";
  if (btn === "limp" && sb === "fold") return "bb_vs_btn_limp";
  if (btn === "fold" && sb === "limp") return "bb_vs_sb_limp";
  if (btn === "fold" && sb === "raise") return "bb_vs_sb_raise";
  if (btn === "fold" && sb === "allin") return "bb_vs_sb_jam";
  if (btn === "raise" && sb === "call") return "bb_squeeze";
  if (btn === "raise" && sb === "allin") return "bb_vs_reshove";
  return null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
