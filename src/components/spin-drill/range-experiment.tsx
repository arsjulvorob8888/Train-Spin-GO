import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { buildShape, floodSame, studyHands, type Shape } from "@/lib/spin-drill/range-shape";
import { GROUPS, SPOTS, spotsIn, type SpotDef, type SpotGroup } from "@/lib/spin-drill/spots";
import type { MixAction } from "@/lib/spin-drill/mix";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const ACT: Record<MixAction, string> = {
  fold: "bg-fold text-fg",
  call: "bg-call text-fg",
  raise: "bg-raise text-fg",
  allin: "bg-allin text-fg",
};

type Mode = "sapper" | "edge";
type CellMark = "ok" | "miss";

function formatTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RangeExperiment() {
  const [group, setGroup] = useState<SpotGroup>("BTN");
  const [spotId, setSpotId] = useState(SPOTS[0]!.id);
  const [mode, setMode] = useState<Mode>("sapper");
  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0]!;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Эксперимент · рейнджи</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          Микс убран: в каждой клетке только самое частое действие, один цвет. Сапёр открывает середину
          одним кликом — учить остаётся границу. Обычные чарты и тренировка не меняются.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setGroup(g);
              const first = spotsIn(g)[0];
              if (first) setSpotId(first.id);
            }}
            className={cn(
              "h-11 rounded-full border px-3 text-sm",
              group === g ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {spotsIn(group).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSpotId(s.id)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-3 text-sm",
              s.id === spot.id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["sapper", "Сапёр"],
            ["edge", "Граница"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "h-11 rounded-lg px-3 text-sm",
              mode === id ? "bg-surface-2 text-fg" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "sapper" ? <Sapper key={spot.id} spot={spot} /> : <EdgeDrill key={spot.id} spot={spot} />}
    </div>
  );
}

function Sapper({ spot }: { spot: SpotDef }) {
  const shape = useMemo(() => buildShape(spot.range), [spot]);
  const [armed, setArmed] = useState<MixAction | null>(null);
  const [marks, setMarks] = useState<Record<string, CellMark>>({});
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const openCount = Object.keys(marks).length;
  const misses = Object.values(marks).filter((m) => m === "miss").length;
  const done = openCount === 169;

  useEffect(() => {
    if (started == null || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started, done]);

  function paint(hand: string) {
    if (!armed || marks[hand] || done) return;
    const t0 = started ?? Date.now();
    if (started == null) {
      setStarted(t0);
      setNow(t0);
    }
    const right = shape.action[hand] === armed;
    const hands = right && shape.diffCount[hand] === 0 ? floodSame(shape, hand) : [hand];
    setMarks((prev) => {
      const next = { ...prev };
      for (const h of hands) if (!next[h]) next[h] = right ? "ok" : "miss";
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Выберите цвет и нажмите клетку. Попали в середину одного цвета — откроется вся середина. На границе
        клетка открывается одна и показывает, сколько соседей другого цвета.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {spot.actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArmed(a)}
            className={cn(
              "h-11 rounded-lg px-3 text-sm",
              ACT[a],
              armed === a ? "outline outline-2 outline-offset-2 outline-fg" : "opacity-80",
            )}
          >
            {spot.labels[a]}
          </button>
        ))}
        <span className="font-mono text-xs text-muted">
          {openCount}/169 · ошибки {misses}
          {started != null ? ` · ${formatTime(now - started)}` : ""}
        </span>
      </div>
      <div className="grid grid-cols-13 gap-px">
        {Array.from({ length: 13 }, (_, r) =>
          Array.from({ length: 13 }, (_, c) => {
            const h = handAt(r, c);
            const mark = marks[h];
            const action = shape.action[h]!;
            const n = shape.diffCount[h] ?? 0;
            return (
              <button
                key={h}
                type="button"
                disabled={Boolean(mark) || done}
                onClick={() => paint(h)}
                className={cn(
                  "relative flex aspect-square items-end p-0.5 font-mono text-[10px] font-semibold leading-none sm:text-xs",
                  mark ? ACT[action] : "bg-surface-2 text-muted",
                  mark === "miss" && "outline outline-2 outline-bad",
                )}
              >
                {h}
                {mark && n > 0 ? (
                  <span className="absolute top-0.5 right-0.5 text-[9px] text-fg/80">{n}</span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      {done ? (
        <p className="text-sm text-muted">
          Форма собрана. Ошибок: {misses}. Середину можно забыть — она одного цвета. Помнить стоит клетки с
          цифрой: это граница.
        </p>
      ) : null}
    </div>
  );
}

function EdgeDrill({ spot }: { spot: SpotDef }) {
  const shape: Shape = useMemo(() => buildShape(spot.range), [spot]);
  const queue = useMemo(() => studyHands(shape), [shape]);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [misses, setMisses] = useState(0);
  const hand = queue[i];
  const done = hand == null;

  function pick(a: MixAction) {
    if (done || wrong || !hand) return;
    if (shape.action[hand] === a) {
      setI((n) => n + 1);
      return;
    }
    setWrong(true);
    setMisses((n) => n + 1);
  }

  if (done) {
    return (
      <p className="text-sm text-muted">
        Граница этого ренджа закрыта. Рук в наборе: {queue.length}. Ошибок: {misses}. Серые фолды в глубине
        чарта сюда не входят — их не нужно учить по одной.
      </p>
    );
  }

  const truth = shape.action[hand]!;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Только руки, которые играют, и фолды на самой кромке. {i + 1} из {queue.length}. Ошибок: {misses}.
      </p>
      <p className="font-mono text-5xl font-semibold tracking-wide">{hand}</p>
      <div className="flex flex-wrap gap-2">
        {spot.actions.map((a) => (
          <button
            key={a}
            type="button"
            disabled={wrong}
            onClick={() => pick(a)}
            className={cn(
              "h-12 rounded-lg px-4 text-sm",
              ACT[a],
              wrong && a === truth && "outline outline-2 outline-offset-2 outline-fg",
              wrong && a !== truth && "opacity-40",
            )}
          >
            {spot.labels[a]}
          </button>
        ))}
      </div>
      {wrong ? (
        <button type="button" className="h-11 text-sm text-muted" onClick={() => { setWrong(false); setI((n) => n + 1); }}>
          Дальше — это {spot.labels[truth]}
        </button>
      ) : null}
    </div>
  );
}
