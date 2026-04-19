from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.intelligence import ML2AnomalySignal, ML2FactorScore
from app.schemas.intelligence import ML2MetricsResponse, ML2PredictResponse, ML2FactorItem
from app.services.ml2_dataset_builder import build_ml2_dataset
from app.services.ml2_factor_timing import ML2FactorTimingService
from app.services.ml2_anomaly import ML2AnomalyService
from app.services.memory_service import MemoryService

router = APIRouter()


@router.post("/train", response_model=ML2MetricsResponse)
async def train_ml2(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    ds = await build_ml2_dataset(db)
    service = ML2FactorTimingService(settings.ml_artifacts_dir)
    metrics = service.train(ds)
    await MemoryService().upsert_document(
        db,
        source="ml_snapshots",
        doc_key=f"ml2-train:{date.today().isoformat()}",
        title="ML2 train metrics",
        content=str(metrics),
        metadata={"quality_score": 0.95, "source_version": "ml2-v1"},
        tags=["ml2", "train", "metrics"],
    )
    await db.commit()
    return ML2MetricsResponse(**metrics)


@router.get("/metrics", response_model=ML2MetricsResponse)
async def get_ml2_metrics():
    settings = get_settings()
    service = ML2FactorTimingService(settings.ml_artifacts_dir)
    return ML2MetricsResponse(**service.load_metrics())


@router.get("/predict", response_model=ML2PredictResponse)
async def predict_ml2(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    ds = await build_ml2_dataset(db)
    ft_service = ML2FactorTimingService(settings.ml_artifacts_dir)
    an_service = ML2AnomalyService()

    as_of_date, factors = ft_service.predict(ds)
    anomaly_score, is_anomaly, threshold, details = an_service.compute(ds)

    as_date = date.fromisoformat(as_of_date)
    await db.execute(delete(ML2FactorScore).where(ML2FactorScore.date == as_date))
    await db.execute(delete(ML2AnomalySignal).where(ML2AnomalySignal.date == as_date))
    for item in factors[:30]:
        db.add(
            ML2FactorScore(
                date=as_date,
                factor_name=item["factor"],
                horizon_months=item["horizon_months"],
                score=item["score"],
                expected_relative_return=item["expected_relative_return"],
                confidence=item["confidence"],
                model_version="ml2-v1",
            )
        )
    db.add(
        ML2AnomalySignal(
            date=as_date,
            anomaly_score=anomaly_score,
            threshold=threshold,
            is_anomaly=is_anomaly,
            details=details,
        )
    )
    await MemoryService().upsert_document(
        db,
        source="ml_snapshots",
        doc_key=f"ml2-predict:{as_of_date}",
        title="ML2 predict snapshot",
        content=str({"as_of_date": as_of_date, "top_factors": factors[:12], "anomaly_score": anomaly_score, "is_anomaly": is_anomaly}),
        metadata={"quality_score": 0.95, "source_version": "ml2-v1"},
        tags=["ml2", "predict", "snapshot"],
    )
    await db.commit()

    return ML2PredictResponse(
        as_of_date=as_of_date,
        factors=[ML2FactorItem(**x) for x in factors[:12]],
        anomaly_score=anomaly_score,
        is_anomaly=is_anomaly,
        anomaly_threshold=threshold,
        trained=True,
        model_version="ml2-v1",
    )


@router.get("/latest-stored", response_model=ML2PredictResponse)
async def latest_ml2_stored(db: AsyncSession = Depends(get_db)):
    latest_date = (
        await db.execute(select(ML2FactorScore.date).order_by(ML2FactorScore.date.desc()).limit(1))
    ).scalar_one_or_none()
    if latest_date is None:
        return ML2PredictResponse(
            as_of_date=date.today().isoformat(),
            factors=[],
            anomaly_score=0.0,
            is_anomaly=False,
            anomaly_threshold=0.0,
            trained=False,
            model_version="ml2-v1",
        )

    frows = (
        await db.execute(
            select(ML2FactorScore)
            .where(ML2FactorScore.date == latest_date)
            .order_by(ML2FactorScore.score.desc())
            .limit(12)
        )
    ).scalars().all()
    arow = (
        await db.execute(select(ML2AnomalySignal).where(ML2AnomalySignal.date == latest_date))
    ).scalar_one_or_none()
    return ML2PredictResponse(
        as_of_date=latest_date.isoformat(),
        factors=[
            ML2FactorItem(
                factor=x.factor_name,
                horizon_months=x.horizon_months,
                score=x.score,
                expected_relative_return=x.expected_relative_return,
                confidence=x.confidence,
            )
            for x in frows
        ],
        anomaly_score=arow.anomaly_score if arow else 0.0,
        is_anomaly=arow.is_anomaly if arow else False,
        anomaly_threshold=arow.threshold if arow else 0.0,
        trained=True,
        model_version="ml2-v1",
    )

