import { MiniCard } from "@/components/spin-drill/pip-card";
import { RANK_CHARS, SUIT_CHARS, type Card } from "@/lib/poker/cards";
import { bb, dealPotSpot, evText, pct, type PotSpot } from "@/lib/spin-drill/pot-odds-sim";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function face(c: Card) {
  return { r: RANK_CHARS[c.rank]!, s: SUIT_CHARS[c.suit]! };
}

function Who({
  role,
  pos,
  stack,
  tone,
}: {
  role: string;
  pos: string;
  stack: number;
  tone: "hero" | "villain";
}) {
  return (
    <div className={cn("rounded-2xl px-4 py-2 text-center", tone === "hero" ? "bg-call" : "bg-raise")}>
      <p className="text-sm font-semibold text-fg">{role}</p>
      <p className="font-mono text-xs text-fg/80">
        {pos} · {stack <= 0 ? "олл-ин, в стеке ничего" : `в стеке ${bb(stack)} bb`}
      </p>
    </div>
  );
}

function Money({ label, value, hint, hot }: { label: string; value: string; hint: string; hot?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-2 py-3 text-center", hot ? "border-fg bg-surface" : "border-border bg-surface-2")}>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 font-mono text-lg text-fg">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

export function PotOddsDrill() {
  const [spot, setSpot] = useState<PotSpot | null>(null);
  const [pick, setPick] = useState<boolean | null>(null);
  const [session, setSession] = useState({ total: 0, correct: 0, streak: 0 });

  useEffect(() => {
    setSpot(dealPotSpot());
  }, []);

  function answer(yes: boolean) {
    if (!spot || pick !== null) return;
    const ok = yes === spot.enough;
    setPick(yes);
    setSession((s) => ({
      total: s.total + 1,
      correct: s.correct + (ok ? 1 : 0),
      streak: ok ? s.streak + 1 : 0,
    }));
  }

  function next() {
    setPick(null);
    setSpot(dealPotSpot());
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (pick === null) {
        if (e.key === "n" || e.key === "N" || e.key === "н" || e.key === "Н") answer(false);
        if (e.key === "y" || e.key === "Y" || e.key === "д" || e.key === "Д") answer(true);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!spot) return null;

  const ok = pick === null ? null : pick === spot.enough;
  const sessPct = session.total ? Math.round((session.correct / session.total) * 100) : 0;
  const hidden = 5 - spot.board.length;
  const after = Math.round((spot.pot + spot.toCall) * 10) / 10;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <p className="text-center font-mono text-sm text-muted">
        Spin 3-max · старт 15bb · {session.correct}/{session.total} <b className="text-fg">{sessPct}%</b>
        {session.streak > 1 ? ` · ${session.streak} подряд` : ""}
      </p>
      <p className="text-center text-sm leading-relaxed text-muted">{spot.story}</p>

      <div className="flex flex-col items-center gap-2">
        <Who role="Противник" pos={spot.villainPos} stack={spot.villainStack} tone="villain" />
        <p className="text-sm text-muted">{spot.foldPos} уже сбросил</p>
      </div>

      <div className="felt-table mx-auto flex max-w-md flex-col items-center gap-2 rounded-full px-4 py-8">
        <p className="font-mono text-xs tracking-wide text-fg/70">{spot.street}</p>
        <div className="flex gap-1">
          {spot.board.map((c, i) => {
            const f = face(c);
            return <MiniCard key={`${f.r}${f.s}${i}`} r={f.r} s={f.s} />;
          })}
          {Array.from({ length: hidden }, (_, i) => (
            <div key={`h${i}`} className="card-back h-14 w-10 rounded-md" />
          ))}
        </div>
        <p className="font-mono text-sm text-fg">сейчас в банке {bb(spot.pot)} bb</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1">
          {spot.hero.map((c, i) => {
            const f = face(c);
            return <MiniCard key={`${f.r}${f.s}${i}`} r={f.r} s={f.s} />;
          })}
        </div>
        <Who role="Вы" pos={spot.heroPos} stack={spot.heroStack} tone="hero" />
        <p className="text-center font-mono text-sm text-muted">
          ваша эквити <span className="text-base text-fg">{pct(spot.equity)}</span>
          <span className="text-subtle"> · против случайной руки</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Money label="Уже в банке" value={`${bb(spot.potBefore)} bb`} hint="до его ставки" />
        <Money label="Поставил ещё" value={`${bb(spot.bet)} bb`} hint="противник" />
        <Money
          label="Коллировать"
          value={`${bb(spot.toCall)} bb`}
          hint={spot.toCall >= spot.heroStack ? "весь ваш стек" : "вам доплатить"}
          hot
        />
      </div>
      <p className="text-center text-sm text-muted">
        Сейчас в банке {bb(spot.pot)} bb = {bb(spot.potBefore)} уже было + {bb(spot.bet)} его ставка. После вашего колла будет {bb(after)} bb.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-center text-base">Хватит ли эквити, чтобы коллировать {bb(spot.toCall)} bb?</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pick !== null}
            onClick={() => answer(false)}
            className={cn(
              "h-14 rounded-xl bg-bad text-base font-semibold text-fg",
              pick !== null && pick !== false && "opacity-40",
              pick === false && "ring-2 ring-fg",
            )}
          >
            Нет
          </button>
          <button
            type="button"
            disabled={pick !== null}
            onClick={() => answer(true)}
            className={cn(
              "h-14 rounded-xl bg-ok text-base font-semibold text-bg",
              pick !== null && pick !== true && "opacity-40",
              pick === true && "ring-2 ring-fg",
            )}
          >
            Да
          </button>
        </div>

        {pick !== null && ok !== null ? (
          <div className="mt-4">
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border text-center">
              {(
                [
                  [pct(spot.equity), "ваша эквити"],
                  [pct(spot.villainEquity), "противник"],
                  [`${evText(spot.ev)} bb`, "EV колла"],
                  [`${bb(spot.toCall)} bb`, "коллировать"],
                  [`${bb(spot.pot)} bb`, "банк сейчас"],
                  [pct(spot.required), "нужно"],
                ] as const
              ).map(([value, label], i) => (
                <div
                  key={label}
                  className={cn("bg-surface-2 px-2 py-3", i < 3 && "border-b border-border", i % 3 !== 2 && "border-r border-border")}
                >
                  <p className={cn("font-mono text-lg", label === "EV колла" && (spot.ev >= 0 ? "text-ok" : "text-bad"))}>{value}</p>
                  <p className="mt-1 text-xs text-subtle">{label}</p>
                </div>
              ))}
            </div>
            <p className={cn("mt-3 text-center text-sm font-semibold", ok ? "text-ok" : "text-bad")}>
              {ok ? "Верно." : "Ошибка."} {spot.enough ? "Эквити хватает для колла." : "Эквити не хватает для колла."}
            </p>
            <p className="mt-1 text-center text-sm leading-relaxed text-muted">
              {bb(spot.toCall)} / {bb(after)} = {pct(spot.required)}. Это колл {bb(spot.toCall)} bb в банк, который после колла станет {bb(after)} bb. У вас {pct(spot.equity)}.
            </p>
            <button type="button" className="mt-3 h-11 w-full text-sm text-muted" onClick={next}>
              Следующая раздача
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-muted">
            Цена колла — {bb(spot.toCall)} bb из {bb(after)} bb. Поделите первое на второе и сравните со своей эквити.
          </p>
        )}
      </div>
    </div>
  );
}
