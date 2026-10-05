import { cn } from "@/lib/utils";
import { useRef } from "react";

export function StackRail({ bb, onChange }: { bb: number; onChange: (bb: number) => void }) {
  const rail = useRef<HTMLDivElement>(null);

  function choose(clientY: number) {
    const el = rail.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    onChange(Math.min(30, Math.max(1, Math.round(30 - t * 29))));
  }

  const top = `${((30 - bb) / 29) * 100}%`;

  return (
    <div className="flex w-16 shrink-0 flex-col items-center">
      <div
        ref={rail}
        className="relative h-full min-h-48 w-full flex-1 cursor-pointer touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          choose(event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) choose(event.clientY);
        }}
      >
        <div className="absolute top-0 bottom-0 left-3 w-0.5 bg-fg" />
        <span className="absolute top-0 left-5 font-mono text-[10px] text-muted">30</span>
        <button
          type="button"
          className={cn("absolute left-5 font-mono text-[10px]", bb === 15 ? "font-semibold text-fg" : "text-muted")}
          style={{ top: "51.7%" }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(15)}
        >
          15
        </button>
        <span className="absolute bottom-0 left-5 font-mono text-[10px] text-muted">1</span>
        <div className="pointer-events-none absolute left-3 -translate-x-1/2 -translate-y-1/2" style={{ top }}>
          <span className="absolute top-1/2 left-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg" />
          <span
            className={cn(
              "absolute top-1/2 left-3 -translate-y-1/2 rounded-full px-1.5 py-0.5 font-mono text-sm font-semibold",
              bb === 15 ? "bg-fg text-bg" : "bg-surface text-fg",
            )}
          >
            {bb}
          </span>
        </div>
      </div>
    </div>
  );
}
