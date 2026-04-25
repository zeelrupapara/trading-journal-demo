import { describe, expect, it } from "vitest";
// `File` is global in browsers and in Node 20+, but Node 18 still requires the
// `node:buffer` import. Pull it from there so the test runs on either.
import { File as NodeFile } from "node:buffer";
import { dedupeTrades, parseTradesCsv } from "./csv";
import type { Trade } from "./trades";

const FileCtor = (globalThis as { File?: typeof File }).File ?? (NodeFile as unknown as typeof File);

function csvFile(body: string): File {
  return new FileCtor([body], "trades.csv", { type: "text/csv" });
}

const SAMPLE = `date,symbol,side,qty,entry,exit,pnl,strategy,notes
2026-04-10T13:30:00Z,NVDA,LONG,100,200,210,1000,Breakout,clean breakout
2026-04-10T15:00:00Z,SPY,SHORT,50,610,612,-100,Mean Reversion,
2026-04-11T14:00:00Z,AMD,LONG,200,150,148,-400,Trend Following,stopped out
`;

describe("parseTradesCsv", () => {
  it("parses canonical rows", async () => {
    const { trades, skipped } = await parseTradesCsv(csvFile(SAMPLE));
    expect(skipped).toBe(0);
    expect(trades).toHaveLength(3);
    expect(trades[0].symbol).toBe("NVDA");
    expect(trades[0].side).toBe("LONG");
    expect(trades[0].pnl).toBe(1000);
    expect(trades[0].strategy).toBe("Breakout");
  });

  it("falls back to computed PnL when the column is missing", async () => {
    const noPnl = `date,symbol,side,qty,entry,exit,strategy
2026-04-10T13:30:00Z,NVDA,LONG,100,200,210,Breakout
`;
    const { trades } = await parseTradesCsv(csvFile(noPnl));
    expect(trades[0].pnl).toBeCloseTo(1000); // (210-200)*100
  });

  it("normalizes side from various broker dialects", async () => {
    const csv = `date,symbol,side,qty,entry,exit
2026-04-10T13:30:00Z,A,Buy,1,100,101
2026-04-10T13:30:00Z,B,sell,1,100,99
2026-04-10T13:30:00Z,C,short,1,100,99
2026-04-10T13:30:00Z,D,LONG,1,100,101
`;
    const { trades } = await parseTradesCsv(csvFile(csv));
    expect(trades.map((t) => t.side)).toEqual(["LONG", "SHORT", "SHORT", "LONG"]);
  });

  it("recognizes entry_time / exit_time columns", async () => {
    const csv = `entry_time,exit_time,symbol,side,qty,entry,exit
2026-04-10T13:30:00Z,2026-04-10T13:35:00Z,NVDA,LONG,1,100,101
`;
    const { trades } = await parseTradesCsv(csvFile(csv));
    expect(trades[0].entryTime).toBe("2026-04-10T13:30:00.000Z");
    expect(trades[0].exitTime).toBe("2026-04-10T13:35:00.000Z");
  });

  it("rejects CSVs missing the required columns", async () => {
    const broken = `foo,bar\n1,2\n`;
    await expect(parseTradesCsv(csvFile(broken))).rejects.toThrow(/symbol column/);
  });

  it("skips rows with missing symbol or date instead of failing", async () => {
    const partial = `date,symbol,side,qty,entry,exit,pnl
2026-04-10T13:30:00Z,NVDA,LONG,100,200,210,1000
,FOO,LONG,1,1,2,1
2026-04-10T13:30:00Z,,LONG,1,1,2,1
`;
    const { trades, skipped } = await parseTradesCsv(csvFile(partial));
    expect(trades).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("maps the trial spec's placeholder strategies onto canonical names", async () => {
    const csv = `date,symbol,side,qty,entry,exit,pnl,strategy
2026-04-10T13:30:00Z,A,LONG,1,1,1,0,Strategy 1
2026-04-10T13:30:00Z,B,LONG,1,1,1,0,Strategy 2
2026-04-10T13:30:00Z,C,LONG,1,1,1,0,Strategy 3
2026-04-10T13:30:00Z,D,LONG,1,1,1,0,unknown
`;
    const { trades } = await parseTradesCsv(csvFile(csv));
    expect(trades.map((t) => t.strategy)).toEqual([
      "Breakout",
      "Mean Reversion",
      "Trend Following",
      "Unassigned",
    ]);
  });
});

describe("dedupeTrades", () => {
  const make = (over: Partial<Trade>): Trade => ({
    id: "x",
    entryTime: "2026-04-10T13:30:00Z",
    symbol: "NVDA",
    side: "LONG",
    qty: 100,
    entry: 200,
    exit: 210,
    pnl: 1000,
    strategy: "Breakout",
    ...over,
  });

  it("drops trades that match an existing fill", () => {
    const existing = [make({ id: "a" })];
    const incoming = [make({ id: "b" }), make({ id: "c", symbol: "SPY" })];
    const r = dedupeTrades(existing, incoming);
    expect(r.added).toHaveLength(1);
    expect(r.added[0].symbol).toBe("SPY");
    expect(r.skipped).toBe(1);
  });

  it("dedupes within the incoming batch too", () => {
    const r = dedupeTrades([], [make({ id: "a" }), make({ id: "b" })]);
    expect(r.added).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
});
