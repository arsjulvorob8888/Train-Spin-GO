import type { Card } from "./cards";
import type { Position } from "./preflop";
import type { StackDepth } from "./spin/charts";

export type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

export type PlayerAction = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export type Player = {
  id: string;
  name: string;
  stack: number;
  committed: number;
  totalCommitted: number;
  hole: [Card, Card] | null;
  folded: boolean;
  allIn: boolean;
  isHero: boolean;
  sitting: boolean;
};

export type ActionRecord = {
  playerId: string;
  name: string;
  action: PlayerAction;
  amount: number;
  street: Street;
};

export type GameState = {
  players: Player[];
  button: number;
  street: Street;
  board: Card[];
  pot: number;
  currentBet: number;
  toAct: number | null;
  lastAggressor: number | null;
  minRaise: number;
  blinds: { sb: number; bb: number };
  deck: Card[];
  winners: number[] | null;
  winAmount: number;
  handNumber: number;
  log: ActionRecord[];
  actedThisRound: boolean[];
  playerCount: 3 | 6;
  stackBb: StackDepth;
};

export type LegalActions = {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  minBet: number;
  minRaiseTo: number;
  maxRaiseTo: number;
};

export type HintAction = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "JAM" | "LIMP";

export type Hint = {
  action: HintAction;
  reason: string;
  equity: number;
  potOdds: number;
  toCall: number;
  pot: number;
  spr: number;
  handClass: string;
  handName: string;
  position: Position;
  edge: number;
  sizing: number | null;
  opponents: number;
  elapsedMs: number;
  iterations: number;
  gtoSpot?: string;
  gtoWhen?: string;
  gtoStack?: number;
  gtoRangePct?: number;
  gtoContinuePct?: number;
  gtoLine?: string;
  gtoReady?: boolean;
};

export type SeatLayout = {
  x: number;
  y: number;
  align: "left" | "center" | "right";
};

/** Percent positions on the oval felt. Hero is always south. */
export const SEAT_LAYOUT_6: SeatLayout[] = [
  { x: 50, y: 78, align: "center" },
  { x: 16, y: 62, align: "left" },
  { x: 20, y: 28, align: "left" },
  { x: 50, y: 18, align: "center" },
  { x: 80, y: 28, align: "right" },
  { x: 84, y: 62, align: "right" },
];

export const SEAT_LAYOUT_3: SeatLayout[] = [
  { x: 50, y: 78, align: "center" },
  { x: 18, y: 36, align: "left" },
  { x: 82, y: 36, align: "right" },
];

export const BOT_NAMES_6 = ["You", "Nina", "Viktor", "Olga", "Pavel", "Mira"];
export const BOT_NAMES_3 = ["You", "Nina", "Viktor"];
