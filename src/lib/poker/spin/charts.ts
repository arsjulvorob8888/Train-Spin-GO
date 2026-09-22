import type { RangeSpec } from "./notation";

export type StackDepth = 25 | 20 | 15 | 12 | 10 | 8;

export type SpotId =
  | "btn_rfi"
  | "btn_vs_jam"
  | "sb_rfi"
  | "sb_vs_btn_limp"
  | "sb_vs_btn_raise"
  | "sb_vs_btn_jam"
  | "sb_vs_bb_iso"
  | "bb_vs_btn_raise"
  | "bb_vs_btn_jam"
  | "bb_vs_btn_limp"
  | "bb_vs_sb_limp"
  | "bb_vs_sb_raise"
  | "bb_vs_sb_jam"
  | "bb_vs_btn_raise_sb_call"
  | "bb_vs_btn_raise_sb_jam"
  | "hu_sb_rfi"
  | "hu_bb_vs_raise"
  | "hu_bb_vs_jam"
  | "hu_bb_vs_limp";

export type SpotMeta = {
  id: SpotId;
  pos: "BTN" | "SB" | "BB";
  label: string;
  when: string;
};

export const SPOTS: SpotMeta[] = [
  { id: "btn_rfi", pos: "BTN", label: "BTN open", when: "Unopened pot" },
  { id: "btn_vs_jam", pos: "BTN", label: "BTN vs 3-bet jam", when: "Min-raised, SB/BB jammed" },
  { id: "sb_rfi", pos: "SB", label: "SB vs BB", when: "BTN folded" },
  { id: "sb_vs_btn_limp", pos: "SB", label: "SB vs BTN limp", when: "BTN completed 1bb" },
  { id: "sb_vs_btn_raise", pos: "SB", label: "SB vs BTN 2x", when: "BTN min-raise" },
  { id: "sb_vs_btn_jam", pos: "SB", label: "SB vs BTN jam", when: "BTN open-shove" },
  { id: "sb_vs_bb_iso", pos: "SB", label: "SB vs BB iso", when: "Completed, BB raised" },
  { id: "bb_vs_btn_raise", pos: "BB", label: "BB vs BTN 2x", when: "BTN min-raise, SB fold" },
  { id: "bb_vs_btn_jam", pos: "BB", label: "BB vs BTN jam", when: "BTN shove, SB fold" },
  { id: "bb_vs_btn_limp", pos: "BB", label: "BB vs BTN limp", when: "BTN limp, SB fold" },
  { id: "bb_vs_sb_limp", pos: "BB", label: "BB vs SB limp", when: "BTN fold, SB complete" },
  { id: "bb_vs_sb_raise", pos: "BB", label: "BB vs SB 2x", when: "BTN fold, SB raise" },
  { id: "bb_vs_sb_jam", pos: "BB", label: "BB vs SB jam", when: "BTN fold, SB shove" },
  { id: "bb_vs_btn_raise_sb_call", pos: "BB", label: "BB vs BTN 2x + SB call", when: "Multiway, squeezed pot" },
  { id: "bb_vs_btn_raise_sb_jam", pos: "BB", label: "BB vs SB reshove", when: "BTN 2x, SB jammed" },
  { id: "hu_sb_rfi", pos: "SB", label: "HU SB", when: "Heads-up, SB first in" },
  { id: "hu_bb_vs_raise", pos: "BB", label: "HU BB vs 2x", when: "Heads-up, SB min-raise" },
  { id: "hu_bb_vs_jam", pos: "BB", label: "HU BB vs jam", when: "Heads-up, SB shove" },
  { id: "hu_bb_vs_limp", pos: "BB", label: "HU BB vs limp", when: "Heads-up, SB limp" },
];

