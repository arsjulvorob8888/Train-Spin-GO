"use client";

import { MiniCard, PipCard } from "@/components/spin-drill/pip-card";
import {
  MATH_HANDS,
  MATH_TOPICS,
  gradeNumber,
  parseGuess,
  type MathHand,
  type MathQ,
  type MathTopic,
} from "@/lib/spin-drill/math-hands";
import { loadMath, mathCoverage, recordMath, resetMath, type MathStore } from "@/lib/spin-drill/math-store";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type TopicFilter = MathTopic | "all";

function pickNext(
  topic: TopicFilter,
  store: MathStore,
  avoid: string | null,
): { hand: MathHand; qi: number } {
  const pool = MATH_HANDS.filter((h) => topic === "all" || h.topic === topic);
  const items: { hand: MathHand; qi: number; w: number }[] = [];
  for (const hand of pool) {
    hand.questions.forEach((q, qi) => {
      const rec = store.questions[q.id];
      const seen = rec?.total ?? 0;
      const acc = seen ? rec!.correct / rec!.total : 0;
      const w = (seen === 0 ? 2.4 : 1 + (1 - acc) * 4) * (q.id === avoid ? 0.15 : 1);
      items.push({ hand, qi, w });
    });
  }
  const list = items.length ? items : [{ hand: MATH_HANDS[0]!, qi: 0, w: 1 }];
  let t = Math.random() * list.reduce((a, b) => a + b.w, 0);
  for (const it of list) {
    t -= it.w;
    if (t <= 0) return it;
  }
  return list[list.length - 1]!;
}

function formatAnswer(q: MathQ): string {
  if (q.kind === "choice") {
    return q.choices?.find((c) => c.id === q.correct)?.label ?? q.correct ?? "";
  }
  const n = q.answer ?? 0;
  const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
  if (q.unit === "%") return `${body}%`;
  if (q.unit === "bb") return `${body} bb`;
  if (q.unit === "outs") return body;
  return body;
}

