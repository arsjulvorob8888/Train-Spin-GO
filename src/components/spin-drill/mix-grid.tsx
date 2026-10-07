import { gridName, handAt } from "@/lib/spin-drill/legacy-ranges";
import { paintHex, sizeMark, SIZE_ORDER, sizeCaption, type BbSize } from "@/lib/spin-drill/hu-bb-limp";
import { mixOf, segs, type MixRange } from "@/lib/spin-drill/mix";
import { cn } from "@/lib/utils";
import type { SpotStat } from "@/lib/spin-drill/stats";

const BAR: Record<string, string> = {
  allin: "bg-allin",
  raise: "bg-raise",
  call: "bg-call",
  fold: "bg-fold",
};

export function PairLine() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      viewBox="0 0 13 13"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="0.5"
        y1="0.5"
        x2="12.5"
        y2="12.5"
        stroke="#fff"
        strokeWidth="1"
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  );
}

export function MixGrid({
  range,
  selected,
  stats,
  onPick,
  paint,
  bb = 30,
  compact = false,
}: {
  range: MixRange;
  selected?: string | null;
  stats?: SpotStat;
  onPick?: (h: string) => void;
  paint?: Record<string, BbSize> | null;
  bb?: number;
  compact?: boolean;
}) {
  const cells = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const h = handAt(i, j);
      const sized = paint?.[h];
      const hex = sized ? paintHex(sized) : null;
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
          <div className="absolute inset-0 flex" style={hex ? { background: hex } : undefined}>
            {hex
              ? null
              : segs(m).map((s) => (
              <span
                key={s.a}
                className={cn("relative block h-full", BAR[s.a])}
                style={{ width: `${s.p}%` }}
              >
                {s.p >= 22 && s.p < 99 && (
                  <span className="absolute inset-x-0 top-0 hidden pt-px text-center font-mono text-[9px] font-semibold leading-none text-fg [text-shadow:0_1px_2px_#000a] sm:block">
                    {s.p}
                  </span>
                )}
              </span>
            ))}
          </div>
          {sized && sizeMark(sized) ? (
            <span className={cn("absolute top-0.5 left-0.5 z-10 font-mono font-bold leading-none text-fg [text-shadow:0_1px_2px_#000a]", compact ? "text-[8px]" : "text-[11px] sm:text-sm")}>
              {sizeMark(sized)}
            </span>
          ) : null}
          <span className={cn("relative z-10 flex h-full flex-col justify-end p-0.5 font-mono font-bold leading-none tracking-tighter text-fg [text-shadow:0_1px_2px_#0008]", compact ? "text-[9px]" : "text-xs sm:text-sm")}>
            {gridName(h)}
            {acc != null && <span className="self-end text-[9px]">{acc}%</span>}
          </span>
        </button>,
      );
    }
  }
  const used = paint ? SIZE_ORDER.filter((size) => Object.values(paint).includes(size)) : [];
  return (
    <div className="w-full overflow-x-auto">
      {used.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {used.map((size) => (
            <span key={size} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 font-mono text-xs text-fg">
              <i className="block h-3 w-3 rounded-sm" style={{ background: paintHex(size) ?? undefined }} />
              {sizeCaption(size, bb)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative grid min-w-0 grid-cols-13 gap-px bg-bg">
        {cells}
        <PairLine />
      </div>
    </div>
  );
}
