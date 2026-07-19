"""Turn a manuscript into an embedded chunk store + a character roster, then
ground persona cards on demand.

Ingestion (`extract`, BACKEND=watsonx):
    manuscript text -> chunks -> watsonx.embed() -> vector store (Pinecone)
                              -> discovery -> consolidation -> appearance scan
                                 (persona_pipeline.build_roster) -> roster
                              -> per-span timeline summaries
    Returns un-grounded character stubs (id + name + timeline anchors); the
    roster + chunks + timeline are cached in `store` for the next phase.

Grounding (`ensure_personas`, on entering a chat/scene):
    per requested character -> persona_pipeline.ground_character -> full card,
    cached so re-entry is instant. This is the old Stage 4, unchanged except
    that it runs later and only for the characters actually opened.

Mock path still returns sample characters so the rest of the app is
exercisable end to end with no credentials.
"""

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.config import Backend, settings
from app.mock_data import SAMPLE_CHARACTERS
from app.schemas import ExtractRequest, ExtractResponse, PersonaCard
from app.services import persona_pipeline, store, timeline as timeline_service
from app.services.jsonutil import parse_json

# Grounding calls are independent network I/O, so ground a requested cast
# concurrently (mirrors the old batch grounding's fan-out).
_GROUNDING_MAX_WORKERS = 8

SEGMENT_PROMPT = """You are analyzing a chapter from a novel. Split it into scenes.
A new scene begins when the location changes, time jumps, or the set of present characters changes substantially.

Return ONLY valid JSON, no other text, in this format:
{{"scenes": [{{"start_quote": "first 8 words of the scene", "summary": "one line", "characters_present": ["name1", "name2"], "location": "where"}}]}}

CHAPTER TEXT:
{chapter_text}"""


def segment_scenes(chapter_text: str, chapter_num: int) -> list[dict]:
    from app.services.watsonx import generate

    raw = generate(SEGMENT_PROMPT.format(chapter_text=chapter_text), max_tokens=2000)
    scenes = parse_json(raw)["scenes"]
    # locate each scene's start in the text via start_quote, slice the chapter
    # into scene texts, attach chapter_num + running seq
    ...
    return scenes


def _chunk(text: str, size: int = 1200) -> list[str]:
    """Naive fixed-size chunking. Good enough to start; swap for
    scene/paragraph-aware splitting later."""
    return [text[i : i + size] for i in range(0, len(text), size)] or [""]


def extract(
    req: ExtractRequest,
    progress: Optional[Callable[[str], None]] = None,
) -> ExtractResponse:
    """Phase 1: ingest the manuscript and discover the cast. Embeds + persists
    chunks, builds the canonical roster (Stages 1–3), and summarizes the
    timeline. Returns un-grounded character stubs; persona cards are grounded
    later by `ensure_personas`."""
    chunks = _chunk(req.manuscript_text)

    if settings.backend == Backend.MOCK:
        # Mirror the real contract: stubs now, full cards from ensure_personas.
        store.save_chunks(chunks)
        store.save_roster([])
        store.save_timeline([])
        store.clear_characters()
        stubs = [_stub_from_card(c) for c in SAMPLE_CHARACTERS]
        return ExtractResponse(characters=stubs, chunk_count=len(chunks), timeline=[])

    # --- real path (watsonx or claude) ---------------------------------------
    # The provider swaps the LLM/embeddings vendor without touching the staged
    # pipeline below; the vector store (Pinecone vs in-memory) follows backend.
    from app.services import providers

    provider = providers.get_provider()

    # Embed + persist chunks first so grounding + timeline can retrieve them.
    if progress:
        progress("Embedding manuscript and building the vector index…")
    vectors = provider.embed(chunks)
    vector_store = store.get_vector_store()
    vector_store.save_manuscript(chunks, vectors)
    store.save_chunks(chunks)
    # New upload = clean slate for any previously grounded cards.
    store.clear_characters()

    # Stages 1–3: who exists (grounding is deferred to ensure_personas).
    roster = persona_pipeline.build_roster(
        chunks, generate=provider.generate, progress=progress
    )
    store.save_roster(roster)

    # Timeline anchors for the spoiler slider / "what happens" readout.
    timeline = timeline_service.build_timeline(
        chunks, generate=provider.generate, progress=progress
    )
    store.save_timeline(timeline)

    stubs = [_stub_from_roster(entry) for entry in roster]
    return ExtractResponse(
        characters=stubs, chunk_count=len(chunks), timeline=timeline
    )


