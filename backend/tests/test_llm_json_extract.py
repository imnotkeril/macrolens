import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.llm.json_extract import extract_json_object


def test_extract_json_plain():
    d = extract_json_object('{"a": 1, "b": "x"}')
    assert d["a"] == 1
    assert d["b"] == "x"


def test_extract_json_fenced():
    raw = """Here is JSON:
```json
{"stance": "neutral", "score": 0.1}
```
"""
    d = extract_json_object(raw)
    assert d["stance"] == "neutral"
    assert d["score"] == 0.1
