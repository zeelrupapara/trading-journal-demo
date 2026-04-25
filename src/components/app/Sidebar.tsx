import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Brain,
  User,
  LogOut,
  TrendingUp,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/app/UserAvatar";
import { CsvImport } from "@/components/app/CsvImport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/journal", label: "Trade Journal", icon: BookOpen },
  { to: "/analytics", label: "Performance", icon: BarChart3 },
  { to: "/ai", label: "AI Analytics", icon: Brain },
] as const;

export function AppSidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onProfile = path.startsWith("/profile");

  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl flex flex-col sticky top-0 h-screen self-start">
      <div className="px-5 pt-6 pb-4">
        <Link
          to="/dashboard"
          aria-label="Go to dashboard"
          className="flex items-center gap-2.5 group rounded-md -mx-2 px-2 py-1 hover:bg-sidebar-accent/40 transition-colors"
        >
          <div className="h-8 w-8 rounded-md bg-secondary border border-border flex items-center justify-center group-hover:border-primary/40 transition-colors">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide leading-none">QUANTUM</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
              INSTITUTIONAL GRADE
            </p>
          </div>
        </Link>
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
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />
              )}
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pt-3 pb-2 border-t border-sidebar-border">
        <CsvImport variant="sidebar" />
      </div>
      <div className="px-3 pb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                "hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                onProfile && "bg-sidebar-accent/60",
              )}
            >
              <UserAvatar
                name={user?.name}
                email={user?.email}
                size={36}
                online
                ringColor="var(--sidebar)"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <div className="flex items-center gap-3 px-2 py-2">
              <UserAvatar
                name={user?.name}
                email={user?.email}
                size={32}
                ringColor="var(--popover)"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => nav({ to: "/profile" })}>
              <User className="h-3.5 w-3.5 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                logout();
                nav({ to: "/login" });
              }}
              className="text-loss focus:text-loss"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
