// Generates 1000 plausible trade rows for end-to-end testing of the journal app.
// Output:  sample-trades-1000.csv  (in repo root)
//
// Design notes:
// - Dates run Feb 2 → Apr 24 2026 (matches the app's "today" of 2026-04-25),
//   so Yahoo's intraday history will have 5m candles for ~all rows.
// - Timestamps land inside US regular market hours (13:30–19:55 UTC =
//   9:30am–3:55pm ET) so intraday markers always snap to a real candle.
// - Symbol baseline prices are calibrated against actual April 2026
//   adjusted-close levels so dashboard P&L bars look right on first load.
// - Win-rate ~53%, profit-factor ~1.4 (winners trimmed bigger than losers)
//   gives a realistic-looking edge instead of a 50/50 random walk.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// [symbol, baseline price (Apr 2026), avg %ile move per trade]
const SYMBOLS = [
  ["NVDA", 200, 1.4],
  ["AAPL", 242, 0.9],
  ["MSFT", 470, 0.8],
  ["GOOGL", 195, 1.0],
  ["AMZN", 210, 1.1],
  ["META", 640, 1.3],
  ["TSLA", 320, 1.8],
  ["AMD", 150, 1.6],
  ["NFLX", 700, 1.4],
  ["COIN", 260, 2.4],
  ["SPY", 610, 0.5],
  ["QQQ", 547, 0.6],
  ["IWM", 240, 0.8],
  ["JPM", 248, 0.8],
  ["BAC", 47, 0.9],
  ["GS", 600, 1.0],
  ["XOM", 118, 0.9],
  ["JNJ", 158, 0.5],
  ["UNH", 510, 1.0],
  ["DIS", 102, 1.1],
  ["BA", 195, 1.6],
  ["UBER", 78, 1.3],
  ["SHOP", 95, 1.9],
  ["PLTR", 28, 2.2],
  ["MARA", 22, 3.2],
  ["AVGO", 195, 1.2],
  ["CRM", 295, 1.0],
  ["INTC", 32, 1.4],
  ["MU", 110, 1.7],
  ["ORCL", 165, 0.9],
];

const STRATEGIES = ["Breakout", "Mean Reversion", "Trend Following", "Scalp", "Earnings"];

const NOTES_BY_STRATEGY = {
  Breakout: [
    "Pre-market gap up clean breakout",
    "Range breakout on volume",
    "Breakout retest hold",
    "ATH breakout",
    "Cup & handle breakout",
    "Failed breakout, stopped",
    "Bull flag continuation",
    "",
    "",
  ],
  "Mean Reversion": [
    "Mean reversion short at resistance",
    "Fade gap up",
    "Topping pattern fade",
    "VWAP reversion",
    "Oversold bounce",
    "Squeezed out early",
    "",
    "",
  ],
  "Trend Following": [
    "VWAP reclaim long",
    "Trend continuation",
    "Index momentum continuation",
    "Tech rotation long",
    "Stopped below trend line",
    "20EMA trend long",
    "",
    "",
  ],
  Scalp: [
    "Quick scalp",
    "Counter-trend fade scalp",
    "Opening drive scalp",
    "Power-hour scalp",
    "",
    "",
  ],
  Earnings: [
    "Earnings beat",
    "Earnings drift continuation",
    "Earnings miss reversal",
    "Post-earnings IV crush play",
    "",
    "",
  ],
};

// Seedable PRNG so the file is deterministic across runs.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260425);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const range = (lo, hi) => lo + rand() * (hi - lo);

