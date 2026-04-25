// Pure analytics over Trade[]. No React, no DOM — testable in isolation,
// reused by the dashboard, profile page, and AI prompt context.

import type { Trade } from "@/lib/trades";

export type Summary = {
  totalTrades: number;
  wins: number;
  losses: number;
  net: number;
  grossWin: number;
  grossLoss: number;
  winRate: number; // 0..1
  profitFactor: number; // grossWin / grossLoss; if grossLoss==0, equals grossWin
  avgWin: number;
  avgLoss: number;
  expectancy: number; // average $ per trade going forward
  maxDrawdown: number; // peak-to-trough on cumulative equity, negative or zero
};

export type EquityPoint = {
  date: string; // short label "Apr 12"
  equity: number;
  ts: number; // unix ms — useful if a consumer wants to filter by range
};

export const tradeTime = (t: Trade): number => +new Date(t.entryTime);

export function summarize(trades: Trade[]): Summary {
  const wins: Trade[] = [];
  const losses: Trade[] = [];
  for (const t of trades) {
    if (t.pnl > 0) wins.push(t);
    else if (t.pnl < 0) losses.push(t);
  }
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // Max drawdown: walk in chronological order, track running equity vs peak.
  const sorted = [...trades].sort((a, b) => tradeTime(a) - tradeTime(b));
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    net,
    grossWin,
    grossLoss,
    winRate,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown,
  };
}

export function equityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => tradeTime(a) - tradeTime(b));
  let running = 0;
  return sorted.map((t) => {
    running += t.pnl;
    const ts = tradeTime(t);
    return {
      ts,
      equity: running,
      date: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });
}

export function tradesByStrategy(
  trades: Trade[],
  palette: readonly string[],
): Array<{ name: string; value: number; color: string }> {
  const map = new Map<string, number>();
  for (const t of trades) map.set(t.strategy, (map.get(t.strategy) || 0) + 1);
  return Array.from(map.entries()).map(([name, value], i) => ({
    name,
    value,
    color: palette[i % palette.length],
  }));
}

