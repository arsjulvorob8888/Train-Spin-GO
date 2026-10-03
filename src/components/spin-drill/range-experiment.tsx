import { ALL, handAt } from "@/lib/spin-drill/legacy-ranges";
import { buildShape, studyHands, type Shape } from "@/lib/spin-drill/range-shape";
import { drawQuiz, type QuizQ } from "@/lib/spin-drill/quiz-bank";
import { cellDistance, nearestOpen, rangeAtStack, stackNote } from "@/lib/spin-drill/stack-ranges";
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
  fanfare() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, 0.34, "triangle", 0.07, i * 0.12);
      tone(f / 2, 0.34, "square", 0.018, i * 0.12);
    });
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
  cash() {
    [880, 1174, 1568].forEach((f, i) => tone(f, 0.12, "square", 0.035, i * 0.07));
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
  const [autoplay, setAutoplay] = useState(false);
  const [splash, setSplash] = useState<{ bb: number; next: string } | null>(null);
  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0]!;
  const spotRef = useRef(spotId);
  spotRef.current = spotId;

  function cleared() {
    const index = SPOTS.findIndex((s) => s.id === spotRef.current);
    const next = SPOTS[(index + 1) % SPOTS.length]!;
    setSplash({ bb, next: next.title });
    window.setTimeout(() => {
      setGroup(next.group);
      setSpotId(next.id);
      setAutoplay(true);
      setSplash(null);
    }, 2400);
  }

  useEffect(() => {
    if (!autoplay) return;
    setAutoplay(false);
  }, [autoplay, spotId]);

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
          Страйк — пять верных клеток подряд. После трёх страйков открывается кусок доски, после пяти — весь рендж. Потом счётчик сначала.
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
      <div className={cn("rounded-2xl border p-3", bb === 15 ? "border-fg bg-surface" : "border-border bg-surface")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("font-mono text-4xl font-semibold tabular-nums leading-none", bb === 15 ? "text-fg" : "text-muted")}>
            {bb}
            <span className="ml-1 text-lg">bb</span>
          </p>
          {bb === 15 ? (
            <span className="rounded-full bg-fg px-3 py-1 text-sm text-bg">точный чарт</span>
          ) : (
            <button type="button" className="h-11 rounded-lg bg-fg px-3 text-sm font-medium text-bg" onClick={() => setBb(15)}>
              На 15bb
            </button>
          )}
        </div>
        <div className="relative mt-4">
          <span className="pointer-events-none absolute top-1/2 left-[48.3%] z-0 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-fg" />
          <input
            type="range"
            min={1}
            max={30}
            value={bb}
            onChange={(e) => setBb(Number(e.target.value))}
            className="relative z-10 w-full accent-current"
          />
        </div>
        <div className="mt-1 grid grid-cols-3 font-mono text-xs text-muted">
          <span>1</span>
          <button type="button" className={cn("text-center", bb === 15 ? "font-semibold text-fg" : "text-fg")} onClick={() => setBb(15)}>
            15
          </button>
          <span className="text-right">30</span>
        </div>
        <p className="mt-2 text-sm text-muted">{stackNote(bb)}</p>
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
      {mode === "sapper" ? (
        <Sapper key={`${spot.id}-${bb}`} spot={spot} bb={bb} autoplay={autoplay} onClear={cleared} />
      ) : (
        <EdgeDrill key={`${spot.id}-${bb}`} spot={spot} bb={bb} />
      )}
      {splash ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-bg">
          <div className="range-veil" />
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              className={i % 2 === 0 ? "coin" : "coin coin-burst"}
              style={{
                left: `${6 + ((i * 11) % 88)}%`,
                animationDelay: `${i * 30}ms`,
                ["--dx" as string]: `${(i % 7) * 36 - 108}px`,
                ["--dy" as string]: `${-60 - (i % 5) * 40}px`,
              }}
            >
              {i % 3 === 0 ? "bb" : "$"}
            </i>
          ))}
          <div className="stack-in relative text-center">
            <p className="font-mono text-8xl font-semibold leading-none sm:text-9xl">{splash.bb}</p>
            <p className="mt-2 font-mono text-4xl">bb</p>
            <p className="mt-6 text-lg text-muted">Дальше · {splash.next}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function actionLabel(spot: SpotDef, action: MixAction, bb: number): string {
  if (action === "allin") return `All-in ${bb}`;
  if (action === "raise") return bb >= 20 ? "Raise 2.5" : "Raise 2";
  if (action === "call" && (spot.id === "sb_fold" || spot.id === "hu_sb")) return "Limp";
  return spot.labels[action];
}

