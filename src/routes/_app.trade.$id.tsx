import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTrades, fmtCurrency, fmtCurrencyPlain } from "@/lib/trades";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TradingViewChart } from "@/components/app/TradingViewChart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trade/$id")({
  component: TradeDetail,
  notFoundComponent: () => <div className="p-12 text-center text-muted-foreground">Trade not found</div>,
});

function TradeDetail() {
  const { id } = Route.useParams();
  const { getById } = useTrades();
  const nav = useNavigate();
  const t = getById(id);

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
                <span className="text-[10px] font-mono text-muted-foreground">
                  Entry {t.entry.toFixed(2)} → Exit {t.exit.toFixed(2)}
                </span>
              </div>
              <a href={tvUrl} target="_blank" rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                Open in TradingView <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <TradingViewChart symbol={t.symbol} height={420} interval="60" />
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
