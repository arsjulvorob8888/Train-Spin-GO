import { createFileRoute } from "@tanstack/react-router";
import { SpinApp } from "@/components/spin-drill/spin-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SpinApp />;
}
