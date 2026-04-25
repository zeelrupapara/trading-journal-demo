import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTrades } from "@/lib/trades";
import {
  summarize,
  equityCurve,
  tradesByStrategy,
  pnlBySymbol,
  tradeTime,
  fmtCurrency,
} from "@/lib/stats";
import { PageHeader } from "@/components/app/PageHeader";
import { MetricCard } from "@/components/app/MetricCard";
import { EmptyState } from "@/components/app/EmptyState";
import { CsvImport } from "@/components/app/CsvImport";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { TrendingUp, Target, Activity, Percent, Inbox, TrendingDown, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  contentStyle: {
    background: "oklch(0.16 0.012 250)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--foreground)",
    boxShadow: "0 8px 24px oklch(0 0 0 / 0.5)",
  } as const,
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11, marginBottom: 4 } as const,
  itemStyle: { color: "var(--foreground)" } as const,
  cursor: { fill: "oklch(0.22 0.012 250 / 0.4)" } as const,
};

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STRATEGY_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const { trades } = useTrades();
  const [range, setRange] = useState<"1W" | "1M" | "YTD">("1M");

  const stats = useMemo(() => summarize(trades), [trades]);

  // Equity curve respects the 1W / 1M / YTD selector. We filter the trades
  // first so the curve restarts from $0 at the window start — that's what a
  // trader actually wants to see ("last week's P&L"), not absolute equity.
  const equity = useMemo(() => {
    if (trades.length === 0) return [];
    const latest = Math.max(...trades.map(tradeTime));
    const day = 24 * 3600 * 1000;
    let cutoff: number;
    if (range === "1W") cutoff = latest - 7 * day;
    else if (range === "1M") cutoff = latest - 30 * day;
    else cutoff = +new Date(new Date(latest).getUTCFullYear(), 0, 1);
    return equityCurve(trades.filter((t) => tradeTime(t) >= cutoff));
  }, [trades, range]);

  const strategyData = useMemo(() => tradesByStrategy(trades, STRATEGY_PALETTE), [trades]);
  const symbolPnL = useMemo(() => pnlBySymbol(trades, 8), [trades]);
  const recent = useMemo(
    () => [...trades].sort((a, b) => tradeTime(b) - tradeTime(a)).slice(0, 6),
    [trades],
  );

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Real-time performance snapshot" />
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No data found"
          description="Upload a CSV of your trades to see your equity curve, win rate, P&L by symbol, and more. Until then your cockpit is empty."
          action={<CsvImport variant="hero" />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Overview" subtitle="Real-time performance snapshot" />
      <div className="p-8 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Net P&L"
            value={fmtCurrency(stats.net)}
            tone={stats.net >= 0 ? "profit" : "loss"}
            sub={`${stats.totalTrades} trades · ${stats.wins}W / ${stats.losses}L`}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Win Rate"
            value={`${(stats.winRate * 100).toFixed(1)}%`}
            sub={`${stats.wins} wins of ${stats.totalTrades}`}
            icon={<Percent className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Profit Factor"
            value={stats.profitFactor.toFixed(2)}
            sub={`Gross +$${stats.grossWin.toFixed(0)} / -$${stats.grossLoss.toFixed(0)}`}
            tone={stats.profitFactor >= 1 ? "profit" : "loss"}
            icon={<Target className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Expectancy"
            value={fmtCurrency(stats.expectancy)}
            tone={stats.expectancy >= 0 ? "profit" : "loss"}
            sub="per trade, on average"
            icon={<Coins className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Max Drawdown"
            value={fmtCurrency(stats.maxDrawdown)}
            tone="loss"
            sub="peak-to-trough on equity"
            icon={<TrendingDown className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Avg R:R"
            value={`1 : ${(stats.avgWin / (stats.avgLoss || 1)).toFixed(2)}`}
            sub={`Avg win $${stats.avgWin.toFixed(0)} · loss $${stats.avgLoss.toFixed(0)}`}
            icon={<Activity className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Equity + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="metric-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold">Cumulative Equity</h3>
              <div className="flex bg-secondary/60 rounded-md p-0.5">
                {(["1W", "1M", "YTD"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "px-3 py-1 text-[11px] rounded font-medium transition-colors",
                      range === r
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equity}>
                  <defs>
                    <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
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
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Equity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#eqg)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="metric-card p-5">
            <h3 className="text-xs uppercase tracking-widest font-semibold mb-4">
              Strategy Allocation
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {strategyData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    formatter={(v: number, name: string) => [
                      `${v} trade${v === 1 ? "" : "s"}`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {strategyData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-mono">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* P&L by symbol + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="metric-card p-5">
            <h3 className="text-xs uppercase tracking-widest font-semibold mb-4">P&L by Symbol</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbolPnL} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    cursor={tooltipStyle.cursor}
                    formatter={(v: number) => [fmtCurrency(v), "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                    {symbolPnL.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="metric-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-widest font-semibold">Recent Executions</h3>
              <Link to="/journal" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-1">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  to="/trade/$id"
                  params={{ id: t.id }}
                  className="grid grid-cols-12 items-center gap-2 px-2 py-2 rounded hover:bg-accent/40 transition-colors text-sm"
                >
                  <span className="col-span-3 text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(t.entryTime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="col-span-3 font-mono font-medium">{t.symbol}</span>
                  <span
                    className={cn(
                      "col-span-2 text-[10px] font-mono px-1.5 py-0.5 rounded text-center",
                      t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                    )}
                  >
                    {t.side}
                  </span>
                  <span
                    className={cn(
                      "col-span-4 text-right font-mono font-medium tabular-nums",
                      t.pnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {fmtCurrency(t.pnl)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
