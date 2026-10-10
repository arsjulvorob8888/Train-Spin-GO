import { createFileRoute } from "@tanstack/react-router";
import { SpinApp, type AppPane, type Tab } from "@/components/spin-drill/spin-app";

const TABS: Tab[] = ["practice", "strategy", "table", "experiment", "sim", "hands", "math", "stats", "journal", "craft"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab; pane?: AppPane } => {
    const out: { tab?: Tab; pane?: AppPane } = {};
    if (TABS.includes(search.tab as Tab)) out.tab = search.tab as Tab;
    if (search.pane === "anchors" || search.pane === "drill") out.pane = search.pane;
    return out;
  },
  component: Home,
});

function Home() {
  const { tab, pane } = Route.useSearch();
  return <SpinApp tab={tab ?? "strategy"} pane={pane ?? "lesson"} />;
}
