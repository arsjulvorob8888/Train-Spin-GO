import type { Card } from "@/lib/poker/cards";
import { evaluateBest, unpack } from "@/lib/poker/evaluate";
import type { Mix, MixAction } from "@/lib/spin-drill/mix";
import { handPower, rangeAtStack } from "@/lib/spin-drill/stack-ranges";
import { chartStrategy, type SimStrategy, type StyleId } from "@/lib/spin-drill/sim-strategy";

export type PrizeRow = {
  mult: number;
  weight: number;
  places: [number, number, number];
  /** Starting chips. Big blind on level 1 is 20, so 300 = 15bb. */
  stack: number;
  /** Hands on each blind level. PokerOK times the short games; 8 hands ≈ 1 minute. */
  every: number;
};

/**
 * PokerOK / GG Spin & Gold, 3-max, $0.25 table, frequencies per 100,000,000 games.
 * Payouts are buy-in multipliers. x2–x5 pay only 1st. x10 pays 8/2. From x50, three places.
 */
export const PRIZES: PrizeRow[] = [
  { mult: 2, weight: 47863850, places: [2, 0, 0], stack: 300, every: 8 },
  { mult: 3, weight: 44624100, places: [3, 0, 0], stack: 300, every: 16 },
  { mult: 4, weight: 2650000, places: [4, 0, 0], stack: 500, every: 16 },
  { mult: 5, weight: 2500000, places: [5, 0, 0], stack: 500, every: 24 },
  { mult: 10, weight: 2350000, places: [8, 2, 0], stack: 500, every: 10 },
  { mult: 50, weight: 8000, places: [30, 15, 5], stack: 800, every: 15 },
  { mult: 100, weight: 4000, places: [60, 30, 10], stack: 800, every: 15 },
  { mult: 40000, weight: 50, places: [20000, 12000, 8000], stack: 1000, every: 20 },
];

const PRIZE_SUM = PRIZES.reduce((sum, row) => sum + row.weight, 0);
const BASE_RANGES = chartStrategy().ranges;
const RANKS = "23456789TJQKA";

/** Blind ladder from the PokerOK Spin & Gold structure. Level 11 in public tables is 125|250. */
const BLINDS: [number, number][] = [
  [10, 20],
  [15, 30],
  [20, 40],
  [30, 60],
  [40, 80],
  [50, 100],
  [60, 120],
  [75, 150],
  [90, 180],
  [100, 200],
  [125, 250],
  [150, 300],
  [175, 350],
  [200, 400],
  [225, 450],
  [250, 500],
  [300, 600],
  [350, 700],
  [400, 800],
  [500, 1000],
  [600, 1200],
  [750, 1500],
  [900, 1800],
  [1000, 2000],
  [1250, 2500],
  [1500, 3000],
];

export type SimTotals = {
  games: number;
  profit: number;
  wins: number;
  second: number;
  third: number;
  sumSq: number;
  maxUp: number;
  maxDown: number;
  curve: number[];
  byMult: Record<number, { games: number; profit: number; wins: number }>;
  /** Hero chip change on the hand, tagged by the first preflop spot he faced. */
  spots: Record<string, { hands: number; chips: number }>;
};

/** Break-even ROI of three equal players. Prize pool averages 2.79 buy-ins, so the field is about −7%. */
export function fieldRoi(): number {
  const pool = PRIZES.reduce((sum, row) => sum + row.mult * row.weight, 0) / PRIZE_SUM;
  return (pool / 3 - 1) * 100;
}

export function thinCurve(curve: number[], points = 81): number[] {
  if (curve.length === 0) return [0];
  if (curve.length <= points) return curve.slice();
  const last = curve.length - 1;
  const out: number[] = [];
  for (let i = 0; i < points; i++) out.push(curve[Math.round((i / (points - 1)) * last)] ?? 0);
  return out;
}

export function emptyTotals(): SimTotals {
  const byMult: SimTotals["byMult"] = {};
  for (const row of PRIZES) byMult[row.mult] = { games: 0, profit: 0, wins: 0 };
  return { games: 0, profit: 0, wins: 0, second: 0, third: 0, sumSq: 0, maxUp: 0, maxDown: 0, curve: [0], byMult, spots: {} };
}

