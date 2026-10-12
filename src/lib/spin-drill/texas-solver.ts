import { cardId, type Card } from "@/lib/poker/cards";

/** Flip to false to drop the TexasSolver file reader without touching the chart. */
export const TEXAS_ENABLED = true;

const LEGACY_KEY = "spin-texas-v1";
const DB_NAME = "spin-texas";
const STORE = "boards";

export type TexNode = {
  actions: string[];
  table: Record<string, number[]>;
  kids: { label: string; node: TexNode }[];
};

export type TexBook = {
  id: string;
  board: string[];
  root: TexNode;
  at: number;
  name: string;
};

const memory = new Map<string, TexBook>();
let opening: Promise<void> | null = null;

function boardId(board: string[]): string {
  return [...board].sort().join("|");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function legacyBook(): TexBook | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { board?: string[]; root?: TexNode; at?: number };
    if (!parsed.root || !Array.isArray(parsed.board)) return null;
    return { id: boardId(parsed.board), board: parsed.board, root: parsed.root, at: parsed.at ?? Date.now(), name: "файл" };
  } catch {
    return null;
  }
}

export function loadTexas(): Promise<void> {
  if (!TEXAS_ENABLED || typeof indexedDB === "undefined") return Promise.resolve();
  if (opening) return opening;
  opening = (async () => {
    const db = await openDb();
    const rows = await new Promise<TexBook[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as TexBook[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    memory.clear();
    for (const row of rows) {
      if (row?.id && row.root) memory.set(row.id, row);
    }
    const old = legacyBook();
    if (old && !memory.has(old.id)) await rememberTexas(old);
    if (old) localStorage.removeItem(LEGACY_KEY);
  })().catch(() => undefined);
  return opening;
}

export async function rememberTexas(book: TexBook) {
  memory.set(book.id, book);
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(book);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function forgetTexas(id: string) {
  memory.delete(id);
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function texasBoards(): TexBook[] {
  return [...memory.values()].sort((a, b) => b.at - a.at);
}

export function texasFor(board: Card[]): TexBook | null {
  return memory.get(boardId(boardKey(board))) ?? null;
}

type Raw = Record<string, unknown>;

function asRaw(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function kidsOf(node: Raw): { label: string; raw: Raw }[] {
  const children = node.childrens ?? node.children;
  if (Array.isArray(children)) {
    const actions = Array.isArray(node.actions) ? node.actions.map(String) : [];
    return children.flatMap((item, index) => {
      const raw = asRaw(item);
      return raw ? [{ label: actions[index] ?? String(index), raw }] : [];
    });
  }
  const map = asRaw(children);
  if (!map) return [];
  return Object.entries(map).flatMap(([label, item]) => {
    const raw = asRaw(item);
    return raw ? [{ label, raw }] : [];
  });
}

function slimTable(table: Raw, actions: string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(table)) {
    if (key === "actions" || key === "strategy") continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) => Math.round(Number(item) * 1000) / 1000);
      continue;
    }
    const row = asRaw(value);
    if (!row) continue;
    out[key] = actions.map((action) => {
      const hit = Object.entries(row).find(([name]) => name.toUpperCase() === action.toUpperCase());
      return Math.round(Number(hit?.[1] ?? 0) * 1000) / 1000;
    });
  }
  return out;
}

function readTable(node: Raw): { actions: string[]; table: Record<string, number[]> } {
  const strat = asRaw(node.strategy);
  if (strat && Array.isArray(strat.actions) && asRaw(strat.strategy)) {
    const actions = strat.actions.map(String);
    return { actions, table: slimTable(asRaw(strat.strategy)!, actions) };
  }
  const actions = (Array.isArray(node.actions) ? node.actions : Array.isArray(node.valid_actions) ? node.valid_actions : []).map(String);
  if (strat) return { actions, table: slimTable(strat, actions) };
  return { actions, table: {} };
}

function slim(node: Raw, depth: number): TexNode {
  const { actions, table } = readTable(node);
  const kids = depth > 0 ? kidsOf(node).map(({ label, raw }) => ({ label, node: slim(raw, depth - 1) })) : [];
  return { actions, table, kids };
}

export function boardFromDump(value: unknown): string[] | null {
  const root = asRaw(value);
  const raw = root?.board ?? root?.board_cards;
  if (typeof raw === "string") {
    const cards = raw.split(/[\s,]+/).filter((card) => card.length >= 2);
    return cards.length >= 3 ? cards : null;
  }
  if (Array.isArray(raw)) {
    const cards = raw.map(String).filter((card) => card.length >= 2);
    return cards.length >= 3 ? cards : null;
  }
  return null;
}

export function parseTexasDump(value: unknown): TexNode {
  const root = asRaw(value);
  if (!root) throw new Error("Файл не похож на результат TexasSolver.");
  const node = slim(root, 1);
  const has = Object.keys(node.table).length > 0 || node.kids.some((kid) => Object.keys(kid.node.table).length > 0);
  if (!has) throw new Error("В файле нет таблицы стратегии. Нужен output_result.json после dump_result.");
  return node;
}

export function boardKey(cards: Card[]): string[] {
  return cards.map(cardId);
}

function sameBoard(saved: string[], current: string[]): boolean {
  return boardId(saved) === boardId(current);
}

function matchCombo(table: Record<string, number[]>, hole: [string, string]): number[] | null {
  const want = new Set(hole);
  for (const [key, freqs] of Object.entries(table)) {
    if (key.length !== 4) continue;
    const pair = new Set([key.slice(0, 2), key.slice(2)]);
    if (pair.size === want.size && [...want].every((card) => pair.has(card))) return freqs;
  }
  return null;
}

function kind(label: string): string {
  const token = label.trim().toUpperCase().replace(/[-\s]/g, "");
  for (const name of ["CHECK", "CALL", "FOLD", "ALLIN", "BET", "RAISE"]) {
    if (token.startsWith(name)) return name;
  }
  return token;
}

function amount(label: string): number {
  const found = label.replace(",", " ").match(/(\d+(?:\.\d+)?)/);
  return found ? Number(found[1]) : 0;
}

function speak(label: string): string {
  const name = kind(label);
  if (name === "CHECK") return "Check";
  if (name === "CALL") return "Call";
  if (name === "FOLD") return "Fold";
  if (name === "ALLIN") return "All-in";
  if (name === "BET") return amount(label) ? `Bet ${amount(label)}%` : "Bet";
  if (name === "RAISE") return amount(label) ? `Raise ${amount(label)}%` : "Raise";
  return label;
}

function lineFrom(node: TexNode, hole: [string, string]): { action: string; mix: string } | null {
  const freqs = matchCombo(node.table, hole);
  if (!freqs || freqs.length !== node.actions.length) return null;
  const rows = node.actions.map((label, index) => ({ label: speak(label), freq: freqs[index] ?? 0 })).filter((row) => row.freq >= 0.02);
  if (!rows.length) return null;
  rows.sort((a, b) => b.freq - a.freq);
  const top = rows[0]!;
  const mix = rows.map((row) => `${row.label} ${Math.round(row.freq * 100)}%`).join(" · ");
  return { action: top.label, mix };
}

export type TexasHit = {
  action: string;
  mix: string;
  where: string;
  board: string;
  name: string;
};

export function texasHit(book: TexBook, board: Card[], hole: [Card, Card] | null, toCall: number | null, pot: number | null, oop: boolean): TexasHit | { miss: string } | null {
  if (!hole || board.length < 3) return null;
  const current = boardKey(board);
  if (!sameBoard(book.board, current)) return null;
  const cards: [string, string] = [cardId(hole[0]), cardId(hole[1])];
  const facing = toCall != null && toCall > 0;
  const boardText = book.board.join(" ");
  if (facing) {
    const rootKinds = book.root.actions.map(kind);
    const rootHit = lineFrom(book.root, cards);
    if (rootHit && (rootKinds.includes("FOLD") || rootKinds.includes("CALL"))) {
      return { ...rootHit, where: "ответ на ставку", board: boardText, name: book.name };
    }
    const target = pot != null && pot > 0 ? (toCall / pot) * 100 : null;
    let best: TexNode | null = null;
    let gap = Infinity;
    let label = "";
    const bets = book.root.kids.filter((kid) => {
      const name = kind(kid.label);
      return name === "BET" || name === "RAISE" || name === "ALLIN";
    });
    for (const kid of bets) {
      const size = kind(kid.label) === "ALLIN" && amount(kid.label) === 0 ? 100 : amount(kid.label);
      const next = target == null ? 0 : Math.abs(size - target);
      if (next < gap) {
        gap = next;
        best = kid.node;
        label = speak(kid.label);
      }
    }
    const hit = best ? lineFrom(best, cards) : null;
    if (hit) return { ...hit, where: `в позиции после ${label || "ставки"}`, board: boardText, name: book.name };
    return { miss: "Этой руки нет в ответе на ставку. В диапазон файла она не входила." };
  }
  if (oop) {
    const own = lineFrom(book.root, cards);
    if (own) return { ...own, where: "без позиции, первый ход", board: boardText, name: book.name };
    return { miss: "Этой руки нет в линии без позиции. В диапазон файла она не входила." };
  }
  const checked = book.root.kids.find((kid) => kind(kid.label) === "CHECK");
  const after = checked ? lineFrom(checked.node, cards) : null;
  if (after) return { ...after, where: "в позиции, после чека", board: boardText, name: book.name };
  return { miss: "После чека этой руки в файле нет. Линия без позиции для вас уже не ход." };
}
