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

export type StepKind = "hero" | "acted" | "folded" | "waiting" | "out";

export type ActionStep = {
  /** Seat or role shown on the chip, e.g. "BTN" or "SB или BB". */
  label: string;
  /** What already happened, or "ваш ход". */
  did: string;
  kind: StepKind;
};

export type SpotDef = {
  id: string;
  group: SpotGroup;
  hero: HeroSeat;
  title: string;
  detail: string;
  /** Short line: what already happened before hero acts. */
  line: string;
  vs: string;
  players: 2 | 3;
  steps: ActionStep[];
  /** Plain-language explanation for a beginner. */
  story: string;
  actions: MixAction[];
  labels: Record<MixAction, string>;
  range: MixRange;
};

export const SEAT_NAME: Record<HeroSeat, string> = {
  BTN: "баттон",
  SB: "малый блайнд",
  BB: "большой блайнд",
};

export const GROUP_HELP: Record<SpotGroup, { title: string; text: string }> = {
  BTN: {
    title: "Вы на баттоне",
    text: "За столом трое. Баттон ходит первым префлоп. Малый и большой блайнды уже поставили деньги в банк и будут отвечать после вас.",
  },
  SB: {
    title: "Вы в малом блайнде",
    text: "За столом трое. Баттон уже сходил (рейз, лимп, пуш или фолд). После вашего решения ещё отвечает большой блайнд.",
  },
  BB: {
    title: "Вы в большом блайнде",
    text: "За столом трое. Вы закрываете круг: баттон и малый блайнд уже сходили. Часто остаётесь один на один, иногда — против двоих.",
  },
  HU: {
    title: "Heads-up — осталось двое",
    text: "Один соперник выбыл. За столом только SB (ходит первым) и BB. Третьего игрока нет — ренджи другие, чем в 3-max.",
  },
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
    players: 3,
    steps: [
      { label: "вы · BTN", did: "ваш ход", kind: "hero" },
      { label: "SB", did: "ждёт", kind: "waiting" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "За столом трое: баттон, малый блайнд (уже поставил 0.5bb) и большой блайнд (1bb). Никто ещё не открыл торговлю. Вы на баттоне и ходите первым. Этот рендж — с какими руками скидывать, открывать рейзом до 2bb или сразу пушить все 15bb.",
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
    players: 3,
    steps: [
      { label: "вы · BTN", did: "уже Raise 2", kind: "acted" },
      { label: "SB или BB", did: "3-бет", kind: "acted" },
      { label: "вы · BTN", did: "ваш ход", kind: "hero" },
    ],
    story:
      "За столом трое. Вы уже открыли банк с баттона рейзом до 2bb. Один из блайндов переставил — 3-бет, но не олл-ин. Сейчас снова ваш ход. Рендж говорит, когда фолдить, уравнять 3-бет или пушить все 15bb.",
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
    players: 3,
    steps: [
      { label: "вы · BTN", did: "уже Raise 2", kind: "acted" },
      { label: "SB или BB", did: "All-in 15", kind: "acted" },
      { label: "вы · BTN", did: "ваш ход", kind: "hero" },
    ],
    story:
      "За столом трое. Вы открыли 2bb с баттона, и блайнд ответил олл-ином на 15bb. Сейчас решаете только одно: скинуть карты или коллировать пуш. Это рендж колла против 3-бет-джема.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "За столом трое, но баттон сразу скинул. Остались вы в малом блайнде против большого блайнда — почти как heads-up, только вы уже поставили 0.5bb. Ходите вы: лимп (доставить ещё 0.5bb), рейз до 2.5bb, пуш 15bb или фолд.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Limp 1bb", kind: "acted" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "Трое за столом. Баттон не рейзил, а уравнял большой блайнд (лимп 1bb) — слабое действие. Вы в малом блайнде, за вами ещё BB. Можно уравнять, изолировать рейзом до 4bb, пушить или фолдить. Рендж — реакция на лимп баттона.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Raise 2", kind: "acted" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "Трое за столом. Баттон открыл рейзом до 2bb. Вы в малом блайнде, большой блайнд ещё не ходил. Решаете: фолд, колл, 3-бет до 4bb или пуш. Это защита малого блайнда против опен-рейза баттона.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "All-in 15", kind: "acted" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "Трое за столом. Баттон сразу запушил все 15bb. Вы в малом блайнде, большой блайнд ещё в раздаче. Можно только фолд или колл. Рендж — с какими руками коллировать пуш баттона из SB.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "вы · SB", did: "уже Limp", kind: "acted" },
      { label: "BB", did: "Raise (iso)", kind: "acted" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон сфолдил, вы в SB лимпнули (доставили до 1bb), а большой блайнд поднял — изоляция. Сейчас ваш ход против его рейза: фолд, колл или пуш. Рендж — как играть уже лимпнутый SB, когда BB атакует.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "вы · SB", did: "уже Limp", kind: "acted" },
      { label: "BB", did: "All-in 15", kind: "acted" },
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон фолд, вы лимпнули из малого блайнда, большой блайнд запушил 15bb. Осталось фолд или колл. Рендж — с чем коллировать пуш BB после вашего лимпа.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Raise 2", kind: "acted" },
      { label: "SB", did: "Fold", kind: "folded" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон открыл рейзом до 2bb, малый блайнд скинул. Вы в большом блайнде один на один с баттоном и закрываете круг. Фолд, колл, 3-бет до 6bb или пуш. Классическая защита BB против опен-рейза.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "All-in 15", kind: "acted" },
      { label: "SB", did: "Fold", kind: "folded" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон запушил все 15bb, малый блайнд скинул. Вы в большом блайнде против пуша: фолд или колл. Рендж — достаточно ли сильна рука, чтобы коллировать 15bb из BB.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Limp 1bb", kind: "acted" },
      { label: "SB", did: "Fold", kind: "folded" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон лимпнул (уравнял 1bb без рейза), малый блайнд скинул. Вы в BB можете чекнуть бесплатно — оба увидите флоп — или поднять. Чек, рейз до 4bb или пуш. Рендж BB против лимпа баттона.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "SB", did: "Limp 1bb", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон скинул, малый блайнд уравнял (complete до 1bb). Вы в большом блайнде против одного лимпера. Чек (флоп бесплатно), рейз до 4bb или пуш. Рендж — как играть BB, когда SB только доставил блайнд.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "SB", did: "Raise 2", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон фолд, малый блайнд открыл рейзом до 2bb. Вы в большом блайнде закрываете торговлю один на один с SB. Фолд, колл, 3-бет до 6bb или пуш. Защита BB против опен-рейза малого блайнда.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Fold", kind: "folded" },
      { label: "SB", did: "All-in 15", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон фолд, малый блайнд сразу запушил 15bb. Вы в большом блайнде: фолд или колл. Рендж — с какими руками коллировать пуш SB из BB.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Raise 2", kind: "acted" },
      { label: "SB", did: "Call", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Все трое ещё в банке. Баттон открыл 2bb, малый блайнд уравнял. Вы в большом блайнде можете «сквизнуть» — переставить обоих сразу рейзом до 8bb или пушем, коллировать в мультипот или фолд. Это не игра один на один: рендж против двух оппонентов.",
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
    players: 3,
    steps: [
      { label: "BTN", did: "Raise 2", kind: "acted" },
      { label: "SB", did: "All-in 15", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Трое за столом. Баттон открыл 2bb, малый блайнд запушил поверх его рейза (reshove). Сейчас ход в большом блайнде. Баттон ещё не ответил на пуш: если вы коллируете, он тоже может войти. Рендж — с чем коллировать решов SB.",
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
    players: 2,
    steps: [
      { label: "вы · SB", did: "ваш ход", kind: "hero" },
      { label: "BB", did: "ждёт", kind: "waiting" },
    ],
    story:
      "В турнире осталось двое — heads-up. Вы в малом блайнде (он же дилер) и ходите первым. Большой блайнд уже поставил 1bb. Лимп, рейз до 2bb, пуш 15bb или фолд. Это рендж открытия банка heads-up с SB, не путайте с 3-max.",
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
    players: 2,
    steps: [
      { label: "SB", did: "Limp 1bb", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Heads-up, осталось двое. Малый блайнд лимпнул (уравнял 1bb). Вы в большом блайнде: чек — оба увидите флоп бесплатно — рейз до 4bb или пуш. Рендж BB heads-up против лимпа SB.",
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
    players: 2,
    steps: [
      { label: "SB", did: "Raise 2", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Heads-up, двое за столом. Малый блайнд открыл рейзом до 2bb. Вы в большом блайнде закрываете: фолд, колл, 3-бет до 6bb или пуш. Защита большого блайнда heads-up против минрейза.",
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
    players: 2,
    steps: [
      { label: "SB", did: "All-in 15", kind: "acted" },
      { label: "вы · BB", did: "ваш ход", kind: "hero" },
    ],
    story:
      "Heads-up. Малый блайнд запушил все 15bb. Вы в большом блайнде: фолд или колл. Рендж — достаточно ли руки, чтобы коллировать пуш heads-up из BB.",
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
