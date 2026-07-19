# Product Specification: Manuscript Characters

## 1. Overview

**One-line pitch:** Upload a manuscript, and the app generates interactive AI
personas of its characters. Writers can chat one-on-one with a character, or
place multiple characters together in a scene and watch them interact — with
an AI narrator surfacing plot directions the writer hadn't considered.

**Primary user:** Fiction writers who want a tool to explore their own
characters, test dialogue, and get unstuck on "what happens next."

**Core magic moment:** The writer sets a scene, two of their own characters
play it out in voice, and the app returns a concrete, specific suggestion for
what could happen next in the story.

This spec describes a full-stack web app: a backend that handles manuscript
processing and AI orchestration, and a frontend the writer interacts with
directly in the browser.

---

## 2. Tech expectations (flexible, but assume this baseline)

- **Backend:** Python, FastAPI. LLM calls should be abstracted behind a single
  provider-agnostic module so the model/provider can be swapped without
  touching business logic (default to whatever the LLM API available in the
  build environment is — e.g. Anthropic's API — unless told otherwise).
- **Frontend:** React (Vite), no heavy component library required. Clean,
  functional UI — polish is welcome but secondary to the features working
  correctly.
- **Storage:** In-memory or a simple embedded DB (SQLite) is fine for v1. No
  need for user accounts/auth — this is a single-session tool per manuscript
  upload, unless otherwise specified.
- **Vector search:** A simple embedding + cosine similarity store (e.g.
  Chroma, or even an in-memory numpy implementation) is sufficient for
  manuscript retrieval. Don't over-engineer this.

Claude Code should feel free to choose specific libraries, but should keep the
architecture modular: **ingestion → extraction → retrieval → chat/scene
generation → UI**, with clean seams between each stage.

---

## 3. Core user flow

1. Writer uploads or pastes a manuscript (plain text, .docx, or .pdf).
2. App processes the manuscript: splits it into ordered chunks (by
   chapter/scene, falling back to fixed-size chunks) and extracts a list of
   characters with persona cards.
3. Writer sees the list of extracted characters and **selects which ones to
   activate** (see Feature 3 below) — not all characters need to be brought
   to life, especially minor ones.
4. Writer sets a **timeline position** using a slider/toggle (see Feature 2
   below) — this determines how much of the manuscript each character is
   allowed to "know" during interactions.
5. Writer either:
   - Opens a **1:1 chat** with a single selected character, or
   - Opens a **scene** with two or more selected characters, describes a
     situation (and optionally a mid-scene twist), and watches them interact.
6. After a scene, the app shows a **plot suggestion panel**: a summary of what
   emerged plus several concrete "what happens next" directions.

---

## 4. Feature specifications

### 4.1 Manuscript ingestion

- Accept manuscript input via file upload (.txt, .docx, .pdf) or a paste-text
  textarea.
- Parse into an **ordered list of chunks**. Prefer chapter/scene-boundary
  splitting if detectable (e.g. "Chapter", "Ch.", scene breaks like "* * *");
  otherwise fall back to fixed-size chunking (~1000–1500 characters) that
  never splits mid-sentence where avoidable.
- Each chunk gets a stable index (0, 1, 2, ...) and this index is the backbone
  of the timeline feature (Feature 2) — chunk 0 is the start of the
  manuscript, chunk N is the end.
- Store the full chunk list with metadata (index, approximate position %,
  optional detected chapter title) for later retrieval.
- Show basic upload feedback: filename, word count, number of chunks
  detected, and a progress indicator during processing (extraction can take
  a noticeable amount of time on a full novel).

### 4.2 Character extraction

- Run an LLM extraction pass over the manuscript to identify all characters
  with meaningful presence (skip one-off named background characters).
- For each character, generate a **persona card**:
  - `id` (stable slug)
  - `name`
  - `traits` (list of adjectives/descriptors)
  - `motivations` (what they want)
  - `voice` (how they speak — register, verbal tics, sentence style)
  - `relationships` (map of other character id → nature of relationship)
  - `first_appearance_chunk` and `key_chunks` (chunk indices where they're
    most prominent — used for retrieval and for defaulting the timeline)
- Persona cards should be regenerated/refined using the *actual manuscript
  text* via retrieval, not just invented from character names — i.e., ground
  extraction in real passages about that character, not the model's guess
  from name alone.
- Display extracted characters as a list/grid of cards (name + short trait
  summary) once processing finishes.

### 4.3 Character selection (which characters to activate)

- After extraction, the writer sees **all detected characters as a checklist
  (pulled dynamically from the manuscript — never hardcoded)**.
- Each character can be toggled on/off. Only "activated" characters:
  - appear as chat options,
  - are selectable for scenes.
- Support "select all" / "select none" / a reasonable default (e.g. top 5 by
  appearance frequency pre-checked).
- Deactivating a character doesn't delete their persona card — just hides
  them from interaction, so toggling is instant and reversible (no
  re-extraction needed).
- This selection list should update automatically per-manuscript — if a new
  manuscript is uploaded, the old character list is replaced entirely.

### 4.4 Timeline toggle (knowledge boundary)

This is a key feature — treat it as first-class, not an afterthought.

- Display a **slider or scrubber** representing the writer's position in the
  manuscript, labeled with something readable (e.g. "up to Chapter 12" or
  "62% through the manuscript") rather than a raw chunk number.
- The timeline value maps to a chunk index: `knowledge_up_to_chunk`.
- This value must be **respected everywhere characters generate text**:
  - In 1:1 chat: the character's grounding retrieval only pulls from chunks
    at or before `knowledge_up_to_chunk`. The system prompt explicitly
    instructs the model that the character has no knowledge of anything
    past that point in the story, even if asked directly.
  - In scenes: the same boundary applies to all participating characters.
  - Persona cards themselves are static (traits/voice), but *retrieved
    grounding context and behavior* must change based on the timeline
    position — i.e., a character asked about an event 3 chapters in their
    future should plausibly not know it, deflect, or be surprised if asked.
- Default the timeline to **100% (full manuscript)** on load, but make it
  clearly adjustable at all times — this should be a persistent, visible
  control (not buried in a settings menu), since re-reading with an earlier
  timeline is a core reason writers will use this tool (e.g. "what did this
  character believe back in Act 1?").
- Changing the timeline should not require re-uploading or re-extracting —
  it only affects retrieval/generation at chat/scene time.

### 4.5 Single-character chat

- Writer picks one activated character and opens a chat interface.
- Standard chat UI: message history, input box, sending indicator.
- Each character response should:
  - Be grounded via retrieval against manuscript chunks up to the current
    timeline boundary.
  - Stay in voice, per their persona card.
  - Feel like a real conversation, not a manuscript summary — the character
    should respond as themselves, not narrate themselves in third person.
- Conversation history persists for the session (per character) so the
  writer can have an extended back-and-forth.
- Allow a "reset conversation" action per character.

### 4.6 Multi-character scenes (the core differentiator)

- Writer selects **two or more** activated characters to place in a scene.
- Writer provides:
  - A **situation** (free text: the setup/setting for the scene).
  - An optional **mid-scene twist** (free text: something injected partway
    through, e.g. "a letter arrives revealing the affair").
  - A max number of dialogue turns (a reasonable default, e.g. 6–10, with
    the option to extend/continue the scene).
- The app orchestrates the characters taking turns responding to each other
  and to the situation, each grounded in their own persona and the timeline
  boundary — one character should not "know" something another character
  hasn't revealed unless it's plausible from what's already public in the
  scene.
- Display the resulting dialogue as a readable script/transcript (speaker
  name + line), not a raw JSON blob.
- After the dialogue concludes, a **narrator/director pass** runs: an LLM
  call that reads the full exchange and produces:
  - A short summary of what emerged (1–2 sentences).
  - A list of **concrete "what happens next" suggestions** (3–5 distinct,
    specific directions — not generic advice).
- Allow the writer to **continue the scene** (extend dialogue further) or
  **start a new scene** with different characters/situation.

### 4.7 Optional stretch feature: character avatar / visual representation

- Not required for core functionality, but if time allows, each character
  can have a simple visual representation (a generated portrait, stylized
  avatar, or simple 2D illustration) shown next to their name in chat/scenes.
- Optional: text-to-speech playback of character lines.
- This should be built as a clearly separable, optional layer that can be
  skipped entirely without affecting the core chat/scene functionality —
  do not let this block or complicate the core build.

---

## 5. UI/page structure

A single-page app is sufficient. Suggested layout:

1. **Upload/landing view** — file upload or paste-text input, processing
   status.
2. **Manuscript workspace view** (shown after processing completes):
   - Persistent top bar: manuscript title, word count, and the **timeline
     slider** (always visible, since it applies globally to all
     interactions).
   - Sidebar or panel: **character checklist** (activate/deactivate), pulled
     from extraction results.
   - Main panel, with a mode switch between:
     - **Chat mode**: pick one activated character, chat interface.
     - **Scene mode**: pick 2+ activated characters, situation/twist inputs,
       "run scene" button, dialogue transcript, plot suggestion panel below.
3. Empty/loading states should be handled gracefully (e.g. "no characters
   selected yet," "extracting characters from your manuscript... this may
   take a minute").

---

## 6. Explicit non-goals for v1

- No user authentication or multi-user accounts.
- No persistence across sessions/browser restarts required (nice-to-have,
  not required).
- No real-time 3D character rendering — if visuals are added at all, keep
  them lightweight (see 4.7).
- No mobile-specific optimization required, though basic responsiveness is
  appreciated.

---

## 7. Success criteria

The build is complete when a user can:
1. Upload a real manuscript (a public-domain novel is a good test case).
2. See an accurate, non-hardcoded list of extracted characters and select
   which to activate.
3. Move the timeline slider and confirm (by asking a character about a later
   event) that the character plausibly doesn't reveal future knowledge.
4. Hold a coherent, in-voice conversation with a single character.
5. Run a scene with two or more characters and receive a dialogue transcript
   plus specific, non-generic plot suggestions.