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
Manuscript in, cast out. Ingestion only: embed + index chunks, discover the
canonical roster, summarize the timeline. Returns **un-grounded stubs** (`id`,
`name`, timeline anchors, `grounded: false`) for the whole cast. Per-character
persona grounding is deferred to `POST /personas`.

Request:
```json
{ "manuscript_text": "full text...", "title": "optional" }
```
Response:
```json
{
  "characters": [ PersonaCard (stub), ... ],
  "chunk_count": 12,
  "timeline": [ { "chunk_start": 0, "chunk_end": 1, "summary": "..." }, ... ]
}
```

## `POST /personas`
Ground the requested characters into full persona cards (Stage 4), on demand,
when a chat/scene is entered. Caches results; unknown ids yield `404`.

Request:
```json
{
  "character_ids": ["elizabeth-bennet", "fitzwilliam-darcy"],
  "knowledge_up_to_chunk": 8
}
```
Response:
```json
{ "characters": [ PersonaCard, ... ] }
```
`knowledge_up_to_chunk` (optional) grounds each persona from only the passages
up to that timeline point, so the card reflects who the character is *then*.
Part of the cache key. `/scene` accepts the same field, mirroring `/chat`.

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
  "gender": "female",
  "relationships": { "fitzwilliam-darcy": "wary attraction" },
  "key_scene_ids": ["chunk-3", "chunk-11"]
}
```
`gender` is `"male"`, `"female"`, `"nonbinary"`, or `""` when the text never
settles it. It costs no extra API calls: the extraction pipeline asks for it
inside the existing persona grounding call and otherwise infers it
deterministically from honorifics and nearby pronouns — the same inference
backfills cards from runs that predate the field.
