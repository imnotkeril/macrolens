# MacroLens User Guide

MacroLens is a macro trading terminal. It shows the business-cycle regime, recession risk, Fed policy,
yield curve, inflation, market confirmation (cross-asset, breadth, indices) and model-driven forecasts
from the Forecast Lab. Data comes from FRED and market data providers and is refreshed by the backend
on a daily and monthly schedule.

Each number on a page is explained by the page's own labels and the notes in this guide.

## Getting started

1. Open the app. Local default: `http://localhost:3000`. Production: the Vercel URL you were given.
2. The root address `/` opens the Dashboard.
3. The left sidebar lists the pages, in this order: **Dashboard** (`/dashboard`), **Radar**, **Macro
   Sentiment**, **Fed Policy**, **Yield Curve**, **Inflation**, **Analysis** (Relative Performance,
   Major Indices & Bitcoin, Market Breadth, Macro Overview), **Forecast Lab**, **Calendar**, **Reports**.
   There is no Indicators entry in the sidebar; `/indicators` redirects to Macro Sentiment.
4. Read error banners first. They name the backend request that failed. If a card is empty, check the
   backend health (`/api/health`) and the data freshness (see the troubleshooting section).

### Admin actions and the API key

Some actions change data or start jobs: refreshing data, training Forecast Lab, writing snapshots,
running agents. These need the admin key. When you trigger one, the app asks
`Admin API key required for this action`. Enter the `ADMIN_API_KEY` set for your deployment. The key is
kept in this browser's local storage, so you enter it once per browser. Reading pages does not need it.
Marking alerts as read does not need it either.

## Main workflow

1. **Dashboard**: the current navigator quadrant, cycle score, Fed policy score, recession probability,
   yield curve snapshot, cross-asset signals, allocation, factor tilts and trading ideas.
2. **Radar**: cycle score history, recession probability, the recession checklist and the signals
   behind them.
3. **Macro Sentiment**: leading, coincident, lagging and inflation indicator groups.
4. **Fed Policy**: policy score and stance, FOMC probabilities, rate decisions, rate path and balance sheet.
5. **Yield Curve**: spreads, curve momentum, tenor snapshot, percentiles and curve-pattern labels.
6. **Inflation**: CPI, Core CPI, PCE, Core PCE, PPI, Core PPI, breakevens, expectations and components.
7. **Analysis**: relative performance, major indices and Bitcoin, market breadth, macro overview ratios.
8. **Forecast Lab**: phase probabilities, ensemble weights, macro forecasts, stress bands and diagnostics.
   Empty or stale output means the active model bundle needs training or refresh.
9. **Calendar**: briefings, economic calendar, events, FOMC minutes and news.
10. **Reports**: report hub and print-ready previews.

## Page guide

### Dashboard

The executive view. It combines the navigator quadrant with the cycle score, Fed policy score,
recession probability, yield curve, cross-asset confirmation, allocation, factor tilts, sector and
geography bias, and trading ideas. Use it for "what regime are we in and what should I watch next?"

### Radar

Cycle score and recession probability, with the recession checklist and historical timelines.
Use it to check whether the dashboard regime is backed by recession evidence.

### Macro Sentiment

Indicator categories (leading, coincident, lagging, inflation) with category scores, KPI history and
indicator details. Use it to see whether conditions are broad-based or concentrated in one group.
The `/indicators` route redirects here.

### Fed Policy

Policy score and stance, FOMC probabilities, rate-decision history, the rate path and dot plot,
and Fed balance sheet metrics. An AI context card appears only when the agent services are configured.

### Yield Curve

Treasury tenor snapshot, key spreads (for example 2Y10Y) and their history, curve momentum, percentile
tables, curve dynamics and pattern labels, with SOFR/EFFR context where available.

### Inflation

CPI, Core CPI, PCE, Core PCE, PPI and Core PPI, breakevens and expectations, and component
contribution. Use it to check whether inflation supports or contradicts the Fed and cycle signals.

### Analysis

- **Relative Performance**: sector, currency and sentiment-relative charts.
- **Major Indices & Bitcoin**: index trend context, Bitcoin, dominance and breadth overlays.
- **Market Breadth**: participation, highs and lows, moving-average breadth.
- **Macro Overview**: macro ratios and cross-check charts (liquidity, inflation, spreads, leading indicators).

Use these to confirm macro conclusions with price action.

### Forecast Lab

Model and diagnostics workspace. It reads the trained artifacts in the backend and shows phase
probabilities, ensemble evidence, macro forecasts by series and horizon, stress bands, feature
importances and historical phase alignment. Output is only as current as the active bundle.

### Calendar

- **Briefings** (`/calendar/briefings`): daily and archived macro briefings. `/calendar-alerts` redirects here.
- **Economic Calendar**: scheduled releases and event details.
- **Events**: event exploration.
- **FOMC Minutes**: FOMC archive review.
- **News**: curated macro news.

Some calendar screens still show demo data while calendar ingestion matures. Check the source note on
each screen before relying on it.

### Reports

Report hub and preview pages for print-ready output. Use the browser print command.

### Legacy and redirect routes

- `/` redirects to `/dashboard`.
- `/compare` redirects to `/dashboard`.
- `/indicators` redirects to `/macro-sentiment`.
- `/next` redirects to `/dashboard`; `/next/<path>` redirects to `/<path>`.

## Data and refresh

- **FRED** is the primary macro source: rates, yield curve, inflation, labor and activity series.
- **Yahoo** market data supplies indices, ETFs, commodities, FX and volatility.
- **CoinGecko** public endpoints supply crypto market data; an optional Pro key extends history.
- Refresh runs on a schedule (daily market and yield data, weekly claims and balance sheet, monthly
  macro data, then alert checks, intelligence and memory jobs). The admin refresh action runs a
  collection on demand.
- Forecast Lab depends on trained artifacts under `backend/data/forecast_lab_artifacts`.
- Agent cards and memory search need `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` respectively; without
  them the app uses rule-based text and hash embeddings.
- Telegram news ingestion is off by default (`TELEGRAM_INGESTION_ENABLED=false`).

## Troubleshooting

- **Cards show errors**: open `http://localhost:8000/api/health` (or the deployed `/api/health`). If it fails, the
  backend or database is down.
- **Docker paths fail after moving the project**: set `PROJECT_ROOT` in `.env`.
- **Macro history looks too short**: check `HISTORICAL_YEARS`, run the admin backfill, then refresh.
- **Forecast Lab is empty**: check the active bundle id in `backend/data/forecast_lab_artifacts/active_bundle_id.txt`
  and the training progress files in `backend/data`.
- **A chart has no points**: call the endpoint behind it (see `llms.txt`); if it returns no data,
  the problem is the data, not the page.
- **Actions return "Admin API key required" or 401**: enter the current `ADMIN_API_KEY` when prompted.
  If the prompt never appears, the deployment has no `ADMIN_API_KEY` set (writes return 503).
