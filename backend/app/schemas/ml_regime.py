"""Pydantic schemas for ML regime prediction API."""
from pydantic import BaseModel


class ModelProbs(BaseModel):
    quadrant: str | None
    p_q1: float | None
    p_q2: float | None
    p_q3: float | None
    p_q4: float | None


class RegimePredictResponse(BaseModel):
    quadrant_rule: str
    quadrant_ensemble: str
    confidence: float
    p_q1: float
    p_q2: float
    p_q3: float
    p_q4: float
    by_model: dict[str, ModelProbs]
    trained: bool
    ensemble_weights: dict | None = None


class BacktestRow(BaseModel):
    date: str
    quadrant_actual: str
    quadrant_ensemble: str
    match: bool
    p_q1: float
    p_q2: float
    p_q3: float
    p_q4: float


class RegimeBacktestResponse(BaseModel):
    backtest: list[BacktestRow]
    test_start: str | None
    test_end: str | None


class RegimeMetricsResponse(BaseModel):
    trained_at: str | None
    train_end: str | None
    val_end: str | None
    test_start: str | None
    test_end: str | None
    train_rows: int | None
    val_rows: int | None
    test_rows: int | None
    metrics: dict
    confusion_matrix: list[list[int]] | None


class DatasetInfoResponse(BaseModel):
    rows: int
    date_min: str | None
    date_max: str | None
    features: list[str]
    last_built: str | None
    path: str
    build_error: str | None = None  # When rows=0: reason (e.g. which step failed)


class TrainResponse(BaseModel):
    status: str
    version: str | None
    metrics: dict | None
    error: str | None
