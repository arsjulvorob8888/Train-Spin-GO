import {
  RANGE_BTN,
  RANGE_SB_FOLD,
  RANGE_SB_LIMP,
  RANGE_SB_PUSH,
  RANGE_SB_RAISE,
} from "./legacy-ranges";
import {
  RANGE_BB_SQUEEZE,
  RANGE_BB_VS_BTN_JAM,
  RANGE_BB_VS_BTN_LIMP,
  RANGE_BB_VS_BTN_RAISE,
  RANGE_BB_VS_RESHOVE,
  RANGE_BB_VS_SB_JAM,
  RANGE_BB_VS_SB_LIMP,
  RANGE_BB_VS_SB_RAISE,
  RANGE_BTN_VS_3BET,
  RANGE_BTN_VS_JAM,
  RANGE_HU_BB_JAM,
  RANGE_HU_BB_LIMP,
  RANGE_HU_BB_RAISE,
  RANGE_HU_SB,
  RANGE_SB_ISO,
  RANGE_SB_VS_BB_JAM,
} from "./extra-ranges";
import { continuePct, type MixAction, type MixRange } from "./mix";
import { ALL } from "./legacy-ranges";

export type HeroSeat = "BTN" | "SB" | "BB";
export type SpotGroup = "BTN" | "SB" | "BB" | "HU";

export type SpotDef = {
  id: string;
  group: SpotGroup;
  hero: HeroSeat;
  title: string;
  detail: string;
  /** Short line: what already happened before hero acts. */
  line: string;
  vs: string;
  actions: MixAction[];
  labels: Record<MixAction, string>;
  range: MixRange;
};

const FOLD_CALL: MixAction[] = ["fold", "call"];
const FOLD_RAISE_ALLIN: MixAction[] = ["fold", "raise", "allin"];
const FOUR: MixAction[] = ["fold", "call", "raise", "allin"];
const CHECK_RAISE_ALLIN: MixAction[] = ["call", "raise", "allin"];

function L(labels: Partial<Record<MixAction, string>>): Record<MixAction, string> {
  return {
    fold: labels.fold ?? "Fold",
    call: labels.call ?? "Call",
    raise: labels.raise ?? "Raise 2",
    allin: labels.allin ?? "All-in 15",
  };
}

