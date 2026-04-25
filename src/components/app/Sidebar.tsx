import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, BarChart3, Brain, User, LogOut, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/journal", label: "Trade Journal", icon: BookOpen },
  { to: "/analytics", label: "Performance", icon: BarChart3 },
  { to: "/ai", label: "AI Analytics", icon: Brain },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl flex flex-col">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-secondary border border-border flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide leading-none">QUANTUM</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">INSTITUTIONAL GRADE</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />}
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {(user?.name || "T").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => { logout(); nav({ to: "/login" }); }}
            className="text-muted-foreground hover:text-loss transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
