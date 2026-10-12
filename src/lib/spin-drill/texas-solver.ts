import { cardId, type Card } from "@/lib/poker/cards";

/** Flip to false to drop the TexasSolver file reader without touching the chart. */
export const TEXAS_ENABLED = true;

const STORAGE_KEY = "spin-texas-v1";

export type TexNode = {
  actions: string[];
  table: Record<string, number[]>;
  kids: { label: string; node: TexNode }[];
};

export type TexBook = {
  board: string[];
  root: TexNode;
  at: number;
  kept: "saved" | "session";
};

let memory: TexBook | null = null;

export function readTexas(): TexBook | null {
  if (!TEXAS_ENABLED) return null;
  if (memory) return memory;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TexBook;
    if (!parsed?.root || !Array.isArray(parsed.board)) return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTexas(book: TexBook | null) {
  memory = book;
  if (typeof localStorage === "undefined") return;
  if (!book) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...book, kept: "saved" }));
    memory = { ...book, kept: "saved" };
  } catch {
    memory = { ...book, kept: "session" };
  }
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

function slimTable(table: Raw): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(table)) {
    if (key === "actions" || key === "strategy" || !Array.isArray(value)) continue;
    out[key] = value.map((item) => Math.round(Number(item) * 1000) / 1000);
  }
  return out;
}

function readTable(node: Raw): { actions: string[]; table: Record<string, number[]> } {
  const strat = asRaw(node.strategy);
  if (strat && Array.isArray(strat.actions) && asRaw(strat.strategy)) {
    return { actions: strat.actions.map(String), table: slimTable(asRaw(strat.strategy)!) };
  }
  const actions = (Array.isArray(node.actions) ? node.actions : Array.isArray(node.valid_actions) ? node.valid_actions : []).map(String);
  if (strat) return { actions, table: slimTable(strat) };
  return { actions, table: {} };
}

function slim(node: Raw, depth: number): TexNode {
  const { actions, table } = readTable(node);
  const kids = depth > 0 ? kidsOf(node).map(({ label, raw }) => ({ label, node: slim(raw, depth - 1) })) : [];
  return { actions, table, kids };
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
  if (saved.length !== current.length) return false;
  const left = [...saved].sort().join("|");
  return left === [...current].sort().join("|");
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
  kept: TexBook["kept"];
};

export function texasHit(book: TexBook, board: Card[], hole: [Card, Card] | null, toCall: number | null, pot: number | null): TexasHit | { miss: string } | null {
  if (!hole || board.length < 3) return null;
  const current = boardKey(board);
  if (!sameBoard(book.board, current)) {
    return { miss: `Файл посчитан на ${book.board.join(" ")}, а сейчас другой борд.` };
  }
  const cards: [string, string] = [cardId(hole[0]), cardId(hole[1])];
  const facing = toCall != null && toCall > 0;
  if (facing) {
    const rootKinds = book.root.actions.map(kind);
    const rootHit = lineFrom(book.root, cards);
    if (rootHit && (rootKinds.includes("FOLD") || rootKinds.includes("CALL"))) {
      return { ...rootHit, where: "ответ на ставку", board: book.board.join(" "), kept: book.kept };
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
    if (hit) return { ...hit, where: `после ${label || "ставки"}`, board: book.board.join(" "), kept: book.kept };
    return { miss: "Этой руки нет в ответе на ставку. Проверьте диапазон, с которым считали файл." };
  }
  const own = lineFrom(book.root, cards);
  if (own) return { ...own, where: "без ставки, первый ход", board: book.board.join(" "), kept: book.kept };
  const checked = book.root.kids.find((kid) => kind(kid.label) === "CHECK");
  const after = checked ? lineFrom(checked.node, cards) : null;
  if (after) return { ...after, where: "после чека", board: book.board.join(" "), kept: book.kept };
  return { miss: "Этой руки нет в файле. В диапазон TexasSolver она не входила." };
}
