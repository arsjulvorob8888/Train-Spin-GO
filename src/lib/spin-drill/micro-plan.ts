import { primary, type Mix } from "@/lib/spin-drill/mix";
import { chartStrategy, pure, type SimStrategy } from "@/lib/spin-drill/sim-strategy";
import { handPower } from "@/lib/spin-drill/stack-ranges";

const LIMP = ["bb_vs_btn_limp", "bb_vs_sb_limp", "bb_vs_limp_call", "hu_bb_limp", "sb_limp"];

export const MICRO_NAME = "Микро $0.25–$1";

export const MICRO_RULES = [
  "Открытие и пуш — клетка чарта. Мусорный стил не добавлен: в облаке он проигрывал и ниту, и копии чарта.",
  "Против лимпа рейз шире. На этих лимитах лимп почти всегда слабая рука.",
  "Их пуш и 3-бет не коллить шире клетки. Любитель пушит реже чарта, значит его пуш сильнее.",
  "Постфлоп без блефа. Ставка — когда рука бьёт то, с чем они коллируют. Воздух — чек.",
  "Pot odds включены, стек сам сдвигает рейндж от 1 до 30 блайндов.",
];

export function microStrategy(): SimStrategy {
  const strategy = chartStrategy();
  strategy.name = MICRO_NAME;
  strategy.bluff = false;
  strategy.bluffFreq = 0;
  strategy.potOdds = true;
  strategy.adaptStack = true;
  strategy.edge = 0;
  strategy.steal = 0;
  strategy.defend = 0;
  strategy.foldAgg = 0;
  strategy.value = 0.04;
  strategy.cbet = 0.15;
  strategy.survive = true;
  strategy.mirror = false;
  for (const id of LIMP) widenIso(strategy.ranges[id]);
  return strategy;
}

function widenIso(row: Record<string, Mix> | undefined) {
  if (!row) return;
  const folds = ranked(row, "fold");
  const hands = folds.length > 24 ? folds.slice(0, Math.round(folds.length * 0.2)) : ranked(row, "call").slice(0, Math.round(ranked(row, "call").length * 0.16));
  for (const [hand] of hands) row[hand] = pure("raise");
}

function ranked(row: Record<string, Mix>, action: "fold" | "call") {
  return Object.entries(row)
    .filter(([, mix]) => primary(mix) === action)
    .sort((a, b) => handPower(b[0]) - handPower(a[0]));
}

export function spotTip(id: string): string {
  if (LIMP.includes(id)) return "Лимп на $0.25 и $1 — слабая рука. Часть бывших чеков и фолдов уже стала рейзом изоляции.";
  if (id.includes("jam") || id.includes("push")) return "Пуш любителя сильнее чарта: он пушит слишком узко. Колл только по клетке.";
  if (id === "btn" || id === "sb_fold" || id === "hu_sb") return "Открывайте только цвет клетки. Лишний стил в симуляции не обыгрывал рейк.";
  if (id.includes("3bet") || id === "bb_vs_sb_raise" || id === "sb_raise") return "3-бет на микро чаще сила. Без пометки в журнале играйте клетку.";
  return "Цвет клетки — действие. Один спот и одна раздача рейндж не меняют.";
}
