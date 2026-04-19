"""Forecast Lab API — isolated from /api/ml and /api/ml2."""

from __future__ import annotations

import logging
import math
from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session, get_db
from app.models.forecast_lab import ForecastLabPredictionLog, RegimeHistoryMonthly
from app.schemas.forecast_lab import (
    BundleInfoResponse,
    DiagnosticsOOSResponse,
    ForecastLabSummaryResponse,
    LogSnapshotResponse,
    PhaseAssetAlignmentResponse,
    RegimeHistoryListResponse,
    RegimeHistoryMaterializeResponse,
    RegimeHistoryRow,
    TrainStartResponse,
    TrainStatusResponse,
)
from app.services.forecast_lab.artifacts import active_bundle_dir, load_meta, resolve_artifacts_dir
from app.services.forecast_lab.diagnostics import oos_payload, phase_asset_alignment_payload
from app.services.forecast_lab.inference import build_summary
from app.services.forecast_lab.progress import get_progress, set_progress
from app.services.forecast_lab.regime_history_materialize import (
    fetch_regime_history,
    materialize_regime_history_monthly,
)
from app.services.forecast_lab.train_pipeline import run_training

logger = logging.getLogger(__name__)

router = APIRouter()


def _regime_orm_to_schema(row: RegimeHistoryMonthly) -> RegimeHistoryRow:
    """ORM → Pydantic; coerce non-finite floats so response JSON never carries NaN (breaks clients / validation)."""

    def sf(v: object, default: float = 0.0) -> float:
        try:
            x = float(v)  # type: ignore[arg-type]
            return x if math.isfinite(x) else default
        except (TypeError, ValueError):
            return default

    def sfo(v: object | None) -> float | None:
        if v is None:
            return None
        try:
            x = float(v)  # type: ignore[arg-type]
            return x if math.isfinite(x) else None
        except (TypeError, ValueError):
            return None

    ma: datetime | None = row.materialized_at
    if ma is not None and ma.tzinfo is not None:
        ma = ma.replace(tzinfo=None)

    return RegimeHistoryRow(
        obs_date=row.obs_date,
        navigator_growth_score=sf(row.navigator_growth_score),
        navigator_fed_score=sf(row.navigator_fed_score),
        navigator_quadrant=str(row.navigator_quadrant),
        fl_growth_score=sf(row.fl_growth_score),
        fl_fed_policy_score=sf(row.fl_fed_policy_score),
        fl_yield_10y_minus_2y=sf(row.fl_yield_10y_minus_2y),
        fl_hy_spread_proxy=sf(row.fl_hy_spread_proxy),
        fl_rule_quadrant=str(row.fl_rule_quadrant),
        asset_implied_quadrant=str(row.asset_implied_quadrant),
        asset_confirmation_score=sf(row.asset_confirmation_score, -1.0),
        asset_confirmed=bool(row.asset_confirmed),
        asset_used_rule_fallback=bool(row.asset_used_rule_fallback),
        forward_confirmation_score=sf(row.forward_confirmation_score, -1.0),
        forward_regime_confirmed=bool(row.forward_regime_confirmed),
        confirmed_regime_quadrant=row.confirmed_regime_quadrant,
        yield_curve_pattern=row.yield_curve_pattern,
        yield_curve_short_chg_1m_bp=sfo(row.yield_curve_short_chg_1m_bp),
        yield_curve_long_chg_1m_bp=sfo(row.yield_curve_long_chg_1m_bp),
        navigator_curve_matches_expectation=row.navigator_curve_matches_expectation,
        fl_rule_curve_matches_expectation=row.fl_rule_curve_matches_expectation,
        fl_curve_pattern_embed=sfo(row.fl_curve_pattern_embed),
        materialization_batch_id=str(row.materialization_batch_id),
        materialized_at=ma,
    )


@router.get("/summary", response_model=ForecastLabSummaryResponse)
async def get_summary(
    as_of: date | None = None,
    align_month_end: bool | None = Query(
        None,
        description="If true, use last completed month-end on or before as_of. If omitted, uses Settings.forecast_lab_summary_align_month_end.",
    ),
    db: AsyncSession = Depends(get_db),
):
    return await build_summary(db, as_of, align_month_end)


@router.get("/bundle", response_model=BundleInfoResponse)
async def get_bundle():
    bundle_path = active_bundle_dir()
    meta = load_meta(bundle_path)
    if not meta:
        return BundleInfoResponse(bundle_id="untrained", trained=False, label_mode=None, label_stats=None)
    return BundleInfoResponse(
        bundle_id=meta.get("bundle_id", "unknown"),
        trained=True,
        trained_at=meta.get("trained_at"),
        metrics=meta.get("metrics", {}),
        feature_names=meta.get("feature_names", []),
        label_mode=meta.get("label_mode"),
        label_stats=meta.get("label_stats"),
    )


