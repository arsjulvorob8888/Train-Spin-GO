import { remainingDeck, type Card } from "./cards";
import { evaluateBest } from "./evaluate";

export type Matchup = { equity: number; win: number; tie: number };

/** Exact hero equity versus one known hand. Preflop is not enumerated — pass a board of 3+ cards. */
export function exactEquity(hero: Card[], villain: Card[], board: Card[]): Matchup {
  const deck = remainingDeck([...hero, ...villain, ...board]);
  const need = 5 - board.length;
  let win = 0;
  let tie = 0;
  let total = 0;

  const score = (extra: Card[]) => {
    const full = board.concat(extra);
    const h = evaluateBest([...hero, ...full]).score;
    const v = evaluateBest([...villain, ...full]).score;
    if (h > v) win += 1;
    else if (h === v) tie += 1;
    total += 1;
  };

  if (need <= 0) score([]);
  else if (need === 1) {
    for (const c of deck) score([c]);
  } else if (need === 2) {
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) score([deck[i]!, deck[j]!]);
    }
  } else {
    throw new Error("exactEquity supports a flop, turn, or river");
  }

  return { equity: (win + tie / 2) / total, win: win / total, tie: tie / total };
}
