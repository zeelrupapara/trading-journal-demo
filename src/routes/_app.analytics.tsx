import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTrades } from "@/lib/trades";
import { fmtCurrency, pnlByDay, tradeTime } from "@/lib/stats";
import { PageHeader } from "@/components/app/PageHeader";
import { MetricCard } from "@/components/app/MetricCard";
import { EmptyState } from "@/components/app/EmptyState";
import { CsvImport } from "@/components/app/CsvImport";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { trades } = useTrades();
  const today = new Date();

  // Default cursor: month of the most recent trade if any, else current month.
  // This way the calendar always lights up on first render after import — no hunting back through months.
  const [cursor, setCursor] = useState(() => {
    if (trades.length > 0) {
      const latestMs = trades.reduce((m, t) => Math.max(m, tradeTime(t)), 0);
      const d = new Date(latestMs);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // After a fresh import (trades count goes 0 → N), snap to the latest trade's month
  // so the user sees their data immediately. Subsequent navigation by the user is preserved.
  const prevTradesCount = useRef(trades.length);
  useEffect(() => {
    const wasEmpty = prevTradesCount.current === 0;
    prevTradesCount.current = trades.length;
    if (wasEmpty && trades.length > 0) {
      const latestMs = trades.reduce((m, t) => Math.max(m, tradeTime(t)), 0);
      const d = new Date(latestMs);
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [trades.length, trades]);

  const dayMap = useMemo(() => pnlByDay(trades), [trades]);

  // Build calendar grid (Mon-Sun)
  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startDay = (first.getDay() + 6) % 7; // Mon=0
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null });
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  // Month stats
  const monthStats = useMemo(() => {
    const inMonth = trades.filter((t) => {
      const d = new Date(tradeTime(t));
      return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
    });
    const wins = inMonth.filter((t) => t.pnl > 0);
    const net = inMonth.reduce((s, t) => s + t.pnl, 0);
    const best = inMonth.reduce((b, t) => (t.pnl > (b?.pnl ?? -Infinity) ? t : b), inMonth[0]);
    const worst = inMonth.reduce((b, t) => (t.pnl < (b?.pnl ?? Infinity) ? t : b), inMonth[0]);
    const days = new Set(inMonth.map((t) => new Date(tradeTime(t)).toDateString())).size;
    return {
      net,
      trades: inMonth.length,
      winRate: inMonth.length ? (wins.length / inMonth.length) * 100 : 0,
      best,
      worst,
      activeDays: days,
    };
  }, [trades, cursor]);

  const dailyBar = useMemo(() => {
    return monthGrid
      .filter((c) => c.date)
      .map((c) => {
        const stat = dayMap.get(c.date!.toDateString());
        return { day: c.date!.getDate(), pnl: stat?.pnl || 0 };
      })
      .filter((d) => d.pnl !== 0);
  }, [monthGrid, dayMap]);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (trades.length === 0) {
    return (
      <>
        <PageHeader
          title="Performance Calendar"
          subtitle="Daily P&L heatmap of your trading activity"
        />
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No data found"
          description="Your performance calendar lights up green and red as you trade. Import a CSV to populate the month view, daily P&L, and best/worst day stats."
          action={<CsvImport variant="hero" />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Performance Calendar"
        subtitle="Daily P&L heatmap of your trading activity"
      />
      <div className="p-8 space-y-6">
        {/* Calendar — hero element */}
        <div className="metric-card p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="h-8 w-8 rounded border border-border hover:bg-accent/50 flex items-center justify-center"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-base font-semibold uppercase tracking-wider px-3">
                {monthLabel}
              </span>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="h-8 w-8 rounded border border-border hover:bg-accent/50 flex items-center justify-center"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="ml-2 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent/50 uppercase tracking-wider font-medium"
              >
                Today
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  Month Net
                </div>
                <div
                  className={cn(
                    "text-lg font-mono font-semibold tabular-nums",
                    monthStats.net >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {fmtCurrency(monthStats.net)}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--profit)" }} />
                  Profit
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--loss)" }} />
                  Loss
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
              <div
                key={d}
                className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 pb-1 text-center"
              >
                {d}
              </div>
            ))}
            {monthGrid.map((c, i) => {
              if (!c.date) return <div key={i} className="min-h-[88px] rounded bg-secondary/10" />;
              const stat = dayMap.get(c.date.toDateString());
              const isToday = c.date.toDateString() === today.toDateString();
              const tone = stat ? (stat.pnl >= 0 ? "profit" : "loss") : null;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[88px] rounded-md p-2.5 flex flex-col justify-between border transition-all hover:scale-[1.02]",
                    isToday && "ring-1 ring-primary",
                    tone === "profit" && "bg-profit/20 border-profit/40",
                    tone === "loss" && "bg-loss/20 border-loss/40",
                    !tone && "bg-secondary/15 border-border/40",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span className={cn("text-xs font-semibold", isToday && "text-primary")}>
                      {c.date.getDate()}
                    </span>
                    {stat && (
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {stat.count}t
                      </span>
                    )}
                  </div>
                  {stat && (
                    <div
                      className={cn(
                        "text-xs font-mono font-bold tabular-nums truncate",
                        stat.pnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {fmtCurrency(stat.pnl)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Month KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label={`Net P&L · ${cursor.toLocaleDateString("en-US", { month: "short" })}`}
            value={fmtCurrency(monthStats.net)}
            tone={monthStats.net >= 0 ? "profit" : "loss"}
            sub={`${monthStats.trades} trades · ${monthStats.activeDays} days`}
          />
          <MetricCard
            label="Win Rate"
            value={`${monthStats.winRate.toFixed(1)}%`}
            sub="this month"
          />
          <MetricCard
            label="Best Day"
            value={monthStats.best ? fmtCurrency(monthStats.best.pnl) : "—"}
            tone="profit"
            sub={
              monthStats.best
                ? `${monthStats.best.symbol} · ${new Date(monthStats.best.entryTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : ""
            }
          />
          <MetricCard
            label="Worst Day"
            value={monthStats.worst ? fmtCurrency(monthStats.worst.pnl) : "—"}
            tone="loss"
            sub={
              monthStats.worst
                ? `${monthStats.worst.symbol} · ${new Date(monthStats.worst.entryTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : ""
            }
          />
        </div>

        {/* Daily P&L bar */}
        <div className="metric-card p-5">
          <h3 className="text-xs uppercase tracking-widest font-semibold mb-4">
            Daily P&L · {monthLabel}
          </h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.012 250)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--foreground)",
                    boxShadow: "0 8px 24px oklch(0 0 0 / 0.5)",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 4 }}
                  itemStyle={{ color: "var(--foreground)" }}
                  cursor={{ fill: "oklch(0.22 0.012 250 / 0.4)" }}
                  formatter={(v: number) => [fmtCurrency(v), "Net P&L"]}
                  labelFormatter={(v) => `Day ${v}`}
                />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {dailyBar.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