function tradingDays(start, end) {
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const start = new Date("2026-02-02T00:00:00Z");
const end = new Date("2026-04-24T00:00:00Z");
const days = tradingDays(start, end);
// Need ~1000 rows across ~60 days → ~17/day on average.

// Per-symbol "drift" so prices wobble through the period instead of staying
// pinned to one number. Random walk with daily ±0.6% steps.
const driftBySym = new Map();
for (const [sym, base] of SYMBOLS) {
  const series = [base];
  for (let i = 1; i < days.length; i++) {
    series.push(series[i - 1] * (1 + (rand() - 0.5) * 0.012));
  }
  driftBySym.set(sym, series);
}

const rows = [];
for (let dIdx = 0; dIdx < days.length; dIdx++) {
  const day = days[dIdx];
  const tradesThisDay = 17 + Math.floor(rand() * 7); // 17-23 per day, ~1100 total
  for (let i = 0; i < tradesThisDay; i++) {
    const [symbol, , avgMovePct] = pick(SYMBOLS);
    const basePx = driftBySym.get(symbol)[dIdx];

    // Entry timestamp inside RTH: 13:30:00–19:55:00 UTC.
    const minutesFromOpen = Math.floor(rand() * 385); // 0–6h25
    const ts = new Date(day);
    ts.setUTCHours(13, 30, 0, 0);
    ts.setUTCMinutes(ts.getUTCMinutes() + minutesFromOpen);
    ts.setUTCSeconds(Math.floor(rand() * 60));

    // Entry price wobbles ±0.5% around the daily anchor.
    const entry = +(basePx * (1 + (rand() - 0.5) * 0.01)).toFixed(2);

    const side = rand() < 0.62 ? "LONG" : "SHORT";

    // 53% win rate; winners larger than losers (PF ~1.4).
    const isWin = rand() < 0.53;
    const movePct = isWin
      ? avgMovePct * (0.4 + rand() * 1.4) * 0.01
      : -avgMovePct * (0.3 + rand() * 1.0) * 0.01;

    const exit = +(side === "LONG" ? entry * (1 + movePct) : entry * (1 - movePct)).toFixed(2);

    // Position size scales loosely with price so notional stays in a sane range.
    let qty;
    if (basePx >= 400) qty = 10 + Math.floor(rand() * 90);
    else if (basePx >= 150) qty = 30 + Math.floor(rand() * 170);
    else if (basePx >= 50) qty = 80 + Math.floor(rand() * 320);
    else qty = 200 + Math.floor(rand() * 800);

    const grossPnl = (side === "LONG" ? exit - entry : entry - exit) * qty;
    const pnl = +grossPnl.toFixed(2);

    const strategy = pick(STRATEGIES);
    const note = pick(NOTES_BY_STRATEGY[strategy]);
    // Escape commas in notes — rare but be safe for the CSV parser.
    const safeNote =
      note.includes(",") || note.includes('"') ? `"${note.replace(/"/g, '""')}"` : note;

    rows.push({
      date: ts.toISOString(),
      symbol,
      side,
      qty,
      entry,
      exit,
      pnl,
      strategy,
      notes: safeNote,
    });
  }
}

rows.sort((a, b) => +new Date(a.date) - +new Date(b.date));
const final = rows.slice(0, 1000);

const header = "date,symbol,side,qty,entry,exit,pnl,strategy,notes";
const csv =
  header +
  "\n" +
  final
    .map(
      (r) =>
        `${r.date},${r.symbol},${r.side},${r.qty},${r.entry},${r.exit},${r.pnl},${r.strategy},${r.notes}`,
    )
    .join("\n") +
  "\n";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "sample-trades-1000.csv");
writeFileSync(out, csv);

const wins = final.filter((r) => r.pnl > 0).length;
const losses = final.length - wins;
const net = final.reduce((s, r) => s + r.pnl, 0);
const grossW = final.filter((r) => r.pnl > 0).reduce((s, r) => s + r.pnl, 0);
const grossL = Math.abs(final.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0));
console.log(`Wrote ${final.length} trades → ${out}`);
console.log(`  Win rate: ${((wins / final.length) * 100).toFixed(1)}%  (${wins}W / ${losses}L)`);
console.log(`  Net P&L:  ${net >= 0 ? "+" : ""}$${net.toFixed(2)}`);
console.log(`  PF:       ${(grossW / grossL).toFixed(2)}`);
console.log(`  Range:    ${final[0].date}  →  ${final.at(-1).date}`);
