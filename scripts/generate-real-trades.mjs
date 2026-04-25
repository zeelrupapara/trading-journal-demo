// Generates 10,000 trade rows where every entry/exit price comes from a
// real Yahoo Finance 5m candle. The chart's marker labels then match the
// candles 1:1 — no more "$158 entry on a $246 bar" mismatches.
//
// Output:  sample-trades-10000.csv  (in repo root)
//
// CSV schema:  date, entry_time, exit_time, symbol, side, qty,
//              entry, exit, pnl, strategy, notes
//
// `entry_time` and `exit_time` are separate ISO timestamps so the chart can
// render two distinct markers (entry on bar A, exit on bar B). `date` mirrors
// `entry_time` for back-compat with imports that only know about a single
// trade timestamp.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SYMBOLS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "NVDA",
  "TSLA",
  "AVGO",
  "AMD",
  "NFLX",
  "CRM",
  "ORCL",
  "INTC",
  "ADBE",
  "MU",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "XLF",
  "JPM",
  "BAC",
  "GS",
  "V",
  "MA",
  "XOM",
  "CVX",
  "WMT",
  "COST",
  "DIS",
];

const STRATEGIES = ["Breakout", "Mean Reversion", "Trend Following", "Scalp", "Earnings"];

const NOTES_BY_STRATEGY = {
  Breakout: [
    "Range breakout on volume",
    "ATH breakout retest",
    "Cup & handle long",
    "Bull flag continuation",
    "",
    "",
    "",
  ],
  "Mean Reversion": [
    "Fade gap up",
    "VWAP reversion long",
    "Oversold bounce",
    "Squeezed out early",
    "",
    "",
    "",
  ],
  "Trend Following": [
    "VWAP reclaim long",
    "Trend continuation",
    "20EMA pullback long",
    "Stopped below trend line",
    "",
    "",
    "",
  ],
  Scalp: ["Opening drive scalp", "Power-hour scalp", "Quick momentum scalp", "", "", ""],
  Earnings: ["Earnings drift", "Post-earnings IV crush", "Earnings beat momentum", "", "", ""],
};

const TARGET_TRADES = 10000;
const NUM_TRADING_DAYS = 41; // approx Mar 1 - Apr 24 minus weekends

// Window: Mar 1 → Apr 24 2026 (within Yahoo's 60-day intraday cap from "today" 2026-04-25).
const FROM = Math.floor(new Date("2026-02-28T00:00:00Z").getTime() / 1000);
const TO = Math.floor(new Date("2026-04-25T00:00:00Z").getTime() / 1000);

const UA = "Mozilla/5.0 (compatible; QuantJournal/1.0)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCandles(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${FROM}&period2=${TO}&interval=5m&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const r = json.chart?.result?.[0];
  if (!r?.timestamp || !r.indicators?.quote?.[0]) return [];
  const ts = r.timestamp;
  const q = r.indicators.quote[0];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ time: ts[i], open: o, high: h, low: l, close: c });
  }
  return out;
}

// Deterministic PRNG so the file is reproducible.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x10000);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

console.log(`Fetching 5m OHLC for ${SYMBOLS.length} symbols...`);
const data = {};
for (const sym of SYMBOLS) {
  try {
    const candles = await fetchCandles(sym);
    if (candles.length < 100) {
      console.warn(`  ${sym}: only ${candles.length} bars — skipping`);
      continue;
    }
    data[sym] = candles;
    console.log(`  ${sym}: ${candles.length} bars`);
    await sleep(200); // be polite
  } catch (e) {
    console.error(`  ${sym}: ${e.message}`);
  }
}

const usable = Object.keys(data);
if (usable.length === 0) {
  console.error("No usable data — Yahoo refused everything. Aborting.");
  process.exit(1);
}
console.log(`\nGenerating ${TARGET_TRADES} trades from ${usable.length} symbols...`);

