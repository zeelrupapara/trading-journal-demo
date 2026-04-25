import { createServerFn } from "@tanstack/react-start";

export type Candle = {
  time: number; // unix seconds (lightweight-charts UTCTimestamp)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Interval = "1m" | "5m" | "15m" | "1h" | "1d";
type Payload = { symbol: string; from: number; to: number; interval?: Interval };

// Yahoo's per-interval window caps + sensible padding for a trade-review chart.
// 1m is hard-capped at 7d total by Yahoo, so we keep the trade window tight.
const INTERVAL_CFG: Record<Interval, { yahoo: string; padDays: number; maxSpanDays: number }> = {
  "1m": { yahoo: "1m", padDays: 2, maxSpanDays: 6 },
  "5m": { yahoo: "5m", padDays: 5, maxSpanDays: 55 },
  "15m": { yahoo: "15m", padDays: 10, maxSpanDays: 55 },
  "1h": { yahoo: "60m", padDays: 30, maxSpanDays: 720 },
  "1d": { yahoo: "1d", padDays: 14, maxSpanDays: 365 * 5 },
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

/**
 * Fetches daily OHLCV candles for a symbol around a date window.
 * Uses Yahoo Finance's public chart endpoint — no API key, supports US equities,
 * indices (SPY, QQQ), futures (ES=F), FX (EURUSD=X) and crypto (BTC-USD).
 *
 * Server-side fetch dodges browser CORS. Pads the window ±10 trading days
 * either side of the trade so the user sees the price action that led to entry
 * and what happened after exit.
 */
export const fetchOhlc = createServerFn({ method: "GET" })
  .inputValidator((input: Payload): Payload => {
    if (!input?.symbol) throw new Error("symbol required");
    if (!Number.isFinite(input.from) || !Number.isFinite(input.to)) {
      throw new Error("from/to (unix seconds) required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<Candle[]> => {
    const interval: Interval = data.interval ?? "5m";
    const cfg = INTERVAL_CFG[interval];
    const pad = cfg.padDays * 24 * 3600;
    let period1 = Math.floor(data.from - pad);
    let period2 = Math.ceil(data.to + pad);

    // Clamp total span to Yahoo's per-interval cap (it 422s if you exceed).
    const maxSpan = cfg.maxSpanDays * 24 * 3600;
    if (period2 - period1 > maxSpan) {
      const center = Math.floor((data.from + data.to) / 2);
      period1 = Math.floor(center - maxSpan / 2);
      period2 = Math.ceil(center + maxSpan / 2);
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      data.symbol,
    )}?period1=${period1}&period2=${period2}&interval=${cfg.yahoo}`;

    const res = await fetch(url, {
      headers: {
        // Yahoo blocks requests with no UA
        "User-Agent": "Mozilla/5.0 (compatible; QuantJournal/1.0)",
      },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

    const ts = result.timestamp;
    const q = result.indicators.quote[0];
    const out: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      out.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: v ?? 0 });
    }
    return out;
  });
