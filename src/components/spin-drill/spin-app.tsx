"use client";

import { MiniCard, PipCard, type Face } from "@/components/spin-drill/pip-card";
import { StackRail } from "@/components/spin-drill/stack-rail";
import { ActionLine } from "@/components/spin-drill/bb-line";
import { EquityDesk, HandProvider, QuickLine } from "@/components/spin-drill/equity-desk";
import { HandSim } from "@/components/spin-drill/hand-sim";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { MathDrill } from "@/components/spin-drill/math-drill";
import { EquityHintLine, EquitySheet } from "@/components/spin-drill/equity-sheet";
import { EquityDrill } from "@/components/spin-drill/equity-drill";
import { PotOddsDrill } from "@/components/spin-drill/pot-odds-drill";
import { PostflopLesson } from "@/components/spin-drill/postflop-lesson";
import { RangeExperiment } from "@/components/spin-drill/range-experiment";
import { GroupHint, SpotExplain } from "@/components/spin-drill/spot-explain";
import { COMBOS, closeEnough } from "@/lib/spin-drill/combos";
import { ALL, gridName } from "@/lib/spin-drill/legacy-ranges";
import { continueHands, continuePct, grade, mixOf, primary, segs, type MixAction, type MixRange } from "@/lib/spin-drill/mix";
import {
  GROUPS,
  ICM,
  SEAT_NAME,
  SPOTS,
  STACK,
  findSpot,
  spotContinue,
  spotsIn,
  type SpotDef,
  type SpotGroup,
} from "@/lib/spin-drill/spots";
import {
  chooseHand,
  dueInPool,
  isDue,
  leakHands,
  loadStore,
  record,
  resetSpot,
  spotStat,
  type Store,
} from "@/lib/spin-drill/stats";
import { huBbLimpPaint, sizeCaption } from "@/lib/spin-drill/hu-bb-limp";
import { huBbRaisePaint } from "@/lib/spin-drill/hu-bb-raise";
import { rangeAtStack, stackNote } from "@/lib/spin-drill/stack-ranges";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Tab = "practice" | "strategy" | "table" | "experiment" | "hands" | "math" | "stats";

const KEYS: Record<string, MixAction> = {
  f: "fold",
  F: "fold",
  c: "call",
  C: "call",
  r: "raise",
  R: "raise",
  a: "allin",
  A: "allin",
};

const SUITS = ["s", "h", "d", "c"] as const;
const ACT_CLS: Record<MixAction, string> = {
  fold: "bg-fold text-fg",
  call: "bg-call text-fg",
  raise: "bg-raise text-fg",
  allin: "bg-allin text-fg",
};
const BAR: Record<MixAction, string> = {
  allin: "bg-allin",
  raise: "bg-raise",
  call: "bg-call",
  fold: "bg-fold",
};

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]!;
}

function dealCombo(hand: string): [Face, Face] {
  const r1 = hand[0]!;
  const r2 = hand[1]!;
  if (hand.length === 2) {
    const s1 = pick(SUITS);
    const s2 = pick(SUITS.filter((s) => s !== s1));
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ];
  }
  if (hand.endsWith("s")) {
    const s = pick(SUITS);
    return [
      { rank: r1, suit: s },
      { rank: r2, suit: s },
    ];
  }
  const s1 = pick(SUITS);
  const s2 = pick(SUITS.filter((s) => s !== s1));
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ];
}

function pickHand(range: MixRange, statId: string, store: Store, includeFolds: boolean, avoid?: string) {
  const playable = continueHands(range, ALL);
  const base = playable.length ? playable : ALL;
  const st = spotStat(store, statId);
  const reps = store.reps ?? 0;
  let pool = !includeFolds || Math.random() < 0.62 ? [...base] : [...ALL];
  if (includeFolds) {
    for (const h of ALL) {
      if (!pool.includes(h) && isDue(st, h, reps)) pool.push(h);
    }
  }
  return chooseHand(pool, st, reps, avoid);
}

