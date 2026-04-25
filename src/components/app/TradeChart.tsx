import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchOhlc, type Interval } from "@/lib/ohlc";
import { cn } from "@/lib/utils";

type Props = {
  symbol: string;
  side: "LONG" | "SHORT";
  entryDate: string; // ISO
  exitDate?: string; // ISO; if omitted, same as entryDate
  entryPrice: number;
  exitPrice: number;
  height?: number;
};

const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "1d"];

/**
 * Candlestick chart with explicit Entry / Exit markers drawn on the bars.
 *
 * Uses TradingView's open-source `lightweight-charts` library + Yahoo Finance
 * daily OHLC. Unlike the closed-source embed widget, this lets us call
 * `setMarkers()` to place the green ▲ entry / red ▼ exit arrows directly on
 * the price action, which is what a trader actually wants to see when
 * reviewing a trade.
 */
export function TradeChart({
  symbol,
  side,
  entryDate,
  exitDate,
  entryPrice,
  exitPrice,
  height = 420,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [interval, setIntervalState] = useState<Interval>("5m");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Candlestick"> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    const entryUnix = Math.floor(new Date(entryDate).getTime() / 1000);
    const exitUnix = exitDate ? Math.floor(new Date(exitDate).getTime() / 1000) : entryUnix;
    const from = Math.min(entryUnix, exitUnix);
    const to = Math.max(entryUnix, exitUnix);

    (async () => {
      setStatus("loading");
      let candles;
      try {
        candles = await fetchOhlc({ data: { symbol, from, to, interval } });
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;
      if (!candles || candles.length === 0) {
        setStatus("empty");
        return;
      }

      const intraday = interval !== "1d";

      chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: "#8A929E",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: {
          borderColor: "rgba(255,255,255,0.08)",
          rightOffset: 4,
          timeVisible: intraday,
          secondsVisible: false,
        },
        crosshair: { mode: 0 },
      });

      series = chart.addSeries(CandlestickSeries, {
        upColor: "#16C784",
        downColor: "#EA3943",
        borderUpColor: "#16C784",
        borderDownColor: "#EA3943",
        wickUpColor: "#16C784",
        wickDownColor: "#EA3943",
      });

      series.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );

      // Snap entry / exit timestamps to the nearest bar.
      // - Intraday: pick the bar with smallest absolute time diff (minute-precise).
      // - Daily:   prefer the bar that falls on the same calendar date, fall back to nearest.
      const snap = (target: number) => {
        let nearest = candles[0].time;
        let bestDiff = Infinity;
        if (!intraday) {
          const tDate = new Date(target * 1000).toISOString().slice(0, 10);
          for (const c of candles) {
            const cDate = new Date(c.time * 1000).toISOString().slice(0, 10);
            if (cDate === tDate) return c.time;
            const diff = Math.abs(c.time - target);
            if (diff < bestDiff) {
              bestDiff = diff;
              nearest = c.time;
            }
          }
        } else {
          for (const c of candles) {
            const diff = Math.abs(c.time - target);
            if (diff < bestDiff) {
              bestDiff = diff;
              nearest = c.time;
            }
          }
        }
        return nearest;
      };

      const entryT = snap(entryUnix) as UTCTimestamp;
      const exitT = snap(exitUnix) as UTCTimestamp;

      const markers = [
        {
          time: entryT,
          position: side === "LONG" ? ("belowBar" as const) : ("aboveBar" as const),
          color: "#16C784",
          shape: side === "LONG" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: `Entry ${side} @ ${entryPrice.toFixed(2)}`,
        },
        {
          time: exitT,
          position: side === "LONG" ? ("aboveBar" as const) : ("belowBar" as const),
          color: exitPrice >= entryPrice === (side === "LONG") ? "#16C784" : "#EA3943",
          shape: side === "LONG" ? ("arrowDown" as const) : ("arrowUp" as const),
          text: `Exit @ ${exitPrice.toFixed(2)}`,
        },
      ];

      // de-duplicate if entry and exit are the same bar
      if (markers[0].time === markers[1].time) {
        markers[1].text = `Entry ${entryPrice.toFixed(2)} → Exit ${exitPrice.toFixed(2)}`;
        markers.splice(0, 1);
      }
      // markers must be sorted by time ascending
      markers.sort((a, b) => (a.time as number) - (b.time as number));

      createSeriesMarkers(series, markers);

      // Center the visible range on the trade window with a small pad
      chart.timeScale().fitContent();

      resizeObserver = new ResizeObserver(() => chart?.timeScale().fitContent());
      resizeObserver.observe(container);

      setStatus("ok");
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [symbol, side, entryDate, exitDate, entryPrice, exitPrice, interval]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Interval
        </div>
        <div className="inline-flex items-center rounded-md border border-border bg-secondary/40 p-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setIntervalState(iv)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded transition-colors",
                interval === iv
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>
      <div
        className="relative rounded-md overflow-hidden border border-border bg-card/40"
        style={{ height }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading {symbol} {interval} candles…
          </div>
        )}
        {status === "empty" && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground px-6">
            No {interval} history available for <span className="font-mono px-1">{symbol}</span> in
            this window.
            {interval === "1m" && (
              <span className="ml-1">
                Yahoo only serves 1m for the last 7 days — try 5m or 15m.
              </span>
            )}
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-loss">
            Failed to load price data.
          </div>
        )}
      </div>
    </div>
  );
}
