"""Anthropic Claude provider — mirrors the watsonx.py interface.

Exposes the same two functions the rest of the codebase relies on:
`generate(...)` and `embed(...)`, so BACKEND=claude runs the exact same staged
extraction workflow, just with Claude driving the LLM stages.

Two things to know:
  - The Anthropic client is built lazily (first use), not at import time, so
    importing this module never requires a key — same discipline as watsonx.py.
  - Anthropic has NO embeddings API. To keep the vector store working without a
    second vendor (e.g. Voyage), the claude backend embeds locally with a
    deterministic hashing bag-of-words. It's weaker than a real embedding model,
    but Stage 4 grounding also uses deterministic key_chunks, so persona quality
    holds up. If you want real semantic retrieval later, swap `embed` for a
    proper embeddings provider and point BACKEND=claude at the Pinecone store.
"""

import hashlib
import math
import re
from functools import lru_cache

from app.config import settings

# Dimension of the local fallback embedding. Only the in-memory cosine store
# consumes these (claude does not use Pinecone), so the exact value is free to
# choose — 512 is plenty to separate a novel's worth of chunks.
_EMBED_DIM = 512
_TOKEN_RE = re.compile(r"[a-z0-9']+")


@lru_cache(maxsize=1)
def _client():
    _require_credentials()
    import anthropic

    return anthropic.Anthropic(api_key=settings.claude_api_key)


def check_connection():
    """Run me first. Confirms the key/model work and that local embeddings
    produce a stable dimension."""
    print(f"Embedding dim: {len(embed(['hello'])[0])}")
    print(f"LLM says: {generate('Say OK', max_tokens=16)}")


def generate(prompt: str, *, system: str = "", max_tokens: int = 512) -> str:
    """Send a prompt to Claude and return the text response.

    Same signature as watsonx.generate so it drops into the pipeline unchanged.
    """
    kwargs = {
        "model": settings.claude_model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    resp = _client().messages.create(**kwargs)
    return "".join(
        block.text for block in resp.content if getattr(block, "type", None) == "text"
    )


def embed(texts: list[str]) -> list[list[float]]:
    """Return one embedding vector per input text.

    Local, deterministic, no network — Anthropic offers no embeddings endpoint.
    """
    return [_embed_one(text) for text in texts]


def _embed_one(text: str) -> list[float]:
    vec = [0.0] * _EMBED_DIM
    for token in _TOKEN_RE.findall(text.lower()):
        bucket = int(hashlib.md5(token.encode()).hexdigest(), 16) % _EMBED_DIM
        vec[bucket] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _require_credentials() -> None:
    if not settings.claude_api_key:
        raise RuntimeError(
            "CLAUDE_API_KEY must be set to use the claude backend. See .env.example."
        )


if __name__ == "__main__":
    check_connection()
