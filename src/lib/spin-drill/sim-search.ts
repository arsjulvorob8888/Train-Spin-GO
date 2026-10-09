import { primary } from "@/lib/spin-drill/mix";
import { cloneStrategy, pure, type SimStrategy, type StyleId } from "@/lib/spin-drill/sim-strategy";
import { handPower } from "@/lib/spin-drill/stack-ranges";

export type Trial = { name: string; patch: Partial<SimStrategy> };

const OPEN = ["btn", "sb_fold", "hu_sb"];
const JAM = ["bb_vs_btn_jam", "bb_vs_sb_jam", "btn_vs_jam", "hu_bb_jam", "sb_push", "sb_vs_bb_jam", "bb_vs_reshove"];
const RAISED = ["bb_vs_btn_raise", "bb_vs_sb_raise", "hu_bb_raise", "sb_raise", "btn_vs_3bet"];

/** One change at a time against the selected table. */
export function searchSteps(style: StyleId): Trial[] {
  const base: Partial<SimStrategy> = {
    style,
    mirror: false,
    potOdds: true,
    adaptStack: true,
    bluff: false,
    bluffFreq: 0,
    steal: 0,
    defend: 0,
    foldAgg: 0,
    value: 0,
    cbet: 0,
    survive: false,
    edge: 0,
    fixedStack: false,
  };
  return [
    { name: "Чарт без поправок", patch: { ...base } },
    { name: "Стил +15%", patch: { ...base, steal: 0.15 } },
    { name: "Стил +30%", patch: { ...base, steal: 0.3 } },
    { name: "Стил +45%", patch: { ...base, steal: 0.45 } },
    { name: "Колл пуша шире", patch: { ...base, defend: 0.3 } },
    { name: "Колл пуша уже", patch: { ...base, defend: -0.35 } },
    { name: "Фолд на их рейз", patch: { ...base, foldAgg: 0.45 } },
    { name: "Тонкий велью-бет", patch: { ...base, value: 0.08 } },
    { name: "Реже ставить", patch: { ...base, value: -0.06 } },
    { name: "Чаще контбет", patch: { ...base, cbet: 0.3 } },
    { name: "Беречь второе место", patch: { ...base, survive: true } },
  ];
}

/** Write the preflop knobs into the actual ranges so the Strategy tab can play them. */
export function bakeRanges(strategy: SimStrategy): SimStrategy {
  const next = cloneStrategy(strategy);
  if ((next.steal ?? 0) > 0) moveHands(next, OPEN, "fold", "raise", next.steal, "strong");
  if ((next.defend ?? 0) > 0) moveHands(next, JAM, "fold", "call", next.defend, "strong");
  if ((next.defend ?? 0) < 0) moveHands(next, JAM, "call", "fold", -next.defend, "weak");
  if ((next.foldAgg ?? 0) > 0) moveHands(next, RAISED, "call", "fold", next.foldAgg * 0.7, "weak");
  next.steal = 0;
  next.defend = 0;
  next.foldAgg = 0;
  next.name = strategy.name || "Подбор";
  return next;
}

function moveHands(strategy: SimStrategy, spots: string[], from: "fold" | "call" | "raise", to: "fold" | "call" | "raise", frac: number, which: "strong" | "weak") {
  for (const id of spots) {
    const row = strategy.ranges[id];
    if (!row) continue;
    const hands = Object.entries(row)
      .filter(([, mix]) => primary(mix) === from)
      .sort((a, b) => (which === "strong" ? handPower(b[0]) - handPower(a[0]) : handPower(a[0]) - handPower(b[0])));
    const count = Math.round(hands.length * Math.min(0.55, Math.max(0, frac)));
    for (const [hand] of hands.slice(0, count)) row[hand] = pure(to);
  }
}
