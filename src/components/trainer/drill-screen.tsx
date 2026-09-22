"use client";

import { PlayingCard } from "@/components/table/playing-card";
import { Button } from "@/components/ui/button";
import { ACTION_RU, nextDrill, type DrillQ } from "@/lib/poker/drill";
import { VILLAINS, continuePct, type Villain } from "@/lib/poker/exploit";
import { sampleHole } from "@/lib/poker/hole";
import { equityNeeded, potOdds } from "@/lib/poker/icm";
import { loadProgress, pct, recordAnswer, resetProgress, type Progress } from "@/lib/poker/progress";
import { STACKS, SPOTS, type StackDepth } from "@/lib/poker/spin";
import type { GtoAction } from "@/lib/poker/spin/notation";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const POS = ["ANY", "BTN", "SB", "BB"] as const;

function explain(q: DrillQ, pick: GtoAction): string {
  const need = q.toCallBb > 0 ? equityNeeded(q.toCallBb, q.potBb) : 0;
  const odds = q.toCallBb > 0 ? potOdds(q.toCallBb, q.potBb) : 0;
  const meta = SPOTS.find((s) => s.id === q.spot)!;
  const cont = continuePct(q.spec);
  if (pick === q.gto) {
    if (q.gto === "fold") {
      return `Верно. ${q.klass} вне ${cont.toFixed(0)}% продолжения в ${meta.label} на ${q.stack}bb.`;
    }
    if (q.toCallBb > 0) {
      return `Верно. Пот ${q.potBb.toFixed(1)}bb, колл ${q.toCallBb.toFixed(1)}bb → нужно ${(need * 100).toFixed(0)}% эквити (пот-оддсы ${(odds * 100).toFixed(0)}%). ${q.klass} в диапазоне ${ACTION_RU[q.gto]}.`;
    }
    return `Верно. ${q.klass} — ${ACTION_RU[q.gto]} из ${meta.label}. Продолжаем ${cont.toFixed(0)}% рук.`;
  }
  if (q.gto === "fold" && pick !== "fold") {
    return `Лишняя рука. ${q.klass} ниже диапазона: солвер фолдит. На ${q.stack}bb продолжение всего ${cont.toFixed(0)}%.`;
  }
  if (pick === "fold") {
    return `Слишком тайт. Солвер играет ${ACTION_RU[q.gto]}. Узкий фолд отдаёт фолд-эквити и ICM 1-го места.`;
  }
  return `Другой сайзинг. GTO: ${ACTION_RU[q.gto]}, вы: ${ACTION_RU[pick]}. На ${q.stack}bb jam чаще, чем в кэше: стек ~ приз.`;
}

