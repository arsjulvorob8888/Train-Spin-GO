/** Legal preflop buttons. Sizes only; this does not choose a strategy. */

export type OfferId = "fold" | "check" | "limp" | "call" | "raise" | "allin";

export type Offer = { id: OfferId; label: string; to: number | null };

export type LegalInput = {
  /** Chips still in front of the player, not counting what they already posted. */
  stack: number;
  posted: number;
  /** Current bet they must match, in total chips. */
  betTo: number;
  /** Size of the last full raise. 1 when nobody has raised yet. */
  lastRaise: number;
  /** Preferred raise-to. Raised to the minimum when it is too small, dropped when it is an all-in. */
  preferTo?: number | null;
  canCheck?: boolean;
  canLimp?: boolean;
};

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function trim(n: number): string {
  return String(round(n));
}

export function raiseToOf(label: string): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(label);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function legalOffers(input: LegalInput): Offer[] {
  const stack = round(Math.max(0, input.stack));
  const posted = round(Math.max(0, input.posted));
  const betTo = round(Math.max(posted, input.betTo));
  const lastRaise = round(Math.max(1, input.lastRaise));
  const toCall = round(Math.max(0, betTo - posted));
  const commit = round(posted + stack);
  const minTo = round(betTo + lastRaise);
  const out: Offer[] = [];
  const checking = Boolean(input.canCheck) && toCall <= 0.05;
  if (!checking) out.push({ id: "fold", label: "Fold", to: null });
  if (checking) out.push({ id: "check", label: "Check", to: null });
  const callIsRest = toCall > 0.05 && stack > 0 && stack <= toCall + 0.05;
  if (input.canLimp && toCall > 0.05 && stack > toCall + 0.05) out.push({ id: "limp", label: "Limp", to: betTo });
  if (toCall > 0.05 && stack > toCall + 0.05) out.push({ id: "call", label: "Call", to: betTo });
  else if (callIsRest) out.push({ id: "call", label: "Call", to: commit });
  let raiseTo: number | null = null;
  if (commit > minTo + 0.05) {
    const preferred = input.preferTo != null && input.preferTo > 0 ? round(input.preferTo) : minTo;
    const target = round(Math.max(minTo, preferred));
    if (target < commit - 0.05) raiseTo = target;
  }
  if (raiseTo != null) out.push({ id: "raise", label: `Raise ${trim(raiseTo)}`, to: raiseTo });
  if (stack > toCall + 0.05) out.push({ id: "allin", label: "All-in", to: commit });
  return out;
}

/** SB's choices after BTN opens, for the 3-max hand builder. Spot ids are existing charts, except the sized 3-bet. */
export function sbFacingBtnOpen(table: number, openTo: number): { id: OfferId; label: string; spot: string }[] {
  const prefer = table <= 14 ? 4 : table <= 18 ? 4 : table <= 22 ? 5 : 5.5;
  const offers = legalOffers({
    stack: table - 0.5,
    posted: 0.5,
    betTo: openTo,
    lastRaise: Math.max(1, openTo - 1),
    preferTo: prefer,
  });
  const spot: Partial<Record<OfferId, string>> = {
    fold: "bb_vs_btn_raise",
    call: "bb_squeeze",
    raise: "bb_vs_sb_3bet",
    allin: "bb_vs_reshove",
  };
  return offers
    .filter((offer) => spot[offer.id])
    .map((offer) => ({
      id: offer.id,
      label: offer.id === "allin" ? `All-in ${trim(table)}` : offer.label,
      spot: spot[offer.id]!,
    }));
}
