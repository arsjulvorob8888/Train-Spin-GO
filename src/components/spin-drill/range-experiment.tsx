import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { buildShape, studyHands, type Shape } from "@/lib/spin-drill/range-shape";
import { drawQuiz, type QuizQ } from "@/lib/spin-drill/quiz-bank";
import { nearestOpen, rangeAtStack, stackNote } from "@/lib/spin-drill/stack-ranges";
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
  soft() {
    tone(392, 0.16, "sine", 0.04);
  },
};

let bed: { stop: () => void } | null = null;

function startMemoryMusic() {
  if (bed) return;
  const ctx = audio();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = 0.04;
  master.connect(ctx.destination);
  const drone = ctx.createOscillator();
  const fifth = ctx.createOscillator();
  const droneGain = ctx.createGain();
  const fifthGain = ctx.createGain();
  drone.type = "sine";
  fifth.type = "sine";
  drone.frequency.value = 98;
  fifth.frequency.value = 146.83;
  droneGain.gain.value = 0.4;
  fifthGain.gain.value = 0.12;
  drone.connect(droneGain);
  fifth.connect(fifthGain);
  droneGain.connect(master);
  fifthGain.connect(master);
  drone.start();
  fifth.start();
  const scale = [196, 220, 246.94, 293.66, 329.63];
  let step = 0;
  const timer = window.setInterval(() => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = scale[step % scale.length]!;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 1.6);
    step += 1;
  }, 1200);
  bed = {
    stop() {
      window.clearInterval(timer);
      drone.stop();
      fifth.stop();
      master.disconnect();
      bed = null;
    },
  };
}

function stopMemoryMusic() {
  bed?.stop();
}

const SUPPORT = [
  "Поле не закрылось. Ошибка в формуле ничего не стирает из ренджа.",
  "Так и запоминается: не с первого щелчка, а когда видишь, откуда цифра.",
  "Это нормально. На столе вы всё равно будете считать теми же двумя правилами: ауты ×4 и цена колла.",
];

export function RangeExperiment() {
  const [group, setGroup] = useState<SpotGroup>("BTN");
  const [spotId, setSpotId] = useState(SPOTS[0]!.id);
  const [mode, setMode] = useState<Mode>("sapper");
  const [music, setMusic] = useState(true);
  const [bb, setBb] = useState(15);
  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0]!;

  useEffect(() => {
    if (!music) {
      stopMemoryMusic();
      return;
    }
    const unlock = () => startMemoryMusic();
    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      stopMemoryMusic();
    };
  }, [music]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Эксперимент · рейнджи</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          Сначала смотрите форму. Вопрос приходит после трёх волн по пять верных клеток и после ошибки. Обновление страницы не начинает банк сначала.
        </p>
        <button
          type="button"
          onClick={() => {
            setMusic((on) => {
              if (on) stopMemoryMusic();
              else startMemoryMusic();
              return !on;
            });
          }}
          className={cn(
            "h-11 rounded-lg border px-3 text-sm",
            music ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
          )}
        >
          {music ? "Выключить музыку" : "Включить музыку"}
        </button>
      </div>
      <label className="block rounded-2xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-mono text-sm">{bb}bb</span>
          <span className="text-sm text-muted">{stackNote(bb)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={bb}
          onChange={(e) => setBb(Number(e.target.value))}
          className="mt-3 w-full"
        />
      </label>
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
      {mode === "sapper" ? (
        <Sapper key={`${spot.id}-${bb}`} spot={spot} bb={bb} />
      ) : (
        <EdgeDrill key={`${spot.id}-${bb}`} spot={spot} bb={bb} />
      )}
    </div>
  );
}

function actionLabel(spot: SpotDef, action: MixAction, bb: number): string {
  if (action === "allin") return `All-in ${bb}`;
  if (action === "raise") return bb >= 20 ? "Raise 2.5" : "Raise 2";
  if (action === "call" && (spot.id === "sb_fold" || spot.id === "hu_sb")) return "Limp";
  return spot.labels[action];
}

