import { chartGrid } from "@/lib/poker/preflop";
import { actionFromSpec, type GtoAction, type RangeSpec } from "@/lib/poker/spin";
import { cn } from "@/lib/utils";

const CELL: Record<GtoAction, string> = {
  jam: "bg-raise text-accent-fg",
  raise: "bg-raise/50 text-fg",
  call: "bg-call/40 text-fg",
  limp: "bg-check/35 text-fg",
  check: "bg-check/20 text-fg",
  fold: "bg-surface-2 text-subtle",
};

export function RangeMatrix({
  spec,
  picked,
  onPick,
}: {
  spec: RangeSpec;
  picked: string | null;
  onPick: (h: string) => void;
}) {
  const grid = chartGrid();
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[320px] gap-px rounded-md bg-border p-px"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      >
        {grid.flatMap((row) =>
          row.map((h) => {
            const act = actionFromSpec(h, spec);
            const on = picked === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => onPick(h)}
                className={cn(
                  "flex h-8 items-center justify-center text-xs font-medium sm:h-9",
                  CELL[act],
                  on && "ring-2 ring-accent ring-inset",
                )}
              >
                {h}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

export const ACTION_LEGEND: Array<{ action: GtoAction; label: string; cls: string }> = [
  { action: "jam", label: "Jam", cls: "bg-raise" },
  { action: "raise", label: "Raise", cls: "bg-raise/50" },
  { action: "call", label: "Call", cls: "bg-call/50" },
  { action: "limp", label: "Limp", cls: "bg-check/40" },
  { action: "check", label: "Check", cls: "bg-check/25" },
  { action: "fold", label: "Fold", cls: "bg-surface-2" },
];