export function DrillScreen() {
  const [stack, setStack] = useState<StackDepth>(15);
  const [pos, setPos] = useState<(typeof POS)[number]>("ANY");
  const [villain, setVillain] = useState<Villain>("gto");
  const [q, setQ] = useState<DrillQ | null>(null);
  const [pick, setPick] = useState<GtoAction | null>(null);
  const [progress, setProgress] = useState<Progress>(() =>
    typeof window === "undefined"
      ? { seen: 0, correct: 0, streak: 0, bestStreak: 0, byPos: {}, bySpot: {}, leaks: [] }
      : loadProgress(),
  );

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  useEffect(() => {
    setPick(null);
    setQ(nextDrill({ stack, pos, villain }));
  }, [stack, pos, villain]);

  function deal() {
    setPick(null);
    setQ(nextDrill({ stack, pos, villain }));
  }

  function answer(a: GtoAction) {
    if (!q || pick) return;
    setPick(a);
    setProgress(
      recordAnswer(progress, {
        pos: q.pos,
        spot: q.spot,
        klass: q.klass,
        pick: a,
        gto: q.gto,
        ok: a === q.gto,
      }),
    );
  }

  const hole = useMemo(() => (q ? sampleHole(q.klass) : null), [q]);
  const meta = q ? SPOTS.find((s) => s.id === q.spot)! : null;
  const acc = progress.seen ? (progress.correct / progress.seen) * 100 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Спот-тренажёр</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Одна рука. Одно решение.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Spin & Go 3-max, winner-take-all. Играйте только свою руку против выбранного типа оппонента.
            Проценты — доля комбо в диапазоне, не «ощущение».
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STACKS.map((bb) => (
            <Button key={bb} size="sm" variant={stack === bb ? "primary" : "secondary"} onClick={() => setStack(bb)}>
              {bb}bb
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POS.map((p) => (
            <Button key={p} size="sm" variant={pos === p ? "primary" : "ghost"} onClick={() => setPos(p)}>
              {p === "ANY" ? "Все позиции" : p}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VILLAINS.map((v) => (
            <Button key={v.id} size="sm" variant={villain === v.id ? "primary" : "secondary"} onClick={() => setVillain(v.id)}>
              {v.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted">{VILLAINS.find((v) => v.id === villain)?.blurb}</p>

        {q && meta && hole && (
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  {q.pos} · {q.stack}bb · {meta.label}
                </p>
                <p className="mt-1 text-sm text-fg">{meta.when}</p>
              </div>
              <p className="font-display text-2xl font-semibold">{q.klass}</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <PlayingCard card={hole[0]} size="lg" />
              <PlayingCard card={hole[1]} size="lg" />
            </div>
            <p className="mt-3 font-mono text-xs text-muted">
              банк {q.potBb.toFixed(1)}bb
              {q.toCallBb > 0 ? ` · колл ${q.toCallBb.toFixed(1)}bb · нужно ${(equityNeeded(q.toCallBb, q.potBb) * 100).toFixed(0)}%` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {q.buttons.map((a) => (
                <Button
                  key={a}
                  variant={a === "fold" ? "fold" : a === "call" || a === "limp" || a === "check" ? "call" : "raise"}
                  disabled={Boolean(pick)}
                  onClick={() => answer(a)}
                >
                  {ACTION_RU[a]}
                </Button>
              ))}
            </div>
            {pick && (
              <div
                className={cn(
                  "mt-4 rounded-md border px-3 py-3 text-sm",
                  pick === q.gto ? "border-call/40 bg-call/10" : "border-fold/40 bg-fold/10",
                )}
              >
                <p className="font-medium">
                  {pick === q.gto ? "Верно" : "Ошибка"} · солвер: {ACTION_RU[q.gto]}
                </p>
                <p className="mt-1 text-muted">{explain(q, pick)}</p>
                <Button className="mt-3" variant="primary" onClick={deal}>
                  Следующая рука
                </Button>
              </div>
            )}
            {!pick && (
              <Button className="mt-4" variant="ghost" onClick={deal}>
                Пропустить
              </Button>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Точность</p>
          <p className="mt-1 font-display text-3xl font-semibold">{acc.toFixed(0)}%</p>
          <p className="text-sm text-muted">
            {progress.correct}/{progress.seen} · серия {progress.streak} (рекорд {progress.bestStreak})
          </p>
          <div className="mt-3 space-y-1.5">
            {(["BTN", "SB", "BB"] as const).map((p) => (
              <div key={p} className="flex items-center justify-between text-sm">
                <span className="text-muted">{p}</span>
                <span className="font-mono">
                  {pct(progress.byPos[p]).toFixed(0)}% · {progress.byPos[p]?.seen ?? 0}
                </span>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" size="sm" variant="ghost" onClick={() => setProgress(resetProgress())}>
            Сбросить статистику
          </Button>
        </div>
        {progress.leaks.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Лики</p>
            <ul className="mt-2 space-y-1.5 font-mono text-xs">
              {progress.leaks.slice(0, 8).map((l, i) => (
                <li key={`${l.klass}-${i}`} className="flex justify-between gap-2 text-muted">
                  <span className="text-fg">{l.klass}</span>
                  <span>
                    {l.pick} → {l.gto}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
