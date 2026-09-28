import { MiniCard } from "@/components/spin-drill/pip-card";
import { RANK_CHARS, SUIT_CHARS, parseCard } from "@/lib/poker/cards";
import {
  STAGES,
  bucketOf,
  bucketsFor,
  judge,
  shuffleSpots,
  type EquitySpot,
  type EquityStage,
} from "@/lib/spin-drill/equity-drill";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const SAVE_KEY = "spin-equity-v1";

type Save = Record<EquityStage, { total: number; correct: number }>;

const EMPTY: Save = {
  pair: { total: 0, correct: 0 },
  draw: { total: 0, correct: 0 },
  board: { total: 0, correct: 0 },
  range: { total: 0, correct: 0 },
};

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Save>;
    return {
      pair: parsed.pair ?? EMPTY.pair,
      draw: parsed.draw ?? EMPTY.draw,
      board: parsed.board ?? EMPTY.board,
      range: parsed.range ?? EMPTY.range,
    };
  } catch {
    return EMPTY;
  }
}

function face(code: string) {
  const c = parseCard(code);
  return { r: RANK_CHARS[c.rank]!, s: SUIT_CHARS[c.suit]! };
}

export function EquityDrill() {
  const [stage, setStage] = useState<EquityStage>("pair");
  const [help, setHelp] = useState(true);
  const [queue, setQueue] = useState<EquitySpot[]>(() => shuffleSpots("pair"));
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [save, setSave] = useState<Save>(EMPTY);

  const meta = STAGES.find((s) => s.id === stage)!;
  const spot = queue[at % Math.max(queue.length, 1)]!;
  const buckets = bucketsFor(stage);
  const verdict = pick ? judge(stage, spot.equity, pick) : null;
  const right = bucketOf(stage, spot.equity);
  const stat = save[stage];
  const pct = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;

  useEffect(() => {
    setSave(loadSave());
  }, []);

  function go(next: EquityStage) {
    setStage(next);
    setQueue(shuffleSpots(next));
    setAt(0);
    setPick(null);
    setHelp(true);
  }

  function answer(id: string) {
    if (pick) return;
    const result = judge(stage, spot.equity, id);
    setPick(id);
    const nextSave: Save = {
      ...save,
      [stage]: {
        total: stat.total + 1,
        correct: stat.correct + (result === "correct" ? 1 : 0),
      },
    };
    setSave(nextSave);
    localStorage.setItem(SAVE_KEY, JSON.stringify(nextSave));
  }

  function nextHand() {
    if (!pick) return;
    if (verdict === "wrong" || verdict === "close") {
      setQueue((q) => {
        const copy = q.slice();
        const replay = copy[at % copy.length]!;
        const insert = Math.min(copy.length, (at % copy.length) + 2);
        copy.splice(insert, 0, replay);
        return copy;
      });
    }
    setAt((n) => n + 1);
    setPick(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!pick) {
        const n = Number(e.key);
        const bucket = buckets[n - 1];
        if (bucket) answer(bucket.id);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        nextHand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            className={cn(
              "h-11 rounded-full border px-3 text-sm",
              stage === s.id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {s.short}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">Порядок: рука, дро, флоп, диапазон. Любой шаг можно открыть сразу.</p>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{meta.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{meta.lead}</p>
          </div>
          <button type="button" className="h-11 shrink-0 text-sm text-muted" onClick={() => setHelp((v) => !v)}>
            {help ? "Скрыть" : "Шпаргалка"}
          </button>
        </div>
        {help ? (
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-fg">
            {meta.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 font-mono text-sm text-muted">
          Этот шаг {stat.correct}/{stat.total}
          {stat.total ? ` · ${pct}%` : ""}
        </p>
      </section>

      <p className="text-sm leading-relaxed text-muted">{spot.story}</p>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold">Противник</p>
        <p className="text-center text-sm text-muted">{spot.villainLine}</p>
        <div className="flex gap-1">
          {spot.villain ? (
            spot.villain.map((code) => {
              const f = face(code);
              return <MiniCard key={code} r={f.r} s={f.s} />;
            })
          ) : (
            <>
              <div className="card-back h-14 w-10 rounded-md" />
              <div className="card-back h-14 w-10 rounded-md" />
            </>
          )}
        </div>
      </div>

      {spot.board.length ? (
        <div className="felt-table mx-auto flex max-w-md flex-col items-center gap-2 rounded-full px-4 py-6">
          <p className="font-mono text-xs tracking-wide text-fg/70">{spot.street}</p>
          <div className="flex gap-1">
            {spot.board.map((code) => {
              const f = face(code);
              return <MiniCard key={code} r={f.r} s={f.s} />;
            })}
            {Array.from({ length: 5 - spot.board.length }, (_, i) => (
              <div key={i} className="card-back h-14 w-10 rounded-md" />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center font-mono text-sm text-subtle">Префлоп · борда ещё нет</p>
      )}

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1">
          {spot.hero.map((code) => {
            const f = face(code);
            return <MiniCard key={code} r={f.r} s={f.s} />;
          })}
        </div>
        <p className="rounded-2xl bg-call px-4 py-2 text-center text-sm font-semibold text-fg">Вы</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-center text-base">Какая у вас эквити к риверу?</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {buckets.map((b, i) => {
            const chosen = pick === b.id;
            const isRight = pick !== null && b.id === right.id;
            return (
              <button
                key={b.id}
                type="button"
                disabled={pick !== null}
                onClick={() => answer(b.id)}
                className={cn(
                  "h-12 rounded-xl border text-sm font-medium",
                  pick === null && "border-border bg-surface-2",
                  isRight && "border-ok text-ok",
                  chosen && !isRight && "border-bad text-bad",
                  pick !== null && !chosen && !isRight && "border-border text-subtle",
                )}
              >
                {b.label}
                <span className="ml-1 font-mono text-xs text-subtle">{i + 1}</span>
              </button>
            );
          })}
        </div>

        {pick && verdict ? (
          <div className="mt-4">
            <p className="text-center font-mono text-xl">{spot.equity}%</p>
            <p className={cn("mt-1 text-center text-sm font-semibold", verdict === "correct" ? "text-ok" : verdict === "close" ? "text-fg" : "text-bad")}>
              {verdict === "correct" ? "Верно." : verdict === "close" ? "Рядом." : "Мимо."} Полка: {right.label}.
            </p>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted">{spot.rule}</p>
            <p className="mt-1 text-center text-sm leading-relaxed text-muted">{spot.why}</p>
            {stage === "range" ? (
              <p className="mt-2 text-center text-sm leading-relaxed text-fg">
                Колл пуша просит около 47%. {spot.equity >= 47 ? "Этого хватает." : "Этого мало — фолд."}
              </p>
            ) : null}
            <button type="button" className="mt-3 h-11 w-full text-sm text-muted" onClick={nextHand}>
              Следующая
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-muted">Полка, не точный процент. Цифры 1–{buckets.length}.</p>
        )}
      </div>
    </div>
  );
}
