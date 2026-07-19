"""Extraction pipeline tests: the staged watsonx agent with IBM calls faked.

Exercises the two-phase flow on the hp_ch1.txt fixture, with generate/embed
monkeypatched (routed by stage) so no credentials or network are needed:
  - /extract (build_roster): discovery -> consolidation -> appearance scan +
    timeline summaries, returning un-grounded stubs for the whole cast.
  - ensure_personas (ground_character): Stage 4, on demand, producing full
    grounded cards and caching them.
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
        # gender rides the same grounding call as everything else
        "gender": "male",
        "relationships": {"vernon-dursley": "resented guardian"},
    },
    "Vernon Dursley": {
        "traits": ["irritable"],
        "motivations": ["keep life normal"],
        "voice": "Blustering, loud.",
        # physical "unknown" must normalize to an empty string
        "physical": "unknown",
        # model didn't settle gender — the deterministic honorific/pronoun
        # fallback must, without any extra call
        "gender": "unknown",
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
    if "PASSAGE:" in prompt:  # timeline summary calls
        return "Something happens in the passage."
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


def test_extract_returns_ungrounded_roster(fake_watsonx):
    vs = fake_watsonx
    progress_log = []
    resp = extraction.extract(
        ExtractRequest(manuscript_text=FIXTURE.read_text(), title="HP"),
        progress=progress_log.append,
    )

    ids = [c.id for c in resp.characters]
    # both major characters survive; the "background" owl is filtered out
    assert set(ids) == {"harry-potter", "vernon-dursley"}
    # stubs are returned most-mentioned first — the Dursleys dominate chapter 1
    assert ids[0] == "vernon-dursley"

    by_id = {c.id: c for c in resp.characters}
    harry = by_id["harry-potter"]
    # /extract returns un-grounded stubs: identity + timeline anchors only, no
    # persona detail yet (that's deferred to ensure_personas)
    assert harry.grounded is False
    assert harry.traits == []
    assert harry.voice == ""
    assert harry.physical == ""
    # timeline anchors still come from the real appearance scan
    assert harry.first_appearance_chunk is not None
    assert harry.key_scene_ids
    for chunk_id in harry.key_scene_ids:
        assert "harry" in vs.get_chunk(chunk_id).lower()

    # a per-span timeline is produced and returned in chunk order
    assert resp.timeline
    assert resp.timeline[0].chunk_start == 0
    assert all(t.summary for t in resp.timeline)

    # grounding has NOT happened yet — the persona cache is empty
    assert extraction.get_character("harry-potter") is None

    # progress was emitted for the discovery stages
    assert any("Stage 1/4" in m for m in progress_log)


def test_ensure_personas_grounds_on_demand(fake_watsonx):
    vs = fake_watsonx
    extraction.extract(ExtractRequest(manuscript_text=FIXTURE.read_text(), title="HP"))

    cards = extraction.ensure_personas(["harry-potter", "vernon-dursley"])
    # aligned index-for-index with the request
    assert [c.id for c in cards] == ["harry-potter", "vernon-dursley"]

    by_id = {c.id: c for c in cards}
    harry = by_id["harry-potter"]
    assert harry.grounded is True
    assert harry.traits == ["brave", "curious"]
    # physical appearance flows through the same grounding call (no extra call)
    assert "lightning-shaped scar" in harry.physical
    # a model "unknown" is normalized to empty so the UI can hide the field
    assert by_id["vernon-dursley"].physical == ""
    # gender flows through the same grounding call (no extra call)...
    assert harry.gender == "male"
    # ...and when the model punts ("unknown"), the deterministic
    # honorific/pronoun scan settles it from the text itself
    assert by_id["vernon-dursley"].gender == "male"
    # relationships resolve to valid ids (even when the model keyed by name)
    assert harry.relationships == {"vernon-dursley": "resented guardian"}
    assert by_id["vernon-dursley"].relationships == {"harry-potter": "unwanted nephew"}
    # key scenes + first appearance carried over from the roster
    assert harry.first_appearance_chunk is not None
    assert harry.key_scene_ids
    for chunk_id in harry.key_scene_ids:
        assert "harry" in vs.get_chunk(chunk_id).lower()

    # now cached, so it backs chat/scene lookup without re-grounding
    assert extraction.get_character("harry-potter") is not None
    # unknown ids raise (surfaced as 404 by the API)
    with pytest.raises(ValueError):
        extraction.ensure_personas(["nobody"])


def test_grounding_respects_timeline_boundary(fake_watsonx, monkeypatch):
    prompts = []

    def recording_generate(prompt, **kw):
        prompts.append(prompt)
        return _fake_generate(prompt, **kw)

    monkeypatch.setattr(watsonx, "generate", recording_generate)
    extraction.extract(ExtractRequest(manuscript_text=FIXTURE.read_text()))

    # Grounding at a timeline boundary injects the spoiler-safe instruction...
    extraction.ensure_personas(["harry-potter"], knowledge_up_to_chunk=0)
    persona_prompts = [p for p in prompts if "persona card" in p]
    assert persona_prompts and any("TIMELINE" in p for p in persona_prompts)

    # ...and the whole-story grounding does not.
    prompts.clear()
    extraction.ensure_personas(["harry-potter"])  # None = whole manuscript
    assert not any("TIMELINE" in p for p in prompts if "persona card" in p)

    # The two boundaries are cached as distinct cards.
    assert store.get_character("harry-potter", 0) is not None
    assert store.get_character("harry-potter", None) is not None


def test_ensure_personas_caches_per_boundary(fake_watsonx):
    extraction.extract(ExtractRequest(manuscript_text=FIXTURE.read_text()))
    extraction.ensure_personas(["harry-potter"], knowledge_up_to_chunk=1)
    # a second call at the same boundary is served from cache (no new card obj)
    first = store.get_character("harry-potter", 1)
    again = extraction.ensure_personas(["harry-potter"], knowledge_up_to_chunk=1)[0]
    assert again is first


def test_background_character_filtered(fake_watsonx):
    resp = extraction.extract(ExtractRequest(manuscript_text=FIXTURE.read_text()))
    assert "an-owl" not in [c.id for c in resp.characters]


def test_parse_json_tolerates_code_fences():
    from app.services.jsonutil import parse_json

    raw = 'Here you go:\n```json\n{"characters": []}\n```'
    assert parse_json(raw) == {"characters": []}