function labelsAt(spot: SpotDef, bb: number): SpotDef["labels"] {
  return {
    ...spot.labels,
    allin: `All-in ${bb}`,
    raise: bb >= 20 ? "Raise 2.5" : spot.labels.raise,
    call: spot.id === "sb_fold" || spot.id === "hu_sb" ? "Limp" : spot.labels.call,
  };
}

function MixBars({ range, hand, labels }: { range: SpotDef["range"]; hand: string; labels: SpotDef["labels"] }) {
  const m = mixOf(range, hand);
  return (
    <div className="space-y-2">
      {segs(m).map((s) => (
        <div key={s.a}>
          <div className="flex justify-between font-mono text-xs">
            <span>{labels[s.a]}</span>
            <span>{s.p}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <i className={cn("block h-full", BAR[s.a])} style={{ width: `${s.p}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SpotPills({
  group,
  spot,
  onGroup,
  onSpot,
  compact = false,
  extra,
}: {
  group: SpotGroup;
  spot: SpotDef;
  onGroup: (g: SpotGroup) => void;
  onSpot: (id: string) => void;
  compact?: boolean;
  extra?: ReactNode;
}) {
  const list = spotsIn(group);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGroup(g)}
            className={cn(
              "h-11 rounded-full border px-3 text-sm",
              group === g ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {g}
            <span className="ml-1.5 font-mono text-xs opacity-60">{spotsIn(g).length}</span>
          </button>
        ))}
        {extra}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GroupHint group={group} />
        </div>
        {compact ? <QuickLine /> : null}
      </div>
      {compact ? null : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSpot(s.id)}
                className={cn(
                  "h-11 rounded-full border px-3 text-sm",
                  spot.id === s.id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
                )}
              >
                {s.vs}
              </button>
            ))}
          </div>
          <SpotExplain spot={spot} />
        </>
      )}
    </div>
  );
}

function StackType({ bb, onChange }: { bb: number; onChange: (bb: number) => void }) {
  const [text, setText] = useState(String(bb));
  const wait = useRef<number | null>(null);

  useEffect(() => {
    setText(String(bb));
  }, [bb]);

  useEffect(() => {
    return () => {
      if (wait.current != null) window.clearTimeout(wait.current);
    };
  }, []);

  function apply(raw: string) {
    const n = Number(raw);
    if (n >= 1 && n <= 30) onChange(n);
  }

  function type(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 2);
    setText(next);
    if (wait.current != null) window.clearTimeout(wait.current);
    if (!next) return;
    const n = Number(next);
    const done = next.length === 2 || (next.length === 1 && n >= 4);
    if (n >= 1 && n <= 30 && done) apply(next);
    else if (n >= 1 && n <= 3) wait.current = window.setTimeout(() => apply(next), 450);
  }

  return (
    <label className="flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3">
      <span className="text-xs text-muted">Стек</span>
      <input
        inputMode="numeric"
        aria-label="Размер стека"
        value={text}
        onChange={(event) => type(event.target.value)}
        onBlur={() => setText(String(bb))}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply(text);
        }}
        className="w-8 bg-transparent text-center font-mono text-base font-semibold text-fg outline-none"
      />
      <span className="font-mono text-xs text-muted">bb</span>
    </label>
  );
}

function Legend({ spot }: { spot: SpotDef }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {spot.actions.map((a) => (
        <span key={a} className="inline-flex items-center gap-1.5">
          <i className={cn("size-2.5 rounded-sm", BAR[a])} />
          {spot.labels[a]}
        </span>
      ))}
    </div>
  );
}

function Meta({ spot, bb, range, labels }: { spot: SpotDef; bb: number; range: MixRange; labels: SpotDef["labels"] }) {
  const cont = continuePct(range, ALL);
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border-2 border-ok bg-surface-2 p-3">
        <div className="flex justify-between">
          <strong>Вы: {SEAT_NAME[spot.hero]}</strong>
          <span className="font-mono">{bb}bb</span>
        </div>
        <p className="mt-1 font-mono text-xs text-subtle">{spot.line}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {spot.actions.map((a) => (
            <li key={a} className="flex items-center gap-2">
              <i className={cn("size-2.5 rounded-sm", BAR[a])} />
              {labels[a]}
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="rounded-md bg-surface-2 px-2 py-1.5">
          <dt className="text-subtle">Stacks</dt>
          <dd>{bb}bb</dd>
        </div>
        <div className="rounded-md bg-surface-2 px-2 py-1.5">
          <dt className="text-subtle">ICM</dt>
          <dd>{ICM}</dd>
        </div>
        <div className="col-span-2 rounded-md bg-surface-2 px-2 py-1.5">
          <dt className="text-subtle">Continue</dt>
          <dd>{cont.toFixed(1)}% combos</dd>
        </div>
      </dl>
    </div>
  );
}

export function SpinApp() {
  const [tab, setTab] = useState<Tab>("strategy");
  const [spotId, setSpotId] = useState("btn");
  const [mine, setMine] = useState<MixAction | "">("");
  const [group, setGroup] = useState<SpotGroup>("BTN");
  const [store, setStore] = useState<Store>({ spots: {}, reps: 0 });
  const [selected, setSelected] = useState("AA");
  const [includeFolds, setIncludeFolds] = useState(true);
  const [hideRange, setHideRange] = useState(false);
  const [session, setSession] = useState({ total: 0, correct: 0, streak: 0 });
  const [current, setCurrent] = useState<string | null>(null);
  const [cards, setCards] = useState<[Face, Face] | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastGrade, setLastGrade] = useState<"correct" | "mix" | "wrong" | null>(null);
  const [quiz, setQuiz] = useState<{ checked: boolean; ok: number; guesses: Record<number, string> } | null>(null);
  const [review, setReview] = useState(false);
  const [mathPane, setMathPane] = useState<"lesson" | "anchors" | "drill">("lesson");
  const [practiceMode, setPracticeMode] = useState<"ranges" | "math">("ranges");
  const [mathDrill, setMathDrill] = useState<"odds" | "equity">("odds");
  const [bb, setBb] = useState(15);
  const [cardAsk, setCardAsk] = useState(0);
  const advanceRef = useRef<number | null>(null);

  const spot = useMemo(() => findSpot(spotId), [spotId]);
  const range = useMemo(() => rangeAtStack(spot.range, spot.id, bb), [spot, bb]);
  const paint = useMemo(() => {
    if (spot.id === "hu_bb_limp") return huBbLimpPaint(bb);
    if (spot.id === "hu_bb_raise") return huBbRaisePaint(bb);
    return null;
  }, [spot.id, bb]);
  const labels = useMemo(() => labelsAt(spot, bb), [spot, bb]);
  const statId = bb === 15 ? spot.id : `${spot.id}@${bb}`;
  const st = spotStat(store, spot.id);
  const drillStat = spotStat(store, statId);
  const waiting = useMemo(() => {
    const playable = continueHands(range, ALL);
    const pool = includeFolds ? ALL : playable.length ? playable : ALL;
    return dueInPool(drillStat, pool, store.reps ?? 0);
  }, [range, drillStat, includeFolds, store.reps]);
  const leaks = useMemo(() => leakHands(st), [st]);

  useEffect(() => {
    setStore(loadStore());
    setHideRange(localStorage.getItem("spin-hide-range") === "1");
  }, []);

  function deal(nextRange = range, nextId = statId, nextStore = store, avoid?: string) {
    const picked = pickHand(nextRange, nextId, nextStore, includeFolds, avoid);
    setQuiz(null);
    setReview(picked.review);
    setCurrent(picked.hand);
    setCards(dealCombo(picked.hand));
    setLocked(false);
    setLastGrade(null);
  }

  function clearAdvance() {
    if (advanceRef.current != null) {
      window.clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }

  function nextAfter(total: number, nextStore: Store = store, avoid?: string) {
    if (total > 0 && total % 8 === 0) {
      setQuiz({ checked: false, ok: 0, guesses: {} });
      return;
    }
    deal(range, statId, nextStore, avoid);
  }

  useEffect(() => () => clearAdvance(), []);

  useEffect(() => {
    if (tab === "practice" && practiceMode === "ranges" && !current && !quiz) deal();
  }, [tab, practiceMode]);

  useEffect(() => {
    if (tab !== "practice" || practiceMode !== "ranges") return;
    clearAdvance();
    setSession({ total: 0, correct: 0, streak: 0 });
    setLocked(false);
    setLastGrade(null);
    setQuiz(null);
    const picked = pickHand(range, statId, store, includeFolds);
    setReview(picked.review);
    setCurrent(picked.hand);
    setCards(dealCombo(picked.hand));
    // New stack means a new chart, so the open hand is dealt again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bb]);

  function changeSpot(id: string) {
    clearAdvance();
    const s = findSpot(id);
    setSpotId(id);
    setMine("");
    setGroup(s.group);
    setSession({ total: 0, correct: 0, streak: 0 });
    setLocked(false);
    setLastGrade(null);
    setQuiz(null);
    const nextRange = rangeAtStack(s.range, s.id, bb);
    const nextId = bb === 15 ? s.id : `${s.id}@${bb}`;
    const picked = pickHand(nextRange, nextId, store, includeFolds);
    setReview(picked.review);
    setCurrent(picked.hand);
    setCards(dealCombo(picked.hand));
  }

  function changeGroup(g: SpotGroup) {
    const first = spotsIn(g)[0];
    if (first) changeSpot(first.id);
  }

  function answer(a: MixAction) {
    if (quiz || !current || locked) return;
    if (!spot.actions.includes(a)) return;
    const g = grade(mixOf(range, current), a);
    setLastGrade(g);
    setLocked(true);
    const ok = g !== "wrong";
    const nextTotal = session.total + 1;
    const nextStore = record(store, statId, current, g);
    setStore(nextStore);
    setSession((s) => ({
      total: nextTotal,
      correct: s.correct + (ok ? 1 : 0),
      streak: ok ? s.streak + 1 : 0,
    }));
    if (g === "correct") {
      clearAdvance();
      const hand = current;
      advanceRef.current = window.setTimeout(() => {
        advanceRef.current = null;
        nextAfter(nextTotal, nextStore, hand);
      }, 280);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== "practice" || quiz || practiceMode !== "ranges") return;
      const a = KEYS[e.key];
      if (a) answer(a);
      if ((e.key === " " || e.key === "Enter") && locked) {
        e.preventDefault();
        afterHand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function afterHand() {
    if (quiz || !locked || advanceRef.current != null) return;
    nextAfter(session.total, store, current ?? undefined);
  }

  const sessPct = session.total ? Math.round((session.correct / session.total) * 100) : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "practice", label: "Тренировка" },
    { id: "strategy", label: "Стратегия" },
    { id: "table", label: "Раздача" },
    { id: "experiment", label: "GAME" },
    { id: "hands", label: "Комбинации" },
    { id: "math", label: "Математика" },
    { id: "stats", label: "Статистика" },
  ];

  function saveDoc(path: string, filename: string) {
    void fetch(path)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(
          new Blob([blob], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="mr-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
            Spin & Go · 3-max · {STACK} · Preflop
          </p>
          <h1 className="font-display text-xl font-medium">
            Spin Drill{" "}
            <span className="font-mono text-sm font-normal text-muted">
              {tab === "hands"
                ? "Комбинации"
                : tab === "experiment"
                  ? "GAME"
                : tab === "math"
                  ? "Математика"
                  : tab === "practice" && practiceMode === "math"
                    ? mathDrill === "equity"
                      ? "Эквити"
                      : "Pot Odds"
                    : quiz
                      ? "Квиз"
                      : spot.title}
            </span>
          </h1>
          <div className="flex flex-wrap gap-x-4">
            <button type="button" className="text-sm text-muted underline" onClick={() => saveDoc("/spin-go-checklist.docx", "spin-go-checklist.docx")}>
              Скачать чек-лист
            </button>
            <button type="button" className="text-sm text-muted underline" onClick={() => saveDoc("/spin-go-anchors.docx", "spin-go-anchors.docx")}>
              Скачать якоря
            </button>
          </div>
        </div>
        <nav className="flex flex-wrap rounded-lg bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                if (t.id === "practice" && !current) deal();
              }}
              className={cn("h-11 rounded-md px-3 text-sm", tab === t.id ? "bg-surface-2 text-fg" : "text-muted")}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 sm:p-5">
        {tab === "table" && <HandSim />}

        {tab === "strategy" && (
          <HandProvider spot={spot} range={range} bb={bb} labels={labels} onHand={setSelected} openCards={cardAsk}>
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="mt-4">
                <SpotPills
                  compact
                  group={group}
                  spot={spot}
                  onGroup={changeGroup}
                  onSpot={changeSpot}
                  extra={
                    <div className="ml-auto flex items-center gap-1.5">
                      <StackType bb={bb} onChange={setBb} />
                      <button
                        type="button"
                        onClick={() => setCardAsk((n) => n + 1)}
                        className="h-11 rounded-full border border-fg bg-fg px-4 text-sm font-semibold text-bg"
                      >
                        Карты
                      </button>
                    </div>
                  }
                />
              </div>
              <ActionLine spot={spot} bb={bb} mine={mine} onSpot={changeSpot} onMine={setMine} />
              <div className="mt-3 flex items-stretch gap-3 select-none">
                <div className="min-w-0 flex-1">
                  <MixGrid range={range} paint={paint} bb={bb} selected={selected} onPick={setSelected} />
                </div>
                <StackRail bb={bb} onChange={setBb} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {spot.id === "hu_bb_limp"
                  ? "BB против лимпа SB. Один цвет — действие с наибольшей долей. Цифра на клетке — размер рейза, он меняется вместе со стеком."
                  : spot.id === "hu_bb_raise"
                    ? "BB против рейза SB до 2. Один цвет — действие с наибольшей долей. Цифра — размер 3-бета."
                    : spot.id === "hu_bb_jam"
                      ? "BB против пуша SB. Зелёный — колл, синий — фолд. Чем короче стек, тем шире колл."
                      : stackNote(bb)}
              </p>
              <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
                <p className="font-mono text-lg font-semibold">{gridName(selected)}</p>
                <p className="mb-3 text-sm text-muted">
                  {paint?.[selected] ? sizeCaption(paint[selected], bb) : labels[primary(mixOf(range, selected))]}
                </p>
                <MixBars range={range} hand={selected} labels={labels} />
              </div>
              <div className="mt-3">
                <Meta spot={spot} bb={bb} range={range} labels={labels} />
              </div>
              <div className="mt-3">
                <SpotExplain spot={spot} />
              </div>
            </section>
            <aside className="sticky top-4 max-h-[calc(100vh-1.5rem)] space-y-4 overflow-auto rounded-2xl border border-border bg-surface p-4">
              <EquityDesk />
            </aside>
          </div>
          </HandProvider>
        )}

        {tab === "experiment" && <RangeExperiment />}

        {tab === "practice" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["ranges", "Ренжи"],
                  ["math", "Математика"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPracticeMode(id)}
                  className={cn(
                    "h-11 rounded-full border px-3 text-sm",
                    practiceMode === id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {practiceMode === "math" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["odds", "Pot Odds"],
                      ["equity", "Эквити"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMathDrill(id)}
                      className={cn(
                        "h-11 rounded-full border px-3 text-sm",
                        mathDrill === id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {mathDrill === "equity" ? <EquityDrill /> : <PotOddsDrill />}
              </div>
            ) : (
          <div className={cn("grid gap-5", hideRange ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_minmax(22rem,26rem)]")}>
            {!hideRange && (
              <section className="rounded-2xl border border-border bg-surface p-4">
                <SpotPills group={group} spot={spot} onGroup={changeGroup} onSpot={changeSpot} />
                <div className="mt-3 mb-3 flex items-center justify-between gap-2">
                  <strong>{spot.title}</strong>
                  <label className="flex h-11 items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={hideRange}
                      onChange={(e) => {
                        setHideRange(e.target.checked);
                        localStorage.setItem("spin-hide-range", e.target.checked ? "1" : "0");
                      }}
                    />
                    Скрыть рендж
                  </label>
                </div>
                <Legend spot={{ ...spot, labels }} />
                <div className="mt-3 flex items-stretch gap-2 select-none">
                  <div className="min-w-0 flex-1">
                    <MixGrid range={range} paint={paint} bb={bb} selected={current} onPick={setSelected} />
                  </div>
                  <StackRail bb={bb} onChange={setBb} />
                </div>
                <p className="mt-2 text-sm text-muted">{stackNote(bb)}</p>
              </section>
            )}
            <section className="flex items-stretch gap-2 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0 flex-1">
              {quiz ? (
                <QuizPanel quiz={quiz} setQuiz={setQuiz} onDone={() => deal()} />
              ) : (
                <>
                  {hideRange && <SpotPills group={group} spot={spot} onGroup={changeGroup} onSpot={changeSpot} />}
                  {hideRange ? <p className="mb-2 text-sm text-muted">{stackNote(bb)}</p> : null}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm text-muted">
                      Сессия {session.correct}/{session.total} <b className="text-fg">{sessPct}%</b>
                      {session.streak > 1 ? ` · ${session.streak} подряд` : ""}
                      {waiting > 0 ? ` · к повтору ${waiting}` : ""}
                    </span>
                    <label className="flex h-11 items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={includeFolds} onChange={(e) => setIncludeFolds(e.target.checked)} />
                      Фолды
                    </label>
                  </div>
                  {hideRange && (
                    <label className="mb-2 flex h-11 items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={hideRange}
                        onChange={(e) => {
                          setHideRange(e.target.checked);
                          localStorage.setItem("spin-hide-range", e.target.checked ? "1" : "0");
                        }}
                      />
                      Скрыть рендж
                    </label>
                  )}
                  <p className="text-center text-sm text-muted">{spot.detail}</p>
                  {review ? (
                    <p className="mt-1 text-center text-sm text-bad">Повтор · в этой руке уже была ошибка</p>
                  ) : null}
                  <div className="my-4 flex justify-center gap-3">
                    <PipCard card={cards?.[0]} tilt={-6} />
                    <PipCard card={cards?.[1]} tilt={7} />
                  </div>
                  <p
                    className={cn(
                      "min-h-7 text-center text-lg font-medium",
                      lastGrade === "correct" && "text-ok",
                      lastGrade === "wrong" && "text-bad",
                    )}
                  >
                    {!lastGrade && "Выберите действие"}
                    {lastGrade === "correct" && "Верно"}
                    {lastGrade === "mix" && current && `Микс · чаще ${labels[primary(mixOf(range, current))]}`}
                    {lastGrade === "wrong" && current && `Ошибка · нужно ${paint?.[current] ? sizeCaption(paint[current], bb) : labels[primary(mixOf(range, current))]}`}
                  </p>
                  <p className="text-center font-mono text-sm text-muted">{current}</p>
                  <EquityHintLine hand={current} spotId={spot.id} />
                  <div
                    className={cn(
                      "mt-3 grid gap-2",
                      spot.actions.length === 2 ? "grid-cols-2" : spot.actions.length === 4 ? "grid-cols-2" : "grid-cols-3",
                    )}
                  >
                    {spot.actions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={locked}
                        onClick={() => answer(a)}
                        className={cn("h-14 rounded-[10px] text-sm font-semibold", ACT_CLS[a])}
                      >
                        {labels[a]}
                        <kbd className="ml-1 text-[10px] opacity-70">{a[0]!.toUpperCase()}</kbd>
                      </button>
                    ))}
                  </div>
                  {locked && current && lastGrade !== "correct" && (
                    <div className="mt-4">
                      <MixBars range={range} hand={current} labels={labels} />
                      <button type="button" className="mt-3 h-11 w-full text-sm text-muted" onClick={afterHand}>
                        Следующая рука
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-2 h-11 w-full text-sm text-muted"
                    onClick={() => setQuiz({ checked: false, ok: 0, guesses: {} })}
                  >
                    Квиз вероятностей
                  </button>
                </>
              )}
              </div>
              {hideRange ? <StackRail bb={bb} onChange={setBb} /> : null}
            </section>
          </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-4">
                <strong>Все споты</strong>
                <p className="text-sm text-muted">{SPOTS.length} сценариев · 15bb · ICM {ICM}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="font-mono text-xs text-subtle">
                      <tr>
                        <th className="py-1 font-medium">Спот</th>
                        <th className="py-1 font-medium">Cont</th>
                        <th className="py-1 font-medium">Точность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SPOTS.map((s) => {
                        const rec = spotStat(store, s.id).overall;
                        const pct = rec.total ? ((rec.correct / rec.total) * 100).toFixed(0) : "—";
                        return (
                          <tr
                            key={s.id}
                            className={cn("cursor-pointer border-t border-border", s.id === spot.id && "bg-surface-2")}
                            onClick={() => changeSpot(s.id)}
                          >
                            <td className="py-1.5">
                              <span className="font-mono text-xs text-subtle">{s.hero}</span> {s.vs}
                            </td>
                            <td className="py-1.5 font-mono text-xs">{spotContinue(s).toFixed(0)}%</td>
                            <td className="py-1.5 font-mono text-xs">
                              {rec.total ? `${pct}% · ${rec.total}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <SpotPills group={group} spot={spot} onGroup={changeGroup} onSpot={changeSpot} />
              <div className="mt-3 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>Точность · {spot.title}</strong>
                  <p className="text-sm text-muted">
                    Всего {st.overall.total} · верно {st.overall.correct} ·{" "}
                    {st.overall.total ? ((st.overall.correct / st.overall.total) * 100).toFixed(1) : "—"}%
                    {waiting > 0 ? ` · к повтору ${waiting}` : ""}
                  </p>
                  {leaks.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {leaks.map((leak) => (
                        <li key={leak.hand} className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted">
                          {leak.hand} {leak.correct}/{leak.total}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="h-11 rounded-lg bg-bad/20 px-3 text-sm text-bad"
                  onClick={() => setStore(resetSpot(store, spot.id))}
                >
                  Сбросить спот
                </button>
              </div>
              <MixGrid range={spot.range} selected={selected} stats={st} onPick={setSelected} />
            </section>
            <aside className="rounded-2xl border border-border bg-surface p-4">
              <p className="font-mono text-lg font-semibold">{selected}</p>
              <MixBars range={spot.range} hand={selected} labels={spot.labels} />
              <p className="mt-3 text-sm text-muted">
                {st.hands[selected] ? `${st.hands[selected]!.correct}/${st.hands[selected]!.total}` : "Ещё не тренировали"}
              </p>
            </aside>
          </div>
        )}

        {tab === "hands" && <HandsPanel />}
        {tab === "math" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["lesson", "Дро и EV"],
                  ["anchors", "Якоря"],
                  ["drill", "Задачи"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMathPane(id)}
                  className={cn(
                    "h-11 rounded-full border px-3 text-sm",
                    mathPane === id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mathPane === "lesson" && <PostflopLesson />}
            {mathPane === "anchors" && <EquitySheet hand={current} />}
            {mathPane === "drill" && <MathDrill />}
          </div>
        )}
      </main>
    </div>
  );
}

function QuizPanel({
  quiz,
  setQuiz,
  onDone,
}: {
  quiz: { checked: boolean; ok: number; guesses: Record<number, string> };
  setQuiz: (q: { checked: boolean; ok: number; guesses: Record<number, string> }) => void;
  onDone: () => void;
}) {
  return (
    <div>
      <p className="font-medium">Квиз · вероятности 2+5</p>
      <p className="mb-3 text-sm text-muted">Введите % для каждой комбинации.</p>
      <div className="space-y-1.5">
        {COMBOS.map((c) => {
          const guess = quiz.guesses[c.n] || "";
          const g = parseFloat(String(guess).replace(",", ".").replace("%", ""));
          const cls = !quiz.checked ? "" : closeEnough(g, c.val) ? "border-ok" : "border-bad";
          return (
            <label
              key={c.n}
              className={cn("grid grid-cols-[28px_1fr_88px] items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2 py-1.5", cls)}
            >
              <span className="text-muted">{c.n}</span>
              <span>{c.name}</span>
              <input
                inputMode="decimal"
                placeholder="%"
                disabled={quiz.checked}
                value={guess}
                onChange={(e) => setQuiz({ ...quiz, guesses: { ...quiz.guesses, [c.n]: e.target.value } })}
                className="h-10 rounded-lg border border-border bg-bg px-2 font-mono text-sm text-fg"
              />
            </label>
          );
        })}
      </div>
      {quiz.checked && (
        <p className={cn("mt-3 text-center text-lg", quiz.ok === 10 ? "text-ok" : quiz.ok >= 7 ? "text-fg" : "text-bad")}>
          {quiz.ok}/10 верно
        </p>
      )}
      {quiz.checked ? (
        <button type="button" className="mt-3 h-12 w-full rounded-[10px] bg-fg font-semibold text-bg" onClick={onDone}>
          Дальше к рукам
        </button>
      ) : (
        <>
          <button
            type="button"
            className="mt-3 h-12 w-full rounded-[10px] bg-fg font-semibold text-bg"
            onClick={() => {
              let ok = 0;
              COMBOS.forEach((c) => {
                const g = parseFloat(String(quiz.guesses[c.n] || "").replace(",", ".").replace("%", ""));
                if (closeEnough(g, c.val)) ok++;
              });
              setQuiz({ ...quiz, checked: true, ok });
            }}
          >
            Проверить
          </button>
          <button type="button" className="mt-1 h-11 w-full text-sm text-muted" onClick={onDone}>
            Пропустить
          </button>
        </>
      )}
    </div>
  );
}

function HandsPanel() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Texas Hold'em · 7 cards</p>
      <h2 className="mt-1 font-display text-xl font-medium">Комбинации по старшинству</h2>
      <p className="mb-4 text-sm text-muted">Вероятность — лучшие 5 из 7 карт. Всего 133 784 560 раздач.</p>
      <div className="space-y-2.5">
        {COMBOS.map((x) => (
          <article key={x.n} className="grid items-center gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-[48px_180px_1fr_1.2fr]">
            <div className="font-mono text-3xl font-semibold text-raise">{x.n}</div>
            <div>
              <h3 className="text-base font-semibold">{x.name}</h3>
              <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">{x.en}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {x.cards.map((c, i) => (
                <MiniCard key={i} r={c.r} s={c.s} dim={c.dim} />
              ))}
            </div>
            <p className="text-sm text-muted">
              {x.text} <strong className="text-fg">{x.pct}</strong> <span>· {x.odds}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
