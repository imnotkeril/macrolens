"""
ML Dataset Builder for Navigator Regime Prediction.

Builds a point-in-time dataset: for each month-end date, computes growth_score,
fed_policy_score, quadrant (ground truth) and cycle/feature values known at that date.
Uses a fresh DB session per month to avoid connection drops on long runs.
Saves to Parquet for reproducibility. No future data leakage.
"""
import json
import logging
import os
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.services.navigator_engine import NavigatorEngine, CATEGORY_WEIGHTS
from app.services.fed_tracker import FedTracker
from app.services.cycle_engine import CycleEngine
from app.services.progress_store import set_train_progress
from app.models.indicator import Indicator, IndicatorValue
from sqlalchemy import select, desc
import numpy as np

logger = logging.getLogger(__name__)


def _debug_log(message: str, data: dict, hypothesis_id: str, run_id: str = "run1") -> None:
    payload = {
        "sessionId": "7f91af",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": "ml_dataset_builder",
        "message": message,
        "data": data,
    }
    logger.info("DEBUG_NDJSON %s", json.dumps(payload, ensure_ascii=False))
    try:
        log_path = os.environ.get("DEBUG_LOG_PATH")
        if not log_path:
            _p = Path(__file__).resolve()
            for _ in range(5):
                _p = _p.parent
            _log = _p / "debug-7f91af.log"
            if _p.root == str(_p) or not _p.exists():
                _log = Path.cwd() / "debug-7f91af.log"
            log_path = str(_log)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({**payload, "timestamp": __import__("time").time() * 1000}, ensure_ascii=False) + "\n")
    except Exception:
        pass


QUADRANT_TO_ID = {
    "Q1_GOLDILOCKS": 0,
    "Q2_REFLATION": 1,
    "Q3_OVERHEATING": 2,
    "Q4_STAGFLATION": 3,
}
ID_TO_QUADRANT = {v: k for k, v in QUADRANT_TO_ID.items()}

# Feature columns used by XGBoost (must match inference)
FEATURE_COLUMNS = [
    "growth_score",
    "fed_policy_score",
    "cycle_score",
    "ism_new_orders",
    "yield_curve_10y2y",
    "lei_6m_change",
    "payrolls_3m_avg",
    "gdp_gap",
    "hy_spread",
    "leading_credit",
    "consumer_confidence",
]


async def _compute_growth_at_date(db: AsyncSession, target: date) -> float:
    """Historical growth score at target date (same logic as NavigatorEngine._compute_historical_growth)."""
    total = 0.0
    for category, weight in CATEGORY_WEIGHTS.items():
        ind_q = select(Indicator.id).where(Indicator.category == category)
        ind_res = await db.execute(ind_q)
        ind_ids = [r[0] for r in ind_res.all()]
        if not ind_ids:
            continue
        z_scores = []
        for ind_id in ind_ids:
            val_q = (
                select(IndicatorValue.value)
                .where(
                    IndicatorValue.indicator_id == ind_id,
                    IndicatorValue.date <= target,
                )
                .order_by(desc(IndicatorValue.date))
                .limit(60)
            )
            val_res = await db.execute(val_q)
            values = [r[0] for r in val_res.all()]
            if len(values) >= 6:
                latest = values[0]
                arr = np.array(values)
                std = float(arr.std())
                if std > 0:
                    z_scores.append((latest - float(arr.mean())) / std)
        if z_scores:
            total += float(np.mean(z_scores)) * weight
    return max(-2.0, min(2.0, total))


def _determine_quadrant(growth: float, fed: float) -> str:
    if growth >= 0 and fed <= 0:
        return "Q1_GOLDILOCKS"
    if growth < 0 and fed <= 0:
        return "Q2_REFLATION"
    if growth >= 0 and fed > 0:
        return "Q3_OVERHEATING"
    return "Q4_STAGFLATION"


def latest_month_end_on_or_before(as_of: date) -> date:
    """Last calendar day of the month strictly before ``as_of``'s month (typical PIT month-end bar)."""
    first = as_of.replace(day=1)
    return first - timedelta(days=1)


async def get_latest_ml_feature_row(
    db: AsyncSession,
    as_of: date | None = None,
) -> tuple[float, float, float | None, dict[str, float]]:
    """
    Navigator + Fed + Cycle features at the latest completed month-end on or before ``as_of``.
    Returns (growth_score, fed_policy_score, cycle_score, feature_row) for ML1/ML2 inference.
    """
    as_of = as_of or date.today()
    month_end = latest_month_end_on_or_before(as_of)
    row = await _build_row_for_month(db, month_end)
    if not row:
        z = {k: 0.0 for k in FEATURE_COLUMNS}
        return 0.0, 0.0, None, z
    feature_row = {k: float(row.get(k) or 0.0) for k in FEATURE_COLUMNS}
    return (
        float(row.get("growth_score", 0.0)),
        float(row.get("fed_policy_score", 0.0)),
        float(row["cycle_score"]) if row.get("cycle_score") is not None else None,
        feature_row,
    )