export function addTotals(into: SimTotals, part: SimTotals) {
  into.games += part.games;
  into.profit += part.profit;
  into.wins += part.wins;
  into.second += part.second;
  into.third += part.third;
  into.sumSq += part.sumSq;
  into.maxUp = Math.max(into.maxUp, part.maxUp);
  into.maxDown = Math.min(into.maxDown, part.maxDown);
  const start = into.curve[into.curve.length - 1] ?? 0;
  for (let i = 1; i < part.curve.length; i++) into.curve.push(start + part.curve[i]!);
  if (into.curve.length > 240) {
    const step = Math.ceil(into.curve.length / 200);
    into.curve = into.curve.filter((_, i) => i % step === 0 || i === into.curve.length - 1);
  }
  for (const row of PRIZES) {
    const src = part.byMult[row.mult];
    const dst = into.byMult[row.mult]!;
    if (!src) continue;
    dst.games += src.games;
    dst.profit += src.profit;
    dst.wins += src.wins;
  }
  if (!into.spots) into.spots = {};
  for (const [id, src] of Object.entries(part.spots ?? {})) {
    const dst = into.spots[id] ?? { hands: 0, chips: 0 };
    dst.hands += src.hands;
    dst.chips += src.chips;
    into.spots[id] = dst;
  }
}

const stackCache = new Map<string, Record<string, Mix>>();

export function playBatch(strategy: SimStrategy, games: number, seed: number): SimTotals {
  stackCache.clear();
  const rng = mulberry32(seed);
  const totals = emptyTotals();
  let bank = 0;
  let peak = 0;
  let floor = 0;
  for (let i = 0; i < games; i++) {
    const result = playTournament(strategy, rng);
    bank += result.profit;
    peak = Math.max(peak, bank);
    floor = Math.min(floor, bank);
    totals.games += 1;
    totals.profit += result.profit;
    totals.sumSq += result.profit * result.profit;
    totals.curve.push(bank);
    if (result.place === 0) totals.wins += 1;
    else if (result.place === 1) totals.second += 1;
    else totals.third += 1;
    const bucket = totals.byMult[result.mult];
    if (bucket) {
      bucket.games += 1;
      bucket.profit += result.profit;
      if (result.place === 0) bucket.wins += 1;
    }
    for (const [id, src] of Object.entries(result.spots)) {
      const dst = totals.spots[id] ?? { hands: 0, chips: 0 };
      dst.hands += src.hands;
      dst.chips += src.chips;
      totals.spots[id] = dst;
    }
  }
  totals.maxUp = peak;
  totals.maxDown = floor;
  return totals;
}

type Rng = () => number;
type Seat = "BTN" | "SB" | "BB";
type Open = "fold" | "limp" | "raise" | "jam";
type Blind = { sb: number; bb: number };

type Player = {
  id: number;
  hero: boolean;
  stack: number;
  put: number;
  hand: string;
  power: number;
  in: boolean;
  seat: Seat;
  cards: Card[];
};

function playTournament(strategy: SimStrategy, rng: Rng): { profit: number; place: number; mult: number; spots: Record<string, { hands: number; chips: number }> } {
  const wheel = spin(rng);
  const stack = strategy.fixedStack ? Math.max(160, Math.round(strategy.stackBb) * 20) : wheel.stack;
  const players: Player[] = [0, 1, 2].map((id) => ({
    id,
    hero: id === 0,
    stack,
    put: 0,
    hand: "72o",
    power: 0,
    in: true,
    seat: "BTN",
    cards: [],
  }));
  let hands = 0;
  let level = 0;
  let button = Math.floor(rng() * 3);
  const busted: number[] = [];
  const spots: Record<string, { hands: number; chips: number }> = {};
  while (players.filter((p) => p.stack > 0).length > 1 && hands < 220) {
    const before = players.map((player) => player.stack);
    const mark = playHand(strategy, players, button, blindsAt(level), rng);
    if (mark.spot) {
      const row = spots[mark.spot] ?? { hands: 0, chips: 0 };
      row.hands += 1;
      row.chips += mark.chips;
      spots[mark.spot] = row;
    }
    button = nextButton(players, button);
    const fresh = rank(players.filter((player) => player.stack <= 0 && !busted.includes(player.id)), (player) => before[player.id] ?? 0, rng);
    for (const player of fresh) busted.push(player.id);
    hands += 1;
    if (hands % wheel.every === 0) level += 1;
  }
  const alive = rank(players.filter((player) => player.stack > 0), (player) => -player.stack, rng);
  const order = [...alive.map((player) => player.id), ...busted.slice().reverse()];
  const heroPlace = Math.max(0, order.indexOf(0));
  const prize = wheel.places[heroPlace] ?? 0;
  const left = players.reduce((sum, player) => sum + player.stack, 0);
  if (left !== stack * 3) throw new Error(`chip leak ${left} != ${stack * 3}`);
  return { profit: prize - 1, place: heroPlace, mult: wheel.mult, spots };
}

