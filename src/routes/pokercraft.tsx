import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { CraftTable } from "@/components/spin-drill/craft-view";

export const Route = createFileRoute("/pokercraft")({
  component: function Page() {
    const path = useRouterState({ select: (s) => s.location.pathname });
    if (path !== "/pokercraft") return <Outlet />;
    return (
      <main className="mx-auto max-w-4xl p-5">
        <CraftTable />
      </main>
    );
  },
});
