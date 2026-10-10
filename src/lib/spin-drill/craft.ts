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
  localStorage.setItem(KEY, JSON.stringify([hand, ...prev].slice(0, 200)));
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
