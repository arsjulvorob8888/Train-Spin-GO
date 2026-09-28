import { MiniCard } from "@/components/spin-drill/pip-card";
import { RANK_CHARS, SUIT_CHARS, type Card } from "@/lib/poker/cards";
import { bb, dealPotSpot, evText, pct, type PotSpot } from "@/lib/spin-drill/pot-odds-sim";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function face(c: Card) {
  return { r: RANK_CHARS[c.rank]!, s: SUIT_CHARS[c.suit]! };
}

function Stack({ pos, stack, tone }: { pos: string; stack: number; tone: "hero" | "villain" }) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-full pr-3 font-mono text-sm text-fg",
        tone === "hero" ? "bg-call" : "bg-raise",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-bg/25 text-xs">{pos}</span>
      {bb(stack)} bb
    </div>
  );
}

function FoldSeat({ pos }: { pos: string }) {
  return (
    <div className="flex h-9 items-center gap-1.5 rounded-full bg-bg/70 pr-2.5 text-xs text-subtle">
      <span className="flex size-9 items-center justify-center rounded-full bg-surface-2">{pos}</span>
      фолд
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
  const dead = Math.round((spot.pot - spot.toCall) * 10) / 10;
  const [foldL1, foldR1, foldL2, foldR2] = spot.folds;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <p className="text-center font-mono text-sm text-muted">
        Сессия {session.correct}/{session.total} <b className="text-fg">{sessPct}%</b>
        {session.streak > 1 ? ` · ${session.streak} подряд` : ""}
      </p>

      <div className="mx-auto w-full max-w-lg">
        <div className="flex flex-col items-center gap-1">
          <Stack pos={spot.villainPos} stack={spot.villainStack} tone="villain" />
          <p className="font-mono text-sm text-muted">{bb(spot.toCall)} bb</p>
        </div>

        <div className="mt-2 grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="hidden flex-col gap-2 sm:flex">
            <FoldSeat pos={foldL1!} />
            <FoldSeat pos={foldL2!} />
          </div>

          <div className="felt-table flex flex-col items-center gap-2 rounded-full px-4 py-8">
            <p className="font-mono text-xs tracking-wide text-fg/70">{spot.street}</p>
            <p className="font-mono text-sm text-fg">банк {bb(spot.pot)} bb</p>
            <div className="flex gap-1">
              {spot.board.map((c, i) => {
                const f = face(c);
                return <MiniCard key={`${f.r}${f.s}${i}`} r={f.r} s={f.s} />;
              })}
              {Array.from({ length: hidden }, (_, i) => (
                <div key={`h${i}`} className="card-back h-14 w-10 rounded-md" />
              ))}
            </div>
            {dead > 0 ? <p className="font-mono text-sm text-fg/70">{bb(dead)} bb уже в банке</p> : null}
            <p className="text-xs text-fg/60 sm:hidden">фолд: {spot.folds.join(" · ")}</p>
          </div>

          <div className="hidden flex-col gap-2 sm:flex">
            <FoldSeat pos={foldR1!} />
            <FoldSeat pos={foldR2!} />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="relative flex gap-1">
              <span className="absolute -top-2 -left-3 flex size-6 items-center justify-center rounded-full bg-fg font-mono text-xs text-bg">
                D
              </span>
              {spot.hero.map((c, i) => {
                const f = face(c);
                return <MiniCard key={`${f.r}${f.s}${i}`} r={f.r} s={f.s} />;
              })}
            </div>
            <Stack pos={spot.heroPos} stack={spot.heroStack} tone="hero" />
          </div>
          <p className="text-right font-mono text-xs leading-tight text-muted">
            эквити
            <br />
            <span className="text-base text-fg">{pct(spot.equity)}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-center text-base">Хватит ли эквити, чтобы продолжить?</p>
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
                  [pct(spot.equity), "эквити"],
                  [pct(spot.villainEquity), "соперник"],
                  [evText(spot.ev), "EV колла"],
                  [bb(spot.toCall), "доплатить"],
                  [bb(spot.pot), "банк"],
                  [pct(spot.required), "нужно"],
                ] as const
              ).map(([value, label], i) => (
                <div key={label} className={cn("bg-surface-2 px-2 py-3", i < 3 && "border-b border-border", i % 3 !== 2 && "border-r border-border")}>
                  <p className={cn("font-mono text-lg", label === "EV колла" && (spot.ev >= 0 ? "text-ok" : "text-bad"))}>{value}</p>
                  <p className="mt-1 text-xs text-subtle">{label}</p>
                </div>
              ))}
            </div>
            <p className={cn("mt-3 text-center text-sm font-semibold", ok ? "text-ok" : "text-bad")}>
              {ok ? "Верно." : "Ошибка."} {spot.enough ? "Эквити хватает для колла." : "Эквити не хватает для колла."}
            </p>
            <p className="mt-1 text-center text-sm leading-relaxed text-muted">
              {bb(spot.toCall)} / ({bb(spot.pot)} + {bb(spot.toCall)}) = {pct(spot.required)}. У тебя {pct(spot.equity)}.
            </p>
            <button type="button" className="mt-3 h-11 w-full text-sm text-muted" onClick={next}>
              Следующая раздача
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-muted">Сравни эквити с ценой: доплатить / (банк + доплатить).</p>
        )}
      </div>
    </div>
  );
}
