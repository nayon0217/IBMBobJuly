"""Chat agent (real path) with the provider + vector store faked — no network.

Covers the load-bearing guarantees: persona system prompt is built from the
card, retrieval respects the timeline (knowledge_up_to_chunk), and grounded_in
is assembled from what was retrieved rather than self-reported by the model.
"""

from types import SimpleNamespace

import pytest

from app.config import Backend, settings
from app.schemas import ChatRequest, ChatTurn, PersonaCard
from app.services import chat as chat_svc
from app.services import providers, store

CARDS = [
    PersonaCard(
        id="harry-potter",
        name="Harry Potter",
        traits=["brave", "loyal"],
        motivations=["belong somewhere"],
        voice="earnest, plain",
        relationships={"rubeus-hagrid": "father-figure"},
    ),
    PersonaCard(id="rubeus-hagrid", name="Rubeus Hagrid", traits=["warm"]),
]

CHUNKS = [
    "Harry lived in a cupboard under the stairs.",
    "Hagrid arrived carrying the letter.",
    "Much later, at Hogwarts, everything changed.",
]


@pytest.fixture
def fake_chat_backend(monkeypatch):
    monkeypatch.setattr(settings, "backend", Backend.WATSONX)
    store.save_characters(CARDS)
    vs = store.InMemoryVectorStore()
    # Orthogonal vectors so a query vector selects a specific chunk.
    vs.save_manuscript(CHUNKS, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
    monkeypatch.setattr(store, "_vector_store", vs)

    captured = {}

    def fake_generate(prompt, *, system="", max_tokens=512):
        captured["prompt"] = prompt
        captured["system"] = system
        return "I reckon so."

    def fake_embed(texts):
        # Always match chunk-1 (the Hagrid chunk) most strongly.
        return [[0.0, 1.0, 0.0] for _ in texts]

    monkeypatch.setattr(
        providers,
        "get_provider",
        lambda: SimpleNamespace(generate=fake_generate, embed=fake_embed),
    )
    yield captured
    store.clear_characters()
    store.reset_vector_store()


def test_reply_is_in_character_envelope(fake_chat_backend):
    resp = chat_svc.chat(ChatRequest(character_id="harry-potter", message="Hi?"))
    assert resp.reply.speaker_id == "harry-potter"
    assert resp.reply.text == "I reckon so."


def test_unknown_character_raises():
    with pytest.raises(ValueError):
        chat_svc.chat(ChatRequest(character_id="nobody", message="Hi"))


def test_system_prompt_serializes_the_card(fake_chat_backend):
    chat_svc.chat(ChatRequest(character_id="harry-potter", message="Hi?"))
    system = fake_chat_backend["system"]
    assert "Harry Potter" in system
    assert "brave" in system and "loyal" in system
    assert "belong somewhere" in system
    # Relationship id resolved to the other character's display name.
    assert "Rubeus Hagrid" in system
    # Timeline boundary instruction is present (half the timeline guarantee).
    assert "NO knowledge of anything that happens later" in system


def test_grounded_in_respects_timeline(fake_chat_backend):
    resp = chat_svc.chat(
        ChatRequest(
            character_id="harry-potter", message="What now?", knowledge_up_to_chunk=1
        )
    )
    assert resp.grounded_in, "expected retrieved chunks"
    for chunk_id in resp.grounded_in:
        assert int(chunk_id.removeprefix("chunk-")) <= 1


def test_grounded_in_comes_from_retrieval(fake_chat_backend):
    resp = chat_svc.chat(ChatRequest(character_id="harry-potter", message="Hi?"))
    # chunk-1 is the strongest match given the fake embedding.
    assert "chunk-1" in resp.grounded_in
