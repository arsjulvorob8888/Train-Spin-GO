import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { buildShape, floodSame, studyHands, type Shape } from "@/lib/spin-drill/range-shape";
import { GROUPS, SPOTS, spotsIn, type SpotDef, type SpotGroup } from "@/lib/spin-drill/spots";
import type { MixAction } from "@/lib/spin-drill/mix";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

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

let audioCtx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const sounds = {
  hit(streak: number) {
    tone(480 + streak * 55, 0.09, "triangle", 0.06);
  },
  wave() {
    tone(523, 0.12, "square", 0.04);
    tone(659, 0.16, "square", 0.04, 0.08);
    tone(784, 0.22, "triangle", 0.05, 0.16);
  },
  miss() {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
    amp.gain.setValueAtTime(0.05, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.34);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, i * 0.09));
  },
};

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
          Во всём приложении у клетки один цвет — самое частое действие, без микса. Здесь поле ведёт себя как
          игра: пять верных подряд открывают соседей, одна ошибка захлопывает уже открытое.
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
  const [fx, setFx] = useState<Record<string, "pop" | "blast">>({});
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<"play" | "wave" | "collapse" | "win">("play");
  const [shutting, setShutting] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const streakHands = useRef<string[]>([]);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const openCount = Object.keys(marks).length;
  const done = phase === "win" || openCount === 169;

  useEffect(() => {
    if (started == null || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started, done]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }

  function paint(hand: string) {
    if (busy.current || !armed || marks[hand] || done) return;
    const t0 = started ?? Date.now();
    if (started == null) {
      setStarted(t0);
      setNow(t0);
    }
    const right = shape.action[hand] === armed;
    if (!right) {
      busy.current = true;
      sounds.miss();
      setStreak(0);
      streakHands.current = [];
      setMisses((n) => n + 1);
      setPhase("collapse");
      setMarks((prev) => ({ ...prev, [hand]: "miss" }));
      setFx({ [hand]: "pop" });
      later(280, () => setShutting(true));
      later(700, () => {
        setMarks({});
        setFx({});
        setShutting(false);
        setPhase("play");
        busy.current = false;
      });
      return;
    }

    const opened = shape.diffCount[hand] === 0 ? floodSame(shape, hand) : [hand];
    const chain = [...streakHands.current, ...opened];
    const nextStreak = streak + 1;
    const wave = nextStreak >= 5;
    const bonus = wave
      ? chain.flatMap((h) => shape.neighbors[h] ?? []).filter((h, i, all) => all.indexOf(h) === i)
      : [];
    const gained = [...opened, ...bonus];
    if (wave) {
      streakHands.current = [];
      setStreak(0);
      setPhase("wave");
      later(900, () => setPhase((p) => (p === "wave" ? "play" : p)));
    } else {
      streakHands.current = chain;
      setStreak(nextStreak);
      setPhase("play");
    }
    const anim: Record<string, "pop" | "blast"> = {};
    for (const h of opened) anim[h] = "pop";
    for (const h of bonus) anim[h] = "blast";
    const next = { ...marks };
    for (const h of gained) if (!next[h]) next[h] = "ok";
    const cleared = Object.keys(next).length >= 169;
    if (cleared) {
      sounds.win();
      setPhase("win");
    } else if (wave) {
      sounds.wave();
    } else {
      sounds.hit(nextStreak);
    }
    setFx(anim);
    setMarks(next);
  }

  const scenario =
    phase === "win"
      ? "Рендж открыт. Форма собрана."
      : phase === "collapse"
        ? "Обвал. Одна ошибка закрыла уже открытые клетки."
        : phase === "wave"
          ? "Волна. Пять подряд — открылись клетки вокруг цепочки."
          : streak === 0
            ? "Назовите цвет клетки. Пять верных подряд поднимают волну."
            : `Цепочка ${streak}/5. Ещё ${5 - streak} без ошибки — и соседние клетки откроются.`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{scenario}</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <i
              key={i}
              className={cn("block h-2.5 w-2.5 rounded-full", i < streak ? "bg-fg" : "bg-surface-2")}
            />
          ))}
        </div>
      </div>
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
          {openCount}/169 · обвалы {misses}
          {started != null ? ` · ${formatTime(now - started)}` : ""}
        </span>
      </div>
      <div className={cn("grid grid-cols-13 gap-px", shutting && "range-shake")}>
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
                disabled={Boolean(mark) || done || shutting}
                onClick={() => paint(h)}
                className={cn(
                  "relative flex aspect-square origin-center items-end p-0.5 font-mono text-[10px] font-semibold leading-none sm:text-xs",
                  mark ? ACT[action] : "bg-surface-2 text-muted",
                  mark === "miss" && "outline outline-2 outline-bad",
                  shutting && mark && "range-shut",
                  !shutting && fx[h] === "pop" && "range-pop",
                  !shutting && fx[h] === "blast" && "range-blast",
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
      sounds.hit(1);
      setI((n) => n + 1);
      return;
    }
    sounds.miss();
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
