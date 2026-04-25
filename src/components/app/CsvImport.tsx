import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";
import { useTrades } from "@/lib/trades";
import { parseTradesCsv, CsvParseError } from "@/lib/csv";
import { toast } from "sonner";

type CsvImportProps = {
  variant?: "compact" | "hero" | "sidebar";
  onImported?: (count: number) => void;
};

export function CsvImport({ variant = "compact", onImported }: CsvImportProps = {}) {
  const inp = useRef<HTMLInputElement>(null);
  const { addTrades } = useTrades();
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const { trades, skipped: parseSkipped } = await parseTradesCsv(file);
      if (trades.length === 0) {
        toast.error("No valid rows found in CSV.");
        return;
      }
      const { added, skipped: dupSkipped } = addTrades(trades);
      const skipped = parseSkipped + dupSkipped;
      if (added === 0) {
        toast.info(`No new trades — ${skipped} duplicates skipped.`);
      } else {
        toast.success(
          `Imported ${added} trade${added === 1 ? "" : "s"}` +
            (skipped > 0 ? ` · ${skipped} skipped` : ""),
        );
      }
      onImported?.(added);
    } catch (e) {
      const msg = e instanceof CsvParseError || e instanceof Error ? e.message : "invalid CSV";
      toast.error("Import failed: " + msg);
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = () => {
    // Served from /public — 10,000 real trades against actual Yahoo 5m bars,
    // Mar–Apr 2026, across 30 symbols. ~1.2 MB.
    const a = document.createElement("a");
    a.href = "/sample-trades-10000.csv";
    a.download = "sample-trades-10000.csv";
    a.click();
  };

  const fileInput = (
    <input
      ref={inp}
      type="file"
      accept=".csv,text/csv"
      data-testid="csv-file-input"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.currentTarget.value = "";
      }}
    />
  );

  if (variant === "hero") {
    return (
      <>
        {fileInput}
        <Button size="lg" onClick={() => inp.current?.click()} disabled={busy} className="px-6">
          <Upload className="h-4 w-4 mr-2" />
          {busy ? "Importing…" : "Import Trades CSV"}
        </Button>
        <Button size="lg" variant="outline" onClick={downloadSample} disabled={busy}>
          <Download className="h-4 w-4 mr-2" />
          Download Sample
        </Button>
      </>
    );
  }

  if (variant === "sidebar") {
    return (
      <>
        {fileInput}
        <Button
          size="sm"
          onClick={() => inp.current?.click()}
          disabled={busy}
          className="w-full justify-center"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {busy ? "Importing…" : "Import Trades"}
        </Button>
      </>
    );
  }

  return (
    <>
      {fileInput}
      <Button variant="outline" size="sm" onClick={downloadSample}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Sample CSV
      </Button>
      <Button size="sm" onClick={() => inp.current?.click()} disabled={busy}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {busy ? "Importing…" : "Import Trades"}
      </Button>
    </>
  );
}
