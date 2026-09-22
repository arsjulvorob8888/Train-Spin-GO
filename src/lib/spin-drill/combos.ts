export type ComboCard = { r: string; s: "s" | "h" | "d" | "c"; dim?: boolean };

export type Combo = {
  n: number;
  name: string;
  en: string;
  val: number;
  pct: string;
  odds: string;
  text: string;
  cards: ComboCard[];
};

export const COMBOS: Combo[] = [
  { n: 1, name: "Роял-флеш", en: "Royal Flush", val: 0.0032, pct: "0.0032%", odds: "1 из 30 940", text: "Пять старших карт от 10 до туза одной масти. Абсолютно непобедимая комбинация.", cards: [{ r: "A", s: "s" }, { r: "K", s: "s" }, { r: "Q", s: "s" }, { r: "J", s: "s" }, { r: "T", s: "s" }] },
  { n: 2, name: "Стрит-флеш", en: "Straight Flush", val: 0.0279, pct: "0.0279%", odds: "1 из 3 590", text: "Пять карт подряд одной масти. Выше та, где старшая карта больше.", cards: [{ r: "9", s: "h" }, { r: "8", s: "h" }, { r: "7", s: "h" }, { r: "6", s: "h" }, { r: "5", s: "h" }] },
  { n: 3, name: "Каре", en: "Four of a Kind", val: 0.168, pct: "0.168%", odds: "1 из 594", text: "Четыре карты одного номинала. Пятая карта — кикер.", cards: [{ r: "J", s: "s" }, { r: "J", s: "h" }, { r: "J", s: "d" }, { r: "J", s: "c" }, { r: "4", s: "s", dim: true }] },
  { n: 4, name: "Фулл-хаус", en: "Full House", val: 2.6, pct: "2.60%", odds: "1 из 37.5", text: "Тройка плюс пара. Сначала сравнивают тройку, затем пару.", cards: [{ r: "Q", s: "d" }, { r: "Q", s: "s" }, { r: "Q", s: "c" }, { r: "8", s: "h" }, { r: "8", s: "s" }] },
  { n: 5, name: "Флеш", en: "Flush", val: 3.03, pct: "3.03%", odds: "1 из 33", text: "Пять карт одной масти без последовательности.", cards: [{ r: "K", s: "c" }, { r: "T", s: "c" }, { r: "8", s: "c" }, { r: "6", s: "c" }, { r: "3", s: "c" }] },
  { n: 6, name: "Стрит", en: "Straight", val: 4.62, pct: "4.62%", odds: "1 из 21.6", text: "Пять карт подряд разных мастей. Туз сверху и снизу: A-2-3-4-5.", cards: [{ r: "T", s: "d" }, { r: "9", s: "s" }, { r: "8", s: "h" }, { r: "7", s: "c" }, { r: "6", s: "d" }] },
  { n: 7, name: "Сет / Тройка", en: "Three of a Kind", val: 4.83, pct: "4.83%", odds: "1 из 20.7", text: "Три карты одного номинала и две несвязанные карты.", cards: [{ r: "7", s: "h" }, { r: "7", s: "s" }, { r: "7", s: "d" }, { r: "K", s: "c", dim: true }, { r: "2", s: "h", dim: true }] },
  { n: 8, name: "Две пары", en: "Two Pair", val: 23.5, pct: "23.5%", odds: "1 из 4.3", text: "Две разные пары. Решает старшая, затем младшая, затем кикер.", cards: [{ r: "A", s: "d" }, { r: "A", s: "c" }, { r: "5", s: "s" }, { r: "5", s: "h" }, { r: "9", s: "d", dim: true }] },
  { n: 9, name: "Пара", en: "One Pair", val: 43.8, pct: "43.8%", odds: "1 из 2.3", text: "Две карты одного номинала. При равных парах спорят кикеры.", cards: [{ r: "T", s: "s" }, { r: "T", s: "h" }, { r: "K", s: "d", dim: true }, { r: "7", s: "c", dim: true }, { r: "3", s: "s", dim: true }] },
  { n: 10, name: "Старшая карта", en: "High Card", val: 17.4, pct: "17.4%", odds: "1 из 5.7", text: "Комбинации нет — играет самая старшая карта.", cards: [{ r: "A", s: "h" }, { r: "J", s: "s", dim: true }, { r: "8", s: "d", dim: true }, { r: "5", s: "c", dim: true }, { r: "2", s: "h", dim: true }] },
];

export function closeEnough(guess: number, truth: number): boolean {
  if (Number.isNaN(guess)) return false;
  if (truth < 0.01) return guess >= 0.001 && guess <= 0.01;
  if (truth < 0.1) return Math.abs(guess - truth) <= 0.02;
  if (truth < 1) return Math.abs(guess - truth) <= 0.08;
  if (truth < 10) return Math.abs(guess - truth) <= 0.8;
  return Math.abs(guess - truth) <= 2;
}
