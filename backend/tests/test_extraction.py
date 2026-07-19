"""Extraction pipeline tests: the staged watsonx agent with IBM calls faked.

Exercises discovery -> consolidation -> appearance scan -> grounded persona
cards on the hp_ch1.txt fixture, with generate/embed monkeypatched (routed by
stage) so no credentials or network are needed.
"""

import json
import re
from pathlib import Path

import pytest

from app.config import settings
from app.schemas import Backend, ExtractRequest
from app.services import extraction, store, watsonx
from app.services.store import InMemoryVectorStore

FIXTURE = Path(__file__).parent / "hp_ch1.txt"

DISCOVERY = {
    "characters": [
        {"name": "Harry Potter", "aliases": ["Harry"], "descriptor": "an orphaned boy"},
        {"name": "Mr Dursley", "aliases": ["Vernon", "Dursley"], "descriptor": "his uncle"},
        {"name": "an owl", "aliases": [], "descriptor": "a background animal"},
    ]
}

ROSTER = {
    "roster": [
        {
            "canonical_name": "Harry Potter",
            "aliases": ["Harry Potter", "Harry"],
            "rough_importance": "major",
        },
        {
            "canonical_name": "Vernon Dursley",
            "aliases": ["Vernon Dursley", "Mr Dursley", "Dursley", "Vernon"],
            "rough_importance": "major",
        },
        {
            "canonical_name": "An Owl",
            "aliases": ["owl"],
            "rough_importance": "background",
        },
    ]
}

PERSONAS = {
    "Harry Potter": {
        "traits": ["brave", "curious"],
        "motivations": ["find where he belongs"],
        "voice": "Plain, earnest.",
        "physical": "A skinny boy with a lightning-shaped scar on his forehead.",
        "relationships": {"vernon-dursley": "resented guardian"},
    },
    "Vernon Dursley": {
        "traits": ["irritable"],
        "motivations": ["keep life normal"],
        "voice": "Blustering, loud.",
        # physical "unknown" must normalize to an empty string
        "physical": "unknown",
        # keyed by display name on purpose — normalization must remap it to id
        "relationships": {"Harry Potter": "unwanted nephew"},
    },
}


def _fake_generate(prompt: str, **_kw) -> str:
    if "canonical roster" in prompt:
        return json.dumps(ROSTER)
    if "persona card" in prompt:
        name = re.search(r"CHARACTER: (.+)", prompt).group(1).strip()
        return json.dumps(PERSONAS[name])
    return json.dumps(DISCOVERY)  # discovery batches


@pytest.fixture
def fake_watsonx(monkeypatch):
    monkeypatch.setattr(settings, "backend", Backend.WATSONX)
    monkeypatch.setattr(watsonx, "generate", _fake_generate)
    monkeypatch.setattr(watsonx, "embed", lambda texts: [[1.0, 0.0, 0.0] for _ in texts])
    vs = InMemoryVectorStore()
    monkeypatch.setattr(store, "get_vector_store", lambda: vs)
    yield vs
    store.clear_characters()


def test_staged_extraction(fake_watsonx):
    vs = fake_watsonx
    progress_log = []
    resp = extraction.extract(
        ExtractRequest(manuscript_text=FIXTURE.read_text(), title="HP"),
        progress=progress_log.append,
    )

    ids = [c.id for c in resp.characters]
    # both major characters survive; the "background" owl is filtered out
    assert set(ids) == {"harry-potter", "vernon-dursley"}
    # cards are returned most-mentioned first — the Dursleys dominate chapter 1
    assert ids[0] == "vernon-dursley"

    by_id = {c.id: c for c in resp.characters}
    harry = by_id["harry-potter"]
    assert harry.traits == ["brave", "curious"]
    # physical appearance flows through the same grounding call (no extra call)
    assert "lightning-shaped scar" in harry.physical
    # a model "unknown" is normalized to empty so the UI can hide the field
    assert by_id["vernon-dursley"].physical == ""
    # relationships resolve to valid ids (even when the model keyed by name)
    assert harry.relationships == {"vernon-dursley": "resented guardian"}
    assert by_id["vernon-dursley"].relationships == {"harry-potter": "unwanted nephew"}

    # Stage 3 grounding: key scenes + first appearance come from the real text
    assert harry.first_appearance_chunk is not None
    assert harry.key_scene_ids
    for chunk_id in harry.key_scene_ids:
        assert "harry" in vs.get_chunk(chunk_id).lower()

    # persona registry backs chat/scene lookup
    assert extraction.get_character("harry-potter") is not None
    assert extraction.get_character("nobody") is None

    # progress was emitted per stage
    assert any("Stage 1/4" in m for m in progress_log)
    assert any("Stage 4/4" in m for m in progress_log)


def test_background_character_filtered(fake_watsonx):
    resp = extraction.extract(ExtractRequest(manuscript_text=FIXTURE.read_text()))
    assert "an-owl" not in [c.id for c in resp.characters]


def test_parse_json_tolerates_code_fences():
    from app.services.jsonutil import parse_json

    raw = 'Here you go:\n```json\n{"characters": []}\n```'
    assert parse_json(raw) == {"characters": []}
