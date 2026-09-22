import {
  fisherYates,
  fullDeck,
} from "./cards";
import { evaluateBest } from "./evaluate";
import type { Position } from "./preflop";
import type {
  ActionRecord,
  GameState,
  LegalActions,
  Player,
  PlayerAction,
  Street,
} from "./types";
import { BOT_NAMES_3, BOT_NAMES_6 } from "./types";
import type { StackDepth } from "./spin/charts";

const STREETS: Street[] = ["preflop", "flop", "turn", "river", "showdown"];

function namesFor(count: 3 | 6): string[] {
  return count === 3 ? BOT_NAMES_3 : BOT_NAMES_6;
}

export function chipsFor(stackBb: number, bb = 20): number {
  return stackBb * bb;
}

export function createTable(playerCount: 3 | 6 = 3, stackBb: StackDepth = 15): GameState {
  const names = namesFor(playerCount);
  const bb = 20;
  const chips = chipsFor(stackBb, bb);
  const players: Player[] = names.map((name, i) => ({
    id: String(i),
    name,
    stack: chips,
    committed: 0,
    totalCommitted: 0,
    hole: null,
    folded: false,
    allIn: false,
    isHero: i === 0,
    sitting: true,
  }));
  return {
    players,
    button: playerCount - 1,
    street: "waiting",
    board: [],
    pot: 0,
    currentBet: 0,
    toAct: null,
    lastAggressor: null,
    minRaise: bb,
    blinds: { sb: 10, bb },
    deck: [],
    winners: null,
    winAmount: 0,
    handNumber: 0,
    log: [],
    actedThisRound: players.map(() => false),
    playerCount,
    stackBb,
  };
}

function livePlayers(s: GameState): Player[] {
  return s.players.filter((p) => p.sitting && !p.folded);
}

function nextOccupied(s: GameState, from: number, step = 1): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i * step + n * 8) % n;
    const p = s.players[idx]!;
    if (p.sitting) return idx;
  }
  return from;
}

function nextToAct(s: GameState, from: number): number | null {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    const p = s.players[idx]!;
    if (p.sitting && !p.folded && !p.allIn) return idx;
  }
  return null;
}

export function positionOf(s: GameState, index: number): Position {
  const n = s.players.filter((p) => p.sitting).length;
  const seats: number[] = [];
  let cur = s.button;
  for (let i = 0; i < n; i++) {
    seats.push(cur);
    cur = nextOccupied(s, cur);
  }
  const order = seats.indexOf(index);
  if (n === 2) {
    return order === 0 ? "BTN" : "BB";
  }
  if (n === 3) {
    return (["BTN", "SB", "BB"] as Position[])[order] ?? "BTN";
  }
  const map6: Position[] = ["BTN", "SB", "BB", "UTG", "MP", "CO"];
  return map6[order] ?? "MP";
}

function post(s: GameState, idx: number, amount: number): void {
  const p = s.players[idx]!;
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.committed += pay;
  p.totalCommitted += pay;
  s.pot += pay;
  if (p.stack === 0) p.allIn = true;
}

export function dealHand(prev: GameState): GameState {
  const s: GameState = structuredClone(prev);
  const chips = chipsFor(s.stackBb, s.blinds.bb);
  for (const p of s.players) {
    p.stack = chips;
    p.committed = 0;
    p.totalCommitted = 0;
    p.hole = null;
    p.folded = false;
    p.allIn = false;
    p.sitting = true;
  }
  s.button = nextOccupied(s, s.button);
  s.board = [];
  s.pot = 0;
  s.winners = null;
  s.winAmount = 0;
  s.log = [];
  s.handNumber += 1;
  s.street = "preflop";
  s.deck = fisherYates(fullDeck());

  const sb = nextOccupied(s, s.button);
  const bb = nextOccupied(s, sb);
  post(s, sb, s.blinds.sb);
  post(s, bb, s.blinds.bb);
  s.currentBet = s.blinds.bb;
  s.minRaise = s.blinds.bb;
  s.lastAggressor = bb;

  for (const p of s.players) {
    if (!p.sitting) continue;
    const a = s.deck.pop()!;
    const b = s.deck.pop()!;
    p.hole = [a, b];
  }

  s.actedThisRound = s.players.map(() => false);
  const utg = nextOccupied(s, bb);
  s.toAct = s.players[utg]!.allIn ? nextToAct(s, utg) : utg;
  if (countCanAct(s) <= 1) {
    return runOut(s);
  }
  return s;
}

function countCanAct(s: GameState): number {
  return s.players.filter((p) => p.sitting && !p.folded && !p.allIn).length;
}

export function legalActions(s: GameState): LegalActions | null {
  if (s.toAct === null || s.street === "showdown" || s.street === "waiting") return null;
  const p = s.players[s.toAct]!;
  const toCall = Math.max(0, s.currentBet - p.committed);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && p.stack > 0;
  const callAmount = Math.min(toCall, p.stack);
  const minBet = s.blinds.bb;
  const minRaiseTo = s.currentBet + s.minRaise;
  const canBet = toCall === 0 && p.stack > minBet;
  const canRaise = toCall > 0 && p.stack > toCall && p.stack + p.committed > s.currentBet;
  return {
    canFold: !canCheck,
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    minBet,
    minRaiseTo: Math.min(minRaiseTo, p.stack + p.committed),
    maxRaiseTo: p.stack + p.committed,
  };
}

