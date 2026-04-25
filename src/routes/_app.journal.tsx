import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTrades, fmtCurrency, type Strategy } from "@/lib/trades";
import { PageHeader } from "@/components/app/PageHeader";
import { CsvImport } from "@/components/app/CsvImport";
import { Sparkline } from "@/components/app/Sparkline";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/journal")({
  component: JournalPage,
});

const STRATS: Strategy[] = ["Unassigned", "Strategy 1", "Strategy 2", "Strategy 3"];

// deterministic mini price path entry → exit, for the sparkline cell
function miniSeries(entry: number, exit: number, seed: number) {
  const n = 16;
  let s = seed || 1;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const noise = Math.max(Math.abs(exit - entry) * 0.35, entry * 0.002);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(entry + (exit - entry) * t + (rand() - 0.5) * noise);
  }
  return out;
}

function JournalPage() {
  const { trades, setStrategy, remove } = useTrades();
  const [q, setQ] = useState("");
  const [filterStrat, setFilterStrat] = useState<string>("all");
  const [filterSide, setFilterSide] = useState<string>("all");

  const filtered = useMemo(() => {
    return trades
      .filter(t => filterStrat === "all" || t.strategy === filterStrat)
      .filter(t => filterSide === "all" || t.side === filterSide)
      .filter(t => !q || t.symbol.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [trades, q, filterStrat, filterSide]);

  return (
    <>
      <PageHeader
        title="Trade Journal"
        subtitle={`${filtered.length} of ${trades.length} trades`}
        actions={<CsvImport />}
      />
      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search symbol..." className="pl-9 bg-input/50" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={filterStrat} onValueChange={setFilterStrat}>
            <SelectTrigger className="w-[180px] bg-input/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              {STRATS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSide} onValueChange={setFilterSide}>
            <SelectTrigger className="w-[140px] bg-input/50"><SelectValue /></SelectTrigger>
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
                  <th className="px-4 py-3 text-center font-semibold">Trend</th>
                  <th className="px-4 py-3 text-right font-semibold">P&L</th>
                  <th className="px-4 py-3 text-left font-semibold">Strategy</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/trade/$id" params={{ id: t.id }} className="font-mono font-semibold text-primary hover:underline">
                        {t.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded",
                        t.side === "LONG" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                      )}>{t.side}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{t.qty}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{t.entry.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{t.exit.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Sparkline
                          data={miniSeries(t.entry, t.exit, Array.from(t.symbol).reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(t.entry))}
                          positive={t.pnl >= 0}
                        />
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono font-semibold tabular-nums",
                      t.pnl >= 0 ? "text-profit" : "text-loss"
                    )}>{fmtCurrency(t.pnl)}</td>
                    <td className="px-4 py-3">
                      <Select value={t.strategy} onValueChange={(v) => setStrategy(t.id, v as Strategy)}>
                        <SelectTrigger className="h-7 text-xs w-[130px] bg-secondary/40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STRATS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => remove(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-sm">No trades match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
