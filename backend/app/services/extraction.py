"""Turn a manuscript into persona cards + an embedded chunk store.

Phase 1 work (Person A). Right now the mock path returns sample characters so
the rest of the app is exercisable end to end.
"""

from app.config import Backend, settings
from app.mock_data import SAMPLE_CHARACTERS
from app.schemas import ExtractRequest, ExtractResponse, PersonaCard


def _chunk(text: str, size: int = 1200) -> list[str]:
    """Naive fixed-size chunking. Good enough to start; Person A can swap for
    scene/paragraph-aware splitting later."""
    return [text[i : i + size] for i in range(0, len(text), size)] or [""]


def extract(req: ExtractRequest) -> ExtractResponse:
    chunks = _chunk(req.manuscript_text)

    if settings.backend == Backend.MOCK:
        return ExtractResponse(characters=SAMPLE_CHARACTERS, chunk_count=len(chunks))

    # --- watsonx path (Person A) ---------------------------------------------
    # 1. embed(chunks) and store vectors keyed by chunk id ("chunk-0", ...)
    # 2. prompt Granite to list characters, then to fill one PersonaCard each
    # 3. return real cards + real chunk_count
    from app.services import watsonx  # noqa: F401  (import here to keep mock light)

    raise NotImplementedError(
        "Real extraction not wired up. Implement in extraction.extract()."
    )


def get_character(character_id: str) -> PersonaCard | None:
    """Lookup helper used by chat/scene. Backed by mock data for now; Person A
    replaces with a real store once /extract persists cards."""
    return next((c for c in SAMPLE_CHARACTERS if c.id == character_id), None)
