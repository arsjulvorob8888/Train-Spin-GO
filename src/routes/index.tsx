import { createFileRoute } from "@tanstack/react-router";
import { SpinApp, type AppPane, type Tab } from "@/components/spin-drill/spin-app";

const TABS: Tab[] = ["practice", "strategy", "mtt", "table", "experiment", "sim", "hands", "math", "stats", "journal", "craft", "sources"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab; pane?: AppPane; mode?: "spin" | "mtt" } => {
    const out: { tab?: Tab; pane?: AppPane; mode?: "spin" | "mtt" } = {};
    if (TABS.includes(search.tab as Tab)) out.tab = search.tab as Tab;
    if (search.pane === "anchors" || search.pane === "drill") out.pane = search.pane;
    if (search.mode === "spin" || search.mode === "mtt") out.mode = search.mode;
    return out;
  },
  component: Home,
});

function Home() {
  const { tab, pane, mode } = Route.useSearch();
  return <SpinApp tab={tab ?? "strategy"} pane={pane ?? "lesson"} mode={mode ?? "spin"} />;
}