export function MathDrill() {
  const [store, setStore] = useState<MathStore>({ overall: { total: 0, correct: 0 }, questions: {} });
  const [topic, setTopic] = useState<TopicFilter>("all");
  const [hand, setHand] = useState<MathHand>(MATH_HANDS[0]!);
  const [qi, setQi] = useState(0);
  const [guess, setGuess] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ok, setOk] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [session, setSession] = useState({ total: 0, correct: 0, streak: 0 });
  const [calc, setCalc] = useState({ pot: 18.5, call: 13, eq: 45 });

  const q = hand.questions[qi]!;
  const cover = useMemo(() => mathCoverage(store), [store]);
  const need = (calc.call / (calc.pot + calc.call)) * 100;
  const ev = (calc.eq / 100) * (calc.pot + calc.call) - calc.call;

  useEffect(() => {
    const s = loadMath();
    setStore(s);
    const n = pickNext("all", s, null);
    setHand(n.hand);
    setQi(n.qi);
  }, []);

  function deal(nextTopic = topic, from = store, avoid: string | null = q.id) {
    const n = pickNext(nextTopic, from, avoid);
    setHand(n.hand);
    setQi(n.qi);
    setGuess("");
    setChoice(null);
    setRevealed(false);
    setOk(false);
    setHintOn(false);
  }

  function changeTopic(t: TopicFilter) {
    setTopic(t);
    deal(t, store, null);
  }

  function submit() {
    if (revealed) return;
    let correct = false;
    if (q.kind === "number") {
      correct = gradeNumber(parseGuess(guess), q.answer ?? 0, q.tolerance ?? 1);
    } else {
      correct = choice === q.correct;
    }
    setOk(correct);
    setRevealed(true);
    setStore(recordMath(store, q.id, correct));
    setSession((s) => ({
      total: s.total + 1,
      correct: s.correct + (correct ? 1 : 0),
      streak: correct ? s.streak + 1 : 0,
    }));
  }

  const sessPct = session.total ? Math.round((session.correct / session.total) * 100) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{hand.tag}</p>
            <h2 className="font-display text-xl font-medium">{hand.title}</h2>
          </div>
          <p className="font-mono text-sm text-muted">
            Сессия {session.correct}/{session.total} <b className="text-fg">{sessPct}%</b>
            {session.streak > 1 ? ` · ${session.streak} подряд` : ""}
          </p>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MATH_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTopic(t.id)}
              className={cn(
                "h-11 rounded-full border px-3 text-sm",
                topic === t.id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-muted">{hand.story}</p>
        <p className="mb-1 font-mono text-xs text-subtle">{hand.line}</p>
        <p className="mb-4 font-mono text-xs text-muted">{hand.pot}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">Hero</p>
            <div className="flex gap-2">
              <PipCard card={hand.hero[0]} tilt={-6} />
              <PipCard card={hand.hero[1]} tilt={7} />
            </div>
          </div>
          {hand.villain && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                {hand.villainLabel ?? "Villain"}
              </p>
              <div className="flex gap-1.5">
                {hand.villain.map((c, i) => (
                  <MiniCard key={i} r={c.rank} s={c.suit} />
                ))}
              </div>
            </div>
          )}
          {hand.board && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">Борд</p>
              <div className="flex gap-1.5">
                {hand.board.map((c, i) => (
                  <MiniCard key={i} r={c.rank} s={c.suit} />
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 font-mono text-xs text-subtle">
          Вопрос {qi + 1} из {hand.questions.length} · покрыто {cover.seen}/{cover.total}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="text-sm font-medium leading-snug">{q.prompt}</p>
        {!revealed && (
          <button type="button" className="mt-2 h-11 text-sm text-muted" onClick={() => setHintOn((v) => !v)}>
            {hintOn ? "Скрыть подсказку" : "Подсказка"}
          </button>
        )}
        {hintOn && !revealed && <p className="mt-1 text-sm text-muted">{q.hint}</p>}

        {q.kind === "number" ? (
          <label className="mt-3 grid gap-1 text-xs text-muted">
            Ответ{q.unit === "%" ? ", %" : q.unit === "bb" ? ", bb" : ""}
            <input
              inputMode="decimal"
              value={guess}
              disabled={revealed}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-12 rounded-lg border border-border bg-bg px-3 font-mono text-lg text-fg"
            />
          </label>
        ) : (
          <div className="mt-3 grid gap-2">
            {q.choices?.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={revealed}
                onClick={() => setChoice(c.id)}
                className={cn(
                  "h-12 rounded-[10px] border px-3 text-left text-sm",
                  choice === c.id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-fg",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {!revealed ? (
          <button
            type="button"
            className="mt-3 h-12 w-full rounded-[10px] bg-fg font-semibold text-bg disabled:opacity-40"
            disabled={q.kind === "number" ? guess.trim() === "" : !choice}
            onClick={submit}
          >
            Проверить
          </button>
        ) : (
          <div className="mt-4">
            <p className={cn("text-lg font-medium", ok ? "text-ok" : "text-bad")}>
              {ok ? "Верно" : "Ошибка"}
              <span className="ml-2 font-mono text-sm font-normal text-fg">· {formatAnswer(q)}</span>
            </p>
            {!ok && (
              <p className="mt-1 text-sm text-muted">
                Вы ответили:{" "}
                {q.kind === "number"
                  ? guess
                  : (q.choices?.find((c) => c.id === choice)?.label ?? "—")}
              </p>
            )}
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted">
              {q.steps.map((s, i) => (
                <li key={i} className={cn(!ok && "text-fg")}>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-3 rounded-lg border border-border border-l-raise bg-bg px-3 py-2 text-sm">
              <p className="font-medium text-fg">{q.takeaway}</p>
              <p className="mt-1 text-muted">{q.leak}</p>
            </div>
            <button
              type="button"
              className="mt-3 h-12 w-full rounded-[10px] bg-fg font-semibold text-bg"
              onClick={() => deal()}
            >
              Следующий вопрос
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Калькулятор колла</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["Банк", calc.pot, (n: number) => setCalc({ ...calc, pot: n })],
                ["Колл", calc.call, (n: number) => setCalc({ ...calc, call: n })],
                ["Эквити %", calc.eq, (n: number) => setCalc({ ...calc, eq: n })],
              ] as const
            ).map(([label, val, set]) => (
              <label key={label} className="grid gap-1 text-xs text-muted">
                {label}
                <input
                  type="number"
                  step={0.5}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                  className="h-11 rounded-lg border border-border bg-bg px-2 font-mono text-fg"
                />
              </label>
            ))}
          </div>
          <p className={cn("mt-2 font-mono text-sm", ev >= 0 ? "text-ok" : "text-bad")}>
            Нужно {need.toFixed(1)}% · EV {ev >= 0 ? "+" : ""}
            {ev.toFixed(2)} bb
          </p>
          <button
            type="button"
            className="mt-2 h-11 text-sm text-muted"
            onClick={() => setStore(resetMath())}
          >
            Сбросить статистику математики
          </button>
        </div>
      </section>
    </div>
  );
}