function rank(list: Player[], chips: (player: Player) => number, rng: Rng): Player[] {
  return list
    .map((player) => ({ player, chips: chips(player), tie: rng() }))
    .sort((a, b) => a.chips - b.chips || a.tie - b.tie)
    .map((row) => row.player);
}
function blindsAt(level: number): Blind {
  if (level < BLINDS.length) {
    const row = BLINDS[level]!;
    return { sb: row[0], bb: row[1] };
  }
  const last = BLINDS[BLINDS.length - 1]!;
  const scale = 1.25 ** (level - BLINDS.length + 1);
  return { sb: Math.round(last[0] * scale), bb: Math.round(last[1] * scale) };
}

function nextButton(players: Player[], button: number): number {
  for (let step = 1; step <= 3; step++) {
    const id = (button + step) % 3;
    if (players[id]!.stack > 0) return id;
  }
  return button;
}

function spin(rng: Rng): PrizeRow {
  let ticket = rng() * PRIZE_SUM;
  for (const row of PRIZES) {
    ticket -= row.weight;
    if (ticket <= 0) return row;
  }
  return PRIZES[0]!;
}

function playHand(strategy: SimStrategy, players: Player[], button: number, blind: Blind, rng: Rng): { spot: string; chips: number } {
  const hero = players.find((player) => player.hero);
  const before = hero?.stack ?? 0;
  let heroSpot = "";
  const finish = () => {
    const after = players.find((player) => player.hero)?.stack ?? before;
    return { spot: heroSpot, chips: after - before };
  };
  const live = players.filter((player) => player.stack > 0);
  if (live.length < 2) return { spot: "", chips: 0 };
  seatThem(live, button);
  const board = deal(live, rng);
  for (const player of live) {
    player.put = 0;
    player.in = true;
  }
  const sb = live.find((player) => player.seat === "SB") ?? live[0]!;
  const bbP = live.find((player) => player.seat === "BB") ?? live[live.length - 1]!;
  commit(sb, Math.min(sb.stack, blind.sb));
  commit(bbP, Math.min(bbP.stack, blind.bb));
  const btn = live.find((player) => player.seat === "BTN");
  const order = live.length === 2 || !btn ? [sb, bbP] : [btn, sb, bbP];
  const acted: { seat: Seat; act: Open }[] = [];
  for (let guard = 0; guard < 9; guard++) {
    let moved = false;
    for (const player of order) {
      if (!player.in || player.stack <= 0) continue;
      const maxPut = Math.max(...live.filter((p) => p.in).map((p) => p.put));
      if (player.put >= maxPut && acted.some((a) => a.seat === player.seat)) continue;
      if (player.hero && !heroSpot) heroSpot = spotId(live.length === 2 ? 2 : 3, player.seat, acted);
      const action = choose(strategy, player, live, acted, blind, rng);
      acted.push({ seat: player.seat, act: action });
      moved = true;
      if (action === "fold") {
        player.in = false;
      } else if (action === "limp") {
        commit(player, Math.max(player.put, Math.max(...live.map((p) => p.put))));
      } else if (action === "raise") {
        commit(player, raiseTo(player, live, acted, blind.bb));
      } else {
        commit(player, player.stack + player.put);
      }
      if (live.filter((p) => p.in).length <= 1) break;
    }
    const still = live.filter((p) => p.in);
    if (still.length <= 1 || !moved) break;
    const maxPut = Math.max(...still.map((p) => p.put));
    if (still.every((p) => p.put >= maxPut || p.stack <= 0)) break;
  }
  const still = live.filter((p) => p.in);
  if (still.length <= 1) {
    if (still[0]) still[0].stack += live.reduce((sum, player) => sum + player.put, 0);
    for (const player of live) player.put = 0;
    return finish();
  }
  if (still.filter((player) => player.stack > 0).length >= 2) playBoard(strategy, live, board, blind.bb, rng);
  award(live, board);
  return finish();
}

