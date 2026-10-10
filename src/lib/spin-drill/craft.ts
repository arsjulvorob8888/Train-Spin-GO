import { handClass, RANK_CHARS, SUIT_GLYPHS, type Card } from "@/lib/poker/cards";
import { evaluateBest } from "@/lib/poker/evaluate";
import { chartRaiseTo, priceFromRaise } from "@/lib/spin-drill/equity-calc";
import { callSize, seatStack, type Line, type LineAction, type Seat } from "@/lib/spin-drill/postflop-line";

/** Prize shown in the middle of a PokerOK 3-max Spin & Gold, and the stack it starts. */
export const PRIZES: { prize: number; bb: number; note: string }[] = [
  { prize: 0.5, bb: 15, note: "$0.25 · x2 · стек 300" },
  { prize: 0.75, bb: 15, note: "$0.25 · x3 · стек 300" },
  { prize: 2, bb: 15, note: "$1 · x2 · стек 300" },
  { prize: 3, bb: 15, note: "$1 · x3 · стек 300" },
  { prize: 4, bb: 25, note: "x4 · стек 500" },
  { prize: 5, bb: 25, note: "x5 · стек 500" },
  { prize: 10, bb: 25, note: "$1 · x10 · стек 500" },
  { prize: 40, bb: 40, note: "x50 · стек 800" },
  { prize: 50, bb: 40, note: "x100 · стек 800" },
];

export type CraftBluff = {
  on: boolean;
  title: string;
  action: string;
  reasons: string[];
  equity: number;
  foldNeed: number | null;
  bet: number | null;
  pot: number | null;
};

export type CraftHand = {
  id: string;
  at: number;
  prize: number | null;
  bb: number;
  spotId: string;
  spotTitle: string;
  heroSeat: string;
  klass: string;
  hole: string;
  board: string;
  line: string;
  pot: number | null;
  toCall: number | null;
  need: number | null;
  equity: number | null;
  verdict: string;
  text: string;
  made: string | null;
  draw: string | null;
  bluff: CraftBluff | null;
  result: "" | "win" | "fold" | "hero" | "villain" | "split";
  villains: string;
  /** What the hero actually did, when the line recorded it. */
  played?: string;
};

const KEY = "spin-craft-v1";
const PRIZE_KEY = "spin-craft-prize";

export function rememberPrize(prize: number, bb: number) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PRIZE_KEY, JSON.stringify({ prize, bb }));
}

export function readPrize(): { prize: number; bb: number } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { prize?: number; bb?: number };
    if (typeof parsed.prize !== "number" || typeof parsed.bb !== "number") return null;
    return { prize: parsed.prize, bb: parsed.bb };
  } catch {
    return null;
  }
}

