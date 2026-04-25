import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label, value, sub, tone = "neutral", icon, className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "profit" | "loss";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("metric-card p-4 relative overflow-hidden", className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={cn(
        "text-2xl font-mono font-semibold tabular-nums",
        tone === "profit" && "text-profit",
        tone === "loss" && "text-loss",
      )}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground font-mono mt-1">{sub}</div>}
    </div>
  );
}