def ensure_personas(
    character_ids: list[str],
    knowledge_up_to_chunk: Optional[int] = None,
) -> list[PersonaCard]:
    """Phase 2: return fully grounded persona cards for the requested ids,
    grounding (Stage 4) any that aren't cached yet and caching the result so
    re-entry is instant. Aligned index-for-index with `character_ids`.

    `knowledge_up_to_chunk` is the timeline boundary the writer picked: the
    cards reflect who the characters are up to that point only. It's part of the
    cache key, so the same character at two different points is grounded (and
    cached) separately.

    Raises ValueError if an id isn't in the roster (surfaced as 404 upstream)."""
    if settings.backend == Backend.MOCK:
        cards = []
        for cid in character_ids:
            card = next((c for c in SAMPLE_CHARACTERS if c.id == cid), None)
            if card is None:
                raise ValueError(f"Unknown character: {cid}")
            cards.append(card)
        return cards

    roster = store.get_roster()
    by_id = {e["id"]: e for e in roster}

    # An id is resolvable if it's in the roster (we can ground it) or a card for
    # it already exists in the cache (e.g. directly injected, or grounded at
    # another boundary we can reuse when re-grounding isn't possible).
    missing = [
        cid
        for cid in character_ids
        if cid not in by_id and store.get_character(cid) is None
    ]
    if missing:
        raise ValueError(f"Unknown character(s): {', '.join(missing)}")

    # Ground (or re-ground) only roster ids not already cached at this exact
    # timeline boundary; ids we can't ground fall back to their existing card.
    to_ground = [
        cid
        for cid in dict.fromkeys(character_ids)
        if cid in by_id
        and not _is_grounded(store.get_character(cid, knowledge_up_to_chunk))
    ]

    if to_ground:
        from app.services import providers

        provider = providers.get_provider()
        chunks = store.get_chunks()
        vector_store = store.get_vector_store()

        def ground(cid: str) -> PersonaCard:
            return persona_pipeline.ground_character(
                by_id[cid],
                roster,
                chunks,
                vector_store,
                generate=provider.generate,
                embed=provider.embed,
                knowledge_up_to_chunk=knowledge_up_to_chunk,
            )

        workers = min(_GROUNDING_MAX_WORKERS, len(to_ground))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for card in pool.map(ground, to_ground):
                store.save_character(card, knowledge_up_to_chunk)

    # Prefer the card grounded at this exact boundary; fall back to any existing
    # card for the id when re-grounding wasn't possible.
    return [
        store.get_character(cid, knowledge_up_to_chunk) or store.get_character(cid)
        for cid in character_ids
    ]


def ensure_persona(
    character_id: str,
    knowledge_up_to_chunk: Optional[int] = None,
) -> PersonaCard | None:
    """Grounded card for a single id at a timeline boundary (or None if unknown
    in mock)."""
    return ensure_personas([character_id], knowledge_up_to_chunk)[0]


def get_character(
    character_id: str,
    knowledge_up_to_chunk: Optional[int] = None,
) -> PersonaCard | None:
    """Lookup helper: the grounded card if it exists, else the mock sample.
    Does NOT trigger grounding — use ensure_persona for that."""
    character = store.get_character(character_id, knowledge_up_to_chunk)
    if character is not None:
        return character
    if settings.backend == Backend.MOCK:
        return next((c for c in SAMPLE_CHARACTERS if c.id == character_id), None)
    return None


# --- stub helpers -------------------------------------------------------------


def _is_grounded(card: Optional[PersonaCard]) -> bool:
    return card is not None and card.grounded


def _stub_from_roster(entry: dict) -> PersonaCard:
    """A roster survivor as an un-grounded stub: identity + timeline anchors,
    no persona detail yet."""
    return PersonaCard(
        id=entry["id"],
        name=entry["canonical_name"],
        key_scene_ids=entry.get("key_chunk_ids", []),
        first_appearance_chunk=entry.get("first_appearance_chunk"),
        grounded=False,
    )


def _stub_from_card(card: PersonaCard) -> PersonaCard:
    """Strip a full (mock) card down to an un-grounded stub for the /extract
    response, so mock mirrors the real contract."""
    return PersonaCard(
        id=card.id,
        name=card.name,
        key_scene_ids=card.key_scene_ids,
        first_appearance_chunk=card.first_appearance_chunk,
        grounded=False,
    )
