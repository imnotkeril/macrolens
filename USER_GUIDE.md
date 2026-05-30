# MacroLens User Guide

MacroLens is a macro trading dashboard for monitoring business-cycle conditions, Fed policy, yield curve risk, inflation pressure, cross-asset confirmation, and model-driven regime forecasts.

## Getting Started

1. Open the app at `http://localhost:3000`.
2. Use the left sidebar to move between dashboard sections.
3. Use the refresh control in the header after loading or updating macro data.
4. Review error banners first. They show which backend data source failed and provide a retry action where available.

## Main Workflow

1. Start on **Dashboard** for the current macro regime, recession risk, Fed stance, yield curve snapshot, allocation summary, and trading ideas.
2. Open **Radar** to inspect the cycle score, recession probability, checklist, and historical cycle context.
3. Open **Macro Sentiment** to drill into leading, coincident, lagging, and inflation indicator groups.
4. Open **Fed Policy** to review policy score, rate path, FOMC probabilities, rate decisions, and balance sheet metrics.
5. Open **Yield Curve** to inspect curve shape, spreads, momentum, percentiles, and curve-pattern interpretation.
6. Open **Inflation** to compare CPI/PCE/PPI measures, breakevens, expectations, and component contribution.
7. Use **Analysis** for relative performance, major indices and Bitcoin, market breadth, and macro overview charts.
8. Use **Forecast Lab** after model artifacts are trained to compare phase probabilities, macro forecasts, stress diagnostics, and ensemble evidence.
9. Use **Calendar** for event briefings, economic calendar views, FOMC minutes, events exploration, and news.
10. Use **Reports** to prepare printable report views and previews.

## Page Guide

### Dashboard

Dashboard is the executive view. It combines the active navigator quadrant, cycle score, Fed policy score, recession risk, yield curve, cross-asset signals, allocation, factor tilts, sectors, geography, and trading ideas.

Use it when you need a fast answer to: "What regime are we in and what should I watch next?"

### Radar

Radar focuses on cycle and recession risk. It includes current cycle score, recession probability, recession checklist, historical cycle-score chart, recession probability history, and tables for underlying signals.

Use it to validate whether the dashboard regime is backed by recession evidence.

### Macro Sentiment

Macro Sentiment breaks the macro score into indicator families. It separates the cycle-sensitive categories from inflation so the user can see whether macro conditions are broad-based or concentrated in one group.

Use it to inspect the data behind the growth side of the navigator.

### Fed Policy

Fed Policy shows policy stance, rate decision history, FOMC probabilities, rate path/dot plot, policy score, and balance sheet metrics.

Use it to inspect the policy side of the navigator and identify whether the Fed backdrop is easing, neutral, or tightening.

### Yield Curve

Yield Curve shows spread history, curve dynamics, tenor snapshots, percentiles, SOFR/EFFR context, and curve-pattern labels.

Use it to separate growth stress, policy pressure, and curve-shape signals.

### Inflation

Inflation shows CPI, Core CPI, PCE, Core PCE, PPI, Core PPI, breakevens, expectations, and component contribution charts.

Use it to check whether inflation pressure supports or contradicts Fed and cycle signals.

### Analysis

Analysis provides market confirmation screens:

- **Relative Performance** compares sectors, currencies, and sentiment-sensitive baskets.
- **Major Indices & Bitcoin** tracks index trends, Bitcoin, dominance, and major market context.
- **Market Breadth** monitors internal participation and breadth metrics.
- **Macro Overview** combines ratios and macro cross-check charts.

Use these pages to confirm macro conclusions with price action.

### Forecast Lab

Forecast Lab is the model and diagnostics workspace. It reads trained backend artifacts and displays phase probabilities, ensemble weights, macro forecasts, stress bands, feature importances, and historical phase alignment.

If the page is empty or stale, train or refresh Forecast Lab artifacts from the backend before relying on the output.

### Calendar

Calendar contains event-focused pages:

- **Briefings** for summarized daily or archived macro briefings.
- **Economic Calendar** for scheduled releases and event details.
- **Events** for event exploration.
- **FOMC Minutes** for FOMC archive review.
- **News** for curated macro news views.

Some calendar screens currently use demo data while the calendar ingestion layer matures.

### Reports

Reports provides report hub and preview pages for print-ready output. Use the browser print command or the in-app print action where available.

## Data And Refresh Notes

- FRED is the primary macro data source.
- Yahoo/CoinGecko-style market feeds support cross-asset and market pages where configured.
- Forecast Lab depends on trained artifacts in `backend/data/forecast_lab_artifacts`.
- Optional LLM and memory features require Anthropic/OpenAI keys.
- Telegram ingestion is optional and disabled by default.

## Troubleshooting

- If the frontend loads but data cards fail, confirm the backend is reachable at `http://localhost:8000/api/health`.
- If Docker paths fail after moving the project, set `PROJECT_ROOT` in `.env`.
- If macro history looks too short, adjust `HISTORICAL_YEARS`, reload data, and rebuild derived analytics.
- If Forecast Lab is unavailable, check the active bundle id and training progress files under `backend/data`.
- If a chart has no observations, verify that the corresponding backend endpoint returns data before debugging the UI.
