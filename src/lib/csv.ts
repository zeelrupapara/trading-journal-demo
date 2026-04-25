// Pure CSV parsing. No React, no DOM, no toast. Returns plain Trade[].
// Header alias map handles common broker CSV dialects (TradingView, IBKR,
// Webull, etc.) so users don't need to pre-normalize their export.

import Papa from "papaparse";
import { normalizeStrategy, type Trade, type Side } from "@/lib/trades";

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "datetime", "time", "timestamp", "trade date", "opened", "closed"],
  entryTime: ["entry_time", "entry time", "entry_date", "entry date", "open time", "filled time"],
  exitTime: ["exit_time", "exit time", "exit_date", "exit date", "close time", "closed time"],
  symbol: ["symbol", "ticker", "instrument", "asset", "pair"],
  side: ["side", "direction", "action", "type", "position"],
  qty: ["qty", "quantity", "size", "shares", "amount", "volume", "contracts"],
  entry: ["entry", "entry price", "open price", "buy price", "avg entry", "price in"],
  exit: ["exit", "exit price", "close price", "sell price", "avg exit", "price out"],
  pnl: ["pnl", "p&l", "p/l", "profit", "net", "net pnl", "realized pnl", "result"],
  strategy: ["strategy", "setup", "playbook", "tag"],
  notes: ["notes", "note", "comment", "comments", "description"],
};

function buildKeyMap(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.trim().toLowerCase();
  const out: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const hit = headers.find((h) => aliases.includes(norm(h)));
    if (hit) out[canonical] = hit;
  }
  return out;
}

function parseSide(raw: string | undefined): Side {
  const v = (raw || "").trim().toLowerCase();
  if (["short", "sell", "s", "sld"].includes(v)) return "SHORT";
  return "LONG";
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(+d) ? undefined : d.toISOString();
}

function makeId(): string {
  // crypto.randomUUID exists in modern browsers and Node 16+. Fall back to a
  // deterministic-enough hash for the rare runtime that doesn't have it.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class CsvParseError extends Error {}

export type ParseResult = { trades: Trade[]; skipped: number };

async function readAsText(input: File | string): Promise<string> {
  if (typeof input === "string") return input;
  // File.text() is supported in modern browsers and Node 20+. Avoids PapaParse's
  // FileReaderSync code path which doesn't exist in Node test envs.
  return await input.text();
}

/**
 * Parse a CSV (File from a file input, or a raw string in tests/scripts) into
 * Trade[]. Throws CsvParseError on missing required headers or unrecoverable
 * parse errors. Rows that fail field-level validation are dropped and counted
 * in `skipped`.
 */
export async function parseTradesCsv(input: File | string): Promise<ParseResult> {
  const text = await readAsText(input);
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields || [];
        const km = buildKeyMap(headers);
        if (!km.symbol || (!km.date && !km.entryTime)) {
          reject(
            new CsvParseError("CSV needs at least a symbol column and a date / entry_time column."),
          );
          return;
        }
        const get = (r: Record<string, string>, k: string) => (km[k] ? r[km[k]] : undefined);

        let skipped = 0;
        const trades: Trade[] = [];
        for (const r of res.data) {
          const symbol = (get(r, "symbol") || "").toUpperCase().trim();
          if (!symbol) {
            skipped++;
            continue;
          }
          const entryTime = toIso(get(r, "entryTime"));
          const fallbackDate = toIso(get(r, "date")) ?? entryTime;
          if (!fallbackDate) {
            skipped++;
            continue;
          }
          const exitTime = toIso(get(r, "exitTime"));
          const entry = parseFloat(get(r, "entry") || "0");
          const exit = parseFloat(get(r, "exit") || "0");
          const qty = parseFloat(get(r, "qty") || "0");
          const side = parseSide(get(r, "side"));

          // PnL: prefer the broker's reported value (handles fees), fall back
          // to (exit - entry) * qty when the column is missing.
          const rawPnl = (get(r, "pnl") || "").replace(/[$,()\s]/g, "");
          let pnl = parseFloat(rawPnl);
          if (Number.isNaN(pnl)) {
            pnl = (side === "LONG" ? exit - entry : entry - exit) * qty;
          }

          trades.push({
            id: makeId(),
            entryTime: entryTime ?? fallbackDate,
            exitTime,
            symbol,
            side,
            qty,
            entry,
            exit,
            pnl,
            strategy: normalizeStrategy(get(r, "strategy")),
            notes: get(r, "notes"),
          });
        }
        resolve({ trades, skipped });
      },
      error: (err: Error) => reject(new CsvParseError(err.message)),
    });
  });
}

/**
 * Hash a trade for dedup purposes. Two CSV rows that describe the same fill
 * (same symbol + entry timestamp + qty + entry price + exit price) collide.
 */
function tradeHash(t: Trade): string {
  return `${t.symbol}|${t.entryTime}|${t.qty}|${t.entry}|${t.exit}|${t.side}`;
}

export type DedupeResult = { added: Trade[]; skipped: number };

/**
 * Drop incoming trades that look like duplicates of trades already in the
 * journal. Keeps the user from doubling their data on re-import.
 */
export function dedupeTrades(existing: Trade[], incoming: Trade[]): DedupeResult {
  const seen = new Set(existing.map(tradeHash));
  const added: Trade[] = [];
  let skipped = 0;
  for (const t of incoming) {
    const h = tradeHash(t);
    if (seen.has(h)) {
      skipped++;
      continue;
    }
    seen.add(h);
    added.push(t);
  }
  return { added, skipped };
}
