import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useTrades } from "@/lib/trades";
import { fmtCurrency, fmtCurrencyPlain, returnPct, tradeTime } from "@/lib/stats";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { TradeChart } from "@/components/app/TradeChart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trade/$id")({
  component: TradeDetail,
  notFoundComponent: () => (
    <div className="p-12 text-center text-muted-foreground">Trade not found</div>
  ),
});

function TradeDetail() {
  const { id } = Route.useParams();
  const { trades, getById } = useTrades();
  const nav = useNavigate();
  const t = getById(id);

  // Sort by entry time ascending so "prev" = older, "next" = newer.
  const sorted = useMemo(() => [...trades].sort((a, b) => tradeTime(a) - tradeTime(b)), [trades]);
  const idx = sorted.findIndex((x) => x.id === id);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        nav({ to: "/trade/$id", params: { id: prev.id } });
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        nav({ to: "/trade/$id", params: { id: next.id } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, nav]);

  if (!t) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">Trade not found.</p>
        <Button onClick={() => nav({ to: "/journal" })} className="mt-4">
          Back to Journal
        </Button>
      </div>
    );
  }

  const tvUrl = `https://www.tradingview.com/symbols/${t.symbol}/`;
  const ret = returnPct(t);

  return (
    <>
      <PageHeader
        title={`${t.symbol} · ${t.side}`}
        subtitle={new Date(t.entryTime).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!prev}
                onClick={() => prev && nav({ to: "/trade/$id", params: { id: prev.id } })}
                aria-label="Previous trade"
                title={prev ? `← ${prev.symbol}` : "No previous trade"}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums px-1 min-w-[3.5rem] text-center">
                {idx >= 0 ? `${idx + 1} / ${sorted.length}` : "—"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!next}
                onClick={() => next && nav({ to: "/trade/$id", params: { id: next.id } })}
                aria-label="Next trade"
                title={next ? `→ ${next.symbol}` : "No next trade"}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/journal">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </Link>
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {/* Top: chart + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="metric-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-mono font-semibold text-lg">{t.symbol}</h3>
                <span
                  className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded",
                    t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                  )}
                >
                  {t.side}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Entry {t.entry.toFixed(2)} → Exit {t.exit.toFixed(2)}
                </span>
              </div>
              <a
                href={tvUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                Open in TradingView <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <TradeChart
              symbol={t.symbol}
              side={t.side}
              entryDate={t.entryTime}
              exitDate={t.exitTime ?? t.entryTime}
              entryPrice={t.entry}
              exitPrice={t.exit}
              height={420}
            />
          </div>

          <div className="space-y-3">
            <div className="metric-card p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Gross P&L
              </div>
              <div
                className={cn(
                  "text-3xl font-mono font-semibold tabular-nums",
                  t.pnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {fmtCurrency(t.pnl)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {t.qty} shares · {ret.toFixed(2)}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Entry
                </div>
                <div className="font-mono font-semibold">{fmtCurrencyPlain(t.entry)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Exit
                </div>
                <div className="font-mono font-semibold">{fmtCurrencyPlain(t.exit)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Volume
                </div>
                <div className="font-mono font-semibold">{t.qty} sh</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                  Return
                </div>
                <div
                  className={cn(
                    "font-mono font-semibold",
                    t.pnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {(ret >= 0 ? "+" : "") + ret.toFixed(2) + "%"}
                </div>
              </div>
            </div>

            <div className="metric-card p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Strategy
              </div>
              <div className="text-sm">{t.strategy}</div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {t.notes && (
          <div className="metric-card p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Trade Notes
            </div>
            <p className="text-sm leading-relaxed">{t.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
