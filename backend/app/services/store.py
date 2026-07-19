"""Vector store abstraction + in-memory persona registry.

Single-session tool (see Description.md §2): one manuscript at a time, no
persistence across restarts. Uploading a new manuscript replaces everything.

Two things are kept:
  - Chunk vectors live in a `VectorStore` (in-memory for mock/tests, Pinecone
    when BACKEND=watsonx). Selected via `get_vector_store()`.
  - Persona cards are NOT vectors, so they live in a small in-memory registry
    here (save_characters / get_character).

Chunk ids are "chunk-0", "chunk-1", ... in manuscript order — that index is
the backbone of the timeline / knowledge_up_to_chunk feature, and the same
ids appear in PersonaCard.key_scene_ids and ChatResponse.grounded_in.
"""

import math
from typing import Protocol, runtime_checkable

from app.config import Backend, settings
from app.schemas import PersonaCard


# --- vector store -------------------------------------------------------------


@runtime_checkable
class VectorStore(Protocol):
    """The retrieval seam. Chat/scene only ever touch these methods, so the
    backing store (in-memory vs Pinecone) never leaks into business logic."""

    def save_manuscript(self, chunks: list[str], vectors: list[list[float]]) -> None:
        """Replace all stored chunks/vectors (new upload = clean slate)."""

    def has_manuscript(self) -> bool:
        ...

    def get_chunk(self, chunk_id: str) -> str | None:
        ...

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        up_to_chunk: int | None = None,
    ) -> list[tuple[str, str]]:
        """Return [(chunk_id, chunk_text), ...] best first. `up_to_chunk` caps
        results to chunks the character is allowed to know (timeline feature)."""

    def clear(self) -> None:
        ...


class InMemoryVectorStore:
    """Cosine-similarity store. Used for BACKEND=mock and tests — no network."""

    def __init__(self) -> None:
        self._chunks: list[str] = []
        self._vectors: list[list[float]] = []

    def save_manuscript(self, chunks: list[str], vectors: list[list[float]]) -> None:
        self._chunks = list(chunks)
        self._vectors = list(vectors)

    def has_manuscript(self) -> bool:
        return bool(self._chunks)

    def get_chunk(self, chunk_id: str) -> str | None:
        idx = _chunk_index(chunk_id)
        if idx is None or not 0 <= idx < len(self._chunks):
            return None
        return self._chunks[idx]

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        up_to_chunk: int | None = None,
    ) -> list[tuple[str, str]]:
        limit = (
            len(self._vectors)
            if up_to_chunk is None
            else min(up_to_chunk + 1, len(self._vectors))
        )
        scored = [
            (_cosine(query_vector, vec), i)
            for i, vec in enumerate(self._vectors[:limit])
        ]
        scored.sort(reverse=True)
        return [(f"chunk-{i}", self._chunks[i]) for _, i in scored[:top_k]]

    def clear(self) -> None:
        self._chunks = []
        self._vectors = []


_vector_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """Return the process-wide vector store. Pinecone is mandatory when
    BACKEND=watsonx (fails loudly if unconfigured); in-memory otherwise."""
    global _vector_store
    if _vector_store is None:
        if settings.backend == Backend.WATSONX:
            from app.services.pinecone_store import PineconeVectorStore

            _vector_store = PineconeVectorStore()
        else:
            _vector_store = InMemoryVectorStore()
    return _vector_store


def reset_vector_store() -> None:
    """Drop the cached store (used by tests to swap implementations)."""
    global _vector_store
    _vector_store = None


# --- persona registry (in-memory) --------------------------------------------

_characters: list[PersonaCard] = []


def save_characters(characters: list[PersonaCard]) -> None:
    global _characters
    _characters = list(characters)


def get_characters() -> list[PersonaCard]:
    return list(_characters)


def get_character(character_id: str) -> PersonaCard | None:
    return next((c for c in _characters if c.id == character_id), None)


def clear_characters() -> None:
    global _characters
    _characters = []


# --- helpers ------------------------------------------------------------------


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def _chunk_index(chunk_id: str) -> int | None:
    try:
        return int(chunk_id.removeprefix("chunk-"))
    except ValueError:
        return None
