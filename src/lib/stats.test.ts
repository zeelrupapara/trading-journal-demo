import { describe, expect, it } from "vitest";
import {
  equityCurve,
  pnlByDay,
  pnlBySymbol,
  returnPct,
  summarize,
  tradesByStrategy,
} from "./stats";
import type { Trade } from "./trades";

const t = (over: Partial<Trade> = {}): Trade => ({
  id: over.id ?? "x",
  entryTime: over.entryTime ?? "2026-04-10T13:30:00Z",
  symbol: over.symbol ?? "NVDA",
  side: over.side ?? "LONG",
  qty: over.qty ?? 100,
  entry: over.entry ?? 100,
  exit: over.exit ?? 110,
  pnl: over.pnl ?? 0,
  strategy: over.strategy ?? "Breakout",
  ...over,
});

describe("summarize", () => {
  it("returns zeros for an empty journal", () => {
    const s = summarize([]);
    expect(s.totalTrades).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.profitFactor).toBe(0);
    expect(s.maxDrawdown).toBe(0);
  });

  it("computes win rate, gross, net, expectancy", () => {
    const trades = [t({ pnl: 100 }), t({ pnl: 200 }), t({ pnl: -50 }), t({ pnl: -50 })];
    const s = summarize(trades);
    expect(s.totalTrades).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.net).toBe(200);
    expect(s.grossWin).toBe(300);
    expect(s.grossLoss).toBe(100);
    expect(s.winRate).toBe(0.5);
    expect(s.profitFactor).toBe(3);
    expect(s.avgWin).toBe(150);
    expect(s.avgLoss).toBe(50);
    // 0.5 * 150 - 0.5 * 50 = 50
    expect(s.expectancy).toBe(50);
  });

  it("computes max drawdown peak-to-trough on chronological equity", () => {
    // Winners first push equity to +500, then a -300 drawdown to +200.
    const trades = [
      t({ entryTime: "2026-04-01T13:30:00Z", pnl: 200 }),
      t({ entryTime: "2026-04-02T13:30:00Z", pnl: 300 }),
      t({ entryTime: "2026-04-03T13:30:00Z", pnl: -100 }),
      t({ entryTime: "2026-04-04T13:30:00Z", pnl: -200 }),
    ];
    const s = summarize(trades);
    expect(s.net).toBe(200);
    // peak = 500, trough = 200 -> max drawdown = -300
    expect(s.maxDrawdown).toBe(-300);
  });

  it("treats no-loss case as profit factor = grossWin (avoids divide-by-zero)", () => {
    const s = summarize([t({ pnl: 50 }), t({ pnl: 75 })]);
    expect(s.grossLoss).toBe(0);
    expect(s.profitFactor).toBe(125);
  });
});

describe("equityCurve", () => {
  it("walks chronologically and accumulates pnl", () => {
    const curve = equityCurve([
      t({ entryTime: "2026-04-03T13:30:00Z", pnl: -50 }),
      t({ entryTime: "2026-04-01T13:30:00Z", pnl: 100 }),
      t({ entryTime: "2026-04-02T13:30:00Z", pnl: 75 }),
    ]);
    expect(curve.map((p) => p.equity)).toEqual([100, 175, 125]);
  });
});

describe("pnlBySymbol", () => {
  it("sums by symbol and orders by absolute |pnl| desc", () => {
    const out = pnlBySymbol([
      t({ symbol: "NVDA", pnl: 100 }),
      t({ symbol: "AMD", pnl: -300 }),
      t({ symbol: "NVDA", pnl: 50 }),
      t({ symbol: "SPY", pnl: 200 }),
    ]);
    expect(out[0]).toEqual({ symbol: "AMD", pnl: -300 });
    expect(out[1]).toEqual({ symbol: "SPY", pnl: 200 });
    expect(out[2]).toEqual({ symbol: "NVDA", pnl: 150 });
  });
});

describe("tradesByStrategy", () => {
  it("counts and assigns palette colors round-robin", () => {
    const out = tradesByStrategy(
      [t({ strategy: "Breakout" }), t({ strategy: "Breakout" }), t({ strategy: "Scalp" })],
      ["#a", "#b"],
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "Breakout", value: 2, color: "#a" });
    expect(out[1]).toEqual({ name: "Scalp", value: 1, color: "#b" });
  });
});

describe("pnlByDay", () => {
  it("groups trades into per-day buckets", () => {
    // pnlByDay groups by *local* date so the analytics calendar (also local)
    // looks up the right bucket. Use timestamps that fall on the same calendar
    // day in every reasonable timezone (UTC offset ±14h).
    const sameDayA = "2026-04-10T15:00:00Z"; // 11 AM ET / 8 PM IST
    const sameDayB = "2026-04-10T17:00:00Z"; // 1 PM ET / 10:30 PM IST
    const nextDay = "2026-04-12T15:00:00Z";
    const map = pnlByDay([
      t({ entryTime: sameDayA, pnl: 100 }),
      t({ entryTime: sameDayB, pnl: -25 }),
      t({ entryTime: nextDay, pnl: 50 }),
    ]);
    expect(map.size).toBe(2);
    const dayA = map.get(new Date(sameDayA).toDateString())!;
    expect(dayA.pnl).toBe(75);
    expect(dayA.count).toBe(2);
  });
});

describe("returnPct", () => {
  it("LONG: positive when exit > entry", () => {
    expect(returnPct(t({ side: "LONG", entry: 100, exit: 105 }))).toBeCloseTo(5);
  });
  it("SHORT: positive when entry > exit", () => {
    expect(returnPct(t({ side: "SHORT", entry: 100, exit: 95 }))).toBeCloseTo(5);
  });
});
