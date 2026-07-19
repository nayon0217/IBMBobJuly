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
  "reply": { "speaker_id": "elizabeth-bennet", "text": "...", "emotion": "smile" },
  "grounded_in": ["chunk-3", "chunk-11"]
}
```
`knowledge_up_to_chunk` is optional; when set, the character can't know events
after that point (spoiler-safe).

`reply.emotion` is the speaker's facial expression for that line, one of
`concerned`, `default`, `eating`, `grimace`, `sad`, `screamOpen`, `serious`,
`smile`, `tongue`, `twinkle` (matches the DiceBear avataaars `mouth` enum, so
the frontend can render it directly). It's produced inside the same generation
call as the reply — no extra API call — and falls back to `default`. Writer
turns always carry `default`.

## `POST /scene`  ← the differentiator
Put one or more characters into a situation and read what emerges. Characters
take turns round-robin, but if a speaker calls another character by name, that
character replies next (out of turn). One character is a soliloquy.

Request:
```json
{
  "character_ids": ["elizabeth-bennet", "fitzwilliam-darcy"],
  "situation": "They are trapped by rain in a parlour.",
  "max_turns": 6
}
```
`character_ids` needs at least one id; `max_turns` is 1–20 (default 6).

Response:
```json
{
  "dialogue": [ { "speaker_id": "...", "text": "...", "emotion": "serious" }, ... ],
  "suggestion": {
    "summary": "...",
    "character_feelings": ["...", "...", "..."]
  }
}
```
`summary` is a third-person recap of the scene. `character_feelings` is how each
character feels afterwards, in voice — aligned index-for-index with the request's
`character_ids`.

Each dialogue turn's `emotion` is the speaker's facial expression for that line
(same enum and same in-generation trick as `/chat`, no extra API call), so the
scene stage can emote per line — an actor's avatar takes on the expression of
their most recent line.

---

## PersonaCard
```json
{
  "id": "elizabeth-bennet",
  "name": "Elizabeth Bennet",
  "traits": ["witty", "independent"],
  "motivations": ["marry for love"],
  "voice": "Sharp, ironic, full sentences.",
  "physical": "Tall, 17 years old, blonde hair",
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