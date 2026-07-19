"""Pinecone-backed vector store — the retrieval DB when BACKEND=watsonx.

This is the ONLY file that talks to Pinecone. It implements the VectorStore
protocol from store.py, so chat/scene/extraction never import Pinecone
directly. The client and index handle are built lazily on first use (same
pattern as watsonx.py) so importing this module never forces credentials.

Chunk metadata carries {chunk_index, text}:
  - chunk_index powers the timeline filter ($lte up_to_chunk),
  - text lets get_chunk() / search() return chunk text without a side store.
"""

import time

from app.config import settings

_UPSERT_BATCH = 100
_INDEX_READY_TIMEOUT_S = 60


class PineconeVectorStore:
    def __init__(self) -> None:
        self._client = None
        self._index = None
        self._namespace = settings.pinecone_namespace

    # --- VectorStore protocol -------------------------------------------------

    def save_manuscript(self, chunks: list[str], vectors: list[list[float]]) -> None:
        if not vectors:
            return
        index = self._ensure_index(dimension=len(vectors[0]))

        # New upload = clean slate for this manuscript's namespace.
        self._clear_namespace(index)

        records = [
            {
                "id": f"chunk-{i}",
                "values": vector,
                "metadata": {"chunk_index": i, "text": chunks[i]},
            }
            for i, vector in enumerate(vectors)
        ]
        for start in range(0, len(records), _UPSERT_BATCH):
            index.upsert(
                vectors=records[start : start + _UPSERT_BATCH],
                namespace=self._namespace,
            )

    def has_manuscript(self) -> bool:
        try:
            index = self._get_index()
        except Exception:
            return False
        stats = index.describe_index_stats()
        namespaces = getattr(stats, "namespaces", None) or {}
        ns = namespaces.get(self._namespace)
        return bool(ns and getattr(ns, "vector_count", 0))

    def get_chunk(self, chunk_id: str) -> str | None:
        index = self._get_index()
        res = index.fetch(ids=[chunk_id], namespace=self._namespace)
        vector = (getattr(res, "vectors", None) or {}).get(chunk_id)
        if vector is None:
            return None
        return (getattr(vector, "metadata", None) or {}).get("text")

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        up_to_chunk: int | None = None,
    ) -> list[tuple[str, str]]:
        index = self._get_index()
        query_filter = (
            {"chunk_index": {"$lte": up_to_chunk}} if up_to_chunk is not None else None
        )
        res = index.query(
            vector=query_vector,
            top_k=top_k,
            namespace=self._namespace,
            filter=query_filter,
            include_metadata=True,
        )
        matches = getattr(res, "matches", None) or []
        return [
            (m.id, (getattr(m, "metadata", None) or {}).get("text", ""))
            for m in matches
        ]

    def clear(self) -> None:
        try:
            self._clear_namespace(self._get_index())
        except Exception:
            pass

    # --- Pinecone plumbing ----------------------------------------------------

    def _pc(self):
        if self._client is None:
            _require_config()
            from pinecone import Pinecone

            self._client = Pinecone(api_key=settings.pinecone_api_key)
        return self._client

    def _ensure_index(self, dimension: int):
        pc = self._pc()
        if not pc.has_index(settings.pinecone_index):
            from pinecone import ServerlessSpec

            pc.create_index(
                name=settings.pinecone_index,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud=settings.pinecone_cloud,
                    region=settings.pinecone_region,
                ),
            )
            self._wait_until_ready(pc)
        self._index = pc.Index(settings.pinecone_index)
        return self._index

    def _get_index(self):
        if self._index is None:
            self._index = self._pc().Index(settings.pinecone_index)
        return self._index

    def _wait_until_ready(self, pc) -> None:
        deadline = time.time() + _INDEX_READY_TIMEOUT_S
        while time.time() < deadline:
            desc = pc.describe_index(settings.pinecone_index)
            if getattr(getattr(desc, "status", None), "ready", False):
                return
            time.sleep(1)
        raise RuntimeError(
            f"Pinecone index '{settings.pinecone_index}' did not become ready "
            f"within {_INDEX_READY_TIMEOUT_S}s."
        )

    def _clear_namespace(self, index) -> None:
        # delete_all raises NotFoundError if the namespace doesn't exist yet.
        try:
            index.delete(delete_all=True, namespace=self._namespace)
        except Exception:
            pass


def _require_config() -> None:
    if not settings.pinecone_api_key:
        raise RuntimeError(
            "PINECONE_API_KEY must be set to use the watsonx backend. "
            "See .env.example."
        )
