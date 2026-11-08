import type { MttSeat } from "./live";

/** Standard 8-max action order (preflop). */
export const SEAT_ORDER: MttSeat[] = ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

export type MttSpotGroup = "RFI" | "vsOpen" | "vs3bet" | "cold" | "limp";

export type MttSpotDef = {
  id: string;
  group: MttSpotGroup;
  hero: MttSeat;
  title: string;
  detail: string;
  /** Relative positions that matter for chart selection. */
  opener?: MttSeat | "any";
  threeBetter?: "ip" | "oop" | "blind";
  hasLimp?: boolean;
  /** Typical open / 3bet size the chart assumes (bb). */
  chartOpen?: number;
  chartThree?: number;
};

const POS: Record<MttSeat, string> = {
  UTG: "UTG",
  UTG1: "UTG+1",
  LJ: "LJ",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB",
};

function p(seat: MttSeat): string {
  return POS[seat];
}

/** Catalog of standard 8-max preflop nodes. Ranges will be attached later. */
export const MTT_SPOTS: MttSpotDef[] = [
  // RFI
  { id: "rfi_utg", group: "RFI", hero: "UTG", title: "UTG открывает", detail: "Все сбросили. Первое открытие.", chartOpen: 2.2 },
  { id: "rfi_utg1", group: "RFI", hero: "UTG1", title: "UTG+1 открывает", detail: "Все сбросили.", chartOpen: 2.2 },
  { id: "rfi_lj", group: "RFI", hero: "LJ", title: "LJ открывает", detail: "Все сбросили.", chartOpen: 2.2 },
  { id: "rfi_hj", group: "RFI", hero: "HJ", title: "HJ открывает", detail: "Все сбросили.", chartOpen: 2.2 },
  { id: "rfi_co", group: "RFI", hero: "CO", title: "CO открывает", detail: "Все сбросили.", chartOpen: 2.2 },
  { id: "rfi_btn", group: "RFI", hero: "BTN", title: "BTN открывает", detail: "Все сбросили.", chartOpen: 2.2 },
  { id: "rfi_sb", group: "RFI", hero: "SB", title: "SB открывает", detail: "Все сбросили. SB vs BB.", chartOpen: 2.5 },

  // vs Open (selected important ones; full matrix can be generated)
  { id: "bb_vs_btn", group: "vsOpen", hero: "BB", title: "BB vs BTN open", detail: "BTN открыл, все остальные сбросили.", opener: "BTN", chartOpen: 2.2 },
  { id: "bb_vs_co", group: "vsOpen", hero: "BB", title: "BB vs CO open", detail: "CO открыл.", opener: "CO", chartOpen: 2.2 },
  { id: "bb_vs_hj", group: "vsOpen", hero: "BB", title: "BB vs HJ open", detail: "HJ открыл.", opener: "HJ", chartOpen: 2.2 },
  { id: "sb_vs_btn", group: "vsOpen", hero: "SB", title: "SB vs BTN open", detail: "BTN открыл.", opener: "BTN", chartOpen: 2.2 },
  { id: "btn_vs_co", group: "vsOpen", hero: "BTN", title: "BTN vs CO open", detail: "CO открыл.", opener: "CO", chartOpen: 2.2 },
  { id: "co_vs_hj", group: "vsOpen", hero: "CO", title: "CO vs HJ open", detail: "HJ открыл.", opener: "HJ", chartOpen: 2.2 },

  // vs 3bet
  { id: "btn_vs_bb3", group: "vs3bet", hero: "BTN", title: "BTN vs BB 3bet", detail: "Вы открыли с BTN, BB 3-бет.", threeBetter: "blind", chartThree: 7.5 },
  { id: "co_vs_btn3", group: "vs3bet", hero: "CO", title: "CO vs BTN 3bet", detail: "Вы открыли с CO, BTN 3-бет.", threeBetter: "ip", chartThree: 7 },
  { id: "utg_vs_ip3", group: "vs3bet", hero: "UTG", title: "UTG vs IP 3bet", detail: "Вы открыли с UTG, поздняя позиция 3-бет.", threeBetter: "ip", chartThree: 7 },

  // Limp
  { id: "bb_vs_sblimp", group: "limp", hero: "BB", title: "BB vs SB limp", detail: "SB залимпил.", hasLimp: true },

  // Cold
  { id: "cold_btn", group: "cold", hero: "BTN", title: "BTN холодный 4-бет", detail: "Кто-то открыл, кто-то 3-бет, вы не были в банке." },
  { id: "cold_bb", group: "cold", hero: "BB", title: "BB холодный 4-бет", detail: "Холодный колл почти всегда фолд." },
];

export function spotsIn(group: MttSpotGroup): MttSpotDef[] {
  return MTT_SPOTS.filter((s) => s.group === group);
}

export function findMttSpot(id: string): MttSpotDef | undefined {
  return MTT_SPOTS.find((s) => s.id === id);
}

export function seatLabel(seat: MttSeat): string {
  return p(seat);
}
