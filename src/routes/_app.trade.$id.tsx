import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTrades, fmtCurrency, fmtCurrencyPlain } from "@/lib/trades";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trade/$id")({
  component: TradeDetail,
  notFoundComponent: () => <div className="p-12 text-center text-muted-foreground">Trade not found</div>,
});

// deterministic synthetic intraday price series around entry/exit
function buildSeries(entry: number, exit: number, side: "LONG" | "SHORT", seed: number) {
  const points = 60;
  const spread = Math.abs(exit - entry);
  const noise = Math.max(spread * 0.4, entry * 0.003);
  // simple LCG
  let s = seed || 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const startPrice = entry - (rand() * noise);
  const data = [];
  const entryIdx = Math.floor(points * 0.25);
  const exitIdx = Math.floor(points * 0.85);
  let price = startPrice;
  for (let i = 0; i < points; i++) {
    let target;
    if (i < entryIdx) target = entry + (rand() - 0.5) * noise;
    else if (i < exitIdx) {
      const t = (i - entryIdx) / (exitIdx - entryIdx);
      target = entry + (exit - entry) * t + (rand() - 0.5) * noise * 0.6;
    } else target = exit + (rand() - 0.5) * noise * 0.5;
    price = price * 0.6 + target * 0.4;
    data.push({
      t: i,
      time: new Date(Date.now() - (points - i) * 60000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      price: +price.toFixed(2),
    });
  }
  return data;
}

function TradeDetail() {
  const { id } = Route.useParams();
  const { getById } = useTrades();
  const nav = useNavigate();
  const t = getById(id);

  const series = useMemo(() => {
    if (!t) return [];
    const seed = Array.from(t.symbol).reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(t.entry);
    return buildSeries(t.entry, t.exit, t.side, seed);
  }, [t]);

  if (!t) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">Trade not found.</p>
        <Button onClick={() => nav({ to: "/journal" })} className="mt-4">Back to Journal</Button>
      </div>
    );
  }

  const tvUrl = `https://www.tradingview.com/symbols/${t.symbol}/`;
  const rMultiple = t.exit !== t.entry ? Math.abs((t.exit - t.entry) / (t.entry * 0.005)) : 0;

  return (
    <>
      <PageHeader
        title={`${t.symbol} · ${t.side}`}
        subtitle={new Date(t.date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/journal"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back</Link>
          </Button>
        }
      />
      <div className="p-8 space-y-6">
        {/* Top: chart + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="metric-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-mono font-semibold text-lg">{t.symbol}</h3>
                <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded",
                  t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                )}>{t.side}</span>
              </div>
              <a href={tvUrl} target="_blank" rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                Open in TradingView <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.pnl >= 0 ? "var(--profit)" : "var(--loss)"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={t.pnl >= 0 ? "var(--profit)" : "var(--loss)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
                    interval={Math.floor(series.length / 6)} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tickFormatter={(v) => v.toFixed(2)} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                  />
                  <ReferenceLine y={t.entry} stroke="var(--chart-1)" strokeDasharray="4 4" label={{ value: `ENTRY ${t.entry.toFixed(2)}`, position: "insideLeft", fill: "var(--chart-1)", fontSize: 10 }} />
                  <ReferenceLine y={t.exit} stroke={t.pnl >= 0 ? "var(--profit)" : "var(--loss)"} strokeDasharray="4 4"
                    label={{ value: `EXIT ${t.exit.toFixed(2)}`, position: "insideRight", fill: t.pnl >= 0 ? "var(--profit)" : "var(--loss)", fontSize: 10 }} />
                  <Area type="monotone" dataKey="price" stroke={t.pnl >= 0 ? "var(--profit)" : "var(--loss)"} strokeWidth={2} fill="url(#pg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <div className="metric-card p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Gross P&L</div>
              <div className={cn("text-3xl font-mono font-semibold tabular-nums", t.pnl >= 0 ? "text-profit" : "text-loss")}>
                {fmtCurrency(t.pnl)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {t.qty} shares · {((t.exit - t.entry) / t.entry * 100 * (t.side === "LONG" ? 1 : -1)).toFixed(2)}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Entry</div>
                <div className="font-mono font-semibold">{fmtCurrencyPlain(t.entry)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Exit</div>
                <div className="font-mono font-semibold">{fmtCurrencyPlain(t.exit)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Volume</div>
                <div className="font-mono font-semibold">{t.qty} sh</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">R Multiple</div>
                <div className={cn("font-mono font-semibold", t.pnl >= 0 ? "text-profit" : "text-loss")}>
                  {t.pnl >= 0 ? "+" : "-"}{rMultiple.toFixed(2)}R
                </div>
              </div>
            </div>

            <div className="metric-card p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Strategy</div>
              <div className="text-sm">{t.strategy}</div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {t.notes && (
          <div className="metric-card p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Trade Notes</div>
            <p className="text-sm leading-relaxed">{t.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
