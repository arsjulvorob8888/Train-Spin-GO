import { type Card, remainingDeck, partialShuffle } from "./cards";
import { evaluateBest } from "./evaluate";

export type EquityResult = {
  equity: number;
  win: number;
  tie: number;
  lose: number;
  iterations: number;
  elapsedMs: number;
};

const EMPTY: EquityResult = {
  equity: 0,
  win: 0,
  tie: 0,
  lose: 0,
  iterations: 0,
  elapsedMs: 0,
};

/**
 * Monte Carlo equity vs N random opponent hands.
 * Completes the board uniformly from the remaining deck.
 * Target: ~2–8 ms for 800 iters / 2 opponents in modern JS.
 */
export function monteCarloEquity(
  hero: Card[],
  board: Card[],
  opponentCount: number,
  iterations: number,
): EquityResult {
  if (hero.length < 2 || opponentCount < 1 || iterations < 1) return EMPTY;

  const used = [...hero, ...board];
  const deck = remainingDeck(used);
  const need = opponentCount * 2 + (5 - board.length);
  if (deck.length < need) return EMPTY;

  const start = performance.now();
  let win = 0;
  let tie = 0;
  let lose = 0;
  let equitySum = 0;

  for (let i = 0; i < iterations; i++) {
    partialShuffle(deck, need);
    let cursor = 0;
    const oppHoles: Card[][] = [];
    for (let o = 0; o < opponentCount; o++) {
      oppHoles.push([deck[cursor++]!, deck[cursor++]!]);
    }
    const fullBoard =
      board.length >= 5 ? board : board.concat(deck.slice(cursor, cursor + (5 - board.length)));

    const heroScore = evaluateBest([...hero, ...fullBoard]).score;
    let best = heroScore;
    let winners = 1;
    let heroTiedBest = true;

    for (const hole of oppHoles) {
      const score = evaluateBest([...hole, ...fullBoard]).score;
      if (score > best) {
        best = score;
        winners = 1;
        heroTiedBest = false;
      } else if (score === best) {
        winners += 1;
      }
    }

    if (!heroTiedBest) {
      lose += 1;
    } else if (winners === 1) {
      win += 1;
      equitySum += 1;
    } else {
      tie += 1;
      equitySum += 1 / winners;
    }
  }

  return {
    equity: equitySum / iterations,
    win: win / iterations,
    tie: tie / iterations,
    lose: lose / iterations,
    iterations,
    elapsedMs: performance.now() - start,
  };
}

export function potOdds(toCall: number, pot: number): number {
  if (toCall <= 0) return 0;
  const denom = pot + toCall;
  if (denom <= 0) return 0;
  return toCall / denom;
}

export function equityAdvantage(equity: number, odds: number): number {
  return equity - odds;
}
