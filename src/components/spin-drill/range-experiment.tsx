import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { buildShape, studyHands, type Shape } from "@/lib/spin-drill/range-shape";
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

const QUIZ: { topic: string; prompt: string; options: string[]; answer: number; why: string }[] = [
  {
    topic: "Pot odds",
    prompt: "Банк 10bb, соперник ставит 5bb. Вы доплачиваете 5bb. Какая цена колла?",
    options: ["20%", "25%", "33%", "50%"],
    answer: 1,
    why: "Цена = сколько доплатить / банк после вашего колла. В банке уже 15bb, после колла будет 20bb. 5 / 20 = 25%.",
  },
  {
    topic: "Pot odds",
    prompt: "Блеф в полбанка. Как часто соперник должен сбросить?",
    options: ["25%", "33%", "50%", "67%"],
    answer: 1,
    why: "Нужно фолдов = ставка / (банк + ставка). Полбанка — это 50 в банк 100, то есть 50 / 150 ≈ 33%.",
  },
  {
    topic: "Флеш",
    prompt: "Голый флеш-дро на флопе. Ауты и грубая эквити до ривера?",
    options: ["4 ≈ 16%", "8 ≈ 32%", "9 ≈ 36%", "12 ≈ 48%"],
    answer: 2,
    why: "Карт вашей масти осталось 9. С флопа ауты × 4: 9 × 4 = 36%.",
  },
  {
    topic: "Стрит",
    prompt: "Обычный гатшот. Сколько аутов?",
    options: ["2", "4", "8", "9"],
    answer: 1,
    why: "Одна дырка — один ранг, четыре карты. С флопа около 16%. На 15bb такой колл почти всегда дорогой.",
  },
  {
    topic: "Стрит",
    prompt: "Стрейт с двух сторон, OESD. Сколько аутов?",
    options: ["4", "6", "8", "9"],
    answer: 2,
    why: "Два открытых края, по четыре карты. 8 × 4 ≈ 32% с флопа.",
  },
  {
    topic: "Стрит",
    prompt: "Двойной гатшот: две разные дырки. Сколько аутов?",
    options: ["4", "6", "8", "12"],
    answer: 2,
    why: "Два разных ранга по четыре карты. Те же 8, что у открытого стрейта. Не путать с одним гатшотом.",
  },
  {
    topic: "Оверкарты",
    prompt: "AK на флопе Q-7-2. Сколько потенциальных аутов, если они чистые?",
    options: ["3", "6", "8", "9"],
    answer: 1,
    why: "Три туза и три короля. 6 × 4 ≈ 24%. Это не готовая рука и не монетка.",
  },
  {
    topic: "Комбинаторика",
    prompt: "Сколько комбинаций у AKo, у AKs и у пары?",
    options: ["12, 4 и 6", "6, 6 и 6", "4, 12 и 6", "16, 4 и 6"],
    answer: 0,
    why: "Разномастная рука весит 12, одномастная 4, пара 6. AKo в диапазоне втрое тяжелее AKs.",
  },
  {
    topic: "Комбинаторика",
    prompt: "Флоп уже выложен. Сколько карт осталось до тёрна?",
    options: ["52", "49", "47", "45"],
    answer: 2,
    why: "52 − 2 ваши − 3 на флопе = 47. Один аут на тёрне — это примерно 2%. Поэтому с тёрна ауты × 2.",
  },
  {
    topic: "Эквити",
    prompt: "Колл пуша 15bb с баттона. Какая эквити нужна?",
    options: ["33%", "40%", "около 47%", "55%"],
    answer: 2,
    why: "Около 47%. Любая пара и AJ ещё колл. ATo около 41–44% — фолд.",
  },
  {
    topic: "Эквити",
    prompt: "Пара против AK. Грубая эквити пары?",
    options: ["35%", "45%", "52–55%", "70%"],
    answer: 2,
    why: "Пара чуть впереди двух оверкарт. Это флип, не 70%. 22 против AK тоже около 52–55%.",
  },
  {
    topic: "Комбо-дро",
    prompt: "Флеш-дро 9 и стрит на 4 карты, одна из них той же масти. Сколько аутов?",
    options: ["13", "12", "9", "8"],
    answer: 1,
    why: "Общую карту нельзя сложить дважды. 9 + 4 − 1 = 12.",
  },
];

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
          Пять верных подряд открывают все клетки, которые граничат с последней угаданной. Остальные открываются по одной.
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
  const [quiz, setQuiz] = useState<(typeof QUIZ)[number] & { picked: number | null; note: string } | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const lastHand = useRef<string>("AA");
  const quizCursor = useRef(0);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const openCount = Object.keys(marks).length;
  const done = phase === "win" || openCount === 169;

  useEffect(() => {
    if (started == null || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started, done]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  function later(ms: number, fn: () => void) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }

  function paint(hand: string) {
    if (busy.current || !armed || marks[hand] || done || quiz) return;
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
      const q = QUIZ[quizCursor.current % QUIZ.length]!;
      quizCursor.current += 1;
      setQuiz({ ...q, picked: null, note: "" });
      setCheer(null);
      setPhase("wave");
      busy.current = true;
    } else {
      sounds.hit(nextStreak);
      setPhase("play");
    }
    setFx(anim);
    setMarks(next);
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
      note: SUPPORT[quizCursor.current % SUPPORT.length]!,
    });
  }

  const scenario =
    phase === "win"
      ? "Рендж открыт. Форма собрана."
      : phase === "collapse"
        ? "Обвал. Одна ошибка закрыла уже открытые клетки."
        : phase === "wave"
          ? "Пять подряд. Открылись все клетки вокруг последней руки."
          : streak === 0
            ? "Каждая верная рука открывает только себя. Пять подряд — все соседи последней."
            : `Цепочка ${streak}/5. Ошибка на клетке закроет поле. Ошибка в вопросе — нет.`;

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
                disabled={Boolean(mark) || done || shutting || quiz != null}
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
      {quiz ? (
        <section className={cn("rounded-2xl border border-border bg-surface p-4", cheer && "range-blast")}>
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
            <div className="mt-3 space-y-2 text-sm leading-relaxed">
              {cheer ? <p className="font-medium">{cheer}</p> : null}
              <p className="text-muted">{quiz.why}</p>
              {quiz.note ? <p>{quiz.note}</p> : null}
              <button type="button" className="h-11 text-sm text-muted" onClick={finishQuiz}>
                Дальше к ренджу
              </button>
            </div>
          ) : null}
        </section>
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
