# The Green Room

## Motivation

The Green Room is a platform to help writers combat writer's block. Upload a
manuscript and this one fills with its characters — talk to them one at a
time, or put several on stage together and watch what they do to each other.
Built for the IBM Bob AI Builders Challenge (July theme: *Reimagine Creative
Industries with AI*).

Check it out here! https://thegreenroom.up.railway.app/ 

## How to Use

1. **Upload a manuscript** — supports `.docx`, `.pdf`, and plain text.
2. **Personas are generated** for every character who appears, grounded in the text.
3. **Set the timeline** — choose how far into the manuscript the writer wants characters to "know" for this session.
4. **Chat** — ask Harry about school, and he won't mention Hogwarts or magic if that hasn't happened yet in the story. Personality and emotional tone come through in how he answers regardless.
5. **Or stage a scene** — give a prompt, and watch multiple characters converse. The tool surfaces their outcomes, feelings, a fleshed-out sense of the scenario, and the final exchange.

## Demo

(add video later)

<img width="1167" height="662" alt="Screenshot 2026-07-28 at 12 41 39" src="https://github.com/user-attachments/assets/7f255922-4a3d-4d78-b2d1-98a7d6355889" />
<img width="1166" height="658" alt="Screenshot 2026-07-28 at 12 42 04" src="https://github.com/user-attachments/assets/4988ef04-b32a-4fb4-a92c-e4e90df7048f" />
<img width="1164" height="661" alt="Screenshot 2026-07-28 at 12 42 54" src="https://github.com/user-attachments/assets/e3f293ee-3042-4cc2-b0d6-33dd8c9badd2" />
<img width="1166" height="657" alt="Screenshot 2026-07-28 at 12 43 24" src="https://github.com/user-attachments/assets/76a93e30-22c6-4c36-ad8d-1a20e624899a" />

## Tech Used

### Retrieval-augmented generation — IBM Granite embeddings + Pinecone

The manuscript is chunked in order, embedded with IBM's Granite embedding model on watsonx.ai, and indexed in a Pinecone serverless vector database. Every generation — persona grounding, chat replies, scene dialogue — is answered from passages retrieved from that index rather than the model's own memory of the book. Retrieval is capped to the writer's chosen timeline position, which is what keeps characters from knowing their own endings.

### Character extraction and persona building — IBM watsonx.ai

Personas are built by a four-stage pipeline:

1. **Discovery** — reads the manuscript and lists everyone who appears.
2. **Consolidation** — merges aliases and nicknames ("Elizabeth", "Lizzy", "Miss Bennet") into one canonical character.
3. **Ranking** — a deterministic scan ranks characters by how often they actually appear and drops background names.
4. **Grounding** — writes the persona card (traits, motivations, voice, physical description, relationships) from retrieved passages only — never from the name alone.

### 2D character generation — DiceBear

Each persona card includes a `physical` field extracted from the manuscript. An LLM call maps that freeform description onto a fixed menu of avatar parameters — hairstyle, hair color, skin tone, facial hair, accessories, clothing — which are passed to **DiceBear** (Avataaars style) to render a deterministic SVG avatar for the character. After every line a character speaks, an expression tag is parsed off that completion and mapped onto the avatar, so the character's visible emotional state updates as a conversation or scene unfolds. 

