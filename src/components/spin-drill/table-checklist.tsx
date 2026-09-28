import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const LOG_KEY = "spin-table-log-v1";

type SpotNote = { hand: string; board: string; did: string; should: string };

type SessionLog = {
  id: string;
  at: string;
  games: string;
  first: string;
  second: string;
  buyins: string;
  chart: boolean;
  jam: boolean;
  postflop: boolean;
  noHero: boolean;
  mistake: string;
  drill: string;
  spots: SpotNote[];
};

const EMPTY_NOTE: SpotNote = { hand: "", board: "", did: "", should: "" };

const HAND_STEPS = [
  "Позиция и кто ещё в банке",
  "Эффективный стек: 15bb или меньше",
  "Это префлоп — спот есть в чарте",
  "Действие с чарта, не потому что рука красивая",
  "Борд: я впереди, позади или это дро",
  "Ауты. Флоп ×4, тёрн ×2. Грязные не считал",
  "Цена колла в уме: доплатить / банк после колла",
  "Полка эквити выше цены — колл, ниже — фолд",
];

function loadLog(): SessionLog[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TableChecklist() {
  const [pane, setPane] = useState<"hand" | "session">("hand");
  const [ticks, setTicks] = useState<boolean[]>(() => HAND_STEPS.map(() => false));
  const [note, setNote] = useState<SpotNote>(EMPTY_NOTE);
  const [pending, setPending] = useState<SpotNote[]>([]);
  const [log, setLog] = useState<SessionLog[]>([]);
  const [form, setForm] = useState({
    games: "",
    first: "",
    second: "",
    buyins: "",
    chart: false,
    jam: false,
    postflop: false,
    noHero: false,
    mistake: "",
    drill: "",
  });

  useEffect(() => {
    setLog(loadLog());
  }, []);

  function toggle(i: number) {
    setTicks((list) => list.map((on, n) => (n === i ? !on : on)));
  }

  function addNote() {
    if (!note.hand.trim() && !note.did.trim()) return;
    setPending((list) => [...list, note]);
    setNote(EMPTY_NOTE);
  }

  function saveSession() {
    const entry: SessionLog = {
      id: `${Date.now()}`,
      at: new Date().toLocaleDateString("ru-RU"),
      ...form,
      spots: pending,
    };
    const next = [entry, ...log].slice(0, 30);
    setLog(next);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
    setPending([]);
    setForm({ games: "", first: "", second: "", buyins: "", chart: false, jam: false, postflop: false, noHero: false, mistake: "", drill: "" });
  }

  const done = ticks.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["hand", "В раздаче"],
            ["session", "После сессии"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "h-11 rounded-full border px-3 text-sm",
              pane === id ? "border-fg bg-fg text-bg" : "border-border bg-surface-2 text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "hand" ? (
        <>
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-medium">Порядок на каждый ход</h2>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>1. Префлоп или уже борд. Кто сбросил. Вы баттон, малый или большой блайнд.</li>
              <li>2. Стек. На старте 15bb. Если у кого-то меньше — решайте по меньшему.</li>
              <li>3. Префлоп: откройте тот же спот во вкладке «Стратегия» и сыграйте цвет. Микс — берите частое действие.</li>
              <li>4. Вам пуш 15bb. Нужно около 47%. AA–JJ, AK, AQ, AJ и любая пара — колл. ATo, KQo, 76s — фолд.</li>
              <li>5. Борд: ауты, потом цена, потом сравнение. Выше цены — колл. Ниже — фолд.</li>
              <li>6. Не узнали спот и стек короткий — фолд. Невыученный колл дороже фолда.</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-medium">Что в уме, что в программе</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <p>В раздаче только в уме. Цена колла — одно деление: сколько доплатить разделить на банк после вашего колла. Ауты с флопа умножить на 4, с тёрна на 2.</p>
              <p>Оверкарта — карта в руке старше борда. AK на Q-7-2 — две оверкарты, около 24% против топ-пары, не монетка.</p>
              <p>Калькулятор эквити и солвер во время раздачи не открывать. На PokerStars, GG и большинстве сайтов это запрещённая подсказка, за неё блокируют аккаунт. Чарты этого тренажёра — до сессии. Калькулятор — после, на одной спорной руке во вкладке «Эквити».</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Эта раздача</h2>
              <button
                type="button"
                className="h-11 text-sm text-muted"
                onClick={() => setTicks(HAND_STEPS.map(() => false))}
              >
                Новая раздача {done}/{HAND_STEPS.length}
              </button>
            </div>
            <ul className="mt-2">
              {HAND_STEPS.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="flex min-h-11 w-full items-center gap-3 text-left text-sm"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border font-mono text-xs",
                        ticks[i] ? "border-ok text-ok" : "border-border text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <span className={ticks[i] ? "text-subtle" : "text-fg"}>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-medium">Спорная рука — записать между раздачами</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Рука" value={note.hand} onChange={(hand) => setNote({ ...note, hand })} placeholder="AJo" />
              <Field label="Борд" value={note.board} onChange={(board) => setNote({ ...note, board })} placeholder="K72" />
              <Field label="Что сделал" value={note.did} onChange={(did) => setNote({ ...note, did })} placeholder="колл" />
              <Field label="Что надо было" value={note.should} onChange={(should) => setNote({ ...note, should })} placeholder="фолд" />
            </div>
            <button type="button" className="mt-3 h-11 text-sm text-muted" onClick={addNote}>
              Добавить в сессию
            </button>
            {pending.length ? (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {pending.map((s, i) => (
                  <li key={`${s.hand}${i}`}>
                    {s.hand || "?"} {s.board} · {s.did || "?"} → {s.should || "?"}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-medium">Закрыть сессию</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Пять минут после игры. Прибыль копится из повторяемого порядка, не из одной удачной раздачи.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Турниров" value={form.games} onChange={(games) => setForm({ ...form, games })} placeholder="40" />
              <Field label="Первых мест" value={form.first} onChange={(first) => setForm({ ...form, first })} placeholder="12" />
              <Field label="Вторых мест" value={form.second} onChange={(second) => setForm({ ...form, second })} placeholder="14" />
              <Field label="Бай-ины, ±" value={form.buyins} onChange={(buyins) => setForm({ ...form, buyins })} placeholder="+3" />
            </div>
            <ul className="mt-3">
              {(
                [
                  ["chart", "Префлоп играл по чарту"],
                  ["jam", "Колл пуша сверял с 47%"],
                  ["postflop", "На борде считал ауты и цену"],
                  ["noHero", "Не коллировал «красивую» руку без цены"],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [key]: !form[key] })}
                    className="flex min-h-11 w-full items-center gap-3 text-left text-sm"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border font-mono text-xs",
                        form[key] ? "border-ok text-ok" : "border-border text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <label className="mt-2 block text-sm text-muted">
              Главная ошибка сессии
              <textarea
                value={form.mistake}
                onChange={(e) => setForm({ ...form, mistake: e.target.value })}
                className="mt-1 min-h-20 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-fg"
              />
            </label>
            <Field
              label="Завтра в тренажёре"
              value={form.drill}
              onChange={(drill) => setForm({ ...form, drill })}
              placeholder="колл пуша баттона"
            />
            {pending.length ? <p className="mt-2 text-sm text-muted">Спорных рук в этой записи: {pending.length}</p> : null}
            <button type="button" className="mt-3 h-11 rounded-xl bg-fg px-4 text-sm text-bg" onClick={saveSession}>
              Сохранить сессию
            </button>
          </section>

          {log.length ? (
            <ul className="space-y-2">
              {log.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
                  <p className="font-mono text-muted">
                    {row.at} · {row.games || "?"} турниров · {row.buyins || "?"} бай-ина
                  </p>
                  <p className="mt-1 text-muted">
                    1-е {row.first || "?"} · 2-е {row.second || "?"}
                  </p>
                  {row.mistake ? <p className="mt-2 text-fg">{row.mistake}</p> : null}
                  {row.drill ? <p className="mt-1 text-muted">Тренажёр: {row.drill}</p> : null}
                  {row.spots?.length ? (
                    <ul className="mt-2 space-y-1 text-muted">
                      {row.spots.map((s, i) => (
                        <li key={i}>
                          {s.hand} {s.board} · {s.did} → {s.should}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Сохранённых сессий пока нет.</p>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg"
      />
    </label>
  );
}
