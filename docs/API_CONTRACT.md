# API Contract

This is the seam between the two tracks. Agree on it **on day one**. Change it
only together — when it changes, update `backend/app/schemas.py` and
`frontend/src/api.js` in the same commit.

Base URL (local): `http://localhost:8000`

---

## `GET /health`
Returns `{ "status": "ok", "backend": "mock" | "watsonx" }`.
Use it to confirm which backend the frontend is talking to.

## `POST /extract`
Manuscript in, characters out.

Request:
```json
{ "manuscript_text": "full text...", "title": "optional" }
```
Response:
```json
{
  "characters": [ PersonaCard, ... ],
  "chunk_count": 12
}
```

## `POST /chat`
Talk to one character, in voice, grounded in the manuscript.

Request:
```json
{
  "character_id": "elizabeth-bennet",
  "message": "Why did you refuse him?",
  "history": [ { "speaker_id": "writer", "text": "..." } ],
  "knowledge_up_to_chunk": 8
}
```
Response:
```json
{
  "reply": { "speaker_id": "elizabeth-bennet", "text": "..." },
  "grounded_in": ["chunk-3", "chunk-11"]
}
```
`knowledge_up_to_chunk` is optional; when set, the character can't know events
after that point (spoiler-safe).

## `POST /scene`  ← the differentiator
Put two+ characters together and read what emerges.

Request:
```json
{
  "character_ids": ["elizabeth-bennet", "fitzwilliam-darcy"],
  "situation": "They are trapped by rain in a parlour.",
  "twist": "A letter arrives mid-conversation.",
  "max_turns": 6
}
```
Response:
```json
{
  "dialogue": [ { "speaker_id": "...", "text": "..." }, ... ],
  "suggestion": {
    "summary": "...",
    "what_happens_next": ["...", "...", "..."]
  }
}
```

---

## PersonaCard
```json
{
  "id": "elizabeth-bennet",
  "name": "Elizabeth Bennet",
  "traits": ["witty", "independent"],
  "motivations": ["marry for love"],
  "voice": "Sharp, ironic, full sentences.",
  "relationships": { "fitzwilliam-darcy": "wary attraction" },
  "key_scene_ids": ["chunk-3", "chunk-11"]
}
```
