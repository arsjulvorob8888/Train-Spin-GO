import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "call" | "fold" | "raise" | "check" | "accent";
}) {
  const tones: Record<string, string> = {
    muted: "bg-surface-2 text-muted",
    call: "bg-call/15 text-call",
    fold: "bg-fold/15 text-fold",
    raise: "bg-raise/15 text-raise",
    check: "bg-check/15 text-check",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-xs tracking-wide uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
