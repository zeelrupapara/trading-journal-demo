import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-1 items-center justify-center px-6 py-16", className)}>
      <div className="metric-card relative w-full max-w-xl overflow-hidden p-10 text-center">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        {icon && (
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-6 flex items-center justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