export function readCraft(): CraftHand[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CraftHand[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCraft(hand: CraftHand) {
  const prev = readCraft().filter((item) => item.id !== hand.id);
  localStorage.setItem(KEY, JSON.stringify([hand, ...prev].slice(0, 1000)));
}

export function findCraft(id: string): CraftHand | null {
  return readCraft().find((item) => item.id === id) ?? null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function openingPrice(spotId: string, bb: number, raiseTo: number | null): { pot: number; toCall: number } {
  if (raiseTo != null && raiseTo > 0) {
    const priced = priceFromRaise(spotId, raiseTo);
    if (priced) return priced;
  }
  const chart = chartRaiseTo(spotId, bb);
  if (chart != null) {
    const priced = priceFromRaise(spotId, chart);
    if (priced) return priced;
  }
  return { pot: 1.5, toCall: 0 };
}

const AGG = new Set<LineAction>(["bet33", "bet66", "betpot", "raise", "allin"]);

/** Pot and the call left, from the blinds through the current street. */
export function quotePot(opts: {
  spotId: string;
  bb: number;
  raiseTo: number | null;
  streetBet: number | null;
  line: Line;
  boardLength: number;
  hero: Seat;
}): { pot: number; toCall: number } {
  const base = openingPrice(opts.spotId, opts.bb, opts.raiseTo);
  if (opts.boardLength < 3) return base;
  let pot = round(base.pot + Math.max(0, base.toCall));
  let toCall = 0;
  const streets = (["flop", "turn", "river"] as const).slice(0, opts.boardLength >= 5 ? 3 : opts.boardLength === 4 ? 2 : 1);
  for (const street of streets) {
    let bet = 0;
    for (const act of opts.line[street]) {
      if (act.action === "check" || act.action === "fold") continue;
      if (act.action === "call") {
        pot = round(pot + bet);
        bet = 0;
        continue;
      }
      const sized = opts.streetBet != null && opts.streetBet > 0 && act === opts.line[street][opts.line[street].length - 1] ? opts.streetBet : null;
      const add = sized ?? (act.action === "allin" ? seatStack(act.seat, opts.bb) : (callSize(act.action, pot, seatStack(act.seat, opts.bb)) ?? 0));
      pot = round(pot + add);
      bet = add;
    }
    const last = opts.line[street][opts.line[street].length - 1];
    toCall = last && last.seat !== opts.hero && AGG.has(last.action) ? bet : 0;
  }
  return { pot, toCall };
}

export function cardLabel(card: Card): string {
  const rank = RANK_CHARS[card.rank] === "T" ? "10" : RANK_CHARS[card.rank];
  return `${rank}${SUIT_GLYPHS[card.suit]}`;
}

export function holeKlass(cards: Card[]): string {
  if (cards.length < 2) return "";
  return handClass(cards[0]!, cards[1]!);
}

export function decideShowdown(hero: Card[], villains: Card[][], board: Card[]): "" | "hero" | "villain" | "split" {
  if (hero.length < 2 || board.length < 5) return "";
  const known = villains.filter((cards) => cards.length >= 2);
  if (!known.length) return "";
  const heroScore = evaluateBest([...hero, ...board]).score;
  let ahead = true;
  let tied = false;
  for (const cards of known) {
    const score = evaluateBest([...cards, ...board]).score;
    if (score > heroScore) ahead = false;
    else if (score === heroScore) tied = true;
  }
  if (!ahead) return "villain";
  if (tied) return "split";
  return "hero";
}

export function placeText(result: CraftHand["result"]): string {
  if (result === "hero" || result === "win") return "1 место";
  if (result === "split") return "делёж";
  if (result === "fold") return "фолд";
  if (result === "villain") return "проигрыш на вскрытии";
  return "не отмечено";
}

function round2(value: number): number {
  return Math.round(value * 10) / 10;
}

export function actionFamily(label: string): "" | "fold" | "call" | "raise" | "allin" {
  const text = label.toLowerCase();
  if (/fold|фолд/.test(text)) return "fold";
  if (/all-in|allin|jam|пуш/.test(text)) return "allin";
  if (/raise|рейз|3-bet|bet|ставка/.test(text)) return "raise";
  if (/call|колл|limp|лимп|check|чек/.test(text)) return "call";
  return "";
}

/** Action we can count, from the saved click or from how the hand ended. */
export function playedOf(hand: CraftHand): string {
  if (hand.played) return hand.played;
  if (hand.result === "fold") return "fold";
  if (hand.result === "win" && actionFamily(hand.verdict) === "allin") return "allin";
  if (hand.result === "win" && actionFamily(hand.verdict) === "raise") return "raise";
  if (hand.result === "hero" || hand.result === "villain" || hand.result === "split" || hand.result === "win") return "call";
  return "";
}

/**
 * Chip result of the logged decision.
 * A win collects the pot that was already there. A lost showdown costs the call.
 * A fold adds nothing: the fold itself does not put more chips in.
 * EV replaces a priced call with equity × (pot + call) − call, the all-in EV trackers use.
 */
export function handMoney(hand: CraftHand): { net: number; ev: number } {
  const pot = hand.pot ?? 0;
  const call = Math.max(0, hand.toCall ?? 0);
  const eq = hand.equity;
  let net = 0;
  if (hand.result === "hero" || hand.result === "win") net = pot > 0 ? pot : 1.5;
  else if (hand.result === "villain") net = call > 0 ? -call : -1;
  const ev = eq != null && call > 0 ? eq * (pot + call) - call : net;
  return { net: round2(net), ev: round2(ev) };
}

export type TrackRow = {
  label: string;
  hands: number;
  winrate: number | null;
  bb100: number | null;
  ev100: number | null;
};

export type Track = {
  hands: number;
  wins: number;
  winrate: number | null;
  net: number;
  ev: number;
  bb100: number | null;
  ev100: number | null;
  vpip: number | null;
  pfr: number | null;
  wwsf: number | null;
  wtsd: number | null;
  wsd: number | null;
  match: number | null;
  curve: { net: number; ev: number }[];
  bySeat: TrackRow[];
  byStack: TrackRow[];
};

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function per100(sum: number, hands: number): number | null {
  if (hands <= 0) return null;
  return round2((sum / hands) * 100);
}

function row(label: string, hands: CraftHand[]): TrackRow {
  let wins = 0;
  let net = 0;
  let ev = 0;
  for (const hand of hands) {
    if (hand.result === "hero" || hand.result === "win") wins += 1;
    const money = handMoney(hand);
    net += money.net;
    ev += money.ev;
  }
  return { label, hands: hands.length, winrate: pct(wins, hands.length), bb100: per100(net, hands.length), ev100: per100(ev, hands.length) };
}

function stackName(bb: number): string {
  if (bb <= 10) return "до 10bb";
  if (bb <= 16) return "11–16bb";
  if (bb <= 25) return "17–25bb";
  return "26bb+";
}

function sawFlop(hand: CraftHand): boolean {
  return hand.board.split(/\s+/).filter(Boolean).length >= 3;
}

function sawShowdown(hand: CraftHand): boolean {
  return hand.result === "hero" || hand.result === "villain" || hand.result === "split";
}

export function trackHands(hands: CraftHand[]): Track {
  const ordered = hands.slice().sort((a, b) => a.at - b.at);
  let wins = 0;
  let net = 0;
  let ev = 0;
  let vpip = 0;
  let pfr = 0;
  let known = 0;
  let flop = 0;
  let flopWins = 0;
  let showdown = 0;
  let showdownWins = 0;
  let matched = 0;
  let compared = 0;
  const curve: { net: number; ev: number }[] = [];
  for (const hand of ordered) {
    if (hand.result === "hero" || hand.result === "win") wins += 1;
    const money = handMoney(hand);
    net += money.net;
    ev += money.ev;
    curve.push({ net: round2(net), ev: round2(ev) });
    const played = actionFamily(playedOf(hand));
    if (played) {
      known += 1;
      if (played !== "fold") vpip += 1;
      if (played === "raise" || played === "allin") pfr += 1;
    }
    if (sawFlop(hand)) {
      flop += 1;
      if (hand.result === "hero" || hand.result === "win") flopWins += 1;
    }
    if (sawShowdown(hand)) {
      showdown += 1;
      if (hand.result === "hero") showdownWins += 1;
    }
    const told = actionFamily(hand.verdict);
    if (played && told) {
      compared += 1;
      if (played === told) matched += 1;
    }
  }
  const seats = ["BTN", "SB", "BB"].map((seat) => row(seat, ordered.filter((hand) => hand.heroSeat === seat)));
  const stacks = ["до 10bb", "11–16bb", "17–25bb", "26bb+"].map((label) => row(label, ordered.filter((hand) => stackName(hand.bb) === label)));
  return {
    hands: ordered.length,
    wins,
    winrate: pct(wins, ordered.length),
    net: round2(net),
    ev: round2(ev),
    bb100: per100(net, ordered.length),
    ev100: per100(ev, ordered.length),
    vpip: pct(vpip, known),
    pfr: pct(pfr, known),
    wwsf: pct(flopWins, flop),
    wtsd: pct(showdown, flop),
    wsd: pct(showdownWins, showdown),
    match: pct(matched, compared),
    curve,
    bySeat: seats.filter((item) => item.hands > 0),
    byStack: stacks.filter((item) => item.hands > 0),
  };
}