export const SPOTS: SpotDef[] = [
  {
    id: "btn",
    group: "BTN",
    hero: "BTN",
    title: "BTN open",
    detail: "BTN vs 3-max · неоткрытый банк",
    line: "BTN first in",
    vs: "Unopened",
    actions: FOLD_RAISE_ALLIN,
    labels: L({ raise: "Raise 2", allin: "All-in 15" }),
    range: RANGE_BTN,
  },
  {
    id: "btn_vs_3bet",
    group: "BTN",
    hero: "BTN",
    title: "BTN vs 3-bet",
    detail: "Вы открыли 2bb · SB или BB 3-бет не олл-ин",
    line: "BTN Raise 2 · villain Raise",
    vs: "3-bet",
    actions: ["fold", "call", "allin"],
    labels: L({ call: "Call", allin: "All-in 15" }),
    range: RANGE_BTN_VS_3BET,
  },
  {
    id: "btn_vs_jam",
    group: "BTN",
    hero: "BTN",
    title: "BTN vs 3-bet jam",
    detail: "Вы открыли 2bb · SB или BB запушил",
    line: "BTN Raise 2 · villain All-in 15",
    vs: "3-bet jam",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_BTN_VS_JAM,
  },
  {
    id: "sb_fold",
    group: "SB",
    hero: "SB",
    title: "SB vs BTN Fold",
    detail: "BTN сфолдил · SB vs BB",
    line: "BTN Fold",
    vs: "BTN Fold",
    actions: FOUR,
    labels: L({ call: "Limp", raise: "Raise 2.5", allin: "All-in 15" }),
    range: RANGE_SB_FOLD,
  },
  {
    id: "sb_limp",
    group: "SB",
    hero: "SB",
    title: "SB vs BTN Limp",
    detail: "BTN лимп / complete 1bb",
    line: "BTN Limp",
    vs: "BTN Limp",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 4", allin: "All-in 15" }),
    range: RANGE_SB_LIMP,
  },
  {
    id: "sb_raise",
    group: "SB",
    hero: "SB",
    title: "SB vs BTN Raise 2",
    detail: "BTN открыл Raise 2",
    line: "BTN Raise 2",
    vs: "BTN Raise 2",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 4", allin: "All-in 15" }),
    range: RANGE_SB_RAISE,
  },
  {
    id: "sb_push",
    group: "SB",
    hero: "SB",
    title: "SB vs BTN All-in",
    detail: "BTN запушил All-in 15",
    line: "BTN All-in 15",
    vs: "BTN All-in",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_SB_PUSH,
  },
  {
    id: "sb_iso",
    group: "SB",
    hero: "SB",
    title: "SB vs BB iso",
    detail: "Вы лимпнули · BB поднял",
    line: "BTN Fold · SB Limp · BB Raise",
    vs: "BB iso",
    actions: ["fold", "call", "allin"],
    labels: L({ call: "Call", allin: "All-in 15" }),
    range: RANGE_SB_ISO,
  },
  {
    id: "sb_vs_bb_jam",
    group: "SB",
    hero: "SB",
    title: "SB vs BB jam",
    detail: "Вы лимпнули · BB запушил",
    line: "BTN Fold · SB Limp · BB All-in 15",
    vs: "BB jam",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_SB_VS_BB_JAM,
  },
  {
    id: "bb_vs_btn_raise",
    group: "BB",
    hero: "BB",
    title: "BB vs BTN 2x",
    detail: "BTN Raise 2 · SB fold",
    line: "BTN Raise 2 · SB Fold",
    vs: "BTN Raise 2",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 6", allin: "All-in 15" }),
    range: RANGE_BB_VS_BTN_RAISE,
  },
  {
    id: "bb_vs_btn_jam",
    group: "BB",
    hero: "BB",
    title: "BB vs BTN All-in",
    detail: "BTN shove · SB fold",
    line: "BTN All-in 15 · SB Fold",
    vs: "BTN All-in",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_BB_VS_BTN_JAM,
  },
  {
    id: "bb_vs_btn_limp",
    group: "BB",
    hero: "BB",
    title: "BB vs BTN Limp",
    detail: "BTN limp · SB fold",
    line: "BTN Limp · SB Fold",
    vs: "BTN Limp",
    actions: CHECK_RAISE_ALLIN,
    labels: L({ call: "Check", raise: "Raise 4", allin: "All-in 15" }),
    range: RANGE_BB_VS_BTN_LIMP,
  },
  {
    id: "bb_vs_sb_limp",
    group: "BB",
    hero: "BB",
    title: "BB vs SB Limp",
    detail: "BTN fold · SB complete",
    line: "BTN Fold · SB Limp",
    vs: "SB Limp",
    actions: CHECK_RAISE_ALLIN,
    labels: L({ call: "Check", raise: "Raise 4", allin: "All-in 15" }),
    range: RANGE_BB_VS_SB_LIMP,
  },
  {
    id: "bb_vs_sb_raise",
    group: "BB",
    hero: "BB",
    title: "BB vs SB 2x",
    detail: "BTN fold · SB Raise 2",
    line: "BTN Fold · SB Raise 2",
    vs: "SB Raise 2",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 6", allin: "All-in 15" }),
    range: RANGE_BB_VS_SB_RAISE,
  },
  {
    id: "bb_vs_sb_jam",
    group: "BB",
    hero: "BB",
    title: "BB vs SB All-in",
    detail: "BTN fold · SB shove",
    line: "BTN Fold · SB All-in 15",
    vs: "SB All-in",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_BB_VS_SB_JAM,
  },
  {
    id: "bb_squeeze",
    group: "BB",
    hero: "BB",
    title: "BB squeeze",
    detail: "BTN Raise 2 · SB call · мультивей",
    line: "BTN Raise 2 · SB Call",
    vs: "BTN 2x + SB call",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 8", allin: "All-in 15" }),
    range: RANGE_BB_SQUEEZE,
  },
  {
    id: "bb_vs_reshove",
    group: "BB",
    hero: "BB",
    title: "BB vs SB reshove",
    detail: "BTN Raise 2 · SB jammed",
    line: "BTN Raise 2 · SB All-in 15",
    vs: "SB reshove",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_BB_VS_RESHOVE,
  },
  {
    id: "hu_sb",
    group: "HU",
    hero: "SB",
    title: "HU SB first in",
    detail: "Осталось двое · SB ходит первым",
    line: "Heads-up · SB first in",
    vs: "Unopened",
    actions: FOUR,
    labels: L({ call: "Limp", raise: "Raise 2", allin: "All-in 15" }),
    range: RANGE_HU_SB,
  },
  {
    id: "hu_bb_limp",
    group: "HU",
    hero: "BB",
    title: "HU BB vs Limp",
    detail: "Heads-up · SB limp",
    line: "HU · SB Limp",
    vs: "SB Limp",
    actions: CHECK_RAISE_ALLIN,
    labels: L({ call: "Check", raise: "Raise 4", allin: "All-in 15" }),
    range: RANGE_HU_BB_LIMP,
  },
  {
    id: "hu_bb_raise",
    group: "HU",
    hero: "BB",
    title: "HU BB vs 2x",
    detail: "Heads-up · SB min-raise",
    line: "HU · SB Raise 2",
    vs: "SB Raise 2",
    actions: FOUR,
    labels: L({ call: "Call", raise: "Raise 6", allin: "All-in 15" }),
    range: RANGE_HU_BB_RAISE,
  },
  {
    id: "hu_bb_jam",
    group: "HU",
    hero: "BB",
    title: "HU BB vs All-in",
    detail: "Heads-up · SB shove",
    line: "HU · SB All-in 15",
    vs: "SB All-in",
    actions: FOLD_CALL,
    labels: L({ call: "Call" }),
    range: RANGE_HU_BB_JAM,
  },
];

export const GROUPS: SpotGroup[] = ["BTN", "SB", "BB", "HU"];

export const ICM = "50 / 30 / 20";
export const STACK = "15bb";

export function spotsIn(group: SpotGroup): SpotDef[] {
  return SPOTS.filter((s) => s.group === group);
}

export function findSpot(id: string): SpotDef {
  return SPOTS.find((s) => s.id === id) ?? SPOTS[0]!;
}

export function spotContinue(spot: SpotDef): number {
  return continuePct(spot.range, ALL);
}
