import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { emptyMix, mixOf, type Mix, type MixAction } from "@/lib/spin-drill/mix";
import { SPOTS } from "@/lib/spin-drill/spots";

export type { Mix, MixAction };
export type StyleId = "off" | "nit" | "reg" | "lag";
export type RangeMap = Record<string, Record<string, Mix>>;

export type SimStrategy = {
  name: string;
  /** Used only when fixedStack is on. Otherwise the multiplier sets the stack. */
  stackBb: number;
  fixedStack: boolean;
  potOdds: boolean;
  edge: number;
  style: StyleId;
  bluff: boolean;
  bluffFreq: number;
  adaptStack: boolean;
  /** When on, opponents use this chart too. Off: they play the built-in 15bb chart. */
  mirror: boolean;
  ranges: RangeMap;
};

export type SavedVersion = {
  id: string;
  name: string;
  savedAt: string;
  strategy: SimStrategy;
};

const KEY = "spin-sim-versions";

export function pure(action: MixAction): Mix {
  const mix = emptyMix();
  mix[action] = 100;
  return mix;
}

export function chartStrategy(): SimStrategy {
  const ranges: RangeMap = {};
  for (const spot of SPOTS) {
    const row: Record<string, Mix> = {};
    const canFold = spot.actions.includes("fold");
    for (const hand of ALL) {
      const mix = mixOf(spot.range, hand);
      if (!canFold && spot.actions.includes("call") && mix.fold) {
        mix.call += mix.fold;
        mix.fold = 0;
      }
      row[hand] = mix;
    }
    ranges[spot.id] = row;
  }
  return {
    name: "Чарт + солвер",
    stackBb: 15,
    fixedStack: false,
    potOdds: true,
    edge: 0,
    style: "off",
    bluff: false,
    bluffFreq: 0.12,
    adaptStack: true,
    mirror: false,
    ranges,
  };
}

export function cloneStrategy(strategy: SimStrategy): SimStrategy {
  return JSON.parse(JSON.stringify(strategy)) as SimStrategy;
}

export function spotChoices(): { id: string; title: string }[] {
  return SPOTS.map((spot) => ({ id: spot.id, title: spot.title }));
}

export function readVersions(): SavedVersion[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeVersions(list: SavedVersion[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
}

export function parseStrategy(raw: string): SimStrategy {
  const data = JSON.parse(raw) as Partial<SimStrategy>;
  const base = chartStrategy();
  if (!data.ranges || typeof data.ranges !== "object") throw new Error("В файле нет рейнджей");
  const ranges = cloneStrategy(base).ranges;
  for (const [spot, hands] of Object.entries(data.ranges)) {
    if (!ranges[spot] || !hands || typeof hands !== "object") continue;
    for (const [hand, value] of Object.entries(hands as Record<string, unknown>)) {
      const mix = asMix(value);
      if (mix && ranges[spot][hand]) ranges[spot][hand] = mix;
    }
  }
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Загруженная",
    stackBb: clamp(num(data.stackBb, 15), 8, 50),
    fixedStack: Boolean(data.fixedStack),
    potOdds: Boolean(data.potOdds),
    edge: clamp(num(data.edge, 0), -0.1, 0.2),
    style: data.style === "nit" || data.style === "lag" || data.style === "off" || data.style === "reg" ? data.style : "off",
    bluff: Boolean(data.bluff),
    bluffFreq: clamp(num(data.bluffFreq, 0.12), 0, 0.5),
    adaptStack: data.adaptStack !== false,
    mirror: Boolean(data.mirror),
    ranges,
  };
}

function asMix(value: unknown): Mix | null {
  if (value === "fold" || value === "call" || value === "raise" || value === "allin") return pure(value);
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Mix>;
  const mix = emptyMix();
  mix.fold = num(row.fold, 0);
  mix.call = num(row.call, 0);
  mix.raise = num(row.raise, 0);
  mix.allin = num(row.allin, 0);
  const sum = mix.fold + mix.call + mix.raise + mix.allin;
  if (sum <= 0) return pure("fold");
  if (Math.abs(sum - 100) > 0.5) {
    for (const key of ["fold", "call", "raise", "allin"] as MixAction[]) mix[key] = (mix[key] / sum) * 100;
  }
  return mix;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