function Sapper({
  spot,
  bb,
  autoplay,
  onClear,
}: {
  spot: SpotDef;
  bb: number;
  autoplay: boolean;
  onClear: () => void;
}) {
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
  const [chain, setChain] = useState(0);
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<"play" | "wave" | "win" | "time">("play");
  const [closing, setClosing] = useState<string[]>([]);
  const [live, setLive] = useState(autoplay);
  const told = useRef(false);
  const [paused, setPaused] = useState(false);
  const [peek, setPeek] = useState<"part" | "all" | null>(null);
  const [strikeFx, setStrikeFx] = useState(false);
  const [left, setLeft] = useState(120);
  const [tick, setTick] = useState(3);
  const [freeze, setFreeze] = useState(0);
  const [salute, setSalute] = useState(0);
  const [quiz, setQuiz] = useState<(QuizQ & { picked: number | null; note: string; reason: "strike" | "miss" }) | null>(null);
  const [quizLeft, setQuizLeft] = useState(12);
  const [rewardBb, setRewardBb] = useState(10);
  const rewardFlip = useRef(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const lastHand = useRef<string>("AA");
  const marksRef = useRef(marks);
  const freezeRef = useRef(0);
  marksRef.current = marks;
  const busy = useRef(false);
  const quizFail = useRef(false);
  const timers = useRef<number[]>([]);
  const openCount = Object.keys(marks).length;
  const done = phase === "win" || phase === "time" || openCount === 169;

  useEffect(() => {
    if (!live || paused || quiz || phase === "win" || phase === "time") return;
    const id = window.setInterval(() => {
      setLeft((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [live, paused, quiz, phase]);

  useEffect(() => {
    if (!live || left !== 0) return;
    sounds.miss();
    setPhase("time");
    setLive(false);
  }, [live, left]);

  useEffect(() => {
    if (!live || paused || quiz || phase === "win" || phase === "time") return;
    const id = window.setInterval(() => {
      if (busy.current) return;
      if (freezeRef.current > 0) {
        freezeRef.current -= 1;
        setFreeze(freezeRef.current);
        setTick(3);
        return;
      }
      setTick((current) => (current > 1 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [live, paused, quiz, phase]);

  useEffect(() => {
    if (tick !== 0 || paused || quiz || phase === "win") return;
    const open = Object.keys(marksRef.current).filter((cell) => cell !== lastHand.current && marksRef.current[cell] === "ok");
    const victims = nearestOpen(lastHand.current, open, 3);
    if (victims.length) {
      sounds.soft();
      setClosing(victims);
      const id = window.setTimeout(() => {
        setMarks((prev) => {
          const next = { ...prev };
          for (const cell of victims) if (next[cell] === "ok") delete next[cell];
          return next;
        });
        setClosing([]);
      }, 280);
      timers.current.push(id);
    }
    setTick(3);
  }, [tick, paused, quiz, phase]);

  useEffect(() => {
    const keys = ["a", "s", "d", "f"];
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = keys.indexOf(event.key.toLowerCase());
      if (index < 0 || index >= actions.length) return;
      event.preventDefault();
      setArmed(actions[index]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  function celebrate() {
    if (told.current) return;
    told.current = true;
    sounds.win();
    sounds.cash();
    setPhase("win");
    onClear();
  }

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }

  function paint(hand: string) {
    if (!live || paused || busy.current || !armed || marks[hand] || done || quiz || peek) return;
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
      setChain(0);
      freezeRef.current = 0;
      setFreeze(0);
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
        ask("miss");
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
      celebrate();
    } else if (wave) {
      sounds.fanfare();
      setStrikeFx(true);
      later(1100, () => setStrikeFx(false));
      setLeft((seconds) => seconds + 15);
      const nextChain = chain + 1;
      const showAll = nextChain >= 5;
      const showPart = nextChain === 3;
      if (showAll) {
        sounds.cash();
        setChain(0);
        setSalute((n) => n + 1);
        setPeek("all");
        later(2200, () => setPeek(null));
      } else {
        setChain(nextChain);
        if (showPart) {
          setPeek("part");
          later(1600, () => setPeek(null));
        }
      }
      setPhase("wave");
      if (showAll) {
        freezeRef.current = 0;
        setFreeze(0);
        later(2300, () => ask("strike"));
      } else {
        freezeRef.current = 6;
        setFreeze(freezeRef.current);
        later(900, () => setPhase((p) => (p === "wave" ? "play" : p)));
      }
    } else {
      sounds.hit(nextStreak);
      setPhase("play");
    }
    setFx(anim);
    setMarks(next);
  }

  function ask(reason: "strike" | "miss") {
    const q = drawQuiz(reason === "strike" ? "reward" : "drill");
    if (reason === "strike") {
      if (bb === 15) {
        rewardFlip.current = !rewardFlip.current;
        setRewardBb(rewardFlip.current ? 10 : 25);
      } else {
        setRewardBb(15);
      }
    }
    quizFail.current = false;
    setQuizLeft(reason === "strike" ? 0 : 12);
    setQuiz({ ...q, picked: null, note: "", reason });
    setCheer(null);
    busy.current = true;
  }

  function punish(note: string, picked: number) {
    sounds.soft();
    const victims = nearestOpen(lastHand.current, Object.keys(marksRef.current), 5);
    setClosing(victims);
    later(420, () => {
      setMarks((prev) => {
        const next = { ...prev };
        for (const cell of victims) delete next[cell];
        return next;
      });
      setClosing([]);
    });
    setCheer(null);
    setQuiz((current) => (current ? { ...current, picked, note } : current));
  }

  useEffect(() => {
    if (!quiz || quiz.picked != null || paused || quiz.reason === "strike") return;
    if (quizLeft > 0) {
      const id = window.setTimeout(() => setQuizLeft((n) => n - 1), 1000);
      return () => window.clearTimeout(id);
    }
    if (quizFail.current) return;
    quizFail.current = true;
    punish("Время вышло.", -1);
  }, [quiz, quizLeft, paused]);

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
      if (quiz.reason === "miss") {
        const extra = ALL.filter((h) => !marks[h])
          .sort((a, b) => cellDistance(lastHand.current, a) - cellDistance(lastHand.current, b))
          .slice(0, 8);
        if (extra.length) {
          const next = { ...marks };
          const anim: Record<string, "pop" | "blast"> = {};
          for (const h of extra) {
            next[h] = "ok";
            anim[h] = "blast";
          }
          setMarks(next);
          setFx(anim);
          if (Object.keys(next).length >= 169) celebrate();
        }
        setCheer("Верно.");
        setQuiz({ ...quiz, picked: index, note: "" });
        later(420, finishQuiz);
        return;
      }
      sounds.cash();
      setQuiz({ ...quiz, picked: index, note: "Пять страйков. Забери лайфхак с собой." });
      return;
    }
    if (quiz.reason === "strike") {
      sounds.soft();
      setQuiz({ ...quiz, picked: index, note: "Это награда, не штраф. Клетки остаются открытыми." });
      return;
    }
    punish(SUPPORT[Math.floor(Math.random() * SUPPORT.length)]!, index);
  }

  const rewardShape = useMemo(
    () => buildShape(rangeAtStack(spot.range, spot.id, rewardBb)),
    [spot, rewardBb],
  );

  const doomed =
    tick === 1 && freeze === 0
      ? nearestOpen(
          lastHand.current,
          Object.keys(marks).filter((cell) => cell !== lastHand.current && marks[cell] === "ok"),
          3,
        )
      : [];

  const scenario =
    !live && phase !== "time" && phase !== "win"
      ? "Рендж открыт. Посмотрите форму и нажмите «Играть»."
      : paused
        ? "Пауза. Часы стоят, рендж открыт."
        : phase === "win"
      ? "Рендж собран. Угасание не успело."
      : peek === "all"
        ? "Пять страйков подряд. Весь рендж открыт."
        : peek === "part"
          ? "Три страйка. Открыт кусок вокруг последней руки."
          : phase === "wave"
            ? `Страйк ${chain}/5. +15 секунд. Вопрос будет на пятом.`
            : freeze > 0
          ? `Серия держит поле ещё ${freeze} с. Цепочка ${streak}/5.`
          : streak === 0
            ? "Каждые 3 секунды гаснут 3 ближайшие открытые клетки. Пять подряд останавливают угасание."
            : `Цепочка ${streak}/5. Ещё ${5 - streak} — и будет STRIKE.`;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-bg/90 py-2 backdrop-blur-sm">
        <div>
          <p className={cn("font-mono text-6xl font-semibold tabular-nums leading-none", left <= 15 ? "text-bad" : "text-fg")}>
            {formatTime(left * 1000)}
          </p>
          <p className="font-mono text-sm text-ok">{phase === "wave" ? "+15с" : ""}</p>
        </div>
        <p className="text-right text-sm text-muted">
          <span className={cn("font-mono text-3xl font-semibold", freeze > 0 ? "text-ok" : tick === 1 ? "text-bad" : "text-fg")}>
            {freeze > 0 ? freeze : Math.max(tick, 1)}
          </span>
          <br />
          {freeze > 0 ? "серия держит поле" : "сек до угасания"}
          <br />
          {openCount}/169 · страйки {chain}/5
        </p>
      </div>
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
        {actions.map((a, i) => (
          <button
            key={a}
            type="button"
            onClick={() => setArmed(a)}
            className={cn(
              "h-11 rounded-lg px-3 text-sm",
              ACT[a],
              armed === a ? "scale-110 text-base outline outline-2 outline-offset-2 outline-fg" : "opacity-70",
            )}
          >
            <span className="mr-1.5 font-mono">{["A", "S", "D", "F"][i]}</span>
            {actionLabel(spot, a, bb)}
          </button>
        ))}
        <span className="font-mono text-xs text-muted">
          {streak === 0 ? "A S D F" : `цепочка ${streak}/5`}
        </span>
        {!live && phase !== "win" ? (
          <button
            type="button"
            className="h-11 rounded-lg bg-fg px-3 text-sm font-medium text-bg"
            onClick={() => {
              setLive(true);
              setPaused(false);
              setPeek(null);
              setLeft(120);
              setTick(3);
              setFreeze(0);
              freezeRef.current = 0;
              setMarks({});
              setStreak(0);
              setChain(0);
              setPhase("play");
              setMisses(0);
              setQuiz(null);
            }}
          >
            {phase === "time" ? "Ещё раз" : "Играть"}
          </button>
        ) : null}
        {live && !paused ? (
          <button type="button" className="h-11 rounded-lg border border-border px-3 text-sm" onClick={() => setPaused(true)}>
            Стоп
          </button>
        ) : null}
        {paused ? (
          <button type="button" className="h-11 rounded-lg bg-fg px-3 text-sm font-medium text-bg" onClick={() => setPaused(false)}>
            Продолжить
          </button>
        ) : null}
      </div>
      <div className="relative">
      <div className={cn("grid grid-cols-13 gap-px", live && !paused && tick === 1 && freeze === 0 && "range-urgent", (phase === "wave" || peek) && "range-flash range-peek", (!live || paused) && phase !== "time" && "range-live")}>
        {Array.from({ length: 13 }, (_, r) =>
          Array.from({ length: 13 }, (_, c) => {
            const h = handAt(r, c);
            const mark = marks[h];
            const action = shape.action[h]!;
            const n = shape.diffCount[h] ?? 0;
            const inPart = peek === "part" && cellDistance(lastHand.current, h) <= 3;
            const revealed = Boolean(mark) || !live || paused || peek === "all" || inPart || phase === "time" || phase === "win";
            return (
              <button
                key={h}
                type="button"
                disabled={!live || paused || peek != null || Boolean(mark) || done || quiz != null || closing.includes(h)}
                onClick={() => paint(h)}
                className={cn(
                  "relative flex aspect-square origin-center items-center justify-center font-mono text-sm font-bold leading-none tracking-tight sm:text-lg",
                  revealed ? ACT[action] : "bg-surface-2 text-muted",
                  mark === "miss" && "outline outline-2 outline-bad",
                  closing.includes(h) && "range-shut",
                  doomed.includes(h) && "range-warn",
                  (peek === "all" || inPart) && !mark && "range-peek-cell",
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
      {strikeFx ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
          <div className="strike-ring" />
          <div className="strike-ring strike-ring-late" />
          <p className="strike-title">STRIKE!!!</p>
        </div>
      ) : null}
      {peek === "all" ? (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          <div className="range-veil" />
          {Array.from({ length: 40 }, (_, i) => (
            <i
              key={`${salute}-${i}`}
              className={i % 2 === 0 ? "coin coin-fall" : "coin coin-burst"}
              style={{
                left: `${8 + ((i * 13) % 84)}%`,
                animationDelay: `${i * 28}ms`,
                ["--dx" as string]: `${(i % 7) * 28 - 84}px`,
                ["--dy" as string]: `${-40 - (i % 5) * 36}px`,
              }}
            >
              {i % 3 === 0 ? "bb" : "$"}
            </i>
          ))}
        </div>
      ) : null}
      {quiz ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm">
          <section className={cn("max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border bg-surface p-6 shadow-border sm:p-8", quiz.reason === "strike" ? "quiz-reward border-transparent" : "quiz-miss border-transparent", cheer && "range-blast")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("text-lg font-medium", quiz.reason === "strike" ? "text-fg" : "text-bad")}>
                  {quiz.reason === "strike" ? "Награда · 5 STRIKE" : "Ошибка · неверное действие"}
                </p>
                <p className="mt-1 font-mono text-sm text-subtle">{quiz.topic}</p>
              </div>
              {quiz.reason === "strike" ? (
                <p className="font-mono text-5xl font-semibold leading-none">{rewardBb}</p>
              ) : quiz.picked == null ? (
                <p className={cn("font-mono text-5xl font-semibold tabular-nums leading-none", quizLeft <= 4 ? "text-bad" : "text-fg")}>
                  {quizLeft}
                </p>
              ) : (
                <span />
              )}
            </div>
            {quiz.reason === "strike" ? (
              <div className="mt-4">
                <p className="text-lg">
                  {spot.title}. Сейчас {bb}bb, это тот же спот на {rewardBb}bb.
                </p>
                <p className="mt-1 text-sm text-muted">Обводка — действие другое, чем на твоём стеке. {stackNote(rewardBb)}</p>
                <div className="mt-3 grid grid-cols-13 gap-px">
                  {Array.from({ length: 13 }, (_, r) =>
                    Array.from({ length: 13 }, (_, c) => {
                      const h = handAt(r, c);
                      const action = rewardShape.action[h]!;
                      const changed = action !== shape.action[h];
                      return (
                        <div
                          key={h}
                          className={cn(
                            "flex aspect-square items-center justify-center font-mono text-[9px] font-bold leading-none sm:text-xs",
                            ACT[action],
                            changed && "outline outline-2 outline-fg",
                          )}
                        >
                          {h}
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-2xl leading-snug">{quiz.prompt}</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      "min-h-14 rounded-xl border px-4 py-3 text-left text-lg leading-snug",
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
            {quiz.picked != null && !cheer ? (
              <div className="mt-5 space-y-4 text-lg leading-relaxed">
                <p className="text-muted">{quiz.why}</p>
                {quiz.note ? <p>{quiz.note}</p> : null}
                {quiz.reason === "miss" ? <p>Закрылись ещё 5 ближайших клеток.</p> : null}
                <button
                  type="button"
                  className="h-14 w-full rounded-xl bg-fg text-xl font-medium text-bg"
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