async def _build_row_for_month(db: AsyncSession, month_end: date) -> dict | None:
    """Build one dataset row for month_end using the given session. Returns None on error."""
    try:
        growth = await _compute_growth_at_date(db, month_end)
        fed_tracker = FedTracker(db)
        fed = await fed_tracker.get_policy_score_at_date(month_end)
        quadrant = _determine_quadrant(growth, fed)
        cycle_engine = CycleEngine(db)
        # 2y lookback for z-score: faster than 10y, enough for ML
        cycle_features = await cycle_engine.get_features_at_date(
            month_end, lookback_days=730
        )
    except Exception as e:
        logger.warning("Skip date %s: %s", month_end, e)
        return None

    row = {
        "date": month_end.isoformat(),
        "as_of_date": month_end.isoformat(),
        # For current data sources we approximate publication availability at month-end close.
        "release_date": month_end.isoformat(),
        "available_at": month_end.isoformat(),
        "growth_score": round(growth, 4),
        "fed_policy_score": round(fed, 4),
        "quadrant": quadrant,
        "quadrant_id": QUADRANT_TO_ID[quadrant],
        "cycle_score": cycle_features.get("cycle_score"),
    }
    for k in [
        "ism_new_orders",
        "yield_curve_10y2y",
        "lei_6m_change",
        "payrolls_3m_avg",
        "gdp_gap",
        "hy_spread",
        "leading_credit",
        "consumer_confidence",
    ]:
        row[k] = cycle_features.get(k)
    return row


def run_leakage_audit(df: pd.DataFrame) -> dict:
    """Simple PIT leak check: available_at must not be after feature date."""
    if df.empty:
        return {"passed": False, "issues": ["empty_dataset"], "checked_rows": 0}
    if "available_at" not in df.columns:
        return {"passed": False, "issues": ["missing_available_at"], "checked_rows": len(df)}

    issues = []
    for idx, row in df.iterrows():
        d = str(row.get("date", ""))
        a = str(row.get("available_at", ""))
        if a and d and a > d:
            issues.append(f"row_{idx}: available_at>{d}")
            if len(issues) >= 10:
                break
    return {"passed": len(issues) == 0, "issues": issues, "checked_rows": len(df)}


async def diagnose_build_one_month(month_end: date) -> str | None:
    """
    Run growth, fed, cycle for one month. Return None if ok, else error message.
    Used when build returns 0 rows to surface the real failure.
    """
    async with async_session() as db:
        try:
            await _compute_growth_at_date(db, month_end)
        except Exception as e:
            return f"growth: {type(e).__name__}: {e}"
        try:
            fed_tracker = FedTracker(db)
            await fed_tracker.get_policy_score_at_date(month_end)
        except Exception as e:
            return f"fed: {type(e).__name__}: {e}"
        try:
            cycle_engine = CycleEngine(db)
            await cycle_engine.get_features_at_date(month_end, lookback_days=730)
        except Exception as e:
            return f"cycle: {type(e).__name__}: {e}"
    return None


def _month_end_range(start: date, end: date) -> list[date]:
    """List of month-end dates from start to end (inclusive)."""
    out = []
    current = start
    while current <= end:
        out.append(current)
        next_month = current.replace(day=1) + timedelta(days=32)
        current = next_month.replace(day=1) - timedelta(days=1)
    return out


async def build_dataset_single_indicator(
    output_path: str | None = None,
    max_months: int = 12,
    db: AsyncSession | None = None,
) -> pd.DataFrame:
    """
    Build a minimal dataset: one indicator only, one row per month.
    Fast: one simple query. Use to verify data loading without full pipeline.
    If db is provided (e.g. from Depends(get_db)), uses that session like Navigator/indicators.
    """
    logger.info("build_dataset_single_indicator max_months=%s", max_months)
    _debug_log("single_indicator start", {"max_months": max_months}, "H0")
    settings = get_settings()
    out_path = output_path or settings.ml_dataset_path
    end = date.today()
    last_me = (end.replace(day=1) - timedelta(days=1))
    start_me = last_me
    for _ in range(max_months - 1):
        start_me = (start_me.replace(day=1) - timedelta(days=1))
    months = _month_end_range(start_me, last_me)
    if not months:
        return pd.DataFrame()

    # Prefer "Unemployment Rate" (UNRATE) — always in seed, monthly, widely available.
    PREFERRED_FRED_ID = "UNRATE"

    async def _run_queries(session: AsyncSession):
        logger.info("single_indicator: executing indicator query (UNRATE)")
        ind_q = (
            select(Indicator.id, Indicator.name)
            .where(Indicator.fred_series_id == PREFERRED_FRED_ID)
            .limit(1)
        )
        res = await session.execute(ind_q)
        row = res.first()
        logger.info("single_indicator: indicator query done, row=%s", row is not None)
        if not row:
            # Fallback: any first indicator (e.g. if seed changed).
            logger.info("single_indicator: fallback indicator query")
            ind_q = select(Indicator.id, Indicator.name).limit(1)
            res = await session.execute(ind_q)
            row = res.first()
        if not row:
            return None, []
        ind_id, ind_name = row[0], row[1]
        logger.info("single_indicator: executing values query ind_id=%s", ind_id)
        val_q = (
            select(IndicatorValue.date, IndicatorValue.value)
            .where(
                IndicatorValue.indicator_id == ind_id,
                IndicatorValue.date >= start_me,
                IndicatorValue.date <= last_me,
            )
            .order_by(IndicatorValue.date)
        )
        val_res = await session.execute(val_q)
        raw = list(val_res.all())
        logger.info("single_indicator: values query done, len=%s", len(raw))
        return ind_name, raw

    # Always use a fresh session for minimal build to avoid request-scoped session
    # blocking or deadlocking (e.g. connection not ready, middleware lock).
    _debug_log("single_indicator before session", {"months_count": len(months)}, "H0")
    logger.info("single_indicator: using own session (minimal build)")
    async with async_session() as session:
        ind_name, raw = await _run_queries(session)

    if ind_name is None:
        logger.warning("No indicators in DB for single-indicator build")
        return pd.DataFrame()
    # For each month-end, use latest value on or before that date.
    by_month = {}
    for d, v in raw:
        by_month[d] = float(v) if v is not None else None
    sorted_dates = sorted(by_month.keys())
    rows = []
    for month_end in months:
        me_str = month_end.isoformat()
        # latest value <= month_end
        cands = [d for d in sorted_dates if d <= month_end]
        value = by_month[cands[-1]] if cands else None
        rows.append({"date": me_str, "value": value})
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    logger.info("Saved single-indicator dataset to %s: %d rows (%s)", path, len(df), ind_name)
    return df


