"""Phase rule YAML loading (deterministic, no DB)."""

from app.services.forecast_lab import rule_loader as rule_loader_mod
from app.services.forecast_lab.rule_loader import load_phase_rules, match_quadrant


def setup_function() -> None:
    rule_loader_mod.load_phase_rules.cache_clear()


def test_load_phase_rules_non_empty():
    rules = load_phase_rules()
    assert len(rules) >= 4
    assert all("quadrant" in r for r in rules)


def test_match_quadrant_default_grid():
    assert match_quadrant(0.5, -0.1) == "Q1_GOLDILOCKS"
    assert match_quadrant(-0.5, -0.1) == "Q2_REFLATION"
    assert match_quadrant(0.5, 0.5) == "Q3_OVERHEATING"
    assert match_quadrant(-0.5, 0.5) == "Q4_STAGFLATION"
