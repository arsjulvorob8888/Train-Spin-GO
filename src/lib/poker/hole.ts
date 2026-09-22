import { RANK_CHARS, type Card } from "./cards";

/** Two concrete cards for a 169-hand class, for display. */
export function sampleHole(klass: string): [Card, Card] {
  if (klass.length === 2) {
    const r = RANK_CHARS.indexOf(klass[0] as (typeof RANK_CHARS)[number]);
    return [
      { rank: r, suit: 3 },
      { rank: r, suit: 2 },
    ];
  }
  const hi = RANK_CHARS.indexOf(klass[0] as (typeof RANK_CHARS)[number]);
  const lo = RANK_CHARS.indexOf(klass[1] as (typeof RANK_CHARS)[number]);
  const suited = klass[2] === "s";
  if (suited) {
    return [
      { rank: hi, suit: 2 },
      { rank: lo, suit: 2 },
    ];
  }
  return [
    { rank: hi, suit: 3 },
    { rank: lo, suit: 1 },
  ];
}
