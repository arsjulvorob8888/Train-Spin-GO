import { useEffect, useRef, useState } from "react";
import type { SpotDef } from "@/lib/spin-drill/spots";
import type { MixAction, MixRange } from "@/lib/spin-drill/mix";
import { mixOf, primary } from "@/lib/spin-drill/mix";
import { chartRaiseTo } from "@/lib/spin-drill/equity-calc";
import { BoardLine, Hole, useHand } from "@/components/spin-drill/equity-desk";
import { cn } from "@/lib/utils";

type Pick = { spot?: string; mine?: MixAction };
type Blind = "" | "fold" | "call" | "3bet" | "allin";

type Column = {
  seat: string;
  title?: string;
  stack: number;
  hero?: boolean;
  actions: { label: string; pick: Pick; blind?: { seat: "BTN" | "SB" | "BB"; act: Blind }; back?: Blind }[];
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
  const [btnAct, setBtnAct] = useState<Blind>("");
  const [back, setBack] = useState<Blind>("");
  useEffect(() => {
    if (spot.group !== "BTN") {
      setSbAct("");
      setBbAct("");
    }
  }, [spot.group]);
  useEffect(() => {
    setBtnAct("");
    setBack("");
    if (spot.group === "SB" || spot.group === "HU") setBbAct("");
  }, [spot.id, mine, spot.group]);
  const cols = columns(spot, bb, mine, sbAct, bbAct, btnAct, back);
  const { sizeText, setSizeText, shown, board, setResult, handNonce, setOut, hero } = useHand();
  const stamped = useRef("");
  useEffect(() => {
    if (!hero || !selected || board.length > 0) return;
    const key = `${spot.group}:${spot.hero}:${selected}:${bb}:${hero[0].rank}.${hero[0].suit}.${hero[1].rank}.${hero[1].suit}`;
    if (stamped.current === key) return;
    const action = playable(spot, primary(mixOf(range, selected)));
    if (!spot.actions.includes(action)) return;
    stamped.current = key;
    if (action !== mine) onMine(action);
  }, [hero, selected, spot.group, spot.hero, spot.actions, bb, range, board.length, mine, onMine]);
  useEffect(() => {
    setSbAct("");
    setBbAct("");
    setBtnAct("");
    setBack("");
  }, [handNonce]);
  useEffect(() => {
    setOut(preflopFolded(spot, sbAct, bbAct, btnAct));
  }, [spot.id, spot.group, sbAct, bbAct, btnAct, setOut]);
  const won = tookPot(spot, mine, sbAct, bbAct, btnAct);
  const folded = mine === "fold" || back === "fold";
  const live = flopOpen(spot, mine, sbAct, bbAct, btnAct, back);
  const waiting = !won && !folded && !live && (mine === "call" || mine === "raise" || mine === "allin");
  const sized = cols.some((col) => /All-in|Raise|3-bet|Limp/i.test(col.selected));
  const chartSize = chartRaiseTo(spot.id, bb);
  const doneRight = cycleClosed(cols) && actionMatches(spot, mine, selected, range, sizeText, shown?.street === "Префлоп" ? shown.verdict : null);
  const expected = board.length >= 3 ? null : wantedAction(spot, selected, range, sizeText, shown?.street === "Префлоп" ? shown.verdict ?? null : null);
  const expectedLabel = expected ? (expected === "allin" ? `All-in ${bb}` : spot.labels[expected]) : "";
  useEffect(() => {
    setResult(won ? "win" : folded ? "fold" : "");
  }, [won, folded, setResult]);
  return (
    <div className="mt-3">
      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        <Hole />
        {spot.group === "HU" ? (
          <div className="w-[6.8rem] shrink-0 rounded-lg border border-ok p-1">
            <p className="px-1 text-[11px] font-medium">Вы играете</p>
            <div className="mt-1 flex flex-col">
              <button
                type="button"
                onClick={() => {
                  if (spot.hero === "SB") return;
                  setSbAct("");
                  setBbAct("");
                  onSpot("hu_sb");
                }}
                className={cn("rounded px-1 py-1 text-left text-xs", spot.hero === "SB" ? "bg-fg font-medium text-bg" : "text-muted")}
              >
                SB · первым
              </button>
              <button
                type="button"
                onClick={() => {
                  if (spot.hero === "BB") return;
                  setSbAct("");
                  setBbAct("");
                  onSpot("hu_bb_raise");
                }}
                className={cn("rounded px-1 py-1 text-left text-xs", spot.hero === "BB" ? "bg-fg font-medium text-bg" : "text-muted")}
              >
                BB · отвечаете
              </button>
            </div>
          </div>
        ) : null}
        {cols.map((col, index) => (
          <div
            key={`${col.seat}-${index}`}
            className={cn("w-[6.4rem] shrink-0 rounded-lg border p-1", col.hero ? "border-ok" : "border-border")}
          >
            <div className={cn("flex items-center justify-between rounded px-1 py-0.5 text-[11px]", head(col.seat))}>
              <span className="font-medium">{col.hero ? "Вы · ваш ход" : (col.title ?? col.seat)}</span>
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
                      if (action.back) {
                        setBack(action.back);
                        return;
                      }
                      if (action.blind) {
                        if (action.blind.seat === "BTN") {
                          setBtnAct(action.blind.act);
                          return;
                        }
                        const nextSb = action.blind.seat === "SB" ? action.blind.act : sbAct;
                        const nextBb = action.blind.seat === "BB" ? action.blind.act : bbAct;
                        if (action.blind.seat === "SB") setSbAct(action.blind.act);
                        else setBbAct(action.blind.act);
                        if (spot.group !== "BTN") return;
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
                      if (action.pick.spot && action.pick.spot !== spot.id) {
                        if (spot.group !== "BTN") setBbAct("");
                        onSpot(action.pick.spot);
                      }
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
          <label className="w-[8.5rem] shrink-0 rounded-lg border border-border p-1 text-[11px]">
            <span className="block px-1 font-medium">Другой рейз, bb</span>
            <input
              inputMode="decimal"
              value={sizeText}
              placeholder={chartSize != null ? String(chartSize) : "2"}
              aria-label="Размер рейза оппонента, если он не как в чарте"
              onChange={(event) => setSizeText(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 font-mono text-sm text-fg"
            />
            <span className="mt-1 block px-1 leading-tight text-muted">Пусто — размер из чарта. Впиши число, только если оппонент поставил иначе.</span>
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
        {won ? (
          <div className="grid w-28 shrink-0 place-items-center self-center text-center text-ok">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M7.5 12.5 10.5 15.5 16.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-semibold">Вы выиграли</span>
            <span className="text-[10px] leading-tight text-fg">Все сбросили. Флопа нет.</span>
          </div>
        ) : folded ? (
          <div className="grid w-28 shrink-0 place-items-center self-center text-center text-muted">
            <span className="text-sm font-semibold text-fg">Раздача закрыта</span>
            <span className="text-[10px] leading-tight">Вы сбросили</span>
          </div>
        ) : live ? (
          <BoardLine openBoard />
        ) : waiting ? (
          <p className="w-32 shrink-0 self-center text-xs leading-snug text-muted">Сначала ходы оппонентов. Флоп откроется после них.</p>
        ) : null}
      </div>
      <p className={cn("mt-1 text-sm", expected || board.length >= 3 ? "font-medium text-fg" : "text-xs text-muted")}>
        {won
          ? "Раздача закрыта. Оппоненты сбросили, вы забрали банк без флопа."
          : folded
            ? "Раздача закрыта. Вы сбросили, карт дальше нет."
            : waiting
              ? "Отметьте действия оппонентов. Карты флопа появятся, только если раздача идёт дальше."
            : board.length >= 5
          ? "Лента слева направо: карты, ходы, галочка улицы. Последняя галочка — раздача закрыта."
          : board.length >= 3
            ? "После галочки префлопа идут карты улицы и колонки ходов. Галочка — улица закрыта."
            : mine && expected && mine === expected
              ? `Ваш ход уже стоит: ${expectedLabel}. Дальше отмечайте только оппонентов.`
              : expected
              ? `Солвер ждёт: ${expectedLabel}. Эта кнопка подсвечена в колонке «ваш ход».`
              : mine
                ? `Вы отметили ${heroLabel(spot, bb, mine)}. Выберите руку в рейндже — солвер скажет, верно ли это.`
                : "Слева ваши карты, потом ваш ход, потом оппоненты. Галочка — цикл закрыт."}
      </p>
    </div>
  );
}

function preflopFolded(spot: SpotDef, sbAct: Blind, bbAct: Blind, btnAct: Blind): ("BTN" | "SB" | "BB")[] {
  const out: ("BTN" | "SB" | "BB")[] = [];
  if (spot.group === "BTN") {
    if (sbAct === "fold") out.push("SB");
    if (bbAct === "fold") out.push("BB");
    return out;
  }
  if (spot.group === "SB") {
    const open = sbOpener(spot.id);
    if (open === "fold" || btnAct === "fold") out.push("BTN");
    if (bbAct === "fold" && spot.id !== "sb_vs_bb_jam") out.push("BB");
  }
  return out;
}

function flopOpen(spot: SpotDef, mine: MixAction | "", sbAct: Blind, bbAct: Blind, btnAct: Blind, back: Blind): boolean {
  if (mine !== "call" && mine !== "raise" && mine !== "allin") return false;
  if (tookPot(spot, mine, sbAct, bbAct, btnAct)) return false;
  if (spot.group === "BTN" && spot.id === "btn") {
    const sbDone = sbAct === "fold" || sbAct === "call";
    const bbDone = bbAct === "fold" || bbAct === "call";
    return sbDone && bbDone && (sbAct === "call" || bbAct === "call");
  }
  if (spot.group === "SB") return sbFlop(spot.id, mine, btnAct, bbAct, back);
  if (spot.group === "HU" && spot.id === "hu_sb") return huFlop(mine, bbAct, back);
  return true;
}

function tookPot(spot: SpotDef, mine: MixAction | "", sbAct: Blind, bbAct: Blind, btnAct: Blind): boolean {
  if (mine !== "raise" && mine !== "allin" && mine !== "call") return false;
  if (spot.group === "BTN" && spot.id === "btn") return sbAct === "fold" && bbAct === "fold";
  if (spot.group === "SB") return sbTook(spot.id, mine, btnAct, bbAct);
  if (spot.group === "HU" && spot.id === "hu_sb") return bbAct === "fold";
  if (spot.group === "HU" && spot.hero === "BB") return sbAct === "fold";
  return false;
}

function cycleClosed(cols: Column[]): boolean {
  if (!cols.some((col) => col.hero && col.selected)) return false;
  return cols.every((col) => Boolean(col.selected) || col.actions.length <= 1);
}

function wantedAction(spot: SpotDef, hand: string, range: MixRange, sizeText: string, verdict: string | null): MixAction | null {
  if (!hand) return null;
  if (sizeText.trim() && verdict) {
    if (verdict === "Фолд" || verdict === "Fold") return playable(spot, "fold");
    if (verdict === "Колл" || verdict === "Call" || verdict === "Чек" || verdict === "Check" || verdict.startsWith("Check")) return playable(spot, "call");
    if (verdict === "Рейз" || verdict === "Ставка") return playable(spot, "raise");
    if (verdict === "Пуш") return playable(spot, "allin");
    return null;
  }
  return playable(spot, primary(mixOf(range, hand)));
}

function playable(spot: SpotDef, action: MixAction): MixAction {
  if (spot.actions.includes(action)) return action;
  if (action === "fold" && spot.actions.includes("call")) return "call";
  return action;
}

function actionMatches(spot: SpotDef, mine: MixAction | "", hand: string, range: MixRange, sizeText: string, verdict: string | null): boolean {
  if (!mine || !hand) return false;
  return wantedAction(spot, hand, range, sizeText, verdict) === mine;
}

function columns(spot: SpotDef, bb: number, mine: MixAction | "", sbAct: Blind, bbAct: Blind, btnAct: Blind, back: Blind): Column[] {
  if (spot.group === "BTN") return btnColumns(spot, bb, mine, sbAct, bbAct);
  if (spot.group === "SB") return sbColumns(spot, bb, mine, btnAct, bbAct, back);
  if (spot.group === "HU") return huColumns(spot, bb, mine, sbAct, bbAct, back);
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
  const raised = vs3 || vsJam || (open && (mine === "raise" || mine === "allin"));
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
  if (!raised) return cols;
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

function sbOpener(id: string): "fold" | "limp" | "raise" | "jam" {
  if (id === "sb_limp") return "limp";
  if (id === "sb_raise") return "raise";
  if (id === "sb_push") return "jam";
  return "fold";
}

function sbReplies(id: string, mine: MixAction | ""): { btn: boolean; bb: boolean; menu: Blind[] } | null {
  if (mine !== "call" && mine !== "raise" && mine !== "allin") return null;
  if (id === "sb_vs_bb_jam") return null;
  if (id === "sb_iso") return mine === "allin" ? { btn: false, bb: true, menu: ["fold", "call"] } : null;
  const open = sbOpener(id);
  const shove = mine === "allin" || open === "jam";
  return {
    btn: (open === "limp" || open === "raise") && (mine === "raise" || mine === "allin"),
    bb: true,
    menu: shove ? ["fold", "call"] : ["fold", "call", "3bet", "allin"],
  };
}

function sbTook(id: string, mine: MixAction | "", btnAct: Blind, bbAct: Blind): boolean {
  if (mine !== "call" && mine !== "raise" && mine !== "allin") return false;
  if (id === "sb_vs_bb_jam") return false;
  if (id === "sb_iso") return mine === "allin" && bbAct === "fold";
  if (bbAct !== "fold") return false;
  const open = sbOpener(id);
  if (open === "fold") return true;
  if (open === "jam") return false;
  return (mine === "raise" || mine === "allin") && btnAct === "fold";
}

function sbFlop(id: string, mine: MixAction | "", btnAct: Blind, bbAct: Blind, back: Blind): boolean {
  if (sbTook(id, mine, btnAct, bbAct)) return false;
  if (id === "sb_vs_bb_jam") return mine === "call";
  if (id === "sb_iso") {
    if (mine === "call") return true;
    return mine === "allin" && bbAct === "call";
  }
  const plan = sbReplies(id, mine);
  if (!plan) return false;
  const pressed = (plan.btn && (btnAct === "3bet" || btnAct === "allin")) || (plan.bb && (bbAct === "3bet" || bbAct === "allin"));
  if (pressed && mine !== "allin") return back === "call" || back === "allin";
  if (plan.btn && btnAct !== "fold" && btnAct !== "call") return false;
  if (plan.bb && bbAct !== "fold" && bbAct !== "call") return false;
  const open = sbOpener(id);
  const btnLive = plan.btn ? btnAct === "call" : open !== "fold";
  return btnLive || bbAct === "call";
}

function replyColumn(seat: "BTN" | "BB", stack: number, menu: Blind[], selected: Blind, full: number, title?: string): Column {
  return {
    seat,
    title,
    stack,
    actions: menu.map((act) => ({ label: blindLabel(act, full), pick: {}, blind: { seat, act } })),
    selected: blindLabel(selected, full),
  };
}

function sbColumns(spot: SpotDef, stack: number, mine: MixAction | "", btnAct: Blind, bbAct: Blind, back: Blind): Column[] {
  const open = sbOpener(spot.id);
  const cols: Column[] = [
    {
      seat: "BTN",
      stack,
      actions: [
        { label: "Fold", pick: { spot: "sb_fold" } },
        { label: "Limp", pick: { spot: "sb_limp" } },
        { label: "Raise 2", pick: { spot: "sb_raise" } },
        { label: `All-in ${stack}`, pick: { spot: "sb_push" } },
      ],
      selected: open === "limp" ? "Limp" : open === "raise" ? "Raise 2" : open === "jam" ? `All-in ${stack}` : "Fold",
    },
  ];
  if (spot.id === "sb_iso" || spot.id === "sb_vs_bb_jam") {
    cols.push({
      seat: "SB",
      stack: stack - 0.5,
      actions: [{ label: "Limp", pick: { spot: "sb_fold", mine: "call" } }],
      selected: "Limp",
    });
    cols.push({
      seat: "BB",
      stack: stack - 1,
      actions: [
        { label: "Raise", pick: { spot: "sb_iso" } },
        { label: `All-in ${stack}`, pick: { spot: "sb_vs_bb_jam" } },
      ],
      selected: spot.id === "sb_iso" ? "Raise" : `All-in ${stack}`,
    });
    cols.push(heroColumn(spot, stack, mine));
    if (spot.id === "sb_iso" && mine === "allin") cols.push(replyColumn("BB", stack - 1, ["fold", "call"], bbAct, stack, "BB · на пуш"));
    return cols;
  }
  cols.push(heroColumn(spot, stack, mine));
  const plan = sbReplies(spot.id, mine);
  if (!plan) return cols;
  if (plan.btn) cols.push(replyColumn("BTN", stack, plan.menu, btnAct, stack, "BTN · ответ"));
  if (plan.bb) cols.push(replyColumn("BB", stack - 1, plan.menu, bbAct, stack));
  const pressed = (plan.btn && (btnAct === "3bet" || btnAct === "allin")) || (plan.bb && (bbAct === "3bet" || bbAct === "allin"));
  if (pressed && mine !== "allin") {
    cols.push({
      seat: "SB",
      title: "SB · ответ",
      stack: stack - 0.5,
      hero: true,
      actions: [
        { label: "Fold", pick: {}, back: "fold" },
        { label: "Call", pick: {}, back: "call" },
        { label: `All-in ${stack}`, pick: {}, back: "allin" },
      ],
      selected: back === "fold" ? "Fold" : back === "call" ? "Call" : back === "allin" ? `All-in ${stack}` : "",
    });
  }
  return cols;
}

function huFlop(mine: MixAction | "", bbAct: Blind, back: Blind): boolean {
  if (bbAct === "fold") return false;
  if (mine === "allin") return bbAct === "call";
  if (bbAct === "call") return true;
  if (bbAct === "3bet" || bbAct === "allin") return back === "call" || back === "allin";
  return false;
}

function huColumns(spot: SpotDef, bb: number, mine: MixAction | "", sbAct: Blind, bbAct: Blind, back: Blind): Column[] {
  const heroSb = spot.id === "hu_sb";
  const sbSelected = heroSb
    ? chosen(spot, bb, mine)
    : sbAct === "fold"
      ? "Fold"
      : spot.id === "hu_bb_limp"
        ? "Limp"
        : spot.id === "hu_bb_raise"
          ? "Raise 2"
          : `All-in ${bb}`;
  const cols: Column[] = [
    {
      seat: "SB",
      stack: bb - 0.5,
      hero: heroSb,
      actions: heroSb
        ? heroButtons(spot, bb)
        : [
            { label: "Fold", pick: {}, blind: { seat: "SB", act: "fold" } },
            { label: "Limp", pick: { spot: "hu_bb_limp" } },
            { label: "Raise 2", pick: { spot: "hu_bb_raise" } },
            { label: `All-in ${bb}`, pick: { spot: "hu_bb_jam" } },
          ],
      selected: sbSelected,
    },
  ];
  if (!heroSb) {
    cols.push(heroColumn(spot, bb, mine));
    return cols;
  }
  if (mine !== "call" && mine !== "raise" && mine !== "allin") return cols;
  const vsJam = mine === "allin";
  const vsLimp = mine === "call";
  cols.push({
    seat: "BB",
    stack: bb - 1,
    actions: vsJam
      ? [
          { label: "Fold", pick: {}, blind: { seat: "BB", act: "fold" } },
          { label: "Call", pick: {}, blind: { seat: "BB", act: "call" } },
        ]
      : [
          { label: "Fold", pick: {}, blind: { seat: "BB", act: "fold" } },
          { label: vsLimp ? "Check|FOLD" : "Call", pick: {}, blind: { seat: "BB", act: "call" } },
          { label: "Raise", pick: {}, blind: { seat: "BB", act: "3bet" } },
          { label: `All-in ${bb}`, pick: {}, blind: { seat: "BB", act: "allin" } },
        ],
    selected: huBbSelected(bbAct, bb, vsLimp),
  });
  if (!vsJam && (bbAct === "3bet" || bbAct === "allin")) {
    cols.push({
      seat: "SB",
      title: "SB · ответ",
      stack: bb - 0.5,
      hero: true,
      actions: [
        { label: "Fold", pick: {}, back: "fold" },
        { label: "Call", pick: {}, back: "call" },
        { label: `All-in ${bb}`, pick: {}, back: "allin" },
      ],
      selected: back === "fold" ? "Fold" : back === "call" ? "Call" : back === "allin" ? `All-in ${bb}` : "",
    });
  }
  return cols;
}

function huBbSelected(act: Blind, stack: number, vsLimp: boolean): string {
  if (act === "fold") return "Fold";
  if (act === "call") return vsLimp ? "Check|FOLD" : "Call";
  if (act === "3bet") return "Raise";
  if (act === "allin") return `All-in ${stack}`;
  return "";
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
