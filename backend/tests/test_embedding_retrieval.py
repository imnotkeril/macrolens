import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.embedding_service import EmbeddingService


def test_embedding_is_normalized():
    svc = EmbeddingService(dim=32)
    v = svc.embed("fed policy hawkish dovish")
    norm = sum(x * x for x in v) ** 0.5
    assert abs(norm - 1.0) < 1e-6


def test_cosine_similarity_higher_for_similar_text():
    svc = EmbeddingService(dim=64)
    a = svc.embed("yield curve inversion recession risk")
    b = svc.embed("yield curve inversion and recession")
    c = svc.embed("crypto nft gaming momentum")
    assert svc.cosine(a, b) > svc.cosine(a, c)
