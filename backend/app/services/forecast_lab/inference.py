"""Inference and summary assembly for Forecast Lab."""

from __future__ import annotations

import json
import logging
import math
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import xgboost as xgb
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast_lab import RecessionLabel
from app.services.forecast_lab import features_pit
from app.services.forecast_lab.artifacts import active_bundle_dir, load_meta
from app.services.forecast_lab.cycle_phase_probs import cycle_quadrant_probs_at_date
from app.services.forecast_lab.ensemble import (
    align_multiclass_proba_row,
    ensemble_probs,
    ensemble_probs_four,
    normalize_weights,
)
from app.services.forecast_lab.macro_infer import predict_macro_panel
from app.services.forecast_lab.rule_phase import (
    QUADRANT_ORDER,
    determine_quadrant,
    rule_probs,
)
from app.services.forecast_lab.stress import compute_stress
from app.services.forecast_lab.hmm_infer import hmm_probs_at_end, simplex_dirichlet_smooth
from app.config import get_settings
from app.schemas.forecast_lab import (
    DashboardContextBlock,
    ExpertPhaseBreakdown,
    ForecastLabSummaryResponse,
    MacroForecastRow,
    PhaseProbabilities,
    StressBlock,
)

logger = logging.getLogger("forecast_lab")


def _load_bundle_models(bundle_path: Path) -> tuple[Any, xgb.XGBClassifier | None, Any, list[int], dict[str, float] | None]:
    meta = load_meta(bundle_path)
    if not meta:
        return None, None, None, [], None

    scaler = None
    sp = bundle_path / "scaler.joblib"
    if sp.exists():
        scaler = joblib.load(sp)

    clf = None
    xp = bundle_path / "xgb.json"
    if xp.exists():
        clf = xgb.XGBClassifier()
        clf.load_model(str(xp))

    hmm = None
    hp = bundle_path / "hmm.joblib"
    if hp.exists():
        hmm = joblib.load(hp)

    sm = bundle_path / "state_map.json"
    state_map = json.loads(sm.read_text(encoding="utf-8")) if sm.exists() else []

    weights = meta.get("ensemble_weights")

    return scaler, clf, hmm, state_map, weights


async def _hmm_probs_for_as_of(
    db: AsyncSession,
    as_of: date,
    scaler: Any,
    hmm: Any,
    state_map: list[int],
    feature_names: list[str],
) -> list[float]:
    if hmm is None or scaler is None:
        return [0.25, 0.25, 0.25, 0.25]
    d0 = as_of - timedelta(days=380 * 3)
    _, rows = await features_pit.build_monthly_feature_rows(db, d0, as_of)
    if len(rows) < 6:
        return [0.25, 0.25, 0.25, 0.25]
    X = np.array([r.vector_for_names(feature_names) for r in rows], dtype=float)
    try:
        Xs = scaler.transform(X)
        return hmm_probs_at_end(hmm, Xs, state_map)
    except Exception as e:
        logger.debug("HMM infer failed: %s", e)
        return [0.25, 0.25, 0.25, 0.25]


def _finite_simplex(p: list[float]) -> list[float]:
    """Avoid NaN/inf from any model path breaking Pydantic JSON serialization + validation."""
    out: list[float] = []
    for x in p:
        v = float(x)
        if not math.isfinite(v) or v < 0.0:
            v = 0.0
        out.append(v)
    s = sum(out)
    if s <= 0.0:
        return [0.25, 0.25, 0.25, 0.25]
    return [x / s for x in out]


def _probs_to_schema(p: list[float]) -> PhaseProbabilities:
    p2 = _finite_simplex(p)
    return PhaseProbabilities(
        Q1_GOLDILOCKS=float(p2[0]),
        Q2_REFLATION=float(p2[1]),
        Q3_OVERHEATING=float(p2[2]),
        Q4_STAGFLATION=float(p2[3]),
    )


