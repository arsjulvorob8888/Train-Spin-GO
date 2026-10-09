import { playBatch, thinCurve } from "./sim-engine";
import type { SimStrategy } from "./sim-strategy";

type Job = { ping: true } | { games: number; seed: number; strategy: SimStrategy };

self.onmessage = (event: MessageEvent<Job>) => {
  const data = event.data;
  if ("ping" in data) {
    self.postMessage({ pong: true });
    return;
  }
  const totals = playBatch(data.strategy, data.games, data.seed);
  self.postMessage({
    games: totals.games,
    profit: totals.profit,
    wins: totals.wins,
    second: totals.second,
    third: totals.third,
    sumSq: totals.sumSq,
    maxUp: totals.maxUp,
    maxDown: totals.maxDown,
    byMult: totals.byMult,
    spots: totals.spots,
    curve: thinCurve(totals.curve, 81),
  });
};
