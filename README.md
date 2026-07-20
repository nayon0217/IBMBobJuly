# The Green Room

A green room is where a theatre's cast wait before going on. Upload a
manuscript and this one fills with its characters — talk to them one at a
time, or put several on stage together and watch what they do to each other.
Built for the IBM Bob AI Builders Challenge (July theme: *Reimagine Creative
Industries with AI*).

The magic moment: a writer sets a scene, two of their own characters play it
out, and the tool surfaces a plot direction they hadn't thought of.

## Why the repo is shaped this way

Two people, one month. The backend exposes a **fixed contract** (`/extract`,
`/chat`, `/scene`) whose internals run on **mock data by default**. That lets
the two tracks run in parallel with almost no blocking:

- **Person A (AI/agent):** replace the mock internals in `backend/app/services/`
  with real watsonx/Granite calls. Start with `watsonx.py`, then extraction →
  chat → scene, in that order.
- **Person B (product/frontend):** build the UI in `frontend/` against the live
  endpoints with `BACKEND=mock`. Never blocked waiting on the AI work.

The contract lives in two mirrored files — keep them in sync:
`backend/app/schemas.py` and `frontend/src/api.js`, described in
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Structure

```
backend/
  app/
    schemas.py         # THE CONTRACT (Pydantic models)
    main.py            # FastAPI routes (thin)
    config.py          # BACKEND=mock|watsonx switch
    mock_data.py       # canned characters + responses
    services/
      extraction.py    # Phase 1: manuscript -> persona cards
      chat.py          # Phase 2: single-character chat (the MVP)
      scene.py         # Phase 3: multi-agent + narrator (the win)
      watsonx.py       # the ONLY file that talks to IBM
  tests/test_smoke.py  # proves the contract end to end
frontend/
  src/api.js           # client mirroring the contract
  src/App.jsx          # plain dev harness — grow into the real UI
docs/API_CONTRACT.md   # agree on this day one
```

## Run it

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env        # BACKEND=mock works with no keys
uvicorn app.main:app --reload     # http://localhost:8000/docs
pytest                            # 5 smoke tests should pass
```

Frontend:
```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

With the backend on `mock`, the frontend harness runs the full loop
(extract → chat → scene) using canned data — no IBM credentials required.

## Build order (maps to the plan)

1. **Week 1** — Person A: `watsonx.py` + real `extraction.py`. Person B:
   manuscript upload UI + character list.
2. **Week 2** — Person A: real `chat.py` (grounded, in-voice). Person B: chat UI.
   *This is the MVP that must ship.*
3. **Week 3** — Person A: real `scene.py` (multi-agent + narrator). Person B:
   scene-setup + conversation view. *Pair on this integration.*
4. **Week 4** — polish, optional avatar/TTS, demo video, submission writeup.

**Cut line:** single-character chat must ship; multi-agent is the win; the
avatar is disposable. If a week slips, cut from the top.

## IBM tech (name these in the submission)

Granite models for extraction, persona voice, and dialogue; watsonx.ai for
inference and embeddings; the multi-agent layer as the orchestration showcase.
Tie each to a judging criterion in the writeup.
