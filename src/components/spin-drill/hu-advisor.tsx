import { HU_ADVISOR_ENABLED, huNash, readHuAdvisorEnabled, writeHuAdvisorEnabled } from "@/lib/spin-drill/hu-nash";
import { HU_POSTFLOP_ENABLED, huPostflop } from "@/lib/spin-drill/hu-postflop";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function HuAdvisor({
  spotId,
  bb,
  klass,
  street,
  chart,
  players,
  equity,
  need,
  made,
  draw,
  pot,
}: {
  spotId: string;
  bb: number;
  klass: string;
  street: string;
  chart: string;
  players: number;
  equity: number;
  need: number | null;
  made: string | null;
  draw: string | null;
  pot: number | null;
}) {
  const post = street !== "Префлоп";
  const [on, setOn] = useState(readHuAdvisorEnabled);
  const headsUp = spotId.startsWith("hu_") || (post && players <= 2);
  if (!headsUp || (post ? !HU_POSTFLOP_ENABLED : !HU_ADVISOR_ENABLED)) return null;
  const advice = on
    ? post
      ? huPostflop({ players, bb, street, equity, need, made, draw, chart, pot })
      : huNash(spotId, bb, klass, street, chart)
    : null;
  function toggle() {
    const next = !on;
    writeHuAdvisorEnabled(next);
    setOn(next);
  }
  return (
    <aside className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium tracking-[0.14em] text-amber-200/80 uppercase">{post ? "Советчик HU · постфлоп" : "Советчик HU · Nash"}</p>
        <button type="button" onClick={toggle} className="text-[11px] text-amber-100 underline">
          {on ? "Выключить" : "Включить"}
        </button>
      </div>
      {advice ? (
        <>
          <p className="mt-1 text-2xl font-semibold leading-none text-amber-100">{advice.action}</p>
          <p className="mt-1 text-xs text-amber-200/80">{advice.line}</p>
          <p className="mt-1 text-sm leading-snug text-amber-50/90">{advice.why}</p>
          {advice.agrees === false ? <p className={cn("mt-1 text-xs font-medium text-amber-200")}>Не совпадает с чартом. Играйте подсвеченную кнопку, если не хотите проверять эту линию.</p> : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-amber-100/80">{on ? "Для этой руки совета нет. Чарт остаётся основным." : "Выключен. Чарт работает как раньше."}</p>
      )}
    </aside>
  );
}
