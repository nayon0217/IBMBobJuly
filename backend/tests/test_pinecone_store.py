"""PineconeVectorStore tests with the Pinecone client fully mocked.

No network or credentials: we inject a fake index handle and assert on the
upsert payloads and the timeline ($lte) query filter.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.pinecone_store import PineconeVectorStore


@pytest.fixture
def store_with_fake_index():
    store = PineconeVectorStore()
    index = MagicMock()
    # Bypass client/index bootstrap so nothing hits Pinecone.
    store._ensure_index = lambda dimension: index
    store._get_index = lambda: index
    return store, index


def test_save_manuscript_upserts_with_metadata(store_with_fake_index):
    store, index = store_with_fake_index
    store.save_manuscript(
        chunks=["first chunk", "second chunk"],
        vectors=[[0.1, 0.2], [0.3, 0.4]],
    )

    # existing namespace wiped before upsert (clean slate on new upload)
    index.delete.assert_called_once()
    assert index.delete.call_args.kwargs["delete_all"] is True

    index.upsert.assert_called_once()
    records = index.upsert.call_args.kwargs["vectors"]
    assert [r["id"] for r in records] == ["chunk-0", "chunk-1"]
    assert records[0]["metadata"] == {"chunk_index": 0, "text": "first chunk"}
    assert records[1]["values"] == [0.3, 0.4]


def test_search_applies_timeline_filter(store_with_fake_index):
    store, index = store_with_fake_index
    index.query.return_value = SimpleNamespace(
        matches=[SimpleNamespace(id="chunk-0", metadata={"text": "hello"})]
    )

    hits = store.search([0.1, 0.2], top_k=3, up_to_chunk=5)

    assert hits == [("chunk-0", "hello")]
    assert index.query.call_args.kwargs["filter"] == {"chunk_index": {"$lte": 5}}
    assert index.query.call_args.kwargs["include_metadata"] is True


def test_search_without_timeline_has_no_filter(store_with_fake_index):
    store, index = store_with_fake_index
    index.query.return_value = SimpleNamespace(matches=[])

    store.search([0.1, 0.2])

    assert index.query.call_args.kwargs["filter"] is None


def test_get_chunk_reads_metadata_text(store_with_fake_index):
    store, index = store_with_fake_index
    index.fetch.return_value = SimpleNamespace(
        vectors={"chunk-2": SimpleNamespace(metadata={"text": "the text"})}
    )

    assert store.get_chunk("chunk-2") == "the text"
