import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export const STRATEGIES = [
  "Breakout",
  "Mean Reversion",
  "Trend Following",
  "Scalp",
  "Earnings",
  "Unassigned",
] as const;
export type Strategy = (typeof STRATEGIES)[number];
export type Side = "LONG" | "SHORT";

export function normalizeStrategy(raw: string | undefined): Strategy {
  if (!raw) return "Unassigned";
  const v = raw.trim().toLowerCase();
  for (const s of STRATEGIES) {
    if (s.toLowerCase() === v) return s;
  }
  // Back-compat for the trial spec's placeholder names.
  if (v === "strategy 1") return "Breakout";
  if (v === "strategy 2") return "Mean Reversion";
  if (v === "strategy 3") return "Trend Following";
  return "Unassigned";
}

export type Trade = {
  id: string;
  entryTime: string; // ISO, required — when the trade was opened
  exitTime?: string; // ISO, optional — when the trade was closed
  symbol: string;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  strategy: Strategy;
  notes?: string;
};

type TradesCtx = {
  trades: Trade[];
  /** Adds new trades, dropping anything that looks like a duplicate already in the journal. */
  addTrades: (t: Trade[]) => { added: number; skipped: number };
  setStrategy: (id: string, s: Strategy) => void;
  remove: (id: string) => void;
  clear: () => void;
  getById: (id: string) => Trade | undefined;
};

const Ctx = createContext<TradesCtx | null>(null);
const KEY = "qj_trades";

// Hash used both at import time (in lib/csv.ts) and for the in-memory dedupe
// path below. Keep the shape identical so a re-import after a reload still
// dedupes against what's in localStorage.
function tradeHash(t: Trade): string {
  return `${t.symbol}|${t.entryTime}|${t.qty}|${t.entry}|${t.exit}|${t.side}`;
}

// Older builds wrote `date` instead of `entryTime`. Migrate on read so existing
// users don't see an empty journal after upgrading.
type LegacyTrade = Trade & { date?: string };
function migrate(raw: LegacyTrade[]): Trade[] {
  return raw.map((t) => {
    if (t.entryTime) return t;
    const date = t.date;
    return { ...t, entryTime: date ?? new Date().toISOString() } as Trade;
  });
}

function loadFromStorage(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return migrate(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function TradesProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>(loadFromStorage);

  const persist = useCallback((next: Trade[]) => {
    setTrades(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded or private mode — non-fatal; in-memory state is still correct.
    }
  }, []);

  const addTrades = useCallback(
    (incoming: Trade[]) => {
      const seen = new Set(trades.map(tradeHash));
      const fresh: Trade[] = [];
      let skipped = 0;
      for (const t of incoming) {
        const h = tradeHash(t);
        if (seen.has(h)) {
          skipped++;
          continue;
        }
        seen.add(h);
        fresh.push(t);
      }
      if (fresh.length > 0) persist([...fresh, ...trades]);
      return { added: fresh.length, skipped };
    },
    [trades, persist],
  );

  const setStrategy = useCallback(
    (id: string, s: Strategy) =>
      persist(trades.map((x) => (x.id === id ? { ...x, strategy: s } : x))),
    [trades, persist],
  );

  const remove = useCallback(
    (id: string) => persist(trades.filter((x) => x.id !== id)),
    [trades, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const getById = useCallback((id: string) => trades.find((x) => x.id === id), [trades]);

  const value = useMemo<TradesCtx>(
    () => ({ trades, addTrades, setStrategy, remove, clear, getById }),
    [trades, addTrades, setStrategy, remove, clear, getById],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrades() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTrades outside provider");
  return c;
}
