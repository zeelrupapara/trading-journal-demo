import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTrades, fmtCurrency } from "@/lib/trades";
import { PageHeader } from "@/components/app/PageHeader";
import { MetricCard } from "@/components/app/MetricCard";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, Target, Activity, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { trades } = useTrades();
  const [range, setRange] = useState<"1W" | "1M" | "YTD">("1M");

  const stats = useMemo(() => {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const net = trades.reduce((s, t) => s + t.pnl, 0);
    const gross = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      net,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      profitFactor: grossLoss ? gross / grossLoss : gross,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      gross, grossLoss,
      avgWin: wins.length ? gross / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
    };
  }, [trades]);

  const equity = useMemo(() => {
    const sorted = [...trades].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    let running = 0;
    return sorted.map(t => {
      running += t.pnl;
      return { date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), equity: running };
    });
  }, [trades]);

  const strategyData = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => map.set(t.strategy, (map.get(t.strategy) || 0) + 1));
    const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
    return Array.from(map.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [trades]);

  const symbolPnL = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => map.set(t.symbol, (map.get(t.symbol) || 0) + t.pnl));
    return Array.from(map.entries())
      .map(([symbol, pnl]) => ({ symbol, pnl }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 8);
  }, [trades]);

  return (
    <>
      <PageHeader title="Overview" subtitle="Real-time performance snapshot" />
      <div className="p-8 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Net P&L"
            value={fmtCurrency(stats.net)}
            tone={stats.net >= 0 ? "profit" : "loss"}
            sub={`${stats.totalTrades} trades · ${stats.wins}W / ${stats.losses}L`}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            sub={`${stats.wins} wins of ${stats.totalTrades}`}
            icon={<Percent className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Profit Factor"
            value={stats.profitFactor.toFixed(2)}
            sub={`Gross +$${stats.gross.toFixed(0)} / -$${stats.grossLoss.toFixed(0)}`}
            tone={stats.profitFactor >= 1 ? "profit" : "loss"}
            icon={<Target className="h-3.5 w-3.5" />}
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
                {(["1W", "1M", "YTD"] as const).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={cn(
                      "px-3 py-1 text-[11px] rounded font-medium transition-colors",
                      range === r ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}>{r}</button>
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
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Equity"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="var(--chart-1)" strokeWidth={2} fill="url(#eqg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="metric-card p-5">
            <h3 className="text-xs uppercase tracking-widest font-semibold mb-4">Strategy Allocation</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={strategyData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {strategyData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
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
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="symbol" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
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
              <Link to="/journal" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="space-y-1">
              {trades.slice(0, 6).map(t => (
                <Link key={t.id} to="/trade/$id" params={{ id: t.id }}
                  className="grid grid-cols-12 items-center gap-2 px-2 py-2 rounded hover:bg-accent/40 transition-colors text-sm">
                  <span className="col-span-3 font-mono font-medium">{t.symbol}</span>
                  <span className={cn("col-span-2 text-[10px] font-mono px-1.5 py-0.5 rounded text-center",
                    t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                  )}>{t.side}</span>
                  <span className="col-span-3 text-xs text-muted-foreground font-mono">{t.qty}</span>
                  <span className={cn("col-span-4 text-right font-mono font-medium tabular-nums",
                    t.pnl >= 0 ? "text-profit" : "text-loss"
                  )}>{fmtCurrency(t.pnl)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