const trades = [];
let attempts = 0;
while (trades.length < TARGET_TRADES && attempts < TARGET_TRADES * 3) {
  attempts++;
  const sym = pick(usable);
  const candles = data[sym];

  // Pick an entry bar with room for an exit bar 1-12 bars later (5-60 minute hold).
  const entryIdx = Math.floor(rand() * (candles.length - 13));
  const holdBars = 1 + Math.floor(rand() * 12);
  const exitIdx = entryIdx + holdBars;
  const entryBar = candles[entryIdx];
  const exitBar = candles[exitIdx];

  // Both bars must fall on the same UTC date (no overnight holds).
  const entryDay = new Date(entryBar.time * 1000).toISOString().slice(0, 10);
  const exitDay = new Date(exitBar.time * 1000).toISOString().slice(0, 10);
  if (entryDay !== exitDay) continue;

  // Entry: random point inside the entry bar's range. Exit: same for exit bar.
  // Using mid-of-range gives realistic (not perfectly tick-quoted) fills.
  const entry = +(entryBar.open + (entryBar.close - entryBar.open) * (0.2 + rand() * 0.6)).toFixed(
    2,
  );
  const exit = +(exitBar.open + (exitBar.close - exitBar.open) * (0.2 + rand() * 0.6)).toFixed(2);
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0 || exit <= 0) continue;

  const side = rand() < 0.55 ? "LONG" : "SHORT";

  // Position size: scale with price so notional stays in a sane range.
  let qty;
  const px = entry;
  if (px >= 400) qty = 10 + Math.floor(rand() * 90);
  else if (px >= 150) qty = 30 + Math.floor(rand() * 170);
  else if (px >= 50) qty = 80 + Math.floor(rand() * 320);
  else qty = 200 + Math.floor(rand() * 800);

  const grossPnl = (side === "LONG" ? exit - entry : entry - exit) * qty;
  const pnl = +grossPnl.toFixed(2);

  // Discard extreme bars (probably a halt / opening cross with a printer wick).
  const movePct = Math.abs((exit - entry) / entry);
  if (movePct > 0.05) continue;

  const strategy = pick(STRATEGIES);
  const note = pick(NOTES_BY_STRATEGY[strategy]);
  const safeNote =
    note.includes(",") || note.includes('"') ? `"${note.replace(/"/g, '""')}"` : note;

  trades.push({
    date: new Date(entryBar.time * 1000).toISOString(),
    entry_time: new Date(entryBar.time * 1000).toISOString(),
    exit_time: new Date(exitBar.time * 1000).toISOString(),
    symbol: sym,
    side,
    qty,
    entry,
    exit,
    pnl,
    strategy,
    notes: safeNote,
  });
}

trades.sort((a, b) => +new Date(a.entry_time) - +new Date(b.entry_time));
const final = trades.slice(0, TARGET_TRADES);

const header = "date,entry_time,exit_time,symbol,side,qty,entry,exit,pnl,strategy,notes";
const csv =
  header +
  "\n" +
  final
    .map(
      (r) =>
        `${r.date},${r.entry_time},${r.exit_time},${r.symbol},${r.side},${r.qty},` +
        `${r.entry},${r.exit},${r.pnl},${r.strategy},${r.notes}`,
    )
    .join("\n") +
  "\n";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "sample-trades-10000.csv");
writeFileSync(out, csv);

const wins = final.filter((r) => r.pnl > 0).length;
const losses = final.length - wins;
const net = final.reduce((s, r) => s + r.pnl, 0);
const grossW = final.filter((r) => r.pnl > 0).reduce((s, r) => s + r.pnl, 0);
const grossL = Math.abs(final.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0));
const sizeKb = Buffer.byteLength(csv) / 1024;

console.log(`\nWrote ${final.length} trades → ${out}  (${sizeKb.toFixed(1)} KB)`);
console.log(`  Symbols:  ${usable.length}`);
console.log(`  Win rate: ${((wins / final.length) * 100).toFixed(1)}%  (${wins}W / ${losses}L)`);
console.log(`  Net P&L:  ${net >= 0 ? "+" : ""}$${net.toFixed(2)}`);
console.log(`  PF:       ${(grossW / grossL).toFixed(2)}`);
console.log(`  Range:    ${final[0].entry_time}  →  ${final.at(-1).entry_time}`);

void NUM_TRADING_DAYS; // reserved for future per-day distribution checks
