import { createFileRoute } from "@tanstack/react-router";
import { CraftDetail } from "@/components/spin-drill/craft-view";

export const Route = createFileRoute("/pokercraft/$id")({
  component: function Page() {
    const { id } = Route.useParams();
    return <CraftDetail id={id} />;
  },
});