function Sapper({ spot, bb }: { spot: SpotDef; bb: number }) {
  const range = useMemo(() => rangeAtStack(spot.range, spot.id, bb), [spot, bb]);
  const shape = useMemo(() => buildShape(range), [range]);
  const actions = useMemo(() => {
    const used = new Set(Object.values(shape.action));
    return spot.actions.filter((action) => used.has(action));
  }, [shape, spot.actions]);
  const [armed, setArmed] = useState<MixAction | null>(null);
  const [marks, setMarks] = useState<Record<string, CellMark>>({});
  const [fx, setFx] = useState<Record<string, "pop" | "blast">>({});
  const [streak, setStreak] = useState(0);
  const [waves, setWaves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<"play" | "wave" | "win" | "time">("play");
  const [closing, setClosing] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [left, setLeft] = useState(120);
  const [quiz, setQuiz] = useState<(QuizQ & { picked: number | null; note: string }) | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const lastHand = useRef<string>("AA");
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const openCount = Object.keys(marks).length;
  const done = phase === "win" || phase === "time" || openCount === 169;

  useEffect(() => {
    if (!live || quiz || phase === "win" || phase === "time") return;
    const id = window.setInterval(() => {
      setLeft((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [live, quiz, phase]);

  useEffect(() => {
    if (!live || left !== 0) return;
    sounds.miss();
    setPhase("time");
    setLive(false);
  }, [live, left]);

  useEffect(() => {
    if (live && left > 0 && left <= 10) sounds.soft();
  }, [live, left]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }

  function paint(hand: string) {
    if (!live || busy.current || !armed || marks[hand] || done || quiz) return;
    const right = shape.action[hand] === armed;
    if (!right) {
      const victims = nearestOpen(
        hand,
        Object.keys(marks).filter((cell) => marks[cell]),
        10,
      );
      busy.current = true;
      sounds.miss();
      setStreak(0);
      setMisses((n) => n + 1);
      setClosing(victims);
      setMarks((prev) => ({ ...prev, [hand]: "miss" }));
      setFx({ [hand]: "pop" });
      later(420, () => {
        setMarks((prev) => {
          const next = { ...prev };
          delete next[hand];
          for (const cell of victims) delete next[cell];
          return next;
        });
        setClosing([]);
        setFx({});
        ask();
      });
      return;
    }

    const opened = [hand];
    const nextStreak = streak + 1;
    const wave = nextStreak >= 5;
    lastHand.current = hand;
    const bonus = wave ? (shape.neighbors[hand] ?? []).filter((h) => !marks[h]) : [];
    const gained = [...opened, ...bonus];
    if (wave) setStreak(0);
    else setStreak(nextStreak);
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
      const doneWaves = waves + 1;
      setPhase("wave");
      if (doneWaves >= 3) {
        setWaves(0);
        ask();
      } else {
        setWaves(doneWaves);
        later(700, () => setPhase((p) => (p === "wave" ? "play" : p)));
      }
    } else {
      sounds.hit(nextStreak);
      setPhase("play");
    }
    setFx(anim);
    setMarks(next);
  }

  function ask() {
    const q = drawQuiz();
    setQuiz({ ...q, picked: null, note: "" });
    setCheer(null);
    busy.current = true;
  }

  function finishQuiz() {
    setQuiz(null);
    setCheer(null);
    busy.current = false;
    setPhase((p) => (p === "win" ? p : "play"));
  }

  function answerQuiz(index: number) {
    if (!quiz || quiz.picked != null) return;
    const ok = index === quiz.answer;
    if (ok) {
      sounds.wave();
      const extra = (shape.neighbors[lastHand.current] ?? [])
        .filter((h) => !marks[h])
        .slice(0, 2);
      if (extra.length) {
        const next = { ...marks };
        const anim: Record<string, "pop" | "blast"> = {};
        for (const h of extra) {
          next[h] = "ok";
          anim[h] = "blast";
        }
        setMarks(next);
        setFx(anim);
        if (Object.keys(next).length >= 169) {
          sounds.win();
          setPhase("win");
        }
      }
      setCheer(extra.length ? "Верно. Две клетки рядом — в подарок." : "Верно. Рядом уже открыто, бонус — само попадание.");
      setQuiz({ ...quiz, picked: index, note: "" });
      return;
    }
    sounds.soft();
    setCheer(null);
    setQuiz({
      ...quiz,
      picked: index,
      note: SUPPORT[Math.floor(Math.random() * SUPPORT.length)]!,
    });
  }

  const scenario =
    !live && phase !== "time" && phase !== "win"
      ? "Рендж открыт. Запомните форму, потом нажмите «Закрыть и играть»."
      : phase === "win"
        ? "Рендж собран до дедлайна."
        : phase === "time"
          ? "Время вышло. Ниже снова видна форма — посмотрите, что осталось."
          : phase === "wave"
            ? "Пять подряд. Соседи открылись. Вопрос будет на третьей такой волне."
            : streak === 0
              ? `Поле закрыто. ${formatTime(left * 1000)}. Волна ${waves}/3. Ошибка тоже задаёт вопрос.`
              : `Цепочка ${streak}/5. Волна ${waves}/3.`;

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
        {actions.map((a) => (
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
            {actionLabel(spot, a, bb)}
          </button>
        ))}
        <span className={cn("font-mono text-xs", left <= 15 && live ? "text-bad" : "text-muted")}>
          {openCount}/169 · ошибки {misses}
          {live || phase === "time" ? ` · ${formatTime(left * 1000)}` : ""}
        </span>
        {!live && phase !== "win" ? (
          <button
            type="button"
            className="h-11 rounded-lg bg-fg px-3 text-sm font-medium text-bg"
            onClick={() => {
              setLive(true);
              setLeft(120);
              setMarks({});
              setStreak(0);
              setWaves(0);
              setPhase("play");
              setMisses(0);
            }}
          >
            {phase === "time" ? "Ещё раз" : "Закрыть и играть"}
          </button>
        ) : null}
      </div>
      <div className="relative">
      <div className={cn("grid grid-cols-13 gap-px", live && left <= 15 && "range-urgent", !live && phase !== "time" && "range-live")}>
        {Array.from({ length: 13 }, (_, r) =>
          Array.from({ length: 13 }, (_, c) => {
            const h = handAt(r, c);
            const mark = marks[h];
            const action = shape.action[h]!;
            const n = shape.diffCount[h] ?? 0;
            const revealed = Boolean(mark) || !live || phase === "time" || phase === "win";
            return (
              <button
                key={h}
                type="button"
                disabled={!live || Boolean(mark) || done || quiz != null || closing.includes(h)}
                onClick={() => paint(h)}
                className={cn(
                  "relative flex aspect-square origin-center items-end p-0.5 font-mono text-[10px] font-semibold leading-none sm:text-xs",
                  revealed ? ACT[action] : "bg-surface-2 text-muted",
                  mark === "miss" && "outline outline-2 outline-bad",
                  closing.includes(h) && "range-shut",
                  !closing.includes(h) && fx[h] === "pop" && "range-pop",
                  !closing.includes(h) && fx[h] === "blast" && "range-blast",
                )}
              >
                {h}
                {revealed && n > 0 ? (
                  <span className="absolute top-0.5 right-0.5 text-[9px] text-fg/80">{n}</span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      {quiz ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/75 p-2 backdrop-blur-sm">
          <section className={cn("max-h-full w-full max-w-lg overflow-auto rounded-2xl border border-border bg-surface p-4 shadow-border", cheer && "range-blast")}>
            <p className="font-mono text-xs text-subtle">{quiz.topic}</p>
            <p className="mt-1 text-base">{quiz.prompt}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quiz.options.map((opt, n) => {
                const picked = quiz.picked === n;
                const good = quiz.picked != null && n === quiz.answer;
                const bad = picked && n !== quiz.answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={quiz.picked != null}
                    onClick={() => answerQuiz(n)}
                    className={cn(
                      "h-11 rounded-[10px] border text-sm",
                      quiz.picked == null && "border-border bg-surface-2",
                      good && "border-ok text-ok",
                      bad && "border-bad text-bad",
                      quiz.picked != null && !good && !bad && "border-border text-subtle",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {quiz.picked != null ? (
              <div className="mt-3 space-y-3 text-sm leading-relaxed">
                {cheer ? <p className="font-medium">{cheer}</p> : null}
                <p className="text-muted">{quiz.why}</p>
                {quiz.note ? <p>{quiz.note}</p> : null}
                <button
                  type="button"
                  className="h-12 w-full rounded-lg bg-fg text-base font-medium text-bg"
                  onClick={finishQuiz}
                >
                  Дальше к ренджу
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function EdgeDrill({ spot, bb }: { spot: SpotDef; bb: number }) {
  const range = useMemo(() => rangeAtStack(spot.range, spot.id, bb), [spot, bb]);
  const shape: Shape = useMemo(() => buildShape(range), [range]);
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
