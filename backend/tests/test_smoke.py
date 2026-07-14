"""Smoke tests: prove the contract holds end to end in mock mode.

Run: pytest  (from the backend/ directory)

These don't test AI quality — they test that the shapes are wired correctly so
the frontend can rely on them. Keep them green as you build.
"""

from fastapi.testclient import TestClient

from app.main import app

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
    assert "what_happens_next" in body["suggestion"]