async def _recession_snapshot(db: AsyncSession, as_of: date) -> tuple[float | None, str | None]:
    qc = select(func.count()).select_from(RecessionLabel)
    n = (await db.execute(qc)).scalar_one()
    if n == 0:
        return None, None
    q = (
        select(RecessionLabel.is_recession)
        .where(RecessionLabel.obs_date <= as_of)
        .order_by(desc(RecessionLabel.obs_date), desc(RecessionLabel.id))
        .limit(1)
    )
    cur = (await db.execute(q)).scalar_one_or_none()
    if cur is None:
        return None, "no_label_on_or_before_as_of"
    return (1.0 if cur else 0.0), "binary_snapshot_latest_month_not_forward_prob"


def _effective_as_of(as_of: date | None, align_month_end: bool | None) -> date:
    settings = get_settings()
    align = settings.forecast_lab_summary_align_month_end if align_month_end is None else align_month_end
    d = as_of or date.today()
    if not align:
        return d
    from app.services.forecast_lab.dates_util import latest_month_end_on_or_before

    return latest_month_end_on_or_before(d)


async def build_summary(
    db: AsyncSession,
    as_of: date | None,
    align_month_end: bool | None = None,
) -> ForecastLabSummaryResponse:
    as_of = _effective_as_of(as_of, align_month_end)
    settings = get_settings()
    row = await features_pit.build_feature_row(db, as_of)
    pr = rule_probs(row.growth_score, row.fed_policy_score)
    q_rule = determine_quadrant(row.growth_score, row.fed_policy_score)

    bundle_path = active_bundle_dir()
    meta = load_meta(bundle_path)
    trained = meta is not None and (bundle_path / "xgb.json").exists()
    feature_names = features_pit.resolve_feature_names_from_meta(meta)

    scaler, clf, hmm, state_map, wts = _load_bundle_models(bundle_path)
    w_rule, w_hmm, w_gbdt, w_cycle = 1 / 3, 1 / 3, 1 / 3, 0.0
    if wts:
        w_rule = float(wts.get("rule", w_rule))
        w_hmm = float(wts.get("hmm", w_hmm))
        w_gbdt = float(wts.get("gbdt", w_gbdt))
        w_cycle = float(wts.get("cycle", w_cycle))

    ph = await _hmm_probs_for_as_of(db, as_of, scaler, hmm, state_map, feature_names)
    pg = [0.25, 0.25, 0.25, 0.25]
    if trained and clf is not None and scaler is not None:
        try:
            xv = scaler.transform(np.array([row.vector_for_names(feature_names)]))
            pg = align_multiclass_proba_row(clf, xv)
        except Exception as e:
            logger.debug("GBDT infer failed: %s", e)

    pc: list[float] | None = None
    if trained and settings.forecast_lab_ensemble_include_cycle:
        pc = await cycle_quadrant_probs_at_date(db, as_of)

    if trained:
        if pc is not None:
            p_final = ensemble_probs_four(pr, ph, pg, pc, w_rule, w_hmm, w_gbdt, w_cycle)
        else:
            wr, wh, wg = normalize_weights([w_rule, w_hmm, w_gbdt])
            p_final = ensemble_probs(pr, ph, pg, wr, wh, wg)
    else:
        p_final = pr

    p_final = _finite_simplex([float(x) for x in p_final])
    phase_idx = int(np.argmax(np.array(p_final)))
    phase_class = QUADRANT_ORDER[phase_idx]
    conf = float(max(p_final))
    if not math.isfinite(conf):
        conf = 0.25

    stress_val, band, drivers = await compute_stress(db, as_of)

    macro_rows: list[MacroForecastRow] = [
        MacroForecastRow(
            series_id="growth_score_nowcast",
            display_name="Macro sentiment (growth score)",
            horizon_months=0,
            value=row.growth_score,
            trained=False,
        ),
        MacroForecastRow(
            series_id="fed_policy_score_nowcast",
            display_name="Fed policy score",
            horizon_months=0,
            value=row.fed_policy_score,
            trained=False,
        ),
    ]
    try:
        macro_rows.extend(await predict_macro_panel(db, bundle_path, as_of))
    except Exception as e:
        logger.debug("macro panel infer skipped: %s", e)

    rec_prob: float | None = None
    rec_reason: str | None = None
    if trained and scaler is not None and (bundle_path / "recession_xgb.json").exists():
        try:
            rclf = xgb.XGBClassifier()
            rclf.load_model(str(bundle_path / "recession_xgb.json"))
            xv_rec = scaler.transform(np.array([row.vector_for_names(feature_names)]))
            rp = float(rclf.predict_proba(xv_rec)[0, 1])
            if math.isfinite(rp):
                rec_prob = rp
                rec_reason = "gbdt_recession_forward_12m"
        except Exception as e:
            logger.debug("recession GBDT infer failed: %s", e)
    if rec_prob is None:
        rec_prob, rec_reason = await _recession_snapshot(db, as_of)

    # HMM filtered posterior often collapses to one hidden state → one-hot over quadrants after
    # state→quadrant map. Smooth lightly for experts.* JSON only; p_final still uses raw ph above.
    ph_expert_display = simplex_dirichlet_smooth(ph, alpha=0.15)
    experts = ExpertPhaseBreakdown(
        rule=_probs_to_schema(pr),
        hmm=_probs_to_schema(ph_expert_display),
        gbdt=_probs_to_schema(pg),
        cycle=_probs_to_schema(pc) if pc is not None else None,
    )

    bundle_id = meta.get("bundle_id", "untrained") if meta else "untrained"
    train_label_mode = meta.get("label_mode") if meta else None

    dash: DashboardContextBlock | None = None
    if settings.forecast_lab_include_dashboard_context:
        nav_q = None
        match_nav: bool | None = None
        c_bucket = c_detail = None
        c_score = None
        try:
            fr_nav = await features_pit.build_feature_row(db, as_of)
            nav_q = determine_quadrant(fr_nav.growth_score, fr_nav.fed_policy_score)
            match_nav = nav_q == phase_class
        except Exception:
            logger.debug("dashboard navigator context skipped", exc_info=True)
        try:
            from app.services.cycle_engine import CycleEngine

            ce = CycleEngine(db)
            cf = await ce.get_features_at_date(as_of, lookback_days=730)
            c_score = float(cf.get("cycle_score") or 0.0)
            c_bucket, c_detail = ce._map_phase(c_score)
        except Exception:
            logger.debug("dashboard cycle context skipped", exc_info=True)
        if any(x is not None for x in (nav_q, c_bucket, c_score)):
            dash = DashboardContextBlock(
                cycle_phase_bucket=c_bucket,
                cycle_phase_detail=c_detail,
                cycle_score=c_score,
                navigator_quadrant=nav_q,
                matches_navigator_quadrant=match_nav,
            )

    logger.info(
        "forecast_lab summary as_of=%s bundle_id=%s trained=%s phase=%s conf=%.3f",
        as_of.isoformat(),
        bundle_id,
        trained,
        phase_class,
        conf,
    )

    payload = ForecastLabSummaryResponse(
        as_of_date=as_of,
        bundle_id=bundle_id,
        trained=trained,
        phase_class=phase_class,
        phase_probabilities=_probs_to_schema(p_final),
        confidence=conf,
        ensemble_weights=(
            {"rule": w_rule, "hmm": w_hmm, "gbdt": w_gbdt, "cycle": w_cycle} if trained else None
        ),
        experts=experts,
        macro_forecasts=macro_rows,
        stress=StressBlock(stress_score=stress_val, stress_band=band, drivers=drivers),
        recession_prob_12m=rec_prob,
        recession_reason=rec_reason,
        data_availability=row.availability,
        dashboard_context=dash,
        training_label_mode=train_label_mode,
    )

    return payload
