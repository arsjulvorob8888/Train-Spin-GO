/** 3-max Spin & Go: prize is winner-take-all. ICM first = chip share. */

export function chipShare(stacks: number[]): number[] {
  const total = stacks.reduce((a, b) => a + b, 0);
  if (total <= 0) return stacks.map(() => 0);
  return stacks.map((s) => s / total);
}

/** Pot odds: fraction of the final pot you buy with a call. */
export function potOdds(toCall: number, pot: number): number {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall);
}

export function equityNeeded(toCall: number, pot: number): number {
  return potOdds(toCall, pot);
}

export function chipEvCall(equity: number, toCall: number, pot: number): number {
  return equity * pot - (1 - equity) * toCall;
}

/**
 * WTA 3-max: after you fold, ICM = your chips / total.
 * After you call a jam: win → you take the pot; lose → 0.
 * Other player's leftover chips stay in the tournament.
 */
export function wtaCallEv(opts: {
  hero: number;
  villain: number;
  other: number;
  pot: number;
  toCall: number;
  equity: number;
}): { foldIcm: number; callIcm: number; delta: number; chipEv: number } {
  const { hero, villain, other, pot, toCall, equity } = opts;
  const total = hero + villain + other + pot;
  const foldIcm = total <= 0 ? 0 : hero / total;
  const winStack = hero - toCall + pot + toCall; // hero + pot
  const remainOther = other + Math.max(0, villain - (pot - (hero - (hero - toCall))));
  // After a won all-in vs one villain: other still has `other`, villain is bust or short.
  // Simplified: villain was all-in for `toCall` effective; winner has hero-toCall+pot+toCall.
  const winTotal = winStack + other;
  const winIcm = winTotal <= 0 ? 1 : winStack / winTotal;
  const loseIcm = 0;
  const callIcm = equity * winIcm + (1 - equity) * loseIcm;
  return {
    foldIcm,
    callIcm,
    delta: callIcm - foldIcm,
    chipEv: chipEvCall(equity, toCall, pot),
  };
}

/** Fold equity of a steal vs a villain type (BB continue %). */
export function stealFoldEquity(villainContinuePct: number): number {
  return Math.max(0, Math.min(1, 1 - villainContinuePct / 100));
}

export function stealEv(opts: {
  openChips: number;
  pot: number;
  foldEq: number;
  calledEquity: number;
}): number {
  const whenCalled =
    opts.calledEquity * (opts.pot + opts.openChips) - (1 - opts.calledEquity) * opts.openChips;
  return opts.foldEq * opts.pot + (1 - opts.foldEq) * whenCalled;
}
