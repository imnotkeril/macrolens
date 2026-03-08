"""
ML Regime Prediction API: predict, backtest, metrics, dataset info, train.
Training runs in a separate process so it survives uvicorn --reload.
"""
import asyncio
import json
import logging
import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.schemas.ml_regime import (
    RegimePredictResponse,
    RegimeBacktestResponse,
    RegimeMetricsResponse,
    DatasetInfoResponse,
    TrainResponse,
)
from app.services.ml_inference_service import (
    predict_current,
    get_backtest,
    get_metrics,
)
from app.services.ml_dataset_builder import (
    build_dataset,
    build_dataset_single_indicator,
    diagnose_build_one_month,
    FEATURE_COLUMNS,
)
from app.services.ml_regime_models import run_train_pipeline
from app.services.navigator_engine import NavigatorEngine
from app.services.cycle_engine import CycleEngine
from app.services.progress_store import (
    init_train_progress,
    set_train_progress,
    get_train_progress,
    get_train_progress_from_file,
)

logger = logging.getLogger(__name__)

# Backend root: same as worker cwd, so dataset/artifacts paths resolve identically
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _resolve_ml_path(path_str: str) -> Path:
    """Resolve ML path relative to backend root so API and worker use the same file."""
    p = Path(path_str)
    return p if p.is_absolute() else (_BACKEND_ROOT / p).resolve()


