import { HU_ADVISOR_ENABLED, huNash, readHuAdvisorEnabled, writeHuAdvisorEnabled } from "@/lib/spin-drill/hu-nash";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function HuAdvisor({ spotId, bb, klass, street, chart }: { spotId: string; bb: number; klass: string; street: string; chart: string }) {
  const [on, setOn] = useState(readHuAdvisorEnabled);
  if (!HU_ADVISOR_ENABLED || !spotId.startsWith("hu_")) return null;
  const advice = on ? huNash(spotId, bb, klass, street, chart) : null;
  function toggle() {
    const next = !on;
    writeHuAdvisorEnabled(next);
    setOn(next);
  }
  return (
    <aside className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium tracking-[0.14em] text-amber-200/80 uppercase">Советчик HU · Nash</p>
        <button type="button" onClick={toggle} className="text-[11px] text-amber-100 underline">
          {on ? "Выключить" : "Включить"}
        </button>
      </div>
      {advice ? (
        <>
          <p className="mt-1 text-2xl font-semibold leading-none text-amber-100">{advice.action}</p>
          <p className="mt-1 text-xs text-amber-200/80">{advice.line}</p>
          <p className="mt-1 text-sm leading-snug text-amber-50/90">{advice.why}</p>
          {advice.agrees === false ? <p className={cn("mt-1 text-xs font-medium text-amber-200")}>Не совпадает с чартом. Играйте подсвеченную кнопку чарта, если не хотите проверять пуш.</p> : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-amber-100/80">Выключен. Чарт работает как раньше. Включить можно в любой раздаче хедз-апа.</p>
      )}
    </aside>
  );
}
