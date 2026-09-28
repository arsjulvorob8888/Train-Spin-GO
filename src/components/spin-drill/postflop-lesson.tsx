import { MiniCard } from "@/components/spin-drill/pip-card";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

type Card = { r: string; s: string };

function Cards({ cards, label }: { cards: Card[]; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <span className="w-16 font-mono text-xs text-subtle">{label}</span> : null}
      <div className="flex flex-wrap gap-1">
        {cards.map((c, i) => (
          <MiniCard key={`${c.r}${c.s}${i}`} r={c.r} s={c.s} />
        ))}
      </div>
    </div>
  );
}

function Strip({ ranks, hot }: { ranks: string[]; hot: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ranks.map((r) => (
        <span
          key={r}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg font-mono text-sm",
            hot.includes(r) ? "bg-fg text-bg" : "bg-surface-2 text-fg",
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function Formula({ children }: { children: string }) {
  return <p className="rounded-xl bg-surface-2 px-3 py-3 text-center font-mono text-sm text-fg sm:text-base">{children}</p>;
}

const DRAWS = [
  ["OESD, два конца", "8", "~32%", "~16%"],
  ["Гатшот, одна дырка", "4", "~16%", "~8%"],
  ["Флеш-дро", "9", "~36%", "~18%"],
  ["Две оверкарты", "6", "~24%", "~12%"],
  ["Флеш + лишние стрит-карты", "~12", "~45%", "~24%"],
];

const BLUFFS = [
  ["1/4 банка", "20%"],
  ["1/3 банка", "25%"],
  ["1/2 банка", "33%"],
  ["2/3 банка", "40%"],
  ["3/4 банка", "43%"],
  ["1 банк", "50%"],
  ["1.5 банка", "60%"],
  ["2 банка", "67%"],
];

const CHECKS: { prompt: string; options: string[]; answer: number; why: string }[] = [
  {
    prompt: "8♠7♣, флоп 6♦5♥K♠. Сколько аутов на стрейт?",
    options: ["4", "6", "8", "9"],
    answer: 2,
    why: "Два конца: любая 4 или любая 9. Это OESD, 8 аутов. С флопа около 32%.",
  },
  {
    prompt: "Та же рука, флоп 6♦4♥K♠. Сколько аутов?",
    options: ["4", "8", "6", "2"],
    answer: 0,
    why: "В цепочке 4-6-7-8 дырка одна — пятёрка. Гатшот, 4 аута, около 16%.",
  },
  {
    prompt: "A♠K♣ на Q♦7♥2♠. Сколько потенциальных аутов, если они чистые?",
    options: ["3", "6", "8", "9"],
    answer: 1,
    why: "3 туза и 3 короля. 6 × 4 ≈ 24% до ривера. Это не гарантия: аут может быть грязным.",
  },
  {
    prompt: "Банк станет 20bb после твоего колла 5bb. Сколько эквити нужно?",
    options: ["20%", "25%", "33%", "50%"],
    answer: 1,
    why: "Нужно = колл / банк после колла. 5 / 20 = 25%.",
  },
  {
    prompt: "Блеф размером в полбанка. Как часто соперник должен сбрасывать?",
    options: ["25%", "33%", "50%", "67%"],
    answer: 1,
    why: "Ставка / (банк + ставка). Полбанка — это 50 в банк 100, то есть 50/150 ≈ 33%.",
  },
];

function CheckStep() {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const q = CHECKS[i]!;
  const done = pick !== null;

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-subtle">
        {i + 1} / {CHECKS.length}
      </p>
      <p className="text-base">{q.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt, n) => {
          const on = pick === n;
          const good = done && n === q.answer;
          const bad = done && on && n !== q.answer;
          return (
            <button
              key={opt}
              type="button"
              disabled={done}
              onClick={() => setPick(n)}
              className={cn(
                "h-11 rounded-[10px] border text-sm font-medium",
                !done && "border-border bg-surface-2",
                good && "border-ok bg-surface-2 text-ok",
                bad && "border-bad bg-surface-2 text-bad",
                done && !good && !bad && "border-border text-subtle",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {done ? <p className="text-sm leading-relaxed text-muted">{q.why}</p> : null}
      {done ? (
        <button
          type="button"
          className="h-11 text-sm text-muted"
          onClick={() => {
            setPick(null);
            setI((n) => (n + 1) % CHECKS.length);
          }}
        >
          {i + 1 === CHECKS.length ? "Сначала" : "Дальше"}
        </button>
      ) : null}
    </div>
  );
}

const STEPS: { id: string; short: string; title: string; body: ReactNode }[] = [
  {
    id: "two",
    short: "Две вещи",
    title: "Усилиться или чтобы сбросили",
    body: (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          На флопе банк забирают двумя разными способами. Их нельзя смешивать в одну цифру.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">1. Доехать</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Ты доходишь до вскрытия, и рука оказывается лучше. Это equity. Ауты помогают её прикинуть.
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">2. Чтобы сбросили</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Более сильная рука выбрасывает, банк твой сразу. Это fold equity. Карты больше не нужны.
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          В Spin 3-max на 15bb после рейза 2bb и колла в банке около 4.5bb, за спиной ~13bb. SPR около 3.
          Это не кэш на три улицы: чаще одно решение — колл цены, пуш или фолд.
        </p>
      </div>
    ),
  },
  {
    id: "rule",
    short: "×4 и ×2",
    title: "Числа, которые надо помнить",
    body: (
      <div className="space-y-3">
        <Formula>с флопа: ауты × 4 · с тёрна: ауты × 2</Formula>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-xs text-subtle">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Дро</th>
                <th className="py-1.5 pr-3 font-medium">Ауты</th>
                <th className="py-1.5 pr-3 font-medium">Флоп</th>
                <th className="py-1.5 font-medium">Тёрн</th>
              </tr>
            </thead>
            <tbody>
              {DRAWS.map((row) => (
                <tr key={row[0]} className="border-t border-border">
                  <td className="py-2 pr-3">{row[0]}</td>
                  <td className="py-2 pr-3 font-mono">{row[1]}</td>
                  <td className="py-2 pr-3 font-mono">{row[2]}</td>
                  <td className="py-2 font-mono">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Это грубо, и только если ауты чистые. Больше 10 аутов — умножение на 4 чуть завышает. Для стола хватает.
        </p>
      </div>
    ),
  },
  {
    id: "oesd",
    short: "OESD",
    title: "Стрейт с двух сторон",
    body: (
      <div className="space-y-3">
        <Cards label="Рука" cards={[{ r: "8", s: "s" }, { r: "7", s: "c" }]} />
        <Cards label="Флоп" cards={[{ r: "6", s: "d" }, { r: "5", s: "h" }, { r: "K", s: "s" }]} />
        <p className="text-sm leading-relaxed text-muted">Цепочка уже есть: 5-6-7-8. Не хватает края с любой стороны.</p>
        <Strip ranks={["4", "5", "6", "7", "8", "9"]} hot={["4", "9"]} />
        <p className="text-sm text-muted">Подсвеченные клетки — карты, которые закрывают стрейт. Их по четыре каждой.</p>
        <Formula>8 аутов · ×4 ≈ 32% с флопа · ×2 ≈ 16% с тёрна</Formula>
      </div>
    ),
  },
  {
    id: "gut",
    short: "Гатшот",
    title: "Одна дырка — вдвое меньше",
    body: (
      <div className="space-y-3">
        <Cards label="Рука" cards={[{ r: "8", s: "s" }, { r: "7", s: "c" }]} />
        <Cards label="Флоп" cards={[{ r: "6", s: "d" }, { r: "4", s: "h" }, { r: "K", s: "s" }]} />
        <p className="text-sm leading-relaxed text-muted">Теперь 4-6-7-8. Дырка внутри, а не два открытых конца.</p>
        <Strip ranks={["4", "5", "6", "7", "8"]} hot={["5"]} />
        <Formula>4 аута · ×4 ≈ 16% с флопа · ×2 ≈ 8% с тёрна</Formula>
        <p className="text-sm leading-relaxed text-muted">
          Та же рука, другой флоп — шансов в два раза меньше. Гатшот редко стоит дорогого колла на 15bb.
        </p>
      </div>
    ),
  },
  {
    id: "dirty",
    short: "Грязные",
    title: "Оверкарты не всегда чистые",
    body: (
      <div className="space-y-3">
        <Cards label="Рука" cards={[{ r: "A", s: "s" }, { r: "K", s: "c" }]} />
        <Cards label="Флоп" cards={[{ r: "Q", s: "d" }, { r: "7", s: "h" }, { r: "2", s: "s" }]} />
        <p className="text-sm leading-relaxed text-muted">
          Туз и король выше всего флопа. В колоде 3 туза и 3 короля — 6 потенциальных аутов, около 24% до ривера.
        </p>
        <div className="rounded-xl border border-border p-3">
          <p className="text-sm font-medium">Когда аут грязный</p>
          <div className="mt-2 space-y-2">
            <Cards label="Ты" cards={[{ r: "A", s: "s" }, { r: "K", s: "c" }]} />
            <Cards label="Он" cards={[{ r: "Q", s: "s" }, { r: "8", s: "s" }]} />
            <Cards label="Флоп" cards={[{ r: "Q", s: "h" }, { r: "8", s: "c" }, { r: "7", s: "d" }]} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            У него уже две пары. Туз даёт тебе пару тузов — и ты всё ещё позади. Улучшился, но не выиграл.
            Чистый аут — карта, после которой ты чаще всего впереди.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "combo",
    short: "Комбо",
    title: "Ауты нельзя складывать вслепую",
    body: (
      <div className="space-y-3">
        <Cards label="Рука" cards={[{ r: "A", s: "h" }, { r: "K", s: "h" }]} />
        <Cards label="Флоп" cards={[{ r: "Q", s: "h" }, { r: "J", s: "h" }, { r: "2", s: "c" }]} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">Флеш</p>
            <p className="mt-1 text-sm text-muted">9 червей, включая T♥.</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">Стрейт</p>
            <p className="mt-1 text-sm text-muted">Десятка закрывает T-J-Q-K-A. Таких карт 4.</p>
          </div>
        </div>
        <Formula>9 + 4 = 13 — неверно. T♥ уже внутри флеша. 9 + 3 = 12</Formula>
        <p className="text-sm leading-relaxed text-muted">
          Около 12 чистых аутов — грубо 45% против готовой руки. Если у соперника сет или старший флеш-дро, часть
          червей грязная. Здесь хватает вывода: комбо-дро сильное, но ауты пересекаются.
        </p>
      </div>
    ),
  },
  {
    id: "ev",
    short: "EV",
    title: "Можно проиграть раздачу и быть в плюсе",
    body: (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          EV — среднее на дистанции, не результат этой руки. Монетка: в половине случаев +20, в половине −10.
        </p>
        <Formula>0.5 × 20 − 0.5 × 10 = +5</Formula>
        <p className="text-sm leading-relaxed text-muted">
          Конкретный бросок мог уйти в минус. Решение всё равно плюсовое, если повторять его много раз.
        </p>
        <div className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
          <p>Банк 10bb. Соперник ставит 5bb. Ты платишь 5bb. После колла в банке 20bb.</p>
          <p className="mt-2 font-mono">нужно = 5 / 20 = 25%</p>
          <p className="mt-2 text-muted">
            Флеш-дро — около 36%. Если ауты чистые, цена хорошая. На 15bb ставка часто уже почти стек: считай не
            «колл одной улицы», а готов ли ты вскрыть олл-ин.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "bluff",
    short: "Блеф",
    title: "Сколько фолдов нужно ставке",
    body: (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted">
          Блеф — ставка, чтобы сбросили руки сильнее твоей. Не «мусор, значит ставлю».
        </p>
        <Formula>нужно фолдов = ставка / (банк + ставка)</Formula>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-xs text-subtle">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Ставка</th>
                <th className="py-1.5 font-medium">Нужно фолдов</th>
              </tr>
            </thead>
            <tbody>
              {BLUFFS.map((row) => (
                <tr key={row[0]} className="border-t border-border">
                  <td className="py-2 pr-3">{row[0]}</td>
                  <td className="py-2 font-mono">{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Запомни три якоря: треть банка ≈ 25%, полбанка ≈ 33%, банк ≈ 50%. Больше ставка — больше фолдов нужно, но и
          давление сильнее.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Пример: банк 10bb, флоп A♥K♦2♣, у тебя 7♠6♠, соперник чекнул. Полбанка просит ~33% фолдов. Могут выбросить
          QJ, JT, часть мелких пар. Не выбросят туз, король и сильную пару. Если таких рук в его диапазоне много, блеф
          плохой.
        </p>
      </div>
    ),
  },
  {
    id: "semi",
    short: "Полублеф",
    title: "Два способа забрать банк",
    body: (
      <div className="space-y-3">
        <Cards label="Рука" cards={[{ r: "A", s: "s" }, { r: "5", s: "s" }]} />
        <Cards label="Флоп" cards={[{ r: "K", s: "s" }, { r: "8", s: "s" }, { r: "2", s: "d" }]} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">Сбросили</p>
            <p className="mt-1 text-sm text-muted">Банк твой сразу. Карты тёрна не нужны.</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">Заколлировали</p>
            <p className="mt-1 text-sm text-muted">Остаётся флеш-дро: 9 аутов, около 36% до ривера.</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Это полублеф. Он сильнее ставки без аутов: fold equity и шанс усилиться работают вместе. Чистый блеф живёт
          только за счёт фолдов.
        </p>
      </div>
    ),
  },
  {
    id: "five",
    short: "5 вопросов",
    title: "Что спрашивать себя на флопе",
    body: (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="font-medium">Если думаешь о колле</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-muted">
            <li>Сколько аутов?</li>
            <li>Они чистые или грязные?</li>
            <li>Грубая эквити: ×4 с флопа, ×2 с тёрна.</li>
            <li>Цена: колл / банк после колла.</li>
            <li>Эквити больше цены? На 15bb готов ли ты к олл-ину?</li>
          </ol>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="font-medium">Если думаешь о ставке</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-muted">
            <li>Какие руки сильнее моей сюда дошли?</li>
            <li>Какие из них сбросят?</li>
            <li>Размер ставки и нужный % фолдов.</li>
            <li>Если заколлируют — останется ли эквити?</li>
            <li>Эта ставка уже коммитит стек?</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "check",
    short: "Проверка",
    title: "Пять вопросов на память",
    body: <CheckStep />,
  },
];

export function PostflopLesson() {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-3 text-sm",
              i === step ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {s.short}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="font-mono text-xs text-subtle">
          Spin 3-max · 15bb · {step + 1} / {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-medium">{current.title}</h2>
        <div className="mt-4">{current.body}</div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((n) => Math.max(0, n - 1))}
            className="h-11 flex-1 rounded-[10px] border border-border text-sm disabled:text-subtle"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={step === STEPS.length - 1}
            onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
            className="h-11 flex-1 rounded-[10px] bg-fg text-sm font-medium text-bg disabled:opacity-40"
          >
            Дальше
          </button>
        </div>
      </section>
    </div>
  );
}