def _debug_log(message: str, data: dict, hypothesis_id: str, run_id: str = "run1") -> None:
    payload = {
        "sessionId": "7f91af",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": "ml.py",
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


router = APIRouter()


@router.get("/train-progress")
async def get_train_progress_endpoint():
    """Current ML train progress: percent, phase, logs. Poll from frontend.
    When a worker process is running, progress is read from file."""
    settings = get_settings()
    progress_path = _resolve_ml_path(
        getattr(settings, "ml_train_progress_file", None) or "data/ml_train_progress.json"
    )
    file_progress = get_train_progress_from_file(str(progress_path))
    if file_progress is not None:
        return file_progress
    return get_train_progress()


def _by_model_to_probs(d: dict) -> dict:
    """Convert by_model values to ModelProbs-like dict (quadrant + p_q1..p_q4)."""
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            out[k] = {
                "quadrant": v.get("quadrant"),
                "p_q1": v.get("p_q1"),
                "p_q2": v.get("p_q2"),
                "p_q3": v.get("p_q3"),
                "p_q4": v.get("p_q4"),
            }
    return out


@router.get("/regime-predict", response_model=RegimePredictResponse)
async def regime_predict(db: AsyncSession = Depends(get_db)):
    """Current nowcast: ensemble probabilities, quadrant, per-model breakdown."""
    settings = get_settings()
    nav_engine = NavigatorEngine(db)
    cycle_engine = CycleEngine(db)
    growth = await nav_engine._compute_growth_score()
    fed = await nav_engine.fed_tracker.get_policy_score()
    cycle_features = await cycle_engine.get_features_at_date(date.today())
    def _f(v):
        return float(v) if v is not None else 0.0
    feature_row = {
        "growth_score": float(growth),
        "fed_policy_score": float(fed),
        "cycle_score": _f(cycle_features.get("cycle_score")),
        "ism_new_orders": _f(cycle_features.get("ism_new_orders")),
        "yield_curve_10y2y": _f(cycle_features.get("yield_curve_10y2y")),
        "lei_6m_change": _f(cycle_features.get("lei_6m_change")),
        "payrolls_3m_avg": _f(cycle_features.get("payrolls_3m_avg")),
        "gdp_gap": _f(cycle_features.get("gdp_gap")),
        "hy_spread": _f(cycle_features.get("hy_spread")),
        "leading_credit": _f(cycle_features.get("leading_credit")),
        "consumer_confidence": _f(cycle_features.get("consumer_confidence")),
    }
    result = predict_current(
        growth_score=growth,
        fed_policy_score=fed,
        feature_row=feature_row,
        artifacts_dir=str(_resolve_ml_path(settings.ml_artifacts_dir)),
    )
    return RegimePredictResponse(
        quadrant_rule=result["quadrant_rule"],
        quadrant_ensemble=result["quadrant_ensemble"],
        confidence=result["confidence"],
        p_q1=result["p_q1"],
        p_q2=result["p_q2"],
        p_q3=result["p_q3"],
        p_q4=result["p_q4"],
        by_model=_by_model_to_probs(result["by_model"]),
        trained=result["trained"],
        ensemble_weights=result.get("ensemble_weights"),
    )


@router.get("/regime-backtest", response_model=RegimeBacktestResponse)
async def regime_backtest():
    """Backtest over test period: actual vs ensemble by date."""
    settings = get_settings()
    backtest = get_backtest(artifacts_dir=str(_resolve_ml_path(settings.ml_artifacts_dir)))
    meta = get_metrics(artifacts_dir=str(_resolve_ml_path(settings.ml_artifacts_dir)))
    test_start = meta.get("test_start") if meta else None
    test_end = meta.get("test_end") if meta else None
    return RegimeBacktestResponse(
        backtest=backtest,
        test_start=test_start,
        test_end=test_end,
    )


@router.get("/regime-metrics", response_model=RegimeMetricsResponse)
async def regime_metrics():
    """Metrics of last trained model (test accuracy, balanced accuracy, log-loss, confusion matrix)."""
    settings = get_settings()
    meta = get_metrics(artifacts_dir=str(_resolve_ml_path(settings.ml_artifacts_dir)))
    if not meta:
        return RegimeMetricsResponse(
            trained_at=None,
            train_end=None,
            val_end=None,
            test_start=None,
            test_end=None,
            train_rows=None,
            val_rows=None,
            test_rows=None,
            metrics={},
            confusion_matrix=None,
        )
    return RegimeMetricsResponse(
        trained_at=meta.get("trained_at"),
        train_end=meta.get("train_end"),
        val_end=meta.get("val_end"),
        test_start=meta.get("test_start"),
        test_end=meta.get("test_end"),
        train_rows=meta.get("train_rows"),
        val_rows=meta.get("val_rows"),
        test_rows=meta.get("test_rows"),
        metrics=meta.get("metrics", {}),
        confusion_matrix=meta.get("confusion_matrix"),
    )


# Timeout for build: 90s for small test (1 month), 10 min for full
BUILD_DATASET_TIMEOUT_1MONTH = 90
BUILD_DATASET_TIMEOUT_FULL = 600


@router.post("/build-dataset", response_model=DatasetInfoResponse)
async def build_dataset_endpoint(
    max_months: int | None = None,
    minimal: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Build ML dataset from DB. Returns dataset info (rows, date range, features).
    max_months: limit to last N month-ends (e.g. 1 for quick test).
    minimal=1: build only one indicator (fast, one query per month). No growth/fed/cycle.
    """
    logger.info("POST /build-dataset received max_months=%s minimal=%s", max_months, minimal)
    _debug_log("build-dataset POST received", {"max_months": max_months, "minimal": minimal}, "H0")
    try:
        settings = get_settings()
        out_path = str(_resolve_ml_path(settings.ml_dataset_path))
        end = date.today()
        last_month_end = (end.replace(day=1) - timedelta(days=1))
        loop = asyncio.get_running_loop()

        if minimal:
            n_months = max(1, max_months or 6)
            timeout_sec = 60
            # Pass db=None so builder uses its own session (avoids request-scoped session hang).
            df = await asyncio.wait_for(
                build_dataset_single_indicator(
                    output_path=out_path,
                    max_months=n_months,
                    db=None,
                ),
                timeout=timeout_sec,
            )
            features_used = ["date", "value"]
        else:
            timeout_sec = (
                BUILD_DATASET_TIMEOUT_1MONTH
                if (max_months is not None and max_months <= 3)
                else BUILD_DATASET_TIMEOUT_FULL
            )
            if max_months is not None and max_months >= 1:
                start_ts = last_month_end
                for _ in range(max_months - 1):
                    start_ts = (start_ts.replace(day=1) - timedelta(days=1))
                _start, _end = start_ts, last_month_end
            else:
                _start, _end = None, None

            def _run_build_in_thread():
                return asyncio.run(
                    build_dataset(
                        start_date=_start,
                        end_date=_end,
                        output_path=out_path,
                    )
                )

            df = await asyncio.wait_for(
                loop.run_in_executor(None, _run_build_in_thread),
                timeout=timeout_sec,
            )
            features_used = FEATURE_COLUMNS
    except asyncio.TimeoutError:
        logger.warning("build-dataset timed out after %s s (max_months=%s)", timeout_sec, max_months)
        _debug_log("build-dataset timeout", {"timeout_sec": timeout_sec, "max_months": max_months}, "H0")
        raise HTTPException(
            status_code=504,
            detail=f"Build timed out after {timeout_sec}s. Check backend logs and DB (indicators, Fed, cycle). One month should finish in under a minute.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("build-dataset failed: %s", e)
        _debug_log(
            "build-dataset error",
            {"error": type(e).__name__, "message": str(e)[:500]},
            "H0",
        )
        raise HTTPException(status_code=500, detail=f"Build failed: {type(e).__name__}: {e}")
    path = Path(out_path)
    if df.empty or len(df) == 0:
        build_error = None
        if not minimal:
            try:
                build_error = await diagnose_build_one_month(last_month_end)
            except Exception as e:
                build_error = f"diagnostic failed: {type(e).__name__}: {e}"
        return DatasetInfoResponse(
            rows=0,
            date_min=None,
            date_max=None,
            features=features_used,
            last_built=None,
            path=out_path,
            build_error=build_error,
        )
    return DatasetInfoResponse(
        rows=len(df),
        date_min=df["date"].min() if "date" in df.columns else None,
        date_max=df["date"].max() if "date" in df.columns else None,
        features=features_used,
        last_built=datetime.fromtimestamp(path.stat().st_mtime).isoformat() if path.exists() else datetime.now(timezone.utc).isoformat(),
        path=out_path,
        build_error=None,
    )


@router.get("/dataset-info", response_model=DatasetInfoResponse)
async def dataset_info():
    """Dataset size, date range, feature list."""
    settings = get_settings()
    path = _resolve_ml_path(settings.ml_dataset_path)
    _debug_log(
        "dataset_info",
        {"path_str": settings.ml_dataset_path, "path_resolved": str(path), "exists": path.exists()},
        "H4",
    )
    if not path.exists():
        return DatasetInfoResponse(
            rows=0,
            date_min=None,
            date_max=None,
            features=FEATURE_COLUMNS,
            last_built=None,
            path=str(path),
            build_error=None,
        )
    import pandas as pd
    df = pd.read_parquet(path)
    _debug_log("dataset_info read parquet", {"path_resolved": str(path.resolve()), "rows": len(df)}, "H4")
    return DatasetInfoResponse(
        rows=len(df),
        date_min=df["date"].min() if "date" in df.columns and len(df) else None,
        date_max=df["date"].max() if "date" in df.columns and len(df) else None,
        features=FEATURE_COLUMNS,
        last_built=datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
        path=str(path),
        build_error=None,
    )


async def _run_training_background() -> None:
    """Run dataset build + train in background. Updates progress_store; no return value."""
    global _train_task
    settings = get_settings()
    try:
        set_train_progress(
            phase="dataset", percent=0.0, message="Building dataset…", log_line="[0%] Building dataset…"
        )
        df = await build_dataset(output_path=str(_resolve_ml_path(settings.ml_dataset_path)))
        _debug_log(
            "after build_dataset",
            {"len_df": len(df), "empty": bool(df.empty), "ml_dataset_path": settings.ml_dataset_path},
            "H2",
        )
        if df.empty or len(df) < 24:
            _debug_log("insufficient data, not saving", {"len_df": len(df)}, "H5")
            set_train_progress(done=True, error="Insufficient data (need at least 24 months)")
            return
        set_train_progress(
            percent=50.0, message="Training models…", log_line="[50%] Dataset built. Training models…"
        )
        meta = run_train_pipeline(
            df,
            train_end=settings.ml_train_end,
            val_end=settings.ml_val_end,
            artifacts_dir=str(_resolve_ml_path(settings.ml_artifacts_dir)),
            random_seed=settings.ml_random_seed,
        )
        if meta.get("error"):
            set_train_progress(done=True, error=meta["error"])
            return
        set_train_progress(
            percent=100.0, message="Done.", log_line="[100%] Training completed.", done=True
        )
    except Exception as e:
        logger.exception("ML train failed")
        set_train_progress(done=True, error=str(e))


def _start_train_worker(progress_path: Path, cwd: Path) -> bool:
    """Start training in a subprocess. Returns True if started. stderr not suppressed so worker errors show in logs."""
    env = {**os.environ, "ML_TRAIN_PROGRESS_FILE": str(progress_path.resolve())}
    try:
        subprocess.Popen(
            [sys.executable, "-m", "app.ml_train_worker"],
            env=env,
            cwd=str(cwd),
            stdout=subprocess.DEVNULL,
            # stderr left attached so worker tracebacks appear in docker logs
        )
        return True
    except Exception as e:
        logger.exception("Failed to start ML train worker: %s", e)
        return False


@router.post("/regime-train", response_model=TrainResponse)
async def regime_train():
    """
    Start dataset build + train in a separate process (survives --reload).
    Returns immediately with status "started". Poll GET /api/ml/train-progress for progress.
    """
    settings = get_settings()
    progress_path = _resolve_ml_path(
        getattr(settings, "ml_train_progress_file", None) or "data/ml_train_progress.json"
    )
    # Backend root: same as _BACKEND_ROOT so worker and API use same paths
    cwd = _BACKEND_ROOT

    # If progress file exists and not done, treat as already running
    existing = get_train_progress_from_file(str(progress_path))
    if existing is not None and not existing.get("done", True):
        return TrainResponse(
            status="already_running",
            version=None,
            metrics=None,
            error=None,
        )

    progress_path.parent.mkdir(parents=True, exist_ok=True)
    progress_path.write_text(
        json.dumps(
            {
                "phase": "dataset",
                "percent": 0.0,
                "message": "Building dataset…",
                "logs": ["[0%] Building dataset…"],
                "done": False,
                "error": None,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    if not _start_train_worker(progress_path, cwd):
        progress_path.write_text(
            json.dumps(
                {"phase": "", "percent": 0.0, "message": "", "logs": [], "done": True, "error": "Failed to start worker"},
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        return TrainResponse(status="error", version=None, metrics=None, error="Failed to start worker")
    return TrainResponse(status="started", version=None, metrics=None, error=None)
