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

// Flexible header mapping — accept multiple broker conventions.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "datetime", "time", "timestamp", "execution time", "trade date", "opened", "open time", "closed"],
  symbol: ["symbol", "ticker", "instrument", "asset", "pair"],
  side: ["side", "direction", "action", "type", "position"],
  qty: ["qty", "quantity", "size", "shares", "amount", "volume", "contracts"],
  entry: ["entry", "entry price", "open price", "buy price", "avg entry", "price in"],
  exit: ["exit", "exit price", "close price", "sell price", "avg exit", "price out"],
  pnl: ["pnl", "p&l", "p/l", "profit", "net", "net pnl", "realized pnl", "result"],
  strategy: ["strategy", "setup", "playbook", "tag"],
  notes: ["notes", "note", "comment", "comments", "description"],
};

function buildKeyMap(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.trim().toLowerCase();
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const hit = headers.find(h => aliases.includes(norm(h)));
    if (hit) map[canonical] = hit;
  }
  return map;
}

function parseSide(raw: string | undefined): Side {
  const v = (raw || "").trim().toLowerCase();
  if (["short", "sell", "s", "sld"].includes(v)) return "SHORT";
  return "LONG";
}

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
          const headers = res.meta.fields || [];
          const km = buildKeyMap(headers);
          if (!km.symbol || !km.date) {
            toast.error("CSV needs at least a date and symbol column.");
            setBusy(false);
            return;
          }
          const get = (r: Record<string, string>, k: string) => (km[k] ? r[km[k]] : undefined);
          const trades: Trade[] = res.data
            .filter(r => get(r, "symbol") && get(r, "date"))
            .map((r, i) => {
              const entry = parseFloat(get(r, "entry") || "0");
              const exit = parseFloat(get(r, "exit") || "0");
              const qty = parseFloat(get(r, "qty") || "0");
              const side = parseSide(get(r, "side"));
              const rawPnl = (get(r, "pnl") || "").replace(/[$,()\s]/g, "");
              let pnl = parseFloat(rawPnl);
              if (isNaN(pnl)) {
                pnl = (side === "LONG" ? exit - entry : entry - exit) * qty;
              }
              const dateRaw = get(r, "date") || "";
              const parsedDate = new Date(dateRaw);
              return {
                id: `imp-${Date.now()}-${i}`,
                date: isNaN(+parsedDate) ? new Date().toISOString() : parsedDate.toISOString(),
                symbol: (get(r, "symbol") || "").toUpperCase().trim(),
                side,
                qty,
                entry,
                exit,
                pnl,
                strategy: ((get(r, "strategy") || "Unassigned") as Strategy),
                notes: get(r, "notes"),
              };
            });
          if (!trades.length) {
            toast.error("No valid rows found in CSV.");
            setBusy(false);
            return;
          }
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
