import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export function StackRail({ bb, onChange }: { bb: number; onChange: (bb: number) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function choose(clientY: number) {
    const el = rail.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.height <= 0) return;
    const t = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    onChangeRef.current(Math.min(30, Math.max(1, Math.round(30 - t * 29))));
  }

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      choose(event.clientY);
      const move = (e: PointerEvent) => {
        e.preventDefault();
        choose(e.clientY);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, []);

  const top = `${((30 - bb) / 29) * 100}%`;

  return (
    <div className="ml-4 flex w-24 shrink-0 touch-none flex-col select-none">
      <div ref={rail} className="relative h-full min-h-48 w-full flex-1 cursor-pointer">
        <div className="absolute top-3 bottom-3 left-3 w-1 rounded-full bg-fg" />
        <span className="pointer-events-none absolute top-0 left-8 font-mono text-xs text-muted">30</span>
        <button
          type="button"
          className={cn("absolute left-8 font-mono text-xs", bb === 15 ? "font-semibold text-fg" : "text-muted")}
          style={{ top: "51.7%" }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(15)}
        >
          15
        </button>
        <span className="pointer-events-none absolute bottom-0 left-8 font-mono text-xs text-muted">1</span>
        <div className="pointer-events-none absolute left-3 -translate-x-1/2 -translate-y-1/2" style={{ top }}>
          <span className="absolute top-1/2 left-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-fg" />
          <span
            className={cn(
              "absolute top-1/2 left-6 -translate-y-1/2 rounded-full px-2.5 py-1 font-mono text-lg font-semibold",
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
