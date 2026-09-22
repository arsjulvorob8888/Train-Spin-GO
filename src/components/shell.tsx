import { Link, useRouterState } from "@tanstack/react-router";
import { Dices, Spade } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [{ to: "/", label: "Спот", icon: Dices }] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 pr-2">
            <span className="flex size-8 items-center justify-center rounded-sm bg-felt text-call">
              <Spade className="size-4" strokeWidth={1.75} />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight sm:text-base">Felt Lab</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              Spin 3-max
            </span>
          </Link>
          <nav className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm transition-colors duration-150",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
