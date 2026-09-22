import { positionOf } from "../game";
import type { GameState, PlayerAction } from "../types";
import type { SpotId } from "./charts";

export type Line = "none" | "fold" | "limp" | "call" | "raise" | "jam";

function classifyAct(action: PlayerAction, amount: number, bb: number, committedBefore: number): Line {
  if (action === "fold") return "fold";
  if (action === "allin") return "jam";
  if (action === "check") return "limp";
  if (action === "call") {
    // Limp / complete = putting in only the big blind. Calling a raise is "call".
    return committedBefore + amount <= bb + 1 ? "limp" : "call";
  }
  if (action === "raise" || action === "bet") {
    return amount + committedBefore >= bb * 8 ? "jam" : "raise";
  }
  return "none";
}

export function preflopLines(s: GameState): { BTN: Line; SB: Line; BB: Line } {
  const lines: { BTN: Line; SB: Line; BB: Line } = { BTN: "none", SB: "none", BB: "none" };
  const bb = s.blinds.bb;
  for (const rec of s.log) {
    if (rec.street !== "preflop") continue;
    const idx = s.players.findIndex((p) => p.id === rec.playerId);
    if (idx < 0) continue;
    const pos = positionOf(s, idx);
    if (pos !== "BTN" && pos !== "SB" && pos !== "BB") continue;
    const posted = pos === "SB" ? s.blinds.sb : pos === "BB" ? s.blinds.bb : 0;
    lines[pos] = classifyAct(rec.action, rec.amount, bb, posted);
  }
  return lines;
}

export function formatLine(s: GameState): string {
  const L = preflopLines(s);
  const bit = (pos: "BTN" | "SB" | "BB") => (L[pos] === "none" ? `${pos} …` : `${pos} ${L[pos]}`);
  return `${bit("BTN")} · ${bit("SB")} · ${bit("BB")}`;
}

export function isSpotDetermined(s: GameState, heroIndex: number): boolean {
  const n = s.players.filter((p) => p.sitting).length;
  const pos = positionOf(s, heroIndex);
  const L = preflopLines(s);
  if (n === 2) {
    if (pos === "BB") return L.SB !== "none" || L.BTN !== "none";
    return true;
  }
  if (pos === "BTN") return true;
  if (pos === "SB") return L.BTN !== "none";
  return L.BTN !== "none" && (L.SB !== "none" || L.BTN === "jam");
}

export function detectSpot(s: GameState, heroIndex: number): SpotId {
  const n = s.players.filter((p) => p.sitting).length;
  const pos = positionOf(s, heroIndex);
  const L = preflopLines(s);

  if (n === 2) {
    if (pos === "BTN" || pos === "SB") {
      if (L.BB === "none") return "hu_sb_rfi";
      if (L.BB === "jam") return "sb_vs_bb_iso";
      return "hu_sb_rfi";
    }
    if (L.SB === "jam" || L.BTN === "jam") return "hu_bb_vs_jam";
    if (L.SB === "raise" || L.BTN === "raise") return "hu_bb_vs_raise";
    if (L.SB === "limp" || L.BTN === "limp") return "hu_bb_vs_limp";
    return "hu_bb_vs_raise";
  }

  if (pos === "BTN") {
    if (L.SB === "jam" || L.BB === "jam" || L.SB === "raise" || L.BB === "raise") return "btn_vs_jam";
    return "btn_rfi";
  }

  if (pos === "SB") {
    if (L.BTN === "none" || L.BTN === "fold") {
      if (L.BB === "raise" || L.BB === "jam") return "sb_vs_bb_iso";
      return "sb_rfi";
    }
    if (L.BTN === "jam") return "sb_vs_btn_jam";
    if (L.BTN === "limp") return "sb_vs_btn_limp";
    return "sb_vs_btn_raise";
  }

  // BB — the whole line of BTN then SB
  if (L.BTN === "fold" || L.BTN === "none") {
    if (L.SB === "jam") return "bb_vs_sb_jam";
    if (L.SB === "raise") return "bb_vs_sb_raise";
    if (L.SB === "limp") return "bb_vs_sb_limp";
    return "bb_vs_sb_limp";
  }
  if (L.BTN === "jam") return "bb_vs_btn_jam";
  if (L.BTN === "limp") {
    if (L.SB === "fold" || L.SB === "none") return "bb_vs_btn_limp";
    if (L.SB === "jam") return "bb_vs_btn_raise_sb_jam";
    return "bb_vs_sb_limp";
  }
  // BTN raise
  if (L.SB === "jam") return "bb_vs_btn_raise_sb_jam";
  if (L.SB === "call" || L.SB === "limp") return "bb_vs_btn_raise_sb_call";
  return "bb_vs_btn_raise";
}
