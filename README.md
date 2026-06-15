# MacroLens

**Professional macro trading terminal** for regime analysis, Fed policy, yield curves, inflation, cross-asset confirmation, Forecast Lab diagnostics, and report-ready market intelligence.

<p align="center">
  <a href="#run-with-docker"><strong>Run with Docker</strong></a>
  &nbsp;|&nbsp;
  <a href="USER_GUIDE.md">User guide</a>
  &nbsp;|&nbsp;
  <a href="frontend/ARCHITECTURE.md">Frontend architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white" alt="Python 3.12">
  <img src="https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white" alt="Next.js 14">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
</p>

MacroLens combines economic indicators, Fed policy, yield curve dynamics, inflation, market breadth, cross-asset signals, AI-assisted context, and Forecast Lab model artifacts into a signal-first dashboard for macro trading decisions.

---

## Contents

- [Screenshots](#screenshots)
- [What MacroLens Does](#what-macrolens-does)
- [Key Features](#key-features)
- [Requirements](#requirements)
- [Project Structure](#project-structure)
- [Run With Docker](#run-with-docker)
- [Run Locally](#run-locally)
- [Configuration](#configuration)
- [Data Sources](#data-sources)
- [Testing And Code Quality](#testing-and-code-quality)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Operational Notes](#operational-notes)
- [Acknowledgments](#acknowledgments)

---

### Dashboard

<img width="2269" height="1264" alt="Снимок экрана 2026-05-31 060914" src="https://github.com/user-attachments/assets/3094f32d-4586-47ab-af8a-b51d3307238b" />


### Radar

<img width="2291" height="1265" alt="Снимок экрана 2026-05-31 060333" src="https://github.com/user-attachments/assets/5241b1ff-d6e2-4c01-a6d6-3e47f18776cc" />


### Macro Sentiment

<img width="2294" height="1262" alt="Снимок экрана 2026-05-31 060350" src="https://github.com/user-attachments/assets/1d7d5498-784a-454f-abf2-7fadf1fbdcd3" />


### Fed Policy

<img width="2267" height="1254" alt="Снимок экрана 2026-05-31 060439" src="https://github.com/user-attachments/assets/c9220f52-aaa5-4c6f-85ca-69f541bf41af" />


### Yield Curve

<img width="2279" height="1257" alt="Снимок экрана 2026-05-31 060500" src="https://github.com/user-attachments/assets/fb7540d7-aa11-4313-b254-47c3d6948db3" />


### Inflation

<img width="2241" height="1265" alt="Снимок экрана 2026-05-31 060515" src="https://github.com/user-attachments/assets/b605c4ef-7938-4921-b021-ab771117433c" />


### Analysis: Relative Performance

<img width="2266" height="1256" alt="Снимок экрана 2026-05-31 060628" src="https://github.com/user-attachments/assets/fceb089d-d9c1-4f24-8090-a8c162549f8f" />


### Forecast Lab

<img width="2270" height="1260" alt="Снимок экрана 2026-05-31 060851" src="https://github.com/user-attachments/assets/3cf81019-6a5c-49b5-be75-dab5d3607c9b" />


### Calendar

<img width="2276" height="1253" alt="Снимок экрана 2026-05-31 063028" src="https://github.com/user-attachments/assets/3b4f1be6-108d-4e16-8f17-ee30447b866f" />


---

## What MacroLens Does

| Layer | Purpose | Primary Pages |
|------|---------|---------------|
| **Macro cycle** | Tracks growth, recession, and business-cycle pressure across indicator groups | Dashboard, Radar, Macro Sentiment |
| **Fed policy** | Scores policy stance using rates, neutral-rate context, direction, FOMC probabilities, and balance sheet | Dashboard, Fed Policy |
| **Yield curve** | Monitors spread inversion, curve momentum, tenor snapshots, percentiles, and curve-pattern signals | Dashboard, Yield Curve, Radar |
| **Inflation** | Tracks CPI, PCE, PPI, breakevens, expectations, and component contribution | Inflation, Dashboard |
| **Market confirmation** | Confirms macro regimes with relative performance, breadth, indices, Bitcoin, and cross-asset behavior | Analysis, Dashboard |
| **Forecast Lab** | Displays trained phase models, macro forecasts, ensemble evidence, stress diagnostics, and feature importances | Forecast Lab |
| **Workflow outputs** | Supports macro briefings, event review, report previews, and printable dashboards | Calendar, Reports |

The core decision model is the **Trading Navigator**: a regime matrix that combines macro sentiment and Fed policy into allocation, factor, sector, geography, and trading-idea context.

---

## Key Features

### Dashboard And Navigator

- Active macro regime and navigator quadrant
- Fed policy score, macro sentiment score, recession probability, and yield curve snapshot
- Cross-asset confirmation from risk, dollar, commodities, volatility, and curve signals
- Allocation summary across equities, bonds, commodities, cash, and gold
- Factor tilts, sector allocation, geography bias, and trading ideas

### Radar

- Cycle score and recession probability panels
- Recession checklist and historical recession bands
- Cycle-score and recession-probability timelines
- Tables for recession model evidence and signal-level context

### Macro Sentiment

- Leading, coincident, lagging, and inflation category views
- Category-level macro scoring
- KPI history and selected indicator details
- Backend-backed loading, error, and empty states

### Fed Policy

- Policy score and stance interpretation
- FOMC probabilities and rate-decision history
- Rate path and dot-plot style views
- Fed balance sheet and balance metrics
- AI/context card when optional agent services are configured

### Yield Curve

- Treasury tenor snapshot
- 2Y10Y and related spread history
- Curve momentum and percentile tables
- Curve dynamics and pattern interpretation
- SOFR/EFFR context where available

### Inflation

- CPI, Core CPI, PCE, Core PCE, PPI, Core PPI
- Breakevens and expectations
- Single-line, dual-line, and component-contribution charts
- Component breakdown for current inflation pressure

### Analysis

- **Relative Performance**: sector, currency, and sentiment-relative charts
- **Major Indices & Bitcoin**: index trend context, Bitcoin, dominance, and breadth overlays
- **Market Breadth**: participation, highs/lows, moving-average breadth, and internal market health
- **Macro Overview**: macro ratios and cross-check charts for liquidity, inflation, spreads, and leading indicators

### Forecast Lab

- Phase probability and ensemble dashboard
- Macro forecasts by series and horizon
- Stress bands and top z-score contributors
- Feature importance and trained artifact metadata
- Historical regime alignment and model diagnostics

### Calendar And Reports

- Briefings, economic calendar, events explorer, FOMC minutes, and news views
- Report hub and print/preview-oriented report layouts
- Compatibility redirects from `/next/*` to production routes

---

## Requirements

- **Docker** and Docker Compose for the recommended full-stack setup
- **Python** 3.12 for backend container parity, or Python 3.11+ for local development
- **Node.js** 20+ for frontend local development
- **FRED API key** for full macro data ingestion
- **Network access** for external macro and market data sources
- **RAM** 4GB+ recommended; more is useful for Forecast Lab training and large artifacts

---

## Project Structure

```text
macrolens/
  backend/
    app/
      api/             FastAPI routers
      models/          SQLAlchemy ORM models
      schemas/         Pydantic schemas
      services/        Data, analytics, Forecast Lab, agents, market logic
      tasks/           Scheduler setup
    config/            Forecast Lab and navigator configuration
    data/              Runtime data and Forecast Lab artifacts
    tests/             Pytest suite
    Dockerfile
    requirements.txt

  frontend/
    src/
      app/             Next.js routes
      components/      Shared UI and dashboard screens
      features/        Feature-level hooks, components, utilities
      lib/             API client and shared utilities
      types/           Shared TypeScript contracts
    Dockerfile
    package.json

  USER_GUIDE.md        End-user workflows and page guide
  DESIGN.md            Design tokens and visual system
  docker-compose.yml   PostgreSQL + Redis + backend + frontend
```

---

## Run With Docker

Copy the environment template first:

```powershell
Copy-Item .env.example .env
```

Set at least `FRED_API_KEY` in `.env` for full macro ingestion.

Start the stack:

```powershell
docker compose up --build
```

Open:

- **Frontend**: <http://localhost:3000>
- **Backend API**: <http://localhost:8000>
- **Health check**: <http://localhost:8000/api/health>
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

If the project was moved and Docker bind mounts resolve incorrectly, set `PROJECT_ROOT` in `.env`.

---

## Run Locally

### Backend

Start PostgreSQL and Redis yourself, or run them through Docker Compose.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The frontend proxies `/api/*` requests to the backend.

---

## Configuration

Main configuration is copied from `.env.example` into `.env`.

| Variable | Purpose |
|----------|---------|
| `FRED_API_KEY` | FRED macro data access |
| `HISTORICAL_YEARS` | Rolling FRED/Yahoo history window |
| `FORECAST_LAB_DATE_FROM` | First month-end included in Forecast Lab training features |
| `FORECAST_LAB_LABEL_MODE` | Forecast Lab target mode: `rule_v1` or `asset_implied_v1` |
| `FORECAST_LAB_INCLUDE_DASHBOARD_CONTEXT` | Adds Navigator and Radar cross-checks to Forecast Lab summary |
| `ANTHROPIC_API_KEY` | Optional agent text generation |
| `OPENAI_API_KEY` | Optional memory embeddings |
| `MEMORY_EMBEDDING_BACKEND` | `auto`, `hash`, or `openai` |
| `TELEGRAM_INGESTION_ENABLED` | Optional Telegram ingestion toggle |
| `BACKEND_INTERNAL_URL` | Frontend rewrite target in Docker |

When running the backend directly from `backend/`, copy `backend/.env.example` to `backend/.env`.

---

## Data Sources

- **FRED**: macro indicators, rates, yield curve data, inflation, and economic series
- **Yahoo-style market data**: indices, ETFs, commodities, FX proxies, volatility, and cross-asset charts
- **CoinGecko**: optional deeper crypto history with an API key
- **Anthropic**: optional generation for agent/context cards
- **OpenAI**: optional embeddings for memory retrieval
- **Telegram**: optional news ingestion when configured

---

## Testing And Code Quality

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

| Gate | Command | Status |
|------|---------|--------|
| Backend tests | `python -m pytest` | Passing: 29 tests |
| Frontend lint | `npm run lint` | Passing, no warnings |
| Frontend typecheck | `npm run typecheck` | Passing |
| Frontend production build | `npm run build` | Passing |

Known warning: backend tests currently emit one Pydantic v2 deprecation warning for class-based settings config.

---

## Documentation

- **[USER_GUIDE.md](USER_GUIDE.md)**: user workflows, page guide, data notes, and troubleshooting
- **[frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md)**: frontend module rules and migration strategy
- **[DESIGN.md](DESIGN.md)**: visual identity, tokens, layout, typography, and component guidelines
- **docs/**: internal research/specification material, ignored from publication by `.gitignore`

---

## Roadmap

### Done

- FastAPI backend with PostgreSQL, Redis, SQLAlchemy, Pydantic, scheduler, and modular routers
- Next.js dashboard shell with production routes and compatibility redirects
- Dashboard, Radar, Macro Sentiment, Fed Policy, Yield Curve, Inflation, Analysis, Forecast Lab, Calendar, and Reports pages
- Forecast Lab artifact loading, summary panels, diagnostics, and training-progress integration
- Backend pytest coverage for Forecast Lab, schema, LLM JSON extraction, retrieval, and navigator confidence logic
- Frontend lint, typecheck, and production build gates passing
- README, user guide, and frontend architecture guide refreshed for the current product

### In Progress

- Calendar ingestion maturity and replacement of remaining demo-backed calendar screens
- Forecast Lab artifact lifecycle polish and active-bundle management
- Broader automated frontend coverage for route smoke tests and visual regressions
- Pydantic settings cleanup before Pydantic v3

### Planned

- More robust CI with backend tests, frontend lint/typecheck/build, and coverage reporting
- Production deployment profile with non-reload backend/frontend commands
- Report export polish and screenshot-driven documentation updates
- Stronger data freshness monitoring and source-level observability

---

## Operational Notes

- Forecast Lab output depends on active artifacts under `backend/data/forecast_lab_artifacts`.
- Generated Forecast Lab artifacts can be large and should be handled deliberately.
- Calendar pages include a mix of backend-backed and demo-backed views while ingestion matures.
- `/next/*` routes are preserved as compatibility redirects to production routes.
- No public license file is currently included in this repository.

---

## Acknowledgments

MacroLens builds on:

- **FastAPI**, **SQLAlchemy**, **Pydantic**, **PostgreSQL**, **Redis**
- **Next.js**, **React**, **TypeScript**, **Tailwind**, **React Query**
- **Recharts**, **lightweight-charts**, **lucide-react**
- **Pandas**, **NumPy**, **scikit-learn**, **XGBoost**, **hmmlearn**
- **FRED**, market data providers, and optional LLM/embedding providers
