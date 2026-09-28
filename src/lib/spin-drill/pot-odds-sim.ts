import { fisherYates, fullDeck, type Card } from "@/lib/poker/cards";
import { monteCarloEquity, potOdds } from "@/lib/poker/equity";

const START = 15;

export type PotSpot = {
  hero: [Card, Card];
  board: Card[];
  street: "Флоп" | "Тёрн";
  story: string;
  heroPos: string;
  villainPos: string;
  foldPos: string;
  /** Chips in the pot before the opponent's current bet. */
  potBefore: number;
  /** What the opponent just bet, on top of potBefore. */
  bet: number;
  /** What hero must add. Equal to bet: the bet is capped by both stacks. */
  toCall: number;
  /** potBefore + bet. Does not include hero's call yet. */
  pot: number;
  heroStack: number;
  villainStack: number;
  equity: number;
  villainEquity: number;
  required: number;
  ev: number;
  enough: boolean;
};

type Line = {
  story: string;
  heroPos: string;
  villainPos: string;
  foldPos: string;
  heroIn: number;
  villainIn: number;
  foldIn: number;
};

const LINES: Line[] = [
  {
    story: "Вы на баттоне открыли 2bb. Малый блайнд сбросил. Большой блайнд уравнял.",
    heroPos: "баттон",
    villainPos: "большой блайнд",
    foldPos: "малый блайнд",
    heroIn: 2,
    villainIn: 2,
    foldIn: 0.5,
  },
  {
    story: "Баттон открыл 2bb. Малый блайнд сбросил. Вы на большом блайнде уравняли.",
    heroPos: "большой блайнд",
    villainPos: "баттон",
    foldPos: "малый блайнд",
    heroIn: 2,
    villainIn: 2,
    foldIn: 0.5,
  },
  {
    story: "Баттон сбросил. Вы на малом блайнде открыли 2.5bb. Большой блайнд уравнял.",
    heroPos: "малый блайнд",
    villainPos: "большой блайнд",
    foldPos: "баттон",
    heroIn: 2.5,
    villainIn: 2.5,
    foldIn: 0,
  },
  {
    story: "Баттон сбросил. Малый блайнд открыл 2.5bb. Вы на большом блайнде уравняли.",
    heroPos: "большой блайнд",
    villainPos: "малый блайнд",
    foldPos: "баттон",
    heroIn: 2.5,
    villainIn: 2.5,
    foldIn: 0,
  },
  {
    story: "Вы на баттоне открыли 2bb, большой блайнд 3-бет до 6bb, вы уравняли. Малый блайнд сбросил.",
    heroPos: "баттон",
    villainPos: "большой блайнд",
    foldPos: "малый блайнд",
    heroIn: 6,
    villainIn: 6,
    foldIn: 0.5,
  },
  {
    story: "Баттон открыл 2bb. Вы на большом блайнде сделали 3-бет до 6bb, баттон уравнял. Малый блайнд сбросил.",
    heroPos: "большой блайнд",
    villainPos: "баттон",
    foldPos: "малый блайнд",
    heroIn: 6,
    villainIn: 6,
    foldIn: 0.5,
  },
];

function money(n: number): number {
  return Math.round(n * 10) / 10;
}

function betFor(required: number, potBefore: number, maxBet: number): number {
  if (required >= 0.48) return maxBet;
  const raw = (required * potBefore) / (1 - 2 * required);
  const stepped = Math.round(Math.min(maxBet, Math.max(0.5, raw)) * 2) / 2;
  return Math.min(maxBet, Math.max(0.5, stepped));
}

/** Spin & Go, 3-max, 15bb. One player has folded. Opponent just bet, hero faces a call. */
export function dealPotSpot(): PotSpot {
  const deck = fisherYates(fullDeck());
  let line = LINES[Math.floor(Math.random() * LINES.length)]!;
  let street: PotSpot["street"] = "Флоп";
  let story = line.story;

  const room = Math.min(START - line.heroIn, START - line.villainIn);
  if (Math.random() < 0.35 && room >= 3) {
    const flopBet = room >= 5 ? 2 : 1;
    line = {
      ...line,
      heroIn: money(line.heroIn + flopBet),
      villainIn: money(line.villainIn + flopBet),
    };
    street = "Тёрн";
    story = `${line.story} На флопе ставка ${flopBet}bb, оба вложились.`;
  }

  const streetCards = street === "Флоп" ? 3 : 4;
  const board = deck.slice(0, streetCards);
  const hero: [Card, Card] = [deck[streetCards]!, deck[streetCards + 1]!];
  const sample = monteCarloEquity(hero, board, 1, 900);
  const equity = Number.isFinite(sample.equity) ? sample.equity : 0.45;

  const potBefore = money(line.heroIn + line.villainIn + line.foldIn);
  const heroStack = money(START - line.heroIn);
  const villainLeft = money(START - line.villainIn);
  const maxBet = Math.min(heroStack, villainLeft);

  const roll = Math.random();
  const gap =
    roll < 0.34 ? -(0.08 + Math.random() * 0.12) : roll < 0.68 ? 0.08 + Math.random() * 0.14 : (Math.random() - 0.5) * 0.06;
  const want = Math.min(0.46, Math.max(0.22, equity + gap));
  const bet = Math.random() < 0.22 ? maxBet : betFor(want, potBefore, maxBet);

  const pot = money(potBefore + bet);
  const toCall = bet;
  const required = potOdds(toCall, pot);
  const ev = equity * (pot + toCall) - toCall;

  return {
    hero,
    board,
    street,
    story,
    heroPos: line.heroPos,
    villainPos: line.villainPos,
    foldPos: line.foldPos,
    potBefore,
    bet,
    toCall,
    pot,
    heroStack,
    villainStack: money(villainLeft - bet),
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
