import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.schemas.agent_outputs import (
    FedCBAgentLLMOutput,
    MasterAgentLLMOutput,
    NewsAgentLLMOutput,
)


def test_fed_cb_llm_output_minimal():
    o = FedCBAgentLLMOutput.model_validate(
        {
            "stance": "neutral",
            "score": 0.0,
            "summary": "Hold.",
            "drivers": ["data"],
            "forward_guidance": None,
            "uncertainty": "high",
            "citations": [],
        }
    )
    assert o.stance == "neutral"


def test_news_llm_output_events():
    o = NewsAgentLLMOutput.model_validate(
        {
            "summary": "Calm.",
            "aggregate_score": 0.1,
            "events": [
                {
                    "headline": "CPI inline",
                    "impact": "mixed",
                    "horizon": "days",
                    "confidence": 0.5,
                    "themes": ["inflation"],
                }
            ],
        }
    )
    assert len(o.events) == 1


def test_master_llm_output():
    o = MasterAgentLLMOutput.model_validate(
        {
            "macro_thesis": "Risk balanced.",
            "regime_comment": None,
            "factor_tilt_notes": [],
            "monitoring": ["watch claims"],
            "citations_used": [],
        }
    )
    assert "balanced" in o.macro_thesis
