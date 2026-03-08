from datetime import datetime
from pydantic import BaseModel


class CycleDriverContribution(BaseModel):
    name: str
    raw_value: float | None
    normalized: float
    weight: float
    contribution: float
    direction: str  # "positive", "negative", "neutral"


class RecessionModelResult(BaseModel):
    name: str
    probability: float
    description: str


class PhaseTransitionSignal(BaseModel):
    name: str
    current_value: str
    threshold: str
    status: str  # "green", "yellow", "red"
    description: str


class LightFCIComponent(BaseModel):
    name: str
    weight: float
    z_score: float | None
    contribution: float | None
    direction: str  # "tightening", "loosening", "neutral"


class LightFCI(BaseModel):
    score: float
    gdp_impact: float
    components: list[LightFCIComponent]


class TacticalAllocationRow(BaseModel):
    asset_class: str
    recovery: str
    expansion: str
    slowdown: str
    contraction: str
    current_signal: str


class ExpectedReturn(BaseModel):
    asset_class: str
    avg_return: float
    sharpe: float
    beta_to_cycle: float


class RegimeSnapshot(BaseModel):
    cycle_score: float
    phase: str
    phase_label: str
    recession_prob_12m: float
    recession_models: list[RecessionModelResult]
    top_drivers: list[CycleDriverContribution]
    fci_score: float | None
    fci_gdp_impact: float | None
    fci_components: list[LightFCIComponent]
    phase_signals: list[PhaseTransitionSignal]
    narrative: str
    tactical_allocation: list[TacticalAllocationRow]
    expected_returns: list[ExpectedReturn]
    data_completeness: float
    timestamp: datetime


class RegimeHistoryPoint(BaseModel):
    date: str
    cycle_score: float
    phase: str
    recession_prob: float
