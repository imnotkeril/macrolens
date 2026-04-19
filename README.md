# MacroLens

Macro trading and analysis framework: economic indicators, Fed policy, yield curve, and a **Trading Navigator** matrix (Macro Sentiment × FED Policy) that drives factor, sector, and geographic allocation plus concrete trading ideas.

---

## Functionality

### Three-layer analysis

1. **Economic indicators** — Leading → Coincident → Lagging by business-cycle causality: Housing → Orders → Income → Employment (Inflation tracked separately). Dozens of series from FRED, with z-scores, trends, and category-level scores.
2. **Fed policy** — Policy score from -2 (very easy) to +2 (very tight) using: effective rate vs neutral (r*), rate direction (hiking/cutting/paused), and balance sheet (QE/QT/stable). Historical scores support past and forward-looking dots on the navigator.
3. **Yield curve** — Key spreads (2Y10Y, 3M10Y), inversion and percentiles, real yields (TIPS), breakeven inflation. Curve dynamics: bull/bear steepening and flattening.

These three layers feed a single **regime** view and the **Trading Navigator**.

---

### Trading Navigator
<img width="928" height="1106" alt="image" src="https://github.com/user-attachments/assets/a852b471-d002-445b-a723-8ad15c7098d3" />


A 2×2 matrix (Macro Sentiment × FED Policy):

- **Horizontal axis (X): Macro Sentiment** — Left = negative, right = positive (from category z-scores: Housing, Orders, Income, Employment).
- **Vertical axis (Y): FED Policy** — Top = easy/dovish, bottom = tight/hawkish.
<img width="1115" height="1206" alt="image" src="https://github.com/user-attachments/assets/8b2491a9-5bc5-4c11-bca9-1919880dd52f" />
<img width="1245" height="1184" alt="image" src="https://github.com/user-attachments/assets/5b084fb1-5b2c-4981-98d2-a1218c27a131" />

**Quadrants:**

|  | Easy Fed | Tight Fed |
|--|----------|-----------|
| **Macro positive** | **Risk ON** | **VALUE** |
| **Macro negative** | **GROWTH** | **Risk OFF** |

- **Risk ON** — Cyclicals, small cap, high beta, EM, commodities.
- **GROWTH** — Quality, defensives, long bonds, gold.
- **VALUE** — Value, energy, financials, steepener.
- **Risk OFF** — Defensives, cash, low vol, flattener.

The navigator shows current position, past (6m, 1y), and forward (6m, 1y) from momentum extrapolation. Confidence is derived from cross-asset signals (gold, DXY, copper, VIX, yield curve, real yields).

**Economic Indicators**
<img width="1326" height="902" alt="image" src="https://github.com/user-attachments/assets/52dd72af-9f9d-4a79-a32c-e011383f5ba1" />

---

### Regime, cycle, and risk
<img width="1284" height="1051" alt="image" src="https://github.com/user-attachments/assets/0ed6e5fb-e9e7-4cd9-9dd7-f7e07a7ebd24" />


- **Cycle engine** — Business-cycle phase (expansion / slowdown / contraction), cycle score, 12‑month recession probability (cycle score, yield curve, Sahm + LEI + HY). Phase signals: ISM, LEI, HY spread, Sahm, SPX vs 200d MA.
- **Risk panel** — Composite from yield curve, VIX, real yield, gold: “Mild Risk On” / “Mild Risk Off”.

---

### Recession
<img width="1293" height="1175" alt="image" src="https://github.com/user-attachments/assets/939e0b66-b43a-4469-bd9b-891f10e2e6bf" />

- **Checklist** — 2Y10Y inversion, ISM PMI &lt;50 (3m), unemployment, jobless claims, housing starts, LEI (6m decline), placeholders for corporate profits and HY spreads.
- **12‑month probability** — Combined from cycle score, 10Y–3M spread (NY Fed–style), 3‑factor model (Sahm, LEI, HY).
- **Alerts** — When checklist fires above threshold (e.g. ≥5 items), with short explanation and typical lead time.

---

### Inflation
<img width="1152" height="1186" alt="image" src="https://github.com/user-attachments/assets/59de2de4-bb5a-4440-9098-173722987709" />

CPI, Core CPI, PCE, Core PCE, PPI, Core PPI (levels and MoM/YoY), breakeven (5Y/10Y), Michigan 5Y expectations. Used in cycle/regime layer and available for charts and analysis (not part of the navigator’s Macro Sentiment axis).

---

### Recommendations
<img width="1257" height="894" alt="image" src="https://github.com/user-attachments/assets/3493ecba-2ffd-4f83-8558-b3bf850555c0" />
<img width="1245" height="1206" alt="image" src="https://github.com/user-attachments/assets/fd7a97fa-2b45-4b3a-a722-09ec76c75108" />

For the active quadrant:

- **Factor tilts** — Overweight / neutral / underweight: Growth, Value, Quality, Size, Beta, Cyclicals, Defensives.
- **Representative tickers** — ETF/ticker lists per factor (e.g. VUG, QQQ, XLY, XLI).
- **Sector allocations** — Technology, Financials, Energy, etc. with rationale.
- **Asset allocation** — Target % for equities, bonds, commodities, cash, gold.
- **Geography** — DM vs EM tilt.
- **Trading ideas** — Spreads and pairs by quadrant (e.g. Long XLY/Short XLP, steepener/flattener, Long IWM/Short SPY, Long EEM/Short EFA, Long TLT, Long UUP) with name, type, legs, description.

---

### Cross-asset signals

- Gold (30d) — easy vs tight Fed.
- DXY (30d) — risk on/off, funding.
- Copper (30d) — growth proxy.
- VIX — fear/complacency.
- Yield curve — inversion (recession).
- 10Y real yield — financial conditions.

---

### Calendar and alerts — Coming soon

- **Economic calendar** — Upcoming and recent releases for tracked indicators.
- **Alerts** — Stored events (e.g. recession threshold, yield curve inversion) with optional read state and counts.

---

### Data

- **Source** — FRED (Federal Reserve Economic Data); free API key required.
- **Stored** — Indicators and history, Fed rates and balance sheet, yield curve, market series (VIX, DXY, gold, copper, LEI, ISM, etc.), regime/cycle series.
- **Refresh** — Backend jobs for periodic pull from FRED and optional caches.

---

## ML Regime — Coming soon

An ML layer on top of the rule-based regime is planned: regime probabilities (not only hard labels), macro + market features, and explainability (feature importance). A dedicated **ML Regime** page will show rule-based vs ML regime, history, and key indicator contribution. Not yet implemented.

---

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL, async.
- **Frontend**: Next.js, TypeScript, Tailwind.
- **Deploy**: Docker Compose (PostgreSQL, backend, frontend).

See repo for run instructions and `docker-compose.yml`.
