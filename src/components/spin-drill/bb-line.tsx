import { useEffect, useState } from "react";
import type { SpotDef } from "@/lib/spin-drill/spots";
import type { MixAction, MixRange } from "@/lib/spin-drill/mix";
import { mixOf, primary } from "@/lib/spin-drill/mix";
import { chartRaiseTo } from "@/lib/spin-drill/equity-calc";
import { BoardLine, useHand } from "@/components/spin-drill/equity-desk";
import { cn } from "@/lib/utils";

type Pick = { spot?: string; mine?: MixAction };
type Blind = "" | "fold" | "call" | "3bet" | "allin";

type Column = {
  seat: string;
  stack: number;
  hero?: boolean;
  actions: { label: string; pick: Pick; blind?: { seat: "SB" | "BB"; act: Blind } }[];
  selected: string;
};

export function ActionLine({
  spot,
  bb,
  mine,
  range,
  selected,
  onSpot,
  onMine,
}: {
  spot: SpotDef;
  bb: number;
  mine: MixAction | "";
  range: MixRange;
  selected: string;
  onSpot: (id: string) => void;
  onMine: (action: MixAction) => void;
}) {
  const [sbAct, setSbAct] = useState<Blind>("");
  const [bbAct, setBbAct] = useState<Blind>("");
  useEffect(() => {
    if (spot.group !== "BTN") {
      setSbAct("");
      setBbAct("");
    }
  }, [spot.group]);
  const cols = columns(spot, bb, mine, sbAct, bbAct);
  const { sizeText, setSizeText, shown } = useHand();
  const live = mine === "call" || mine === "raise" || mine === "allin";
  const sized = cols.some((col) => /All-in|Raise|3-bet|Limp/i.test(col.selected));
  const chartSize = chartRaiseTo(spot.id, bb);
  const doneRight = cycleClosed(cols) && actionMatches(mine, selected, range, sizeText, shown?.street === "Префлоп" ? shown.verdict : null);
  const expected = wantedAction(selected, range, sizeText, shown?.street === "Префлоп" ? shown.verdict ?? null : null);
  const expectedLabel = expected ? (expected === "allin" ? `All-in ${bb}` : spot.labels[expected]) : "";
  return (
    <div className="mt-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {cols.map((col, index) => (
          <div
            key={`${col.seat}-${index}`}
            className={cn("w-[6.4rem] shrink-0 rounded-lg border p-1", col.hero ? "border-ok" : "border-border")}
          >
            <div className={cn("flex items-center justify-between rounded px-1 py-0.5 text-[11px]", head(col.seat))}>
              <span className="font-medium">{col.hero ? `${col.seat} · ваш ход` : col.seat}</span>
              <span className="font-mono">{trim(col.stack)}</span>
            </div>
            <div className="mt-1 flex flex-col">
              {col.actions.map((action) => {
                const on = action.label === col.selected;
                const wanted = Boolean(col.hero && expected && action.pick.mine === expected);
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      if (action.blind) {
                        const nextSb = action.blind.seat === "SB" ? action.blind.act : sbAct;
                        const nextBb = action.blind.seat === "BB" ? action.blind.act : bbAct;
                        if (action.blind.seat === "SB") setSbAct(action.blind.act);
                        else setBbAct(action.blind.act);
                        const chart = blindChart(nextSb, nextBb);
                        const facing = spot.id === "btn_vs_3bet" || spot.id === "btn_vs_jam";
                        if (chart !== spot.id) {
                          onSpot(chart);
                          if (chart === "btn") onMine("raise");
                          else if (facing && (mine === "fold" || mine === "call" || mine === "allin")) onMine(mine);
                        }
                        return;
                      }
                      if (action.pick.spot === "btn") {
                        setSbAct("");
                        setBbAct("");
                      }
                      if (action.pick.spot && action.pick.spot !== spot.id) onSpot(action.pick.spot);
                      if (action.pick.mine) onMine(action.pick.mine);
                    }}
                    className={cn(
                      "rounded px-1 py-1 text-left text-xs",
                      on ? "bg-fg font-medium text-bg" : wanted ? "bg-ok/20 font-semibold text-fg ring-1 ring-ok" : "text-muted",
                    )}
                  >
                    {action.label}
                    {wanted && !on ? " · солвер" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {sized ? (
          <label className="w-[6.4rem] shrink-0 rounded-lg border border-border p-1 text-[11px]">
            <span className="block px-1 font-medium">до, bb</span>
            <input
              inputMode="decimal"
              value={sizeText}
              placeholder={chartSize != null ? String(chartSize) : "2"}
              aria-label="Фактический размер рейза, bb"
              onChange={(event) => setSizeText(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg"
            />
            <span className="mt-1 block px-1 text-muted">пусто = чарт</span>
          </label>
        ) : null}
        {doneRight ? (
          <div className="grid w-14 shrink-0 place-items-center self-center text-ok" title="Цикл закрыт, действие верное">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M7.5 12.5 10.5 15.5 16.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-medium">верно</span>
          </div>
        ) : null}
      </div>
      <BoardLine openBoard={live} />
      <p className={cn("mt-1 text-sm", expected ? "font-medium text-fg" : "text-xs text-muted")}>
        {expected
          ? `Солвер ждёт: ${expectedLabel}. Эта кнопка подсвечена в колонке «ваш ход».`
          : mine
            ? `Вы отметили ${heroLabel(spot, bb, mine)}. Выберите руку в рейндже — солвер скажет, верно ли это.`
            : "Зелёная колонка — ваш ход. Сначала выберите руку в рейндже, солвер подсветит кнопку."}
      </p>
    </div>
  );
}

function cycleClosed(cols: Column[]): boolean {
  if (!cols.some((col) => col.hero && col.selected)) return false;
  return cols.every((col) => Boolean(col.selected) || col.actions.length <= 1);
}

function wantedAction(hand: string, range: MixRange, sizeText: string, verdict: string | null): MixAction | null {
  if (!hand) return null;
  if (sizeText.trim() && verdict) {
    if (verdict === "Фолд" || verdict === "Fold") return "fold";
    if (verdict === "Колл" || verdict === "Call" || verdict === "Чек") return "call";
    if (verdict === "Рейз" || verdict === "Ставка") return "raise";
    if (verdict === "Пуш") return "allin";
    return null;
  }
  return primary(mixOf(range, hand));
}

function actionMatches(mine: MixAction | "", hand: string, range: MixRange, sizeText: string, verdict: string | null): boolean {
  if (!mine || !hand) return false;
  return wantedAction(hand, range, sizeText, verdict) === mine;
}

function columns(spot: SpotDef, bb: number, mine: MixAction | "", sbAct: Blind, bbAct: Blind): Column[] {
  if (spot.group === "BTN") return btnColumns(spot, bb, mine, sbAct, bbAct);
  if (spot.group === "SB") return sbColumns(spot, bb, mine);
  if (spot.group === "HU") return huColumns(spot, bb, mine);
  return bbColumns(spot, bb, mine);
}

function blindChart(sb: Blind, bb: Blind): string {
  if (sb === "allin" || bb === "allin") return "btn_vs_jam";
  if (sb === "3bet" || bb === "3bet") return "btn_vs_3bet";
  return "btn";
}

function blindLabel(act: Blind, stack: number): string {
  if (act === "fold") return "Fold";
  if (act === "call") return "Call";
  if (act === "3bet") return "3-bet";
  if (act === "allin") return `All-in ${stack}`;
  return "";
}

function btnColumns(spot: SpotDef, stack: number, mine: MixAction | "", sbAct: Blind, bbAct: Blind): Column[] {
  const open = spot.id === "btn";
  const vs3 = spot.id === "btn_vs_3bet";
  const vsJam = spot.id === "btn_vs_jam";
  const raised = vs3 || vsJam || (open && mine === "raise");
  const shoved = open && mine === "allin";
  const cols: Column[] = [
    {
      seat: "BTN",
      stack,
      hero: open && !vs3 && !vsJam,
      actions: [
        { label: "Fold", pick: { spot: "btn", mine: "fold" } },
        { label: "Raise 2", pick: { spot: "btn", mine: "raise" } },
        { label: `All-in ${stack}`, pick: { spot: "btn", mine: "allin" } },
      ],
      selected: open ? chosen(spot, stack, mine) : "Raise 2",
    },
  ];
  if (!raised || shoved) return cols;
  const sbButtons: Blind[] = ["fold", "call", "3bet", "allin"];
  const bbButtons: Blind[] = sbAct === "allin" ? ["fold", "call"] : sbAct === "3bet" ? ["fold", "call", "allin"] : ["fold", "call", "3bet", "allin"];
  cols.push({
    seat: "SB",
    stack: stack - 0.5,
    actions: sbButtons.map((act) => ({ label: blindLabel(act, stack), pick: {}, blind: { seat: "SB", act } })),
    selected: blindLabel(sbAct, stack),
  });
  cols.push({
    seat: "BB",
    stack: stack - 1,
    actions: bbButtons.map((act) => ({ label: blindLabel(act, stack), pick: {}, blind: { seat: "BB", act } })),
    selected: blindLabel(bbAct, stack),
  });
  if (vs3 || vsJam) cols.push(heroColumn(spot, stack, mine));
  return cols;
}

function sbColumns(spot: SpotDef, bb: number, mine: MixAction | ""): Column[] {
  const btn =
    spot.id === "sb_limp" ? "Limp" : spot.id === "sb_raise" ? "Raise 2" : spot.id === "sb_push" ? `All-in ${bb}` : "Fold";
  const cols: Column[] = [
    {
      seat: "BTN",
      stack: bb,
      actions: [
        { label: "Fold", pick: { spot: "sb_fold" } },
        { label: "Limp", pick: { spot: "sb_limp" } },
        { label: "Raise 2", pick: { spot: "sb_raise" } },
        { label: `All-in ${bb}`, pick: { spot: "sb_push" } },
      ],
      selected: btn,
    },
  ];
  const afterLimp = spot.id === "sb_iso" || spot.id === "sb_vs_bb_jam" || (spot.id === "sb_fold" && mine === "call");
  if (afterLimp) {
    cols.push({
      seat: "SB",
      stack: bb - 0.5,
      actions: [{ label: "Limp", pick: { spot: "sb_fold", mine: "call" } }],
      selected: "Limp",
    });
    cols.push({
      seat: "BB",
      stack: bb - 1,
      actions: [
        { label: "Raise", pick: { spot: "sb_iso" } },
        { label: `All-in ${bb}`, pick: { spot: "sb_vs_bb_jam" } },
      ],
      selected: spot.id === "sb_iso" ? "Raise" : spot.id === "sb_vs_bb_jam" ? `All-in ${bb}` : "",
    });
  }
  if (spot.id === "sb_iso" || spot.id === "sb_vs_bb_jam" || !afterLimp) cols.push(heroColumn(spot, bb, mine));
  if (afterLimp && spot.id === "sb_fold") cols.push(heroColumn(spot, bb, mine));
  return cols;
}

function huColumns(spot: SpotDef, bb: number, mine: MixAction | ""): Column[] {
  const heroSb = spot.id === "hu_sb";
  const sbSelected = heroSb ? chosen(spot, bb, mine) : spot.id === "hu_bb_limp" ? "Limp" : spot.id === "hu_bb_raise" ? "Raise 2" : `All-in ${bb}`;
  const cols: Column[] = [
    {
      seat: "SB",
      stack: bb - 0.5,
      hero: heroSb,
      actions: heroSb
        ? heroButtons(spot, bb)
        : [
            { label: "Limp", pick: { spot: "hu_bb_limp" } },
            { label: "Raise 2", pick: { spot: "hu_bb_raise" } },
            { label: `All-in ${bb}`, pick: { spot: "hu_bb_jam" } },
          ],
      selected: sbSelected,
    },
  ];
  if (!heroSb) cols.push(heroColumn(spot, bb, mine));
  else if (mine === "call" || mine === "raise" || mine === "allin") {
    cols.push({
      seat: "BB",
      stack: bb - 1,
      actions: [
        { label: "рейндж BB", pick: { spot: mine === "call" ? "hu_bb_limp" : mine === "raise" ? "hu_bb_raise" : "hu_bb_jam" } },
      ],
      selected: "",
    });
  }
  return cols;
}

const BB_BTN: { label: string; spot: string; sb: { label: string; spot: string }[] }[] = [
  {
    label: "Fold",
    spot: "bb_vs_sb_limp",
    sb: [
      { label: "Limp", spot: "bb_vs_sb_limp" },
      { label: "Raise 2", spot: "bb_vs_sb_raise" },
      { label: "All-in", spot: "bb_vs_sb_jam" },
    ],
  },
  {
    label: "Limp",
    spot: "bb_vs_btn_limp",
    sb: [
      { label: "Fold", spot: "bb_vs_btn_limp" },
      { label: "Call", spot: "bb_vs_limp_call" },
      { label: "Raise 4", spot: "bb_vs_limp_iso" },
      { label: "All-in", spot: "bb_vs_limp_jam" },
    ],
  },
  {
    label: "Raise 2",
    spot: "bb_vs_btn_raise",
    sb: [
      { label: "Fold", spot: "bb_vs_btn_raise" },
      { label: "Call", spot: "bb_squeeze" },
      { label: "All-in", spot: "bb_vs_reshove" },
    ],
  },
  {
    label: "All-in",
    spot: "bb_vs_btn_jam",
    sb: [
      { label: "Fold", spot: "bb_vs_btn_jam" },
      { label: "Call", spot: "bb_vs_jam_call" },
    ],
  },
];

function bbColumns(spot: SpotDef, bb: number, mine: MixAction | ""): Column[] {
  const branch = BB_BTN.find((item) => item.sb.some((leaf) => leaf.spot === spot.id)) ?? BB_BTN[2]!;
  const leaf = branch.sb.find((item) => item.spot === spot.id) ?? branch.sb[0]!;
  return [
    {
      seat: "BTN",
      stack: bb,
      actions: BB_BTN.map((item) => ({
        label: item.label === "All-in" ? `All-in ${bb}` : item.label,
        pick: { spot: item.sb[0]!.spot },
      })),
      selected: branch.label === "All-in" ? `All-in ${bb}` : branch.label,
    },
    {
      seat: "SB",
      stack: bb - 0.5,
      actions: branch.sb.map((item) => ({
        label: item.label === "All-in" ? `All-in ${bb}` : item.label,
        pick: { spot: item.spot },
      })),
      selected: leaf.label === "All-in" ? `All-in ${bb}` : leaf.label,
    },
    heroColumn(spot, bb, mine),
  ];
}

function heroColumn(spot: SpotDef, bb: number, mine: MixAction | ""): Column {
  return {
    seat: spot.hero,
    stack: spot.hero === "SB" ? bb - 0.5 : spot.hero === "BB" ? bb - 1 : bb,
    hero: true,
    actions: heroButtons(spot, bb),
    selected: chosen(spot, bb, mine),
  };
}

function heroButtons(spot: SpotDef, bb: number): { label: string; pick: Pick }[] {
  return spot.actions.map((action) => ({
    label: action === "allin" ? `All-in ${bb}` : spot.labels[action],
    pick: { mine: action },
  }));
}

function chosen(spot: SpotDef, bb: number, mine: MixAction | ""): string {
  if (!mine) return "";
  return mine === "allin" ? `All-in ${bb}` : spot.labels[mine] ?? "";
}

function heroLabel(spot: SpotDef, bb: number, mine: MixAction): string {
  return chosen(spot, bb, mine);
}

function head(seat: string): string {
  if (seat === "SB") return "bg-amber-800/80 text-amber-50";
  if (seat === "BB") return "bg-orange-900/80 text-orange-50";
  return "bg-zinc-700 text-zinc-50";
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}
