import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const u = typeof window !== "undefined" ? localStorage.getItem("qj_user") : null;
    nav({ to: u ? "/dashboard" : "/login", replace: true });
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}
