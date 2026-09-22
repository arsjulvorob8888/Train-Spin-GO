import { handAt } from "@/lib/spin-drill/legacy-ranges";
import { mixOf, segs, type MixRange } from "@/lib/spin-drill/mix";
import { cn } from "@/lib/utils";
import type { SpotStat } from "@/lib/spin-drill/stats";

const BAR: Record<string, string> = {
  allin: "bg-allin",
  raise: "bg-raise",
  call: "bg-call",
  fold: "bg-fold",
};

export function MixGrid({
  range,
  selected,
  stats,
  onPick,
}: {
  range: MixRange;
  selected?: string | null;
  stats?: SpotStat;
  onPick?: (h: string) => void;
}) {
  const cells = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const h = handAt(i, j);
      const m = mixOf(range, h);
      const rec = stats?.hands[h];
      const acc = rec && rec.total ? Math.round((rec.correct / rec.total) * 100) : null;
      cells.push(
        <button
          key={h}
          type="button"
          onClick={() => onPick?.(h)}
          className={cn(
            "relative aspect-square overflow-hidden text-left",
            selected === h && "z-2 outline outline-2 outline-offset-1 outline-fg",
          )}
        >
          <div className="absolute inset-0 flex">
            {segs(m).map((s) => (
              <span
                key={s.a}
                className={cn("relative block h-full", BAR[s.a])}
                style={{ width: `${s.p}%` }}
              >
                {s.p >= 22 && (
                  <span className="absolute inset-x-0 top-0 hidden pt-px text-center font-mono text-[9px] font-semibold leading-none text-fg [text-shadow:0_1px_2px_#000a] sm:block">
                    {s.p}
                  </span>
                )}
              </span>
            ))}
          </div>
          <span className="relative z-10 flex h-full flex-col justify-end p-0.5 font-mono text-[10px] font-semibold leading-none text-fg [text-shadow:0_1px_2px_#0008] sm:text-xs">
            {h}
            {acc != null && <span className="self-end text-[9px]">{acc}%</span>}
          </span>
        </button>,
      );
    }
  }
  return (
    <div className="w-full overflow-x-auto">
      <div className="grid min-w-0 grid-cols-13 gap-px bg-bg">{cells}</div>
    </div>
  );
}
