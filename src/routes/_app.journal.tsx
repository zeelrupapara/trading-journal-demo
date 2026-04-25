import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTrades, STRATEGIES, type Strategy } from "@/lib/trades";
import { fmtCurrency, fmtPct, returnPct, tradeTime } from "@/lib/stats";
import { PageHeader } from "@/components/app/PageHeader";
import { CsvImport } from "@/components/app/CsvImport";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Trash2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [25, 50, 100, 200] as const;

export const Route = createFileRoute("/_app/journal")({
  component: JournalPage,
});

// Use the canonical list from the trade store so adding a new strategy in one place propagates.
const STRATS = STRATEGIES;

function JournalPage() {
  const { trades, setStrategy, remove } = useTrades();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [filterStrat, setFilterStrat] = useState<string>("all");
  const [filterSide, setFilterSide] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return trades
      .filter((t) => filterStrat === "all" || t.strategy === filterStrat)
      .filter((t) => filterSide === "all" || t.side === filterSide)
      .filter((t) => !q || t.symbol.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => tradeTime(b) - tradeTime(a));
  }, [trades, q, filterStrat, filterSide]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * pageSize;
  const visible = useMemo(
    () => filtered.slice(pageStart, pageStart + pageSize),
    [filtered, pageStart, pageSize],
  );

  // Snap back to page 0 whenever the filtered set shrinks below the current page.
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);
  // Reset to page 0 when filters change.
  useEffect(() => {
    setPage(0);
  }, [q, filterStrat, filterSide, pageSize]);

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Trade Journal" subtitle="No trades imported yet" />
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No data found"
          description="Your trade journal is empty. Import a CSV to load your trade history — we'll auto-detect columns from most broker formats (TradingView, IBKR, Webull, etc.)."
          action={<CsvImport variant="hero" />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Trade Journal"
        subtitle={`${filtered.length} of ${trades.length} trades`}
      />
      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              className="pl-9 bg-input/50"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={filterStrat} onValueChange={setFilterStrat}>
            <SelectTrigger className="w-[200px] bg-input/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              {STRATS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSide} onValueChange={setFilterSide}>
            <SelectTrigger className="w-[140px] bg-input/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sides</SelectItem>
              <SelectItem value="LONG">Long</SelectItem>
              <SelectItem value="SHORT">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="metric-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                  <th className="px-4 py-3 text-left font-semibold">Side</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Entry</th>
                  <th className="px-4 py-3 text-right font-semibold">Exit</th>
                  <th className="px-4 py-3 text-right font-semibold">Return</th>
                  <th className="px-4 py-3 text-right font-semibold">P&L</th>
                  <th className="px-4 py-3 text-left font-semibold">Strategy</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr
                    key={t.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => nav({ to: "/trade/$id", params: { id: t.id } })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        nav({ to: "/trade/$id", params: { id: t.id } });
                      }
                    }}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors group cursor-pointer focus:outline-none focus-visible:bg-accent/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.entryTime).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-primary">{t.symbol}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded",
                          t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss",
                        )}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{t.qty}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {t.entry.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {t.exit.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono tabular-nums",
                        t.pnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {fmtPct(returnPct(t))}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-semibold tabular-nums",
                        t.pnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {fmtCurrency(t.pnl)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.strategy}
                        onValueChange={(v) => setStrategy(t.id, v as Strategy)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[160px] bg-secondary/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STRATS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(t.id);
                        }}
                        aria-label="Delete trade"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-muted-foreground text-sm"
                    >
                      No trades match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}
                </span>
                <span>of</span>
                <span className="font-mono tabular-nums">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Rows</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-7 w-[72px] text-xs bg-secondary/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="First page"
                    disabled={safePage === 0}
                    onClick={() => setPage(0)}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Previous page"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums px-2 min-w-[70px] text-center">
                    {safePage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Next page"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Last page"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage(totalPages - 1)}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
