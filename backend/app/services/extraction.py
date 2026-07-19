"""Turn a manuscript into persona cards + an embedded chunk store.

Real pipeline (BACKEND=watsonx):
    manuscript text -> chunks -> watsonx.embed() -> vector store (Pinecone)
                              -> staged extraction agent (persona_pipeline)
                                 discovery -> consolidation -> appearance scan
                                 -> grounded persona cards (retrieved from the
                                    vector DB)

Mock path still returns sample characters so the rest of the app is
exercisable end to end with no credentials.
"""

from collections.abc import Callable
from typing import Optional

from app.config import Backend, settings
from app.mock_data import SAMPLE_CHARACTERS
from app.schemas import ExtractRequest, ExtractResponse, PersonaCard
from app.services import persona_pipeline, store
from app.services.jsonutil import parse_json

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
    chunks = _chunk(req.manuscript_text)

    if settings.backend == Backend.MOCK:
        return ExtractResponse(characters=SAMPLE_CHARACTERS, chunk_count=len(chunks))

    # --- watsonx path ---------------------------------------------------------
    from app.services import watsonx

    # Embed + persist chunks first so the grounding stage can retrieve them.
    if progress:
        progress("Embedding manuscript and building the vector index…")
    vectors = watsonx.embed(chunks)
    vector_store = store.get_vector_store()
    vector_store.save_manuscript(chunks, vectors)

    characters = persona_pipeline.extract_characters(
        chunks,
        vector_store,
        generate=watsonx.generate,
        embed=watsonx.embed,
        progress=progress,
    )

    store.save_characters(characters)
    return ExtractResponse(characters=characters, chunk_count=len(chunks))


def get_character(character_id: str) -> PersonaCard | None:
    """Lookup helper used by chat/scene. Prefers the real extracted store;
    falls back to mock data so the mock path keeps working."""
    character = store.get_character(character_id)
    if character is not None:
        return character
    if settings.backend == Backend.MOCK:
        return next((c for c in SAMPLE_CHARACTERS if c.id == character_id), None)
    return None