function streetOver(s: GameState): boolean {
  const live = livePlayers(s);
  if (live.length <= 1) return true;
  const canAct = live.filter((p) => !p.allIn);
  if (canAct.length === 0) return true;
  if (canAct.length === 1 && canAct[0]!.committed >= s.currentBet) {
    const othersNeed = live.some((p) => !p.allIn && p !== canAct[0] && p.committed < s.currentBet);
    if (!othersNeed) return true;
  }
  for (const p of canAct) {
    if (p.committed < s.currentBet) return false;
    const idx = s.players.indexOf(p);
    if (!s.actedThisRound[idx]) return false;
  }
  return true;
}

function dealBoard(s: GameState, n: number): void {
  s.deck.pop();
  for (let i = 0; i < n; i++) s.board.push(s.deck.pop()!);
}

function advanceStreet(s: GameState): GameState {
  const live = livePlayers(s);
  if (live.length <= 1) return awardUncontested(s);

  for (const p of s.players) p.committed = 0;
  s.currentBet = 0;
  s.minRaise = s.blinds.bb;
  s.lastAggressor = null;
  s.actedThisRound = s.players.map(() => false);

  const idx = STREETS.indexOf(s.street);
  const next = STREETS[idx + 1] ?? "showdown";
  s.street = next;

  if (next === "flop") dealBoard(s, 3);
  else if (next === "turn" || next === "river") dealBoard(s, 1);

  if (next === "showdown") return showdown(s);

  if (countCanAct(s) <= 1) return runOut(s);

  const first = nextToAct(s, s.button);
  s.toAct = first;
  return s;
}

function runOut(s: GameState): GameState {
  while (s.street !== "showdown") {
    const idx = STREETS.indexOf(s.street);
    const next = STREETS[idx + 1] ?? "showdown";
    if (next === "flop" && s.board.length === 0) dealBoard(s, 3);
    else if ((next === "turn" || next === "river") && s.board.length < (next === "turn" ? 4 : 5)) {
      dealBoard(s, 1);
    }
    s.street = next;
  }
  return showdown(s);
}

function awardUncontested(s: GameState): GameState {
  const winner = livePlayers(s)[0];
  if (!winner) return s;
  winner.stack += s.pot;
  s.winners = [s.players.indexOf(winner)];
  s.winAmount = s.pot;
  s.street = "showdown";
  s.toAct = null;
  return s;
}

function showdown(s: GameState): GameState {
  s.street = "showdown";
  s.toAct = null;
  const live = livePlayers(s);
  if (live.length === 1) return awardUncontested(s);

  const scored = live.map((p) => ({
    p,
    score: evaluateBest([...(p.hole ?? []), ...s.board]).score,
  }));
  const best = Math.max(...scored.map((x) => x.score));
  const winners = scored.filter((x) => x.score === best).map((x) => x.p);
  const share = Math.floor(s.pot / winners.length);
  const remainder = s.pot - share * winners.length;
  winners.forEach((p, i) => {
    p.stack += share + (i === 0 ? remainder : 0);
  });
  s.winners = winners.map((p) => s.players.indexOf(p));
  s.winAmount = share;
  return s;
}

export function applyAction(
  prev: GameState,
  action: PlayerAction,
  raiseTo?: number,
): GameState {
  if (prev.toAct === null) return prev;
  const s: GameState = structuredClone(prev);
  const idx = s.toAct!;
  const p = s.players[idx]!;
  const legal = legalActions(s);
  if (!legal) return prev;

  let recordAction: PlayerAction = action;
  let amount = 0;

  if (action === "fold") {
    p.folded = true;
  } else if (action === "check") {
    if (!legal.canCheck) return prev;
  } else if (action === "call") {
    const pay = legal.callAmount;
    post(s, idx, pay);
    amount = pay;
    if (p.allIn) recordAction = "allin";
  } else if (action === "bet" || action === "raise" || action === "allin") {
    const target =
      action === "allin"
        ? p.stack + p.committed
        : Math.max(legal.minRaiseTo, Math.min(raiseTo ?? legal.minRaiseTo, legal.maxRaiseTo));
    const pay = Math.max(0, target - p.committed);
    const raiseSize = target - s.currentBet;
    post(s, idx, pay);
    amount = pay;
    if (target > s.currentBet) {
      if (raiseSize >= s.minRaise || p.allIn) {
        s.minRaise = Math.max(s.minRaise, raiseSize);
      }
      s.currentBet = p.committed;
      s.lastAggressor = idx;
      s.actedThisRound = s.players.map((pl, i) => i === idx || pl.folded || pl.allIn);
    }
    recordAction = p.allIn ? "allin" : s.currentBet > (prev.currentBet || 0) && prev.currentBet === 0 ? "bet" : "raise";
  }

  s.actedThisRound[idx] = true;
  s.log.push({
    playerId: p.id,
    name: p.name,
    action: recordAction,
    amount,
    street: s.street,
  });

  const remaining = livePlayers(s);
  if (remaining.length <= 1) return awardUncontested(s);

  if (streetOver(s)) return advanceStreet(s);

  s.toAct = nextToAct(s, idx);
  if (s.toAct === null) return advanceStreet(s);
  return s;
}

export function effectiveStack(s: GameState, heroIndex = 0): number {
  const hero = s.players[heroIndex]!;
  const others = s.players.filter((p) => !p.isHero && !p.folded && p.sitting);
  if (!others.length) return hero.stack;
  const maxOther = Math.max(...others.map((p) => p.stack));
  return Math.min(hero.stack, maxOther);
}

export function activeOpponentCount(s: GameState, heroIndex = 0): number {
  return s.players.filter((p, i) => i !== heroIndex && p.sitting && !p.folded).length;
}

export function toCallFor(s: GameState, index: number): number {
  const p = s.players[index]!;
  return Math.max(0, s.currentBet - p.committed);
}
