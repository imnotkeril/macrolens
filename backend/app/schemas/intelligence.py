from pydantic import BaseModel, Field


class ML2FactorItem(BaseModel):
    factor: str
    horizon_months: int
    score: float
    expected_relative_return: float | None = None
    confidence: float | None = None


class ML2PredictResponse(BaseModel):
    as_of_date: str
    factors: list[ML2FactorItem]
    anomaly_score: float
    is_anomaly: bool
    anomaly_threshold: float
    trained: bool = True
    model_version: str = "ml2-v1"


class ML2MetricsResponse(BaseModel):
    trained_at: str | None = None
    rows: int | None = None
    horizons: list[int] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)
    model_version: str = "ml2-v1"


class AgentSignalItem(BaseModel):
    agent_name: str
    signal_type: str
    score: float | None = None
    summary: str
    payload: dict | None = None


class RiskOverlay(BaseModel):
    confidence: float
    uncertainty: float
    data_quality_score: float
    regime_stability_score: float
    no_trade: bool
    reason_codes: list[str] = Field(default_factory=list)
    risk_constraints: dict = Field(default_factory=dict)


class RecommendationResponse(BaseModel):
    as_of_date: str
    regime: str
    macro_thesis: str
    factor_tilts: list[ML2FactorItem]
    top_signals: list[AgentSignalItem]
    historical_analogs: list[str] = Field(default_factory=list)
    risk: RiskOverlay
    payload: dict = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    status: str
    runs: dict[str, str]


class MemorySearchResponse(BaseModel):
    query: str
    hits: list[dict]

