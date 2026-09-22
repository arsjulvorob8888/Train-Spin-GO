"use client";

import { MiniCard, PipCard, type Face } from "@/components/spin-drill/pip-card";
import { MixGrid } from "@/components/spin-drill/mix-grid";
import { MathDrill } from "@/components/spin-drill/math-drill";
import { GroupHint, SpotExplain } from "@/components/spin-drill/spot-explain";
import { COMBOS, closeEnough } from "@/lib/spin-drill/combos";
import { ALL } from "@/lib/spin-drill/legacy-ranges";
import { continueHands, grade, isMix, mixOf, primary, segs, type MixAction } from "@/lib/spin-drill/mix";
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
import { loadStore, record, resetSpot, spotStat, type Store } from "@/lib/spin-drill/stats";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "practice" | "strategy" | "hands" | "math" | "stats";

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

function pickHand(spot: SpotDef, store: Store, includeFolds: boolean): string {
  const playable = continueHands(spot.range, ALL);
  const pool = !includeFolds || Math.random() < 0.62 ? (playable.length ? playable : ALL) : ALL;
  const st = spotStat(store, spot.id);
  const weights = pool.map((h) => {
    const rec = st.hands[h];
    if (!rec || !rec.total) return 1.4;
    return 1 + (1 - rec.correct / rec.total) * 3;
  });
  let t = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    t -= weights[i]!;
    if (t <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
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
}: {
  group: SpotGroup;
  spot: SpotDef;
  onGroup: (g: SpotGroup) => void;
  onSpot: (id: string) => void;
}) {
  const list = spotsIn(group);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
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
      </div>
      <GroupHint group={group} />
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
    </div>
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

function Meta({ spot }: { spot: SpotDef }) {
  const cont = spotContinue(spot);
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border-2 border-ok bg-surface-2 p-3">
        <div className="flex justify-between">
          <strong>Вы: {SEAT_NAME[spot.hero]}</strong>
          <span className="font-mono">{STACK}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-subtle">{spot.line}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {spot.actions.map((a) => (
            <li key={a} className="flex items-center gap-2">
              <i className={cn("size-2.5 rounded-sm", BAR[a])} />
              {spot.labels[a]}
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="rounded-md bg-surface-2 px-2 py-1.5">
          <dt className="text-subtle">Stacks</dt>
          <dd>{STACK}</dd>
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
  const [group, setGroup] = useState<SpotGroup>("BTN");
  const [store, setStore] = useState<Store>({ spots: {} });
  const [selected, setSelected] = useState("AA");
  const [includeFolds, setIncludeFolds] = useState(true);
  const [hideRange, setHideRange] = useState(false);
  const [session, setSession] = useState({ total: 0, correct: 0, streak: 0 });
  const [current, setCurrent] = useState<string | null>(null);
  const [cards, setCards] = useState<[Face, Face] | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastGrade, setLastGrade] = useState<"correct" | "mix" | "wrong" | null>(null);
  const [quiz, setQuiz] = useState<{ checked: boolean; ok: number; guesses: Record<number, string> } | null>(null);
  const advanceRef = useRef<number | null>(null);

  const spot = useMemo(() => findSpot(spotId), [spotId]);
  const st = spotStat(store, spot.id);

  useEffect(() => {
    setStore(loadStore());
    setHideRange(localStorage.getItem("spin-hide-range") === "1");
  }, []);

  function deal(nextSpot = spot) {
    const h = pickHand(nextSpot, store, includeFolds);
    setQuiz(null);
    setCurrent(h);
    setCards(dealCombo(h));
    setLocked(false);
    setLastGrade(null);
  }

  function clearAdvance() {
    if (advanceRef.current != null) {
      window.clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }

  function nextAfter(total: number) {
    if (total > 0 && total % 8 === 0) {
      setQuiz({ checked: false, ok: 0, guesses: {} });
      return;
    }
    deal();
  }

  useEffect(() => () => clearAdvance(), []);

  useEffect(() => {
    if (tab === "practice" && !current && !quiz) deal();
  }, [tab]);

  function changeSpot(id: string) {
    clearAdvance();
    const s = findSpot(id);
    setSpotId(id);
    setGroup(s.group);
    setSession({ total: 0, correct: 0, streak: 0 });
    setLocked(false);
    setLastGrade(null);
    setQuiz(null);
    const h = pickHand(s, store, includeFolds);
    setCurrent(h);
    setCards(dealCombo(h));
  }

  function changeGroup(g: SpotGroup) {
    const first = spotsIn(g)[0];
    if (first) changeSpot(first.id);
  }

  function answer(a: MixAction) {
    if (quiz || !current || locked) return;
    if (!spot.actions.includes(a)) return;
    const g = grade(mixOf(spot.range, current), a);
    setLastGrade(g);
    setLocked(true);
    const ok = g !== "wrong";
    const nextTotal = session.total + 1;
    setStore(record(store, spot.id, current, ok));
    setSession((s) => ({
      total: nextTotal,
      correct: s.correct + (ok ? 1 : 0),
      streak: ok ? s.streak + 1 : 0,
    }));
    if (g === "correct") {
      clearAdvance();
      advanceRef.current = window.setTimeout(() => {
        advanceRef.current = null;
        nextAfter(nextTotal);
      }, 280);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== "practice" || quiz) return;
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
    nextAfter(session.total);
  }

  const sessPct = session.total ? Math.round((session.correct / session.total) * 100) : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "practice", label: "Тренировка" },
    { id: "strategy", label: "Стратегия" },
    { id: "hands", label: "Комбинации" },
    { id: "math", label: "Математика" },
    { id: "stats", label: "Статистика" },
  ];

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
              {tab === "hands" ? "Комбинации" : tab === "math" ? "Математика" : quiz ? "Квиз" : spot.title}
            </span>
          </h1>
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
        {tab === "strategy" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <SpotPills group={group} spot={spot} onGroup={changeGroup} onSpot={changeSpot} />
              <div className="mt-3 mb-3 flex flex-wrap items-center justify-between gap-2">
                <strong>
                  {spot.hero} vs {spot.vs}
                </strong>
                <Legend spot={spot} />
              </div>
              <MixGrid range={spot.range} selected={selected} onPick={setSelected} />
            </section>
            <aside className="rounded-2xl border border-border bg-surface p-4">
              <Meta spot={spot} />
              <p className="mt-4 font-mono text-lg font-semibold">{selected}</p>
              <p className="mb-3 text-sm text-muted">
                {isMix(mixOf(spot.range, selected)) ? "Микс" : "Чисто"} · {spot.labels[primary(mixOf(spot.range, selected))]}
              </p>
              <MixBars range={spot.range} hand={selected} labels={spot.labels} />
            </aside>
          </div>
        )}

        {tab === "practice" && (
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
                <Legend spot={spot} />
                <div className="mt-3">
                  <MixGrid range={spot.range} selected={current} onPick={setSelected} />
                </div>
              </section>
            )}
            <section className="rounded-2xl border border-border bg-surface p-4">
              {quiz ? (
                <QuizPanel quiz={quiz} setQuiz={setQuiz} onDone={() => deal()} />
              ) : (
                <>
                  {hideRange && <SpotPills group={group} spot={spot} onGroup={changeGroup} onSpot={changeSpot} />}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm text-muted">
                      Сессия {session.correct}/{session.total} <b className="text-fg">{sessPct}%</b>
                      {session.streak > 1 ? ` · ${session.streak} подряд` : ""}
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
                    {lastGrade === "mix" && current && `Микс · чаще ${spot.labels[primary(mixOf(spot.range, current))]}`}
                    {lastGrade === "wrong" && current && `Ошибка · нужно ${spot.labels[primary(mixOf(spot.range, current))]}`}
                  </p>
                  <p className="text-center font-mono text-sm text-muted">{current}</p>
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
                        {spot.labels[a]}
                        <kbd className="ml-1 text-[10px] opacity-70">{a[0]!.toUpperCase()}</kbd>
                      </button>
                    ))}
                  </div>
                  {locked && current && lastGrade !== "correct" && (
                    <div className="mt-4">
                      <MixBars range={spot.range} hand={current} labels={spot.labels} />
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
            </section>
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
                  </p>
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
        {tab === "math" && <MathDrill />}
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