/** 15-15-15 ICM Spin & Go 3-max — majority GTO action (WTA). */
const S15: Record<SpotId, RangeSpec> = {
  btn_rfi: {
    raise: ["QQ+", "AQs+", "AKo"],
    jam: [
      "22-JJ",
      "A2s-AJs",
      "A2o-AQo",
      "K9s+",
      "KTo+",
      "Q9s+",
      "QTo+",
      "J9s+",
      "JTo",
      "T8s+",
      "98s",
      "87s",
      "76s",
      "65s",
      "54s",
      "KJo",
    ],
  },
  btn_vs_jam: {
    call: ["JJ+", "AQs+", "AKo", "AJs"],
  },
  sb_rfi: {
    raise: ["JJ+", "AKs", "AKo", "AQs"],
    jam: [
      "22-TT",
      "A2s-AJs",
      "A7o+",
      "K9s+",
      "KTo+",
      "Q9s+",
      "J9s+",
      "T9s",
      "98s",
      "87s",
      "76s",
      "KJo",
      "QJo",
    ],
    limp: [
      "K2s-K8s",
      "Q2s-Q8s",
      "J7s-J8s",
      "T7s-T8s",
      "97s+",
      "86s+",
      "75s+",
      "64s+",
      "54s",
      "A2o-A6o",
      "K9o",
    ],
  },
  sb_vs_btn_limp: {
    jam: ["77+", "ATs+", "AJo+", "KQs"],
    raise: ["22-66", "A2s-A9s", "ATo", "K9s+", "KQo", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s", "KJo"],
    call: ["K2s-K8s", "Q2s-Q8s", "J7s+", "T7s+", "96s+", "85s+", "74s+", "64s+", "54s", "A9o"],
  },
  sb_vs_btn_raise: {
    jam: ["55+", "A9s+", "A5s-A8s", "ATo+", "KQs", "KJs", "KQo", "QJs", "JTs", "T9s", "98s", "87s", "76s"],
    call: ["22-44", "A2s-A4s", "KTs", "QTs", "J9s", "T8s", "97s", "86s", "75s", "65s", "54s", "A9o", "KJo", "QJo"],
  },
  sb_vs_btn_jam: {
    call: ["33+", "A5s+", "A8o+", "KJs+", "KQo", "QJs", "JTs"],
  },
  sb_vs_bb_iso: {
    jam: ["88+", "ATs+", "AJo+", "KQs", "AKo"],
    call: ["22-77", "A2s-A9s", "K9s+", "Q9s+", "J9s+", "T8s+", "97s+", "86s+", "76s", "65s", "ATo", "KQo"],
  },
  bb_vs_btn_raise: {
    jam: ["QQ+", "AKs", "AKo", "22-JJ", "A2s-A9s", "A8o+", "K9s+", "KJo+", "QTs+", "J9s+", "T9s", "98s", "87s"],
    call: [
      "K2s-K8s",
      "Q2s-Q9s",
      "J2s-J8s",
      "T2s-T8s",
      "95s+",
      "85s+",
      "74s+",
      "64s+",
      "53s+",
      "43s",
      "ATo",
      "KTo",
      "QJo",
      "JTo",
    ],
  },
  bb_vs_btn_jam: {
    call: ["33+", "A4s+", "A8o+", "KJs+", "KQo", "QJs", "JTs"],
  },
  bb_vs_btn_limp: {
    jam: ["88+", "ATs+", "AJo+", "KQs"],
    raise: ["22-77", "A2s-A9s", "ATo", "K9s+", "KTo+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s", "QJo"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "T2s-T7s", "96s+", "85s+", "74s+", "64s+", "54s", "A9o", "K9o"],
  },
  bb_vs_sb_limp: {
    jam: ["88+", "ATs+", "AJo+", "KQs"],
    raise: [
      "22-77",
      "A2s-A9s",
      "A9o-ATo",
      "K9s+",
      "KTo+",
      "Q9s+",
      "J9s+",
      "T8s+",
      "98s",
      "87s",
      "76s",
      "65s",
      "QJo",
    ],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "T2s-T7s", "95s+", "84s+", "74s+", "63s+", "53s+", "43s", "A2o-A8o", "K9o"],
  },
  bb_vs_sb_raise: {
    jam: ["66+", "A9s+", "ATo+", "KJs+", "QJs"],
    call: [
      "22-55",
      "A2s-A8s",
      "A2o-A9o",
      "K2s+",
      "K9o+",
      "Q6s+",
      "Q9o+",
      "J7s+",
      "J9o+",
      "T7s+",
      "T9o",
      "97s+",
      "86s+",
      "76s",
      "65s",
      "54s",
    ],
  },
  bb_vs_sb_jam: {
    call: ["22+", "A2s+", "A4o+", "KTs+", "KJo+", "QJs", "J9s+", "T9s"],
  },
  bb_vs_btn_raise_sb_call: {
    jam: ["QQ+", "AKs", "AKo"],
    call: ["TT-JJ", "AQs", "AJs", "KQs"],
  },
  bb_vs_btn_raise_sb_jam: {
    call: ["JJ+", "AKs", "AKo", "AQs"],
  },
  hu_sb_rfi: {
    raise: ["JJ+", "AKs", "AKo", "AQs"],
    jam: ["22-TT", "A2s-AJs", "A2o+", "K5s+", "K9o+", "Q8s+", "QTo+", "J8s+", "JTo", "T8s+", "98s", "87s", "76s", "65s"],
    limp: ["K2s-K4s", "Q2s-Q7s", "J2s-J7s", "T2s-T7s", "96s+", "85s+", "74s+", "64s+", "54s", "53s", "K5o-K8o"],
  },
  hu_bb_vs_raise: {
    jam: ["55+", "A8s+", "ATo+", "KQs", "KJs"],
    call: ["22-44", "A2s-A7s", "A2o-A9o", "K2s+", "K9o+", "Q4s+", "Q9o+", "J6s+", "J9o+", "T6s+", "T8o+", "96s+", "85s+", "75s+", "64s+", "54s"],
  },
  hu_bb_vs_jam: {
    call: ["22+", "A2s+", "A3o+", "K9s+", "KTo+", "QTs+", "QJo", "J9s+", "T9s"],
  },
  hu_bb_vs_limp: {
    jam: ["77+", "A9s+", "ATo+", "KQs"],
    raise: ["22-66", "A2s-A8s", "A2o-A9o", "K7s+", "KTo+", "Q8s+", "J8s+", "T8s+", "97s+", "86s+", "76s"],
    check: ["K2s-K6s", "Q2s-Q7s", "J2s-J7s", "T2s-T7s", "95s+", "84s+", "74s+", "63s+", "53s+", "K9o", "Q9o"],
  },
};