function raiseTo(player: Player, live: Player[], acted: { act: Open }[], bb: number): number {
  const prior = acted.slice(0, -1);
  const maxPut = Math.max(...live.map((p) => p.put));
  const opened = prior.some((a) => a.act === "raise" || a.act === "jam");
  const limped = prior.some((a) => a.act === "limp");
  let to = bb * 2;
  if (!opened && limped) to = bb * 4;
  else if (opened) to = Math.max(Math.round(maxPut * 2.2), bb * 5);
  return Math.min(player.stack + player.put, to);
}

function playBoard(strategy: SimStrategy, live: Player[], board: Card[], bb: number, rng: Rng) {
  for (let street = 3; street <= 5; street++) {
    const still = live.filter((player) => player.in);
    if (still.length < 2) return;
    if (still.filter((player) => player.stack > 0).length < 2) return;
    betStreet(strategy, live, board.slice(0, street), bb, rng);
  }
}

function betStreet(strategy: SimStrategy, live: Player[], board: Card[], bb: number, rng: Rng) {
  const acted = new Set<number>();
  const order = postflopOrder(live);
  for (let guard = 0; guard < 8; guard++) {
    let moved = false;
    for (const player of order) {
      if (!player.in || player.stack <= 0) continue;
      const maxPut = Math.max(...live.filter((p) => p.in).map((p) => p.put));
      if (acted.has(player.id) && player.put >= maxPut) continue;
      const toCall = Math.max(0, maxPut - player.put);
      const pot = live.reduce((sum, p) => sum + p.put, 0);
      const action = streetAction(strategy, player, board, pot, toCall, bb, rng);
      acted.add(player.id);
      moved = true;
      if (action === "fold") player.in = false;
      else if (action !== "check" && action !== "call") commit(player, actionSize(player, pot, toCall, action, bb));
      else if (action === "call") commit(player, maxPut);
      if (live.filter((p) => p.in).length <= 1) return;
    }
    const still = live.filter((player) => player.in);
    if (still.length <= 1 || !moved) return;
    const maxPut = Math.max(...still.map((player) => player.put));
    if (still.every((player) => player.put >= maxPut || player.stack <= 0)) return;
  }
}

type StreetAct = "check" | "call" | "fold" | "raise2" | "raise4" | "raise" | "allin";

/** Same thresholds as the trainer solver: Check, Raise 2, Raise 4, All-in, Call, Fold. */
function streetAction(strategy: SimStrategy, player: Player, board: Card[], pot: number, toCall: number, bb: number, rng: Rng): StreetAct {
  const made = madeCategory(player, board);
  let eq = boardEquity(player, board, made);
  if (!player.hero && strategy.style === "nit") eq -= 0.08;
  if (!player.hero && strategy.style === "lag") eq += 0.07;
  if (player.hero) eq -= strategy.edge;
  const facing = toCall > 0;
  const useSolver = player.hero ? strategy.potOdds : true;
  if (!useSolver) {
    if (!facing) {
      if (player.hero && strategy.bluff && rng() < strategy.bluffFreq && stealFold(strategy.style) >= 0.55) return "raise2";
      return "check";
    }
    return made >= 1 ? "call" : "fold";
  }
  if (facing) {
    const price = toCall / Math.max(1, pot + toCall);
    const allin = toCall >= player.stack - bb;
    if (!allin && eq >= price + 0.18 && eq >= 0.55) return "raise";
    if (eq + 0.01 >= price) return "call";
    if (player.hero && strategy.bluff && !allin && rng() < strategy.bluffFreq * 0.35 && stealFold(strategy.style) >= 0.6 && made === 0) return "raise";
    return "fold";
  }
  const monster = made >= 2;
  if (monster && eq >= 0.7) return "allin";
  if (!player.hero && strategy.style === "nit" && eq < 0.68 && rng() < 0.4) return "check";
  if (monster || eq >= 0.62) return "raise4";
  if (eq >= 0.5) return "raise2";
  if (player.hero && strategy.bluff && rng() < strategy.bluffFreq && stealFold(strategy.style) >= 0.55) return "raise2";
  if (!player.hero && strategy.style === "lag" && eq >= 0.42 && rng() < 0.18) return "raise2";
  return "check";
}

