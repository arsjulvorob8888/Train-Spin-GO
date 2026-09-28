import { fisherYates, fullDeck, type Card } from "@/lib/poker/cards";
import { monteCarloEquity, potOdds } from "@/lib/poker/equity";

export type PotSpot = {
  hero: [Card, Card];
  board: Card[];
  street: "Флоп" | "Тёрн";
  /** Total pot, including the bet hero must call. */
  pot: number;
  toCall: number;
  heroStack: number;
  villainStack: number;
  heroPos: string;
  villainPos: string;
  folds: string[];
  /** 0–100 */
  equity: number;
  villainEquity: number;
  required: number;
  ev: number;
  enough: boolean;
};

const POTS = [4, 5.5, 6, 8, 10, 12, 15, 18, 22.5];
const SEATS = ["UTG", "MP", "CO", "BTN", "SB", "BB"];

function money(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A postflop spot where the only question is: is the shown equity enough to call? */
export function dealPotSpot(): PotSpot {
  const deck = fisherYates(fullDeck());
  const streetCards = Math.random() < 0.7 ? 3 : 4;
  const board = deck.slice(0, streetCards);
  const hero: [Card, Card] = [deck[streetCards]!, deck[streetCards + 1]!];
  const sample = monteCarloEquity(hero, board, 1, 900);
  const equity = Number.isFinite(sample.equity) ? sample.equity : 0.45;

  const roll = Math.random();
  const gap =
    roll < 0.34 ? -(0.1 + Math.random() * 0.16) : roll < 0.68 ? 0.1 + Math.random() * 0.18 : (Math.random() - 0.5) * 0.08;
  const target = Math.min(0.6, Math.max(0.18, equity + gap));
  const pot = POTS[Math.floor(Math.random() * POTS.length)]!;
  let toCall = money((target * pot) / (1 - target));
  if (toCall < 1) toCall = 1;

  const required = potOdds(toCall, pot);
  const ev = equity * (pot + toCall) - toCall;
  const deep = pot >= 10;
  let heroStack = deep ? money(70 + Math.random() * 80) : 15;
  let villainStack = deep ? money(70 + Math.random() * 90) : 15;
  if (heroStack < toCall + 1) heroStack = money(toCall + 8);
  if (villainStack < 1) villainStack = money(toCall + 8);

  const heroPos = SEATS[Math.floor(Math.random() * SEATS.length)]!;
  const rest = SEATS.filter((s) => s !== heroPos);
  const villainPos = rest[Math.floor(Math.random() * rest.length)]!;
  const folds = SEATS.filter((s) => s !== heroPos && s !== villainPos);

  return {
    hero,
    board,
    street: streetCards === 3 ? "Флоп" : "Тёрн",
    pot,
    toCall,
    heroStack,
    villainStack,
    heroPos,
    villainPos,
    folds,
    equity: equity * 100,
    villainEquity: (1 - equity) * 100,
    required: required * 100,
    ev,
    enough: equity + 1e-6 >= required,
  };
}

export function bb(n: number): string {
  const t = Math.round(n * 10) / 10;
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}

export function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function evText(n: number): string {
  const body = (Math.round(n * 10) / 10).toFixed(1);
  return n > 0 ? `+${body}` : body;
}
