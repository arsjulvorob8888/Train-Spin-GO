import { GROUP_HELP, SEAT_NAME, STACK, type SpotDef, type SpotGroup, type StepKind } from "@/lib/spin-drill/spots";
import { cn } from "@/lib/utils";

const STEP_CLS: Record<StepKind, string> = {
  hero: "border-ok bg-felt text-fg",
  acted: "border-border bg-surface text-fg",
  folded: "border-border bg-surface-2 text-subtle",
  waiting: "border-border bg-surface-2 text-muted",
  out: "border-border bg-surface-2 text-subtle",
};

export function GroupHint({ group }: { group: SpotGroup }) {
  const help = GROUP_HELP[group];
  return (
    <p className="text-sm leading-relaxed text-muted">
      <span className="font-medium text-fg">{help.title}. </span>
      {help.text}
    </p>
  );
}

export function SpotExplain({ spot, compact = false }: { spot: SpotDef; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs text-muted">
          {spot.players === 2 ? "2 игрока · heads-up" : "3 игрока за столом"}
        </span>
        <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs text-muted">
          вы: {SEAT_NAME[spot.hero]}
        </span>
        <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs text-muted">{STACK}</span>
      </div>
      <ol className="mt-3 flex flex-wrap items-stretch gap-1.5">
        {spot.steps.map((step, i) => (
          <li key={`${step.label}-${step.did}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span className="font-mono text-xs text-subtle">→</span> : null}
            <span className={cn("min-w-20 rounded-lg border px-2.5 py-1.5", STEP_CLS[step.kind])}>
              <span className="block font-mono text-xs opacity-80">{step.label}</span>
              <span className="text-sm font-medium">{step.did}</span>
            </span>
          </li>
        ))}
      </ol>
      {compact ? null : <p className="mt-3 text-sm leading-relaxed text-muted">{spot.story}</p>}
    </div>
  );
}