function actionSize(player: Player, pot: number, toCall: number, action: StreetAct, bb: number): number {
  const cap = player.stack + player.put;
  if (action === "allin") return cap;
  if (action === "raise") {
    const raised = player.put + toCall + Math.max(bb, toCall);
    return Math.min(cap, raised);
  }
  const frac = action === "raise2" ? 0.33 : 0.66;
  return Math.min(cap, player.put + Math.max(bb, Math.round((pot || bb) * frac)));
}

function postflopOrder(live: Player[]): Player[] {
  const active = live.filter((player) => player.in);
  if (!active.some((player) => player.seat === "BTN")) {
    const bb = active.find((player) => player.seat === "BB");
    const sb = active.find((player) => player.seat === "SB");
    return [bb, sb].filter((player): player is Player => Boolean(player));
  }
  const order: Player[] = [];
  for (const seat of ["SB", "BB", "BTN"] as Seat[]) {
    const player = active.find((item) => item.seat === seat);
    if (player) order.push(player);
  }
  return order;
}

function madeCategory(player: Player, board: Card[]): number {
  if (player.cards.length < 2 || board.length < 3) return 0;
  return unpack(evaluateBest([...player.cards, ...board]).score).category;
}

function boardEquity(player: Player, board: Card[], made: number): number {
  const hole = player.cards;
  let base = [0.36, 0.56, 0.78, 0.88, 0.91, 0.94, 0.97, 0.98, 0.99][made] ?? 0.36;
  if (made === 1 && hole.length === 2) {
    const top = Math.max(...board.map((card) => card.rank));
    if (hole[0]!.rank === hole[1]!.rank && hole[0]!.rank >= top) base = 0.7;
    else if (hole.some((card) => card.rank === top)) base = 0.64;
    else if (hole[0]!.rank === hole[1]!.rank) base = 0.6;
  }
  if (board.length >= 5) return Math.min(0.97, base);
  return Math.min(0.95, base + drawBonus(hole, board));
}

function drawBonus(hole: Card[], board: Card[]): number {
  const all = [...hole, ...board];
  const suits = [0, 0, 0, 0];
  const holeSuits = [0, 0, 0, 0];
  for (const card of all) suits[card.suit]! += 1;
  for (const card of hole) holeSuits[card.suit]! += 1;
  let bonus = 0;
  for (let suit = 0; suit < 4; suit++) {
    if (suits[suit]! >= 4 && holeSuits[suit]! > 0) bonus += board.length === 3 ? 0.16 : 0.08;
  }
  const ranks = [...new Set(all.map((card) => card.rank))].sort((a, b) => a - b);
  if (ranks.includes(12)) ranks.unshift(-1);
  let run = 1;
  let best = 1;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] === ranks[i - 1]! + 1) run += 1;
    else if (ranks[i] !== ranks[i - 1]) run = 1;
    best = Math.max(best, run);
  }
  if (best >= 4) bonus += board.length === 3 ? 0.12 : 0.06;
  return Math.min(0.2, bonus);
}

