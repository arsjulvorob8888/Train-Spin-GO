import type { RangeMap, SimStrategy } from "@/lib/spin-drill/sim-strategy";

const KEY = "spin-live-strategy";

export type LiveStrategy = {
  name: string;
  publishedAt: string;
  ranges: RangeMap;
  potOdds: boolean;
  edge: number;
  bluff: boolean;
  bluffFreq: number;
  adaptStack: boolean;
};

export function readLive(): LiveStrategy | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LiveStrategy;
    if (!data?.ranges || typeof data.ranges !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function publishLive(strategy: SimStrategy) {
  const live: LiveStrategy = {
    name: strategy.name || "Стратегия",
    publishedAt: new Date().toISOString(),
    ranges: strategy.ranges,
    potOdds: strategy.potOdds,
    edge: strategy.edge,
    bluff: strategy.bluff,
    bluffFreq: strategy.bluffFreq,
    adaptStack: strategy.adaptStack,
  };
  localStorage.setItem(KEY, JSON.stringify(live));
  window.dispatchEvent(new CustomEvent("spin-live", { detail: { open: true } }));
}

export function clearLive() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("spin-live"));
}
