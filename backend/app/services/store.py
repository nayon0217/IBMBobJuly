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

import logging
import math
from typing import Protocol, runtime_checkable

from app.config import Backend, settings
from app.schemas import PersonaCard, TimelineEntry
from app.services.gender import infer_gender

logger = logging.getLogger(__name__)


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
    BACKEND=watsonx (fails loudly if unconfigured); in-memory otherwise
    (mock, tests, and claude — which embeds locally, see services/claude.py)."""
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


# --- ingestion registries (in-memory) ----------------------------------------
# Persona grounding (Stage 4) now runs lazily, after upload, so the material it
# needs must survive between /extract and /personas: the survivor roster (who
# exists + their alias/appearance metadata), the raw chunk texts (grounding +
# gender inference read them), and the timeline summaries.

_roster: list[dict] = []
_chunks: list[str] = []
_timeline: list[TimelineEntry] = []


def save_roster(roster: list[dict]) -> None:
    """Store the Stage 1–3 survivor roster (new upload = clean slate)."""
    global _roster
    _roster = list(roster)


def get_roster() -> list[dict]:
    return list(_roster)


def get_roster_entry(character_id: str) -> dict | None:
    return next((e for e in _roster if e.get("id") == character_id), None)


def save_chunks(chunks: list[str]) -> None:
    """Keep the raw chunk texts so deferred grounding + gender inference (which
    scan the manuscript directly) work without re-uploading."""
    global _chunks
    _chunks = list(chunks)


def get_chunks() -> list[str]:
    return list(_chunks)


def save_timeline(timeline: list[TimelineEntry]) -> None:
    global _timeline
    _timeline = list(timeline)


def get_timeline() -> list[TimelineEntry]:
    return list(_timeline)


# --- persona registry (in-memory) --------------------------------------------
# Only *grounded* cards live here; they are filled in on demand by /personas.
# A card is grounded at a specific timeline boundary (knowledge_up_to_chunk), so
# the same character grounded at two points in the story is two distinct cards —
# hence the cache is keyed by (id, knowledge_up_to_chunk). None = whole story.

_grounded: dict[tuple[str, int | None], PersonaCard] = {}


def save_characters(characters: list[PersonaCard]) -> None:
    """Bulk-replace the cache with timeline-agnostic cards (knowledge=None).
    Used by the gender backfill path and tests."""
    global _grounded
    _grounded = {(c.id, None): c for c in characters}
    _backfill_genders(list(_grounded.values()))


def save_character(card: PersonaCard, knowledge_up_to_chunk: int | None = None) -> None:
    """Cache one grounded card at its timeline boundary."""
    _grounded[(card.id, knowledge_up_to_chunk)] = card


def get_id_to_name() -> dict[str, str]:
    """Map every known character id -> display name, spanning the whole roster
    (not just the cards grounded so far) so chat/scene can label any speaker."""
    names = {e["id"]: e["canonical_name"] for e in _roster if e.get("id")}
    names.update({c.id: c.name for c in _grounded.values()})
    return names


def _backfill_genders(characters: list[PersonaCard]) -> None:
    """Cards produced before the gender field existed arrive with it empty.
    Their key_scene_ids point at chunks we already store, so gender is settled
    by the deterministic honorific/pronoun scan over that text — no API calls,
    and previous runs pick the field up the moment they're (re)saved."""
    pending = [c for c in characters if not c.gender and c.key_scene_ids]
    if not pending:
        return
    vector_store = get_vector_store()
    for card in pending:
        try:
            texts = [
                text
                for text in (vector_store.get_chunk(cid) for cid in card.key_scene_ids)
                if text
            ]
        except Exception as exc:  # backfill is best-effort, never fatal
            logger.warning("Gender backfill retrieval failed for %s: %s", card.id, exc)
            continue
        if texts:
            card.gender = infer_gender([card.name], texts)


def get_characters() -> list[PersonaCard]:
    return list(_grounded.values())


def get_character(
    character_id: str, knowledge_up_to_chunk: int | None = None
) -> PersonaCard | None:
    """The grounded card for this id at the given timeline boundary. When no
    boundary is given, falls back to any grounded card for the id (generic
    lookups that don't care which point in the story it was grounded at)."""
    card = _grounded.get((character_id, knowledge_up_to_chunk))
    if card is not None:
        return card
    if knowledge_up_to_chunk is None:
        return next((c for (cid, _), c in _grounded.items() if cid == character_id), None)
    return None


def clear_characters() -> None:
    global _grounded
    _grounded = {}


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
