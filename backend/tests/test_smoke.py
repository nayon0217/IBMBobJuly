"""Smoke tests: prove the contract holds end to end in mock mode.

Run: pytest  (from the backend/ directory)

These don't test AI quality — they test that the shapes are wired correctly so
the frontend can rely on them. Keep them green as you build.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.services import store

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["backend"] == "mock"


def test_extract_returns_characters():
    r = client.post("/extract", json={"manuscript_text": "Once upon a time..."})
    assert r.status_code == 200
    body = r.json()
    assert len(body["characters"]) >= 2
    assert body["chunk_count"] >= 1


def test_extract_returns_ungrounded_stubs():
    r = client.post("/extract", json={"manuscript_text": "Once upon a time..."})
    body = r.json()
    # /extract now returns un-grounded stubs — persona detail comes from /personas
    assert all(c["grounded"] is False for c in body["characters"])
    assert "timeline" in body


def test_personas_grounds_characters():
    client.post("/extract", json={"manuscript_text": "Once upon a time..."})
    r = client.post("/personas", json={"character_ids": ["elizabeth-bennet"]})
    assert r.status_code == 200
    card = r.json()["characters"][0]
    assert card["id"] == "elizabeth-bennet"
    assert card["grounded"] is True
    assert card["traits"]  # full card, not a stub


def test_personas_unknown_404():
    r = client.post("/personas", json={"character_ids": ["nobody"]})
    assert r.status_code == 404


def test_chat_known_character():
    r = client.post(
        "/chat", json={"character_id": "elizabeth-bennet", "message": "Hello?"}
    )
    assert r.status_code == 200
    assert r.json()["reply"]["speaker_id"] == "elizabeth-bennet"


def test_chat_unknown_character_404():
    r = client.post("/chat", json={"character_id": "nobody", "message": "Hi"})
    assert r.status_code == 404


def test_scene_returns_dialogue_and_suggestion():
    r = client.post(
        "/scene",
        json={
            "character_ids": ["elizabeth-bennet", "fitzwilliam-darcy"],
            "situation": "They are trapped by rain in a small parlour.",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["dialogue"]) >= 2
    assert "summary" in body["suggestion"]
    assert "character_feelings" in body["suggestion"]


def test_session_teardown_drops_the_manuscript():
    client.post("/extract", json={"manuscript_text": "Once upon a time..."})
    client.post("/personas", json={"character_ids": ["elizabeth-bennet"]})
    assert store.get_chunks()

    r = client.delete("/session")
    assert r.status_code == 200
    assert r.json()["status"] == "cleared"
    assert store.get_chunks() == []
    assert store.get_roster() == []
    assert store.get_timeline() == []
    assert store.get_characters() == []
    assert store.get_vector_store().has_manuscript() is False


def test_session_teardown_is_idempotent():
    # The frontend fires this on unload without knowing whether anything was
    # uploaded, so a teardown with nothing to tear down must still succeed.
    assert client.delete("/session").status_code == 200
    assert client.delete("/session").status_code == 200
