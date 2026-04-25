# QuantJournal

A trading journal MVP — login, import a CSV of your trades, review them in a dense cockpit, and chat with an AI analyst (Gemini) over your data.

## Stack

- **TanStack Start** (React 19 + TypeScript) — file-based routes, server functions
- **Tailwind CSS v4** + **shadcn/ui** + **Recharts** + **lucide-react**
- **PapaParse** for CSV
- **Google Gemini** (`gemini-2.5-flash`) for AI chat
- **TradingView Advanced Chart** widget on trade detail
- Cloudflare Workers ready (`wrangler.jsonc`)

## Quick start

```bash
bun install
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
bun dev
```

Open http://localhost:3000.

Demo login: any email + any password works.

## Features

| Route        | What it does                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| `/login`     | Demo auth (any creds).                                                       |
| `/dashboard` | Net P&L, win rate, profit factor, equity curve, P&L by symbol, strategy mix. |
| `/journal`   | Filterable, sortable trade list with inline strategy assignment.             |
| `/trade/$id` | Per-trade detail with embedded TradingView chart and KPIs.                   |
| `/analytics` | Calendar-style P&L heatmap by day + monthly summary.                         |
| `/ai`        | Gemini-powered chat that answers questions about your journal.               |

Until you import a CSV, every screen shows a "no data found" empty state with the import CTA. Once a CSV is loaded, all analytics populate.

## CSV format

Headers are auto-detected from common broker exports (TradingView, IBKR, Webull, etc.). Minimum required: `date` and `symbol`. The recommended schema is:

```csv
date,symbol,side,qty,entry,exit,pnl,strategy,notes
2025-04-12T13:30:00Z,COIN,LONG,80,245.10,251.40,504,Strategy 1,Breakout
```

Recognized aliases:

- **date**: `date`, `datetime`, `time`, `timestamp`, `execution time`, `trade date`, `opened`, `closed`
- **side**: `side`, `direction`, `action`, `type`, `position`
- **qty**: `qty`, `quantity`, `size`, `shares`, `volume`, `contracts`
- **entry**: `entry`, `entry price`, `open price`, `buy price`
- **exit**: `exit`, `exit price`, `close price`, `sell price`
- **pnl**: `pnl`, `p&l`, `p/l`, `profit`, `net`, `realized pnl`
- **strategy**: `strategy`, `setup`, `playbook`, `tag`
- **notes**: `notes`, `note`, `comment`, `description`

If `pnl` is missing, it's derived from entry/exit/qty/side.

A sample CSV is downloadable from the import button on the Journal page.

## AI skill (`analysis.md`)

The Gemini system prompt lives at `analysis.md` in the project root. It defines the analyst persona, the trade JSON schema, formatting rules (markdown tables, behavioral lenses), and worked examples. To change how the AI behaves, edit `analysis.md` — it's bundled into the server function via Vite's `?raw` loader, so changes take effect on rebuild.

## Environment variables

| Var              | Purpose              | Default            |
| ---------------- | -------------------- | ------------------ |
| `GEMINI_API_KEY` | Google AI Studio key | required for chat  |
| `GEMINI_MODEL`   | Model override       | `gemini-2.5-flash` |

Get a key at https://aistudio.google.com/apikey.

## Project structure

```
src/
  components/
    app/         # CsvImport, EmptyState, MetricCard, Sidebar, Sparkline,
                 # PageHeader, TradingViewChart
    ui/          # shadcn/ui primitives
  lib/
    auth.tsx     # demo auth context
    trades.tsx   # trade store + types + formatters
    ai-chat.ts   # Gemini server function (reads analysis.md)
    utils.ts     # cn helper
  routes/
    __root.tsx
    index.tsx           # → /login or /dashboard
    login.tsx
    _app.tsx            # protected layout (sidebar)
    _app.dashboard.tsx
    _app.journal.tsx
    _app.analytics.tsx
    _app.ai.tsx
    _app.profile.tsx
    _app.trade.$id.tsx
analysis.md      # AI skill prompt
```

## Scripts

```bash
bun dev        # vite dev server
bun run build  # production build
bun run lint   # eslint
bun run format # prettier
```