async def build_dataset(
    start_date: date | None = None,
    end_date: date | None = None,
    output_path: str | None = None,
) -> pd.DataFrame:
    """
    Build ML dataset: one row per month-end with date, features, quadrant (ground truth).
    Uses a fresh DB session per month to avoid long-lived connection drops.
    Saves to Parquet if output_path is set. Reports progress via progress_store.
    """
    logger.info("build_dataset() entered start_date=%s end_date=%s", start_date, end_date)
    settings = get_settings()
    out_path = output_path or settings.ml_dataset_path
    end_date = end_date or date.today()
    max_years = getattr(settings, "ml_dataset_max_years", 5)
    if start_date is None:
        start_date = end_date - timedelta(days=365 * max_years)
    start_ts = start_date.replace(day=1) + timedelta(days=32)
    start_ts = start_ts.replace(day=1) - timedelta(days=1)
    if start_ts > end_date:
        start_ts = end_date.replace(day=1) - timedelta(days=1)

    months = _month_end_range(start_ts, end_date)
    total = len(months)
    rows = []

    _debug_log(
        "build_dataset start",
        {
            "start_ts": str(start_ts),
            "end_date": str(end_date),
            "total_months": total,
            "out_path": out_path,
        },
        "H3",
    )

    for i, month_end in enumerate(months):
        async with async_session() as db:
            row = await _build_row_for_month(db, month_end)
        if row:
            rows.append(row)
        # Progress: dataset build is 0–50% of full train
        pct = (i + 1) / total * 50.0 if total else 0.0
        if (i + 1) % 6 == 0 or i == 0 or i == total - 1:
            set_train_progress(
                percent=pct,
                message=f"Building dataset… {month_end.isoformat()} ({i + 1}/{total})",
                log_line=f"[{pct:.0f}%] {month_end.isoformat()} ({i + 1}/{total})",
            )

    _debug_log(
        "build_dataset after loop",
        {"len_rows": len(rows), "total_months": total, "first_month": str(months[0]) if months else None},
        "H1",
    )
    if not rows and months:
        first = months[0]
        async with async_session() as _db:
            for step, coro_fn in [
                ("growth", lambda: _compute_growth_at_date(_db, first)),
                ("fed", lambda: FedTracker(_db).get_policy_score_at_date(first)),
                ("cycle", lambda: CycleEngine(_db).get_features_at_date(first)),
            ]:
                try:
                    await coro_fn()
                except Exception as sample_e:
                    logger.warning(
                        "Dataset empty: first-month %s failed: %s",
                        step,
                        sample_e,
                        exc_info=True,
                    )
                    _debug_log(
                        f"sample error first month ({step})",
                        {"error": str(sample_e)[:300]},
                        "H1",
                    )
                    break

    df = pd.DataFrame(rows)
    if df.empty:
        logger.warning("Dataset is empty")
        _debug_log("build_dataset returning empty df (no parquet written)", {"out_path": out_path}, "H5")
        return df

    # Fill NaN features with 0 for model compatibility
    for c in FEATURE_COLUMNS:
        if c not in df.columns:
            df[c] = 0.0
        else:
            df[c] = df[c].fillna(0.0)

    df = df.sort_values("date").reset_index(drop=True)

    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    _debug_log(
        "build_dataset writing parquet",
        {"path_resolved": str(path.resolve()), "rows": len(df), "out_path": out_path},
        "H4",
    )
    df.to_parquet(path, index=False)
    logger.info("Saved ML dataset to %s: %d rows from %s to %s", path, len(df), df["date"].min(), df["date"].max())

    return df
