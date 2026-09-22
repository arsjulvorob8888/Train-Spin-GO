export const RANK_CHARS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
] as const;

export const RANK_NAMES = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
] as const;

export const RANK_PLURAL = [
  "Twos",
  "Threes",
  "Fours",
  "Fives",
  "Sixes",
  "Sevens",
  "Eights",
  "Nines",
  "Tens",
  "Jacks",
  "Queens",
  "Kings",
  "Aces",
] as const;

export const SUIT_CHARS = ["c", "d", "h", "s"] as const;
export const SUIT_NAMES = ["clubs", "diamonds", "hearts", "spades"] as const;
export const SUIT_GLYPHS = ["♣", "♦", "♥", "♠"] as const;

export type RankChar = (typeof RANK_CHARS)[number];
export type SuitChar = (typeof SUIT_CHARS)[number];

export type Card = {
  rank: number;
  suit: number;
};

export function cardId(c: Card): string {
  return `${RANK_CHARS[c.rank]}${SUIT_CHARS[c.suit]}`;
}

export function parseCard(code: string): Card {
  const parsed = tryParseCard(code);
  if (!parsed) throw new Error(`Invalid card: ${code}`);
  return parsed;
}

export function tryParseCard(code: string): Card | null {
  const raw = code.trim().replace(/\s+/g, "");
  if (raw.length < 2) return null;
  const suitMap: Record<string, SuitChar> = {
    h: "h",
    d: "d",
    c: "c",
    s: "s",
    "♥": "h",
    "♦": "d",
    "♣": "c",
    "♠": "s",
  };
  const last = raw[raw.length - 1]!;
  const suitChar = suitMap[last] ?? suitMap[last.toLowerCase()];
  let rankPart = raw.slice(0, -1).toUpperCase();
  if (rankPart === "10") rankPart = "T";
  const rank = RANK_CHARS.indexOf(rankPart as RankChar);
  const suit = suitChar ? SUIT_CHARS.indexOf(suitChar) : -1;
  if (rank < 0 || suit < 0) return null;
  return { rank, suit };
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function isCardIn(list: Card[], card: Card): boolean {
  return list.some((c) => cardsEqual(c, card));
}

export function remainingDeck(used: Card[]): Card[] {
  return fullDeck().filter((c) => !isCardIn(used, c));
}

export function fisherYates<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/** Partial Fisher–Yates: shuffle only the first `need` cards into place. */
export function partialShuffle<T>(items: T[], need: number): void {
  const n = Math.min(need, items.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (items.length - i));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

export function handClass(a: Card, b: Card): string {
  const high = Math.max(a.rank, b.rank);
  const low = Math.min(a.rank, b.rank);
  if (a.rank === b.rank) return `${RANK_CHARS[high]}${RANK_CHARS[low]}`;
  const suited = a.suit === b.suit ? "s" : "o";
  return `${RANK_CHARS[high]}${RANK_CHARS[low]}${suited}`;
}

export function formatCard(c: Card): string {
  return `${RANK_CHARS[c.rank]}${SUIT_GLYPHS[c.suit]}`;
}

export function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2;
}
