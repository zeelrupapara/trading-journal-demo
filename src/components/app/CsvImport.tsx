import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";
import { useTrades, type Trade, type Side, type Strategy } from "@/lib/trades";
import { toast } from "sonner";

const SAMPLE_CSV = `date,symbol,side,qty,entry,exit,pnl,strategy,notes
2025-04-12T13:30:00Z,COIN,LONG,80,245.10,251.40,504,Strategy 1,Breakout from consolidation
2025-04-11T15:00:00Z,SPY,SHORT,150,512.40,510.10,345,Strategy 2,Mean reversion at resistance
2025-04-10T14:15:00Z,AMD,LONG,200,158.20,156.50,-340,Strategy 3,Stopped out
`;

export function CsvImport() {
  const inp = useRef<HTMLInputElement>(null);
  const { addTrades } = useTrades();
  const [busy, setBusy] = useState(false);

  const onFile = (file: File) => {
    setBusy(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const trades: Trade[] = res.data
            .filter(r => r.symbol && r.date)
            .map((r, i) => {
              const entry = parseFloat(r.entry || "0");
              const exit = parseFloat(r.exit || "0");
              const qty = parseFloat(r.qty || "0");
              const side = ((r.side || "LONG").toUpperCase() as Side);
              let pnl = parseFloat(r.pnl || "");
              if (isNaN(pnl)) {
                pnl = (side === "LONG" ? exit - entry : entry - exit) * qty;
              }
              return {
                id: `imp-${Date.now()}-${i}`,
                date: new Date(r.date).toISOString(),
                symbol: r.symbol.toUpperCase(),
                side,
                qty,
                entry,
                exit,
                pnl,
                strategy: (r.strategy || "Unassigned") as Strategy,
                notes: r.notes,
              };
            });
          addTrades(trades);
          toast.success(`Imported ${trades.length} trade${trades.length === 1 ? "" : "s"}`);
        } catch (e: any) {
          toast.error("Import failed: " + (e?.message || "invalid CSV"));
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        toast.error("Parse error: " + err.message);
        setBusy(false);
      }
    });
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sample-trades.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <input ref={inp} type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
      <Button variant="outline" size="sm" onClick={downloadSample}>
        <Download className="h-3.5 w-3.5 mr-1.5" />Sample CSV
      </Button>
      <Button size="sm" onClick={() => inp.current?.click()} disabled={busy}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />{busy ? "Importing..." : "Import Trades"}
      </Button>
    </>
  );
}