function choose(
  strategy: SimStrategy,
  player: Player,
  live: Player[],
  acted: { seat: Seat; act: Open }[],
  blind: Blind,
  rng: Rng,
): Open {
  const alive = live.length === 2 ? 2 : 3;
  const chartSpot = spotId(alive, player.seat, acted);
  const rivals = live.filter((p) => p.in && p !== player);
  const eff = Math.min(player.stack + player.put, ...rivals.map((p) => p.stack + p.put));
  const depth = eff / Math.max(1, blind.bb);
  let action = chartToOpen(sampleMix(chartLine(strategy, player, chartSpot, depth), rng), acted);
  if (!player.hero) action = styleAction(action, player.power, strategy.style, rng);
  const toCall = Math.max(0, Math.max(...live.map((p) => p.put)) - player.put);
  if (player.hero && strategy.bluff && action === "fold" && acted.length === 0 && player.seat === "BTN") {
    if (rng() < strategy.bluffFreq && stealFold(strategy.style) >= 0.55) action = depth <= 10 ? "jam" : "raise";
  }
  if (action === "fold" && toCall <= 0) action = "limp";
  return action;
}

function chartLine(strategy: SimStrategy, player: Player, spot: string, depth: number): Mix | undefined {
  const own = player.hero || strategy.mirror;
  const book = own ? strategy.ranges : BASE_RANGES;
  const base = book[spot];
  if (!base) return undefined;
  const adapt = player.hero ? strategy.adaptStack : true;
  const bb = Math.max(1, Math.min(30, Math.round(depth)));
  if (!adapt || bb === 15) return base[player.hand];
  const key = `${own ? "h" : "v"}:${spot}:${bb}`;
  let shaped = stackCache.get(key);
  if (!shaped) {
    shaped = rangeAtStack(base, spot, bb);
    stackCache.set(key, shaped);
  }
  return shaped[player.hand];
}

function sampleMix(mix: Mix | undefined, rng: Rng): MixAction {
  if (!mix) return "fold";
  const roll = rng() * 100;
  let acc = 0;
  for (const action of ["allin", "raise", "call", "fold"] as MixAction[]) {
    acc += mix[action] || 0;
    if (roll < acc) return action;
  }
  return "fold";
}

function styleAction(action: Open, power: number, style: StyleId, rng: Rng): Open {
  if (style === "off" || style === "reg") return action;
  if (style === "nit") {
    if (action !== "fold" && power < 130 && rng() < 0.22) return "fold";
    return action;
  }
  if (action === "fold" && power > 80 && rng() < 0.16) return "raise";
  return action;
}

function stealFold(style: StyleId): number {
  if (style === "nit") return 0.72;
  if (style === "lag") return 0.4;
  return 0.58;
}

function chartToOpen(action: MixAction, acted: { act: Open }[]): Open {
  if (action === "fold") return "fold";
  if (action === "allin") return "jam";
  if (action === "raise") return acted.some((a) => a.act === "jam") ? "jam" : "raise";
  return "limp";
}

function spotId(alive: number, seat: Seat, acted: { seat: Seat; act: Open }[]): string {
  const mine = acted.filter((a) => a.seat === seat);
  const faced = highest(acted.filter((a) => a.seat !== seat).map((a) => a.act));
  if (alive === 2) {
    if (seat === "SB" && mine.length === 0) return "hu_sb";
    if (seat === "SB") return faced === "jam" ? "hu_bb_jam" : "btn_vs_3bet";
    const open = acted.find((a) => a.seat === "SB")?.act;
    if (open === "jam" || faced === "jam") return "hu_bb_jam";
    if (open === "raise" || faced === "raise") return "hu_bb_raise";
    return "hu_bb_limp";
  }
  if (mine.length > 0) {
    if (seat === "BTN") return faced === "jam" ? "btn_vs_jam" : "btn_vs_3bet";
    if (seat === "SB") {
      const btn = actOf(acted, "BTN");
      if (btn === "fold") return faced === "jam" ? "sb_vs_bb_jam" : "sb_iso";
      return faced === "jam" ? "btn_vs_jam" : "btn_vs_3bet";
    }
    return faced === "jam" ? "bb_vs_reshove" : "bb_vs_btn_raise";
  }
  if (seat === "BTN") return "btn";
  const btn = actOf(acted, "BTN");
  if (seat === "SB") {
    if (btn === "limp") return "sb_limp";
    if (btn === "jam") return "sb_push";
    if (btn === "raise") return "sb_raise";
    return "sb_fold";
  }
  const sb = actOf(acted, "SB");
  if (btn === "raise" && sb === "jam") return "bb_vs_reshove";
  if (btn === "raise" && sb === "limp") return "bb_squeeze";
  if (btn === "jam" && sb === "limp") return "bb_vs_jam_call";
  if (btn === "limp" && sb === "jam") return "bb_vs_limp_jam";
  if (btn === "limp" && sb === "raise") return "bb_vs_limp_iso";
  if (btn === "limp" && sb === "limp") return "bb_vs_limp_call";
  if (btn === "fold" && sb === "limp") return "bb_vs_sb_limp";
  if (btn === "fold" && sb === "raise") return "bb_vs_sb_raise";
  if (btn === "fold" && sb === "jam") return "bb_vs_sb_jam";
  if (btn === "limp") return "bb_vs_btn_limp";
  if (btn === "jam") return "bb_vs_btn_jam";
  return "bb_vs_btn_raise";
}

