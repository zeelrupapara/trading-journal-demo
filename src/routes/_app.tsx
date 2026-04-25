import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app/Sidebar";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("qj_user");
      if (!u) throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
