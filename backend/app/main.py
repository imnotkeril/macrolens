import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, async_session
from app.api import indicators, fed, yield_curve, navigator, alerts, calendar, market, regime, data
from app.tasks.scheduler import start_scheduler, shutdown_scheduler
from app.services.indicator_analyzer import IndicatorAnalyzer

logger = logging.getLogger(__name__)

# So Docker captures logs (stdout); otherwise container Logs tab stays empty.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
    force=True,
)

try:
    from app.api import ml
    _ml_available = True
except Exception as e:
    logger.warning("ML API not loaded: %s. Predictive page will be unavailable.", e)
    ml = None
    _ml_available = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Compute z-scores and trends on startup
    try:
        async with async_session() as db:
            analyzer = IndicatorAnalyzer(db)
            await analyzer.update_all_analytics()
            logger.info("Indicator analytics computed on startup")
    except Exception:
        logger.exception("Failed to compute startup analytics")

    start_scheduler()
    yield
    shutdown_scheduler()
    await engine.dispose()


app = FastAPI(
    title="MacroLens API",
    description="Macro Trading & Analysis Framework",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow frontend from localhost and 127.0.0.1 (browser Origin varies by how user opens the app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(indicators.router, prefix="/api/indicators", tags=["Indicators"])
app.include_router(fed.router, prefix="/api/fed", tags=["Fed Policy"])
app.include_router(yield_curve.router, prefix="/api/yield-curve", tags=["Yield Curve"])
app.include_router(navigator.router, prefix="/api/navigator", tags=["Navigator"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(market.router, prefix="/api/market", tags=["Market"])
app.include_router(regime.router, prefix="/api/regime", tags=["Regime"])
app.include_router(data.router, prefix="/api/data", tags=["Data"])
if _ml_available and ml is not None:
    app.include_router(ml.router, prefix="/api/ml", tags=["ML Regime"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "MacroLens API"}