export function pnlBySymbol(trades: Trade[], topN = 8): Array<{ symbol: string; pnl: number }> {
  const map = new Map<string, number>();
  for (const t of trades) map.set(t.symbol, (map.get(t.symbol) || 0) + t.pnl);
  return Array.from(map.entries())
    .map(([symbol, pnl]) => ({ symbol, pnl }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, topN);
}

export type DayBucket = { pnl: number; count: number };

/**
 * Local-time `Date.toDateString()` key — matches the calendar cells in
 * `_app.analytics.tsx` which build cells from `new Date(year, month, day)`
 * (also local). The pair stays in sync as long as both sides use local time.
 */
export const dayKey = (t: Trade): string => new Date(tradeTime(t)).toDateString();

export function pnlByDay(trades: Trade[]): Map<string, DayBucket> {
  const m = new Map<string, DayBucket>();
  for (const t of trades) {
    const k = dayKey(t);
    const prev = m.get(k);
    if (prev) {
      prev.pnl += t.pnl;
      prev.count += 1;
    } else {
      m.set(k, { pnl: t.pnl, count: 1 });
    }
  }
  return m;
}

export function returnPct(t: Trade): number {
  return ((t.exit - t.entry) / t.entry) * 100 * (t.side === "LONG" ? 1 : -1);
}

export const fmtCurrency = (n: number) =>
  (n < 0 ? "-" : "+") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCurrencyPlain = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

const DAY_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Per-group stats. Same vocabulary as Summary so the AI can compare apples-to-apples. */
export type GroupStats = {
  trades: number;
  wins: number;
  losses: number;
  net: number;
  grossWin: number;
  grossLoss: number;
  winRate: number; // 0..1
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  rr: number; // avgWin / avgLoss — risk:reward ratio
};

type GroupAcc = { trades: number; wins: number; losses: number; grossWin: number; grossLoss: number };

const finalizeGroup = (a: GroupAcc): GroupStats => {
  const net = a.grossWin - a.grossLoss;
  const winRate = a.trades ? a.wins / a.trades : 0;
  const avgWin = a.wins ? a.grossWin / a.wins : 0;
  const avgLoss = a.losses ? a.grossLoss / a.losses : 0;
  return {
    trades: a.trades,
    wins: a.wins,
    losses: a.losses,
    net: +net.toFixed(2),
    grossWin: +a.grossWin.toFixed(2),
    grossLoss: +a.grossLoss.toFixed(2),
    winRate: +winRate.toFixed(3),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    profitFactor: +(a.grossLoss ? a.grossWin / a.grossLoss : a.grossWin).toFixed(2),
    expectancy: +(winRate * avgWin - (1 - winRate) * avgLoss).toFixed(2),
    rr: +(avgLoss ? avgWin / avgLoss : avgWin).toFixed(2),
  };
};

const groupTrades = <K extends string>(trades: Trade[], key: (t: Trade) => K): Map<K, GroupAcc> => {
  const m = new Map<K, GroupAcc>();
  for (const t of trades) {
    const k = key(t);
    let g = m.get(k);
    if (!g) {
      g = { trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 };
      m.set(k, g);
    }
    g.trades += 1;
    if (t.pnl > 0) {
      g.wins += 1;
      g.grossWin += t.pnl;
    } else if (t.pnl < 0) {
      g.losses += 1;
      g.grossLoss += -t.pnl;
    }
  }
  return m;
};

type RecentTrade = {
  date: string;
  symbol: string;
  side: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  strategy: string;
};

const toRecent = (t: Trade): RecentTrade => ({
  date: t.entryTime,
  symbol: t.symbol,
  side: t.side,
  qty: t.qty,
  entry: t.entry,
  exit: t.exit,
  pnl: +t.pnl.toFixed(2),
  strategy: t.strategy,
});

/**
 * Build a compact, pre-aggregated context object for the AI chat. Avoids
 * shipping all 10k raw trades to Gemini every message: pre-computes the
 * answers to the questions a trader actually asks (net, profit factor, R:R,
 * expectancy by symbol/strategy/side/day-of-week) plus samples of recent
 * trades and top winners/losers for specific lookups. Stays well under any
 * sane token budget.
 */
export function aiContext(trades: Trade[]): {
  meta: { totalTrades: number; firstTrade: string | null; lastTrade: string | null };
  summary: Summary;
  bySymbol: Array<{ symbol: string } & GroupStats>;
  byStrategy: Array<{ strategy: string } & GroupStats>;
  bySide: Array<{ side: string } & GroupStats>;
  byDayOfWeek: Array<{ day: string } & GroupStats>;
  recentTrades: RecentTrade[];
  topWinners: RecentTrade[];
  topLosers: RecentTrade[];
} {
  const summary = summarize(trades);

  const sortedDesc = [...trades].sort((a, b) => tradeTime(b) - tradeTime(a));
  const recentTrades = sortedDesc.slice(0, 50).map(toRecent);

  const byPnlDesc = [...trades].sort((a, b) => b.pnl - a.pnl);
  const topWinners = byPnlDesc.slice(0, 5).filter((t) => t.pnl > 0).map(toRecent);
  const topLosers = byPnlDesc.slice(-5).reverse().filter((t) => t.pnl < 0).map(toRecent);

  const bySymbol = Array.from(groupTrades(trades, (t) => t.symbol).entries())
    .map(([symbol, acc]) => ({ symbol, ...finalizeGroup(acc) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const byStrategy = Array.from(groupTrades(trades, (t) => t.strategy).entries())
    .map(([strategy, acc]) => ({ strategy, ...finalizeGroup(acc) }))
    .sort((a, b) => b.net - a.net);

  const bySide = Array.from(groupTrades(trades, (t) => t.side).entries())
    .map(([side, acc]) => ({ side, ...finalizeGroup(acc) }))
    .sort((a, b) => b.net - a.net);

  const dowMap = groupTrades(trades, (t) => DAY_OF_WEEK[new Date(tradeTime(t)).getUTCDay()] as string);
  const empty: GroupAcc = { trades: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0 };
  const byDayOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
    day,
    ...finalizeGroup(dowMap.get(day) ?? empty),
  }));

  const sortedAsc = [...trades].sort((a, b) => tradeTime(a) - tradeTime(b));
  return {
    meta: {
      totalTrades: trades.length,
      firstTrade: sortedAsc[0]?.entryTime ?? null,
      lastTrade: sortedAsc.at(-1)?.entryTime ?? null,
    },
    summary,
    bySymbol,
    byStrategy,
    bySide,
    byDayOfWeek,
    recentTrades,
    topWinners,
    topLosers,
  };
}
