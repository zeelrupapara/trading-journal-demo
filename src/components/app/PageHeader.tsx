import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="border-b border-border px-8 py-5 bg-background/40 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-wide uppercase">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
