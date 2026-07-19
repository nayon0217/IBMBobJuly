"""Claude provider wiring — offline (no Anthropic calls).

Covers the parts that must hold for BACKEND=claude without hitting the network:
provider selection, and the local embedding fallback's shape/determinism.
"""

import math

from app.config import Backend, settings
from app.services import claude, providers


def test_get_provider_returns_claude(monkeypatch):
    monkeypatch.setattr(settings, "backend", Backend.CLAUDE)
    assert providers.get_provider() is claude


def test_get_provider_returns_watsonx_otherwise(monkeypatch):
    monkeypatch.setattr(settings, "backend", Backend.WATSONX)
    from app.services import watsonx

    assert providers.get_provider() is watsonx


def test_local_embed_shape_and_normalization():
    vectors = claude.embed(["Harry saw the owl", "Vernon Dursley frowned"])
    assert len(vectors) == 2
    assert all(len(v) == claude._EMBED_DIM for v in vectors)
    for v in vectors:
        assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0, abs_tol=1e-9)


def test_local_embed_is_deterministic():
    assert claude.embed(["same text"]) == claude.embed(["same text"])


def test_local_embed_separates_different_text():
    a = claude.embed(["cats sleep"])[0]
    b = claude.embed(["dogs run"])[0]
    cosine = sum(x * y for x, y in zip(a, b))
    assert cosine < 0.5
