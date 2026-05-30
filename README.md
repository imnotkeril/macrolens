# MacroLens

MacroLens is a production-oriented macro trading dashboard built with FastAPI, PostgreSQL, Redis, Next.js, TypeScript, Tailwind, React Query, Recharts, and lightweight-charts.

It combines macro indicators, Fed policy, yield curve dynamics, inflation, cross-asset confirmation, calendar workflows, reports, and Forecast Lab model diagnostics into one signal-first interface.

## Screenshot Placeholders

Add screenshots under each heading after capturing the current UI.

### Dashboard

<!-- Add Dashboard screenshot here -->

### Radar

<!-- Add Radar screenshot here -->

### Macro Sentiment

<!-- Add Macro Sentiment screenshot here -->

### Fed Policy

<!-- Add Fed Policy screenshot here -->

### Yield Curve

<!-- Add Yield Curve screenshot here -->

### Inflation

<!-- Add Inflation screenshot here -->

### Analysis: Relative Performance

<!-- Add Relative Performance screenshot here -->

### Analysis: Major Indices & Bitcoin

<!-- Add Major Indices & Bitcoin screenshot here -->

### Analysis: Market Breadth

<!-- Add Market Breadth screenshot here -->

### Analysis: Macro Overview

<!-- Add Macro Overview screenshot here -->

### Forecast Lab

<!-- Add Forecast Lab screenshot here -->

### Calendar

<!-- Add Calendar screenshot here -->

### Reports

<!-- Add Reports screenshot here -->

## Current Features

- **Dashboard**: active regime, navigator quadrant, Fed score, macro score, recession probability, yield curve snapshot, cross-asset signals, allocation, factor tilts, sectors, geography, and trading ideas.
- **Radar**: cycle score, recession probability, recession checklist, cycle-score history, recession probability history, and recession bands.
- **Macro Sentiment**: leading, coincident, lagging, and inflation indicator views with KPI history and category-level scoring.
- **Fed Policy**: policy stance, policy score, rate path, FOMC probabilities, decision history, and balance sheet context.
- **Yield Curve**: tenor snapshot, spreads, percentiles, spread history, curve momentum, and curve-pattern interpretation.
- **Inflation**: CPI, Core CPI, PCE, Core PCE, PPI, Core PPI, breakevens, expectations, and component charts.
- **Analysis**: relative performance, major indices and Bitcoin, market breadth, and macro overview ratio pages.
- **Forecast Lab**: trained-artifact dashboard for phase probabilities, ensemble evidence, macro forecasts, stress diagnostics, feature importances, and historical phase alignment.
- **Calendar**: briefings, economic calendar, events explorer, FOMC minutes, and news views.
- **Reports**: report hub and print/preview-oriented report layouts.

## Architecture

```text
backend/
  app/
    api/          FastAPI routers
    models/       SQLAlchemy models
    schemas/      Pydantic schemas
    services/     Data, analytics, agents, Forecast Lab, and market logic
    tasks/        Scheduler setup
  tests/          Pytest coverage

frontend/
  src/
    app/          Next.js routes
    components/   Shared UI and dashboard screens
    features/     Feature-level hooks/components/utilities
    lib/          API client and shared utilities
    types/        Shared TypeScript contracts
```

The frontend architecture rules live in `frontend/ARCHITECTURE.md`.
The end-user guide lives in `USER_GUIDE.md`.

## Data Sources

- FRED for macro indicators, rates, yield curve data, inflation, and related economic series.
- Yahoo-style market feeds for cross-asset and market screens.
- CoinGecko API key is optional for deeper crypto history.
- Anthropic is optional for agent text generation.
- OpenAI is optional for memory embeddings.
- Telegram ingestion is optional and disabled by default.

## Configuration

Copy `.env.example` to `.env` in the project root for Docker Compose.

Important variables:

- `FRED_API_KEY`: required for full macro data ingestion.
- `HISTORICAL_YEARS`: rolling history window for FRED/Yahoo bulk loads.
- `FORECAST_LAB_DATE_FROM`: first month-end used in Forecast Lab training features.
- `FORECAST_LAB_LABEL_MODE`: `rule_v1` or `asset_implied_v1`.
- `ANTHROPIC_API_KEY`: optional agent generation.
- `OPENAI_API_KEY`: optional memory embeddings.
- `TELEGRAM_INGESTION_ENABLED`: optional Telegram ingestion toggle.

If running the backend directly from `backend/`, copy `backend/.env.example` to `backend/.env`.

## Run With Docker

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

If Docker uses the wrong bind-mount path after moving the project, set `PROJECT_ROOT` in `.env`.

## Run Locally

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality Gates

Backend:

```powershell
cd backend
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

Current verification status:

- Backend tests: passing.
- Frontend lint: passing with no warnings.
- Frontend typecheck: passing.
- Frontend production build: passing.

## Notes

- Forecast Lab output depends on trained artifacts under `backend/data/forecast_lab_artifacts`.
- Calendar pages include a mix of backend-backed and demo-backed screens while ingestion matures.
- Existing `/next/*` routes are kept as compatibility redirects to the production routes.
- The repository currently contains generated Forecast Lab artifacts; avoid deleting or overwriting active bundles unless you intend to retrain.