@router.post("/train", response_model=TrainStartResponse)
async def post_train(background_tasks: BackgroundTasks):
    settings = get_settings()
    if not settings.forecast_lab_enable_train_endpoint:
        raise HTTPException(status_code=403, detail="Forecast Lab train endpoint disabled")
    resolve_artifacts_dir().mkdir(parents=True, exist_ok=True)
    set_progress(0.0, "queued", "[0%] queued", done=False)
    logger.info("forecast_lab train queued (background)")

    async def _run():
        async with async_session() as session:
            try:
                await run_training(session)
            except Exception:
                logger.exception("forecast_lab train failed")
                set_progress(100.0, "error", "[100%] failed", done=True)

    background_tasks.add_task(_run)
    return TrainStartResponse(status="started", message="Training scheduled in background")


@router.post("/train/reset-progress", response_model=TrainStatusResponse)
async def post_train_reset_progress():
    """Clear stuck 'in progress' state so the UI can start training again."""
    from app.services.forecast_lab.progress import reset_progress_idle

    reset_progress_idle()
    p = get_progress()
    return TrainStatusResponse(
        done=bool(p.get("done", True)),
        percent=float(p.get("percent", 0)),
        message=str(p.get("message", "")),
        log_line=p.get("log_line"),
    )


@router.get("/train/status", response_model=TrainStatusResponse)
async def train_status():
    p = get_progress()
    return TrainStatusResponse(
        done=bool(p.get("done", True)),
        percent=float(p.get("percent", 0)),
        message=str(p.get("message", "")),
        log_line=p.get("log_line"),
    )


@router.get("/diagnostics/oos", response_model=DiagnosticsOOSResponse)
async def diagnostics_oos():
    d = oos_payload()
    mid = d.get("bundle_id", "untrained")
    rest = {k: v for k, v in d.items() if k != "bundle_id"}
    return DiagnosticsOOSResponse(bundle_id=mid, metrics=rest)


@router.post("/regime-history/materialize", response_model=RegimeHistoryMaterializeResponse)
async def post_regime_history_materialize(
    date_from: date | None = None,
    date_to: date | None = None,
    asset_confirm_threshold: float = Query(0.5, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
):
    """Fill/update `regime_history_monthly`: Navigator + FL rule + lookback asset-implied + forward rule confirmation (YAML horizon)."""
    settings = get_settings()
    df = date_from or date.fromisoformat(settings.forecast_lab_date_from)
    dt = date_to or date.today()
    out = await materialize_regime_history_monthly(
        db, df, dt, asset_confirm_threshold=asset_confirm_threshold
    )
    return RegimeHistoryMaterializeResponse(
        rows=int(out["rows"]),
        batch_id=str(out["batch_id"]),
        horizon_months=int(out["horizon_months"]),
        message=out.get("message"),
        errors=int(out["errors"]) if out.get("errors") is not None else None,
    )


@router.get("/regime-history", response_model=RegimeHistoryListResponse)
async def get_regime_history(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    df = date_from or date.fromisoformat(settings.forecast_lab_date_from)
    dt = date_to or date.today()
    rows = await fetch_regime_history(db, df, dt)
    items = [_regime_orm_to_schema(r) for r in rows]
    return RegimeHistoryListResponse(items=items, count=len(items))


@router.get("/diagnostics/phase-asset-alignment", response_model=PhaseAssetAlignmentResponse)
async def diagnostics_phase_asset(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    df = date_from or date.fromisoformat(settings.forecast_lab_date_from)
    dt = date_to or date.today()
    d = await phase_asset_alignment_payload(db, df, dt)
    return PhaseAssetAlignmentResponse(
        bundle_id=d["bundle_id"],
        horizon_months=int(d["horizon_months"]),
        overall_hit_rate=d.get("overall_hit_rate"),
        by_quadrant=d.get("by_quadrant", {}),
        sample_size=d.get("sample_size"),
        note=d.get("note"),
    )


@router.post("/log-snapshot", response_model=LogSnapshotResponse)
async def post_log_snapshot(
    as_of: date | None = None,
    align_month_end: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    payload = await build_summary(db, as_of, align_month_end)
    row = ForecastLabPredictionLog(
        as_of_date=payload.as_of_date,
        bundle_id=payload.bundle_id,
        payload_json=payload.model_dump(mode="json"),
    )
    db.add(row)
    if settings.forecast_lab_memory_ingest_enabled:
        try:
            from app.services.memory_ingestion_service import MemoryIngestionService

            await MemoryIngestionService().ingest_forecast_lab_summary(db, payload)
        except Exception:
            logger.exception("forecast_lab memory ingest failed")
    await db.commit()
    await db.refresh(row)
    return LogSnapshotResponse(status="ok", id=row.id)