/** 10bb — mostly push/fold (PokerStars / ICM 3-max). */
const S10: Record<SpotId, RangeSpec> = {
  btn_rfi: {
    raise: ["QQ+", "AKs", "AKo"],
    jam: ["22-JJ", "A2s+", "A2o+", "K6s+", "KTo+", "Q4s+", "QJo", "J8s+", "JTo", "T8s+", "98s", "87s", "76s", "65s"],
  },
  btn_vs_jam: { call: ["77+", "ATs+", "AJo+", "KQs"] },
  sb_rfi: {
    jam: ["22+", "A2s+", "A4o+", "K7s+", "K9o+", "Q8s+", "QTo+", "J8s+", "T8s+", "97s+", "87s", "76s"],
    limp: ["K2s-K6s", "Q2s-Q7s", "J5s-J7s", "T6s-T7s", "96s+", "85s+", "75s+", "64s+", "54s"],
  },
  sb_vs_btn_limp: {
    jam: ["22+", "A2s+", "A7o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T9s"],
  },
  sb_vs_btn_raise: {
    jam: ["22+", "A2s+", "A7o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T9s", "98s", "87s"],
  },
  sb_vs_btn_jam: {
    call: ["22+", "A4s+", "A7o+", "KTs+", "KJo+", "QJs", "JTs"],
  },
  sb_vs_bb_iso: {
    jam: ["55+", "A8s+", "ATo+", "KQs"],
    call: ["22-44", "A2s-A7s", "K9s+", "Q9s+", "J9s+"],
  },
  bb_vs_btn_raise: {
    jam: ["22+", "A2s+", "A7o+", "K8s+", "KTo+", "Q9s+", "J9s+", "T9s", "98s"],
    call: ["K2s-K7s", "Q2s-Q8s", "J5s-J8s", "T6s-T8s", "96s+", "85s+", "75s+", "65s", "54s", "A2o-A6o"],
  },
  bb_vs_btn_jam: {
    call: ["22+", "A2s+", "A3o+", "K9s+", "KTo+", "QJo+", "JTs"],
  },
  bb_vs_btn_limp: {
    jam: ["55+", "A8s+", "ATo+", "KJs+"],
    raise: ["22-44", "A2s-A7s", "K9s+", "Q9s+", "J9s+", "T8s+"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "A2o-A9o"],
  },
  bb_vs_sb_limp: {
    jam: ["66+", "A9s+", "ATo+", "KQs"],
    raise: ["22-55", "A2s-A8s", "A2o+", "K8s+", "KTo+", "Q9s+", "J9s+"],
    check: ["K2s-K7s", "Q2s-Q8s", "J2s-J8s", "T6s+", "96s+", "85s+", "75s+", "65s", "54s"],
  },
  bb_vs_sb_raise: {
    jam: ["44+", "A5s+", "A8o+", "KTs+", "KJo+", "QJs"],
    call: ["22-33", "A2s-A4s", "A2o-A7o", "K2s+", "K9o+", "Q7s+", "J8s+", "T8s+", "97s+", "87s"],
  },
  bb_vs_sb_jam: {
    call: ["22+", "A2s+", "A2o+", "K6s+", "K9o+", "Q8s+", "QTo+", "J8s+", "JTo", "T8s+", "98s"],
  },
  bb_vs_btn_raise_sb_call: {
    jam: ["TT+", "AQs+", "AKo"],
    call: ["88-99", "AJs", "KQs"],
  },
  bb_vs_btn_raise_sb_jam: {
    call: ["TT+", "AQs+", "AKo"],
  },
  hu_sb_rfi: {
    jam: ["22+", "A2s+", "A2o+", "K2s+", "K7o+", "Q5s+", "Q9o+", "J7s+", "J9o+", "T7s+", "T9o", "97s+", "86s+", "76s", "65s", "54s"],
  },
  hu_bb_vs_raise: {
    jam: ["22+", "A2s+", "A5o+", "K9s+", "KTo+", "QTs+", "JTs"],
    call: ["K2s-K8s", "Q2s-Q9s", "J5s+", "T6s+", "96s+", "85s+", "75s+", "64s+", "54s", "A2o-A4o"],
  },
  hu_bb_vs_jam: {
    call: ["22+", "A2s+", "A2o+", "K5s+", "K9o+", "Q8s+", "QTo+", "J8s+", "T8s+", "98s"],
  },
  hu_bb_vs_limp: {
    jam: ["22+", "A2s+", "A7o+", "K9s+", "KTo+", "Q9s+"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s+", "T6s+", "96s+", "85s+", "75s+", "65s", "54s"],
  },
};

/** 25bb — more min-raise / flat, fewer jams. */
const S25: Record<SpotId, RangeSpec> = {
  btn_rfi: {
    raise: [
      "22+",
      "A2s+",
      "A9o+",
      "K9s+",
      "KTo+",
      "Q9s+",
      "QJo",
      "J9s+",
      "T8s+",
      "98s",
      "87s",
      "76s",
      "65s",
      "A5o-A8o",
      "KJo",
    ],
    jam: ["A2o-A4o"],
  },
  btn_vs_jam: {
    call: ["TT+", "AQs+", "AKo", "AJs", "KQs"],
  },
  sb_rfi: {
    raise: ["77+", "A9s+", "ATo+", "KTs+", "KQo", "QJs", "JTs", "T9s", "98s"],
    jam: ["22-66", "A2s-A8s", "A5o-A9o", "K7s-K9s", "Q9s", "J9s", "87s", "76s", "65s"],
    limp: ["K2s-K6s", "Q2s-Q8s", "J6s-J8s", "T7s-T8s", "96s+", "85s+", "75s+", "64s+", "54s", "A2o-A4o"],
  },
  sb_vs_btn_limp: {
    jam: ["JJ+", "AQs+", "AKo"],
    raise: ["22-TT", "A2s-AJs", "ATo+", "K9s+", "KQo", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s"],
    call: ["K2s-K8s", "Q2s-Q8s", "J7s+", "T7s+", "96s+", "85s+", "75s+", "65s", "54s"],
  },
  sb_vs_btn_raise: {
    raise: ["QQ+", "AKs", "AKo", "AQs"],
    jam: ["77-JJ", "A9s-AJs", "A5s-A8s", "ATo+", "KQs", "KJs", "QJs"],
    call: ["22-66", "A2s-A4s", "KTs", "QTs", "J9s+", "T8s+", "97s+", "86s+", "76s", "65s", "54s", "KQo", "KJo", "QJo"],
  },
  sb_vs_btn_jam: {
    call: ["44+", "ATs+", "A9o+", "KQo", "KJs+", "QJs"],
  },
  sb_vs_bb_iso: {
    jam: ["JJ+", "AQs+", "AKo"],
    call: ["22-TT", "A2s-AJs", "K9s+", "Q9s+", "J9s+", "T8s+", "ATo", "KQo"],
  },
  bb_vs_btn_raise: {
    raise: ["QQ+", "AKs", "AKo", "AQs"],
    jam: ["88-JJ", "A9s-AJs", "A5s", "ATo+", "KQs", "KJs"],
    call: [
      "22-77",
      "A2s-A8s",
      "A2o-A9o",
      "K2s+",
      "K9o+",
      "Q6s+",
      "QTo+",
      "J7s+",
      "JTo",
      "T7s+",
      "T9o",
      "97s+",
      "86s+",
      "76s",
      "65s",
      "54s",
    ],
  },
  bb_vs_btn_jam: {
    call: ["44+", "A8s+", "ATo+", "KQs+", "KTs+", "KQo", "QJs"],
  },
  bb_vs_btn_limp: {
    raise: ["22+", "A2s+", "A9o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "T2s-T7s", "96s+", "85s+", "75s+", "64s+", "54s", "A2o-A8o"],
  },
  bb_vs_sb_limp: {
    raise: ["22+", "A2s+", "A8o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s", "65s"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "T2s-T7s", "95s+", "84s+", "74s+", "63s+", "53s+", "A2o-A7o", "K9o"],
  },
  bb_vs_sb_raise: {
    raise: ["JJ+", "AQs+", "AKo"],
    jam: ["77-TT", "A9s-AJs", "ATo+", "KQs"],
    call: [
      "22-66",
      "A2s-A8s",
      "A2o-A9o",
      "K2s+",
      "K9o+",
      "Q5s+",
      "Q9o+",
      "J7s+",
      "J9o+",
      "T7s+",
      "T9o",
      "97s+",
      "86s+",
      "76s",
      "65s",
      "54s",
    ],
  },
  bb_vs_sb_jam: {
    call: ["33+", "A6s+", "ATo+", "KTs+", "QJs"],
  },
  bb_vs_btn_raise_sb_call: {
    raise: ["QQ+", "AKs", "AKo"],
    call: ["99-JJ", "AQs", "AJs", "KQs", "ATs"],
  },
  bb_vs_btn_raise_sb_jam: {
    call: ["QQ+", "AKs", "AKo", "AQs", "JJ"],
  },
  hu_sb_rfi: {
    raise: ["22+", "A2s+", "A9o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "76s", "A5o-A8o"],
    limp: ["K2s-K8s", "Q2s-Q8s", "J5s-J8s", "T6s-T7s", "96s+", "85s+", "75s+", "64s+", "54s", "A2o-A4o", "K9o"],
  },
  hu_bb_vs_raise: {
    raise: ["JJ+", "AQs+", "AKo"],
    call: ["22-TT", "A2s-AJs", "A2o+", "K2s+", "K9o+", "Q6s+", "QTo+", "J7s+", "JTo", "T7s+", "97s+", "86s+", "76s", "65s", "54s"],
  },
  hu_bb_vs_jam: {
    call: ["33+", "A6s+", "ATo+", "KTs+", "KQo", "QJs"],
  },
  hu_bb_vs_limp: {
    raise: ["22+", "A2s+", "A8o+", "K9s+", "KTo+", "Q9s+", "J9s+", "T8s+"],
    check: ["K2s-K8s", "Q2s-Q8s", "J2s-J8s", "T2s-T7s", "96s+", "85s+", "75s+", "64s+", "54s", "A2o-A7o"],
  },
};

const S20: Record<SpotId, RangeSpec> = { ...S15 };
const S12: Record<SpotId, RangeSpec> = { ...S10 };
const S8: Record<SpotId, RangeSpec> = {
  ...S10,
  btn_rfi: {
    jam: ["22+", "A2s+", "A2o+", "K2s+", "K6o+", "Q4s+", "Q8o+", "J6s+", "J9o+", "T6s+", "T8o+", "96s+", "86s+", "75s+", "65s", "54s"],
  },
  sb_rfi: {
    jam: ["22+", "A2s+", "A2o+", "K2s+", "K7o+", "Q5s+", "Q9o+", "J7s+", "J9o+", "T7s+", "97s+", "86s+", "76s", "65s"],
  },
  bb_vs_btn_jam: {
    call: ["22+", "A2s+", "A2o+", "K5s+", "K8o+", "Q8s+", "QTo+", "J8s+", "T8s+", "98s"],
  },
  bb_vs_sb_jam: {
    call: ["22+", "A2s+", "A2o+", "K2s+", "K6o+", "Q5s+", "Q8o+", "J7s+", "J9o+", "T7s+", "T9o", "97s+", "87s"],
  },
};

const BY_STACK: Record<StackDepth, Record<SpotId, RangeSpec>> = {
  25: S25,
  20: S20,
  15: S15,
  12: S12,
  10: S10,
  8: S8,
};

export const STACKS: StackDepth[] = [25, 20, 15, 12, 10, 8];

export function nearestStack(bb: number): StackDepth {
  if (bb >= 22) return 25;
  if (bb >= 17) return 20;
  if (bb >= 13.5) return 15;
  if (bb >= 11) return 12;
  if (bb >= 9) return 10;
  return 8;
}

export function chartFor(stack: StackDepth, spot: SpotId): RangeSpec {
  return BY_STACK[stack][spot];
}