function actOf(acted: { seat: Seat; act: Open }[], seat: Seat): Open {
  return acted.find((a) => a.seat === seat)?.act ?? "fold";
}

function highest(acts: Open[]): Open {
  if (acts.includes("jam")) return "jam";
  if (acts.includes("raise")) return "raise";
  if (acts.includes("limp")) return "limp";
  return "fold";
}

function seatThem(live: Player[], button: number) {
  const names: Seat[] = live.length === 2 ? ["SB", "BB"] : ["BTN", "SB", "BB"];
  live.forEach((player, index) => {
    player.seat = names[index] ?? "BB";
  });
  // live is filtered by stack, not rotated. Rotate so index 0 is the button.
  const start = live.findIndex((player) => player.id === button);
  if (start > 0) {
    const spun = live.slice(start).concat(live.slice(0, start));
    spun.forEach((player, index) => {
      player.seat = names[index] ?? "BB";
    });
    live.splice(0, live.length, ...spun);
  }
}

function deal(live: Player[], rng: Rng): Card[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  const need = live.length * 2 + 5;
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rng() * (52 - i));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  live.forEach((player, index) => {
    const a = deck[index * 2]!;
    const b = deck[index * 2 + 1]!;
    player.cards = [asCard(a), asCard(b)];
    player.hand = klass(a, b);
    player.power = handPower(player.hand);
  });
  const from = live.length * 2;
  return [0, 1, 2, 3, 4].map((i) => asCard(deck[from + i]!));
}

function asCard(id: number): Card {
  return { rank: id % 13, suit: Math.floor(id / 13) };
}

function klass(a: number, b: number): string {
  const ra = a % 13;
  const rb = b % 13;
  const high = Math.max(ra, rb);
  const low = Math.min(ra, rb);
  if (ra === rb) return `${RANKS[high]}${RANKS[low]}`;
  return `${RANKS[high]}${RANKS[low]}${Math.floor(a / 13) === Math.floor(b / 13) ? "s" : "o"}`;
}

function commit(player: Player, total: number) {
  const add = Math.max(0, Math.min(player.stack, Math.round(total) - player.put));
  player.stack -= add;
  player.put += add;
}

function award(live: Player[], board: Card[]) {
  const scores = new Map<number, number>();
  for (const player of live) {
    if (!player.in || player.cards.length < 2) continue;
    scores.set(player.id, evaluateBest([...player.cards, ...board]).score);
  }
  const levels = [...new Set(live.map((player) => player.put))].sort((a, b) => a - b);
  let prev = 0;
  for (const level of levels) {
    const slice = level - prev;
    if (slice <= 0) continue;
    const paying = live.filter((player) => player.put >= level);
    const pot = slice * paying.length;
    const contenders = paying.filter((player) => player.in);
    if (contenders.length === 1) contenders[0]!.stack += pot;
    else if (contenders.length > 1) split(contenders, scores, pot);
    prev = level;
  }
  for (const player of live) player.put = 0;
}

function split(players: Player[], scores: Map<number, number>, pot: number) {
  let best = -1;
  for (const player of players) best = Math.max(best, scores.get(player.id) ?? 0);
  const winners = players.filter((player) => (scores.get(player.id) ?? 0) === best);
  const share = Math.floor(pot / winners.length);
  let rest = pot - share * winners.length;
  for (const winner of winners) {
    winner.stack += share + (rest > 0 ? 1 : 0);
    if (rest > 0) rest -= 1;
  }
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
