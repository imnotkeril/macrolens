"""Structured JSON outputs validated after Claude responses."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class FedCBAgentLLMOutput(BaseModel):
    stance: str = Field(description="hawkish | dovish | neutral")
    score: float = Field(ge=-1.0, le=1.0)
    summary: str
    drivers: list[str] = Field(default_factory=list)
    forward_guidance: str | None = None
    uncertainty: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)


class NewsEventItem(BaseModel):
    headline: str
    impact: str = Field(description="risk_off | risk_on | mixed | local")
    horizon: str = Field(description="hours | days | weeks")
    confidence: float = Field(ge=0.0, le=1.0)
    themes: list[str] = Field(default_factory=list)


class NewsAgentLLMOutput(BaseModel):
    summary: str
    aggregate_score: float = Field(ge=-1.0, le=1.0)
    events: list[NewsEventItem] = Field(default_factory=list)

    @field_validator("events")
    @classmethod
    def max_five_events(cls, v: list) -> list:
        return list(v)[:5] if v else []


ANALYSIS_TAB_KEYS = frozenset(
    {"indices", "sectors", "rates", "breadth", "macro", "inflation", "fed"}
)


class MacroDataAgentLLMOutput(BaseModel):
    summary: str
    score: float = Field(ge=0.0, le=1.0)
    bullets: list[str] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    # One short sentence per Analysis tab for UI strips (cached in signal payload).
    tab_summaries: dict[str, str] = Field(default_factory=dict)

    @field_validator("tab_summaries")
    @classmethod
    def normalize_tab_keys(cls, v: dict[str, str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for k, text in (v or {}).items():
            key = str(k).strip().lower()
            if key in ANALYSIS_TAB_KEYS and text:
                out[key] = str(text).strip()[:800]
        return out


class MasterAgentLLMOutput(BaseModel):
    macro_thesis: str
    regime_comment: str | None = None
    factor_tilt_notes: list[str] = Field(default_factory=list)
    monitoring: list[str] = Field(default_factory=list)
    citations_used: list[str] = Field(default_factory=list, description="doc_keys only from context")
