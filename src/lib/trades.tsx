import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Strategy = "Strategy 1" | "Strategy 2" | "Strategy 3" | "Unassigned";
export type Side = "LONG" | "SHORT";

export type Trade = {
  id: string;
  date: string; // ISO
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
  addTrades: (t: Trade[]) => void;
  setStrategy: (id: string, s: Strategy) => void;
  remove: (id: string) => void;
  clear: () => void;
  getById: (id: string) => Trade | undefined;
};

const Ctx = createContext<TradesCtx | null>(null);
const KEY = "qj_trades";

const SAMPLE: Trade[] = [
  { id: "t1", date: "2025-03-14T13:32:00Z", symbol: "NVDA", side: "LONG", qty: 150, entry: 845.20, exit: 853.47, pnl: 1240, strategy: "Strategy 1", notes: "Pre-market gap up, clean breakout above 845." },
  { id: "t2", date: "2025-03-12T15:10:00Z", symbol: "TSLA", side: "SHORT", qty: 250, entry: 175.40, exit: 172.00, pnl: 850.5, strategy: "Strategy 2" },
  { id: "t3", date: "2025-03-11T18:05:00Z", symbol: "AMD", side: "LONG", qty: 300, entry: 162.10, exit: 160.70, pnl: -420, strategy: "Strategy 3" },
  { id: "t4", date: "2025-03-08T14:00:00Z", symbol: "META", side: "LONG", qty: 50, entry: 485.90, exit: 486.15, pnl: 12.5, strategy: "Strategy 1" },
  { id: "t5", date: "2025-03-07T19:20:00Z", symbol: "AAPL", side: "SHORT", qty: 150, entry: 172.30, exit: 173.53, pnl: -185, strategy: "Strategy 2" },
  { id: "t6", date: "2025-03-05T13:45:00Z", symbol: "SPY", side: "LONG", qty: 200, entry: 510.20, exit: 513.10, pnl: 580, strategy: "Strategy 1" },
  { id: "t7", date: "2025-03-04T20:00:00Z", symbol: "MSFT", side: "LONG", qty: 80, entry: 410.50, exit: 415.20, pnl: 376, strategy: "Strategy 3" },
  { id: "t8", date: "2025-03-01T14:30:00Z", symbol: "NVDA", side: "SHORT", qty: 60, entry: 850.00, exit: 854.20, pnl: -252, strategy: "Strategy 2" },
  { id: "t9", date: "2025-02-28T16:00:00Z", symbol: "TSLA", side: "LONG", qty: 100, entry: 195.00, exit: 199.50, pnl: 450, strategy: "Strategy 1" },
  { id: "t10", date: "2025-02-26T13:35:00Z", symbol: "QQQ", side: "LONG", qty: 120, entry: 432.00, exit: 435.60, pnl: 432, strategy: "Strategy 3" },
];

export function TradesProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        setTrades(JSON.parse(raw));
      } else {
        setTrades(SAMPLE);
        localStorage.setItem(KEY, JSON.stringify(SAMPLE));
      }
    } catch {
      setTrades(SAMPLE);
    }
  }, []);

  const persist = (next: Trade[]) => {
    setTrades(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const value = useMemo<TradesCtx>(() => ({
    trades,
    addTrades: (t) => persist([...t, ...trades]),
    setStrategy: (id, s) => persist(trades.map(x => x.id === id ? { ...x, strategy: s } : x)),
    remove: (id) => persist(trades.filter(x => x.id !== id)),
    clear: () => persist([]),
    getById: (id) => trades.find(x => x.id === id),
  }), [trades]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrades() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTrades outside provider");
  return c;
}

// helpers
export const fmtCurrency = (n: number) =>
  (n < 0 ? "-" : "+") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCurrencyPlain = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
