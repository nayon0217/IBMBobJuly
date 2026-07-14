"""Single-character, in-voice, manuscript-grounded chat.

Phase 2 work (Person A) — this is the MVP that must ship.
"""

from app.config import Backend, settings
from app.mock_data import mock_chat_reply
from app.schemas import ChatRequest, ChatResponse
from app.services.extraction import get_character


def chat(req: ChatRequest) -> ChatResponse:
    character = get_character(req.character_id)
    if character is None:
        raise ValueError(f"Unknown character: {req.character_id}")

    if settings.backend == Backend.MOCK:
        return ChatResponse(reply=mock_chat_reply(req.character_id), grounded_in=[])

    # --- watsonx path (Person A) ---------------------------------------------
    # 1. retrieve top-k manuscript chunks relevant to req.message, filtered by
    #    req.knowledge_up_to_chunk so the character can't know future events
    # 2. build a system prompt from the PersonaCard (voice, traits, motivations)
    # 3. watsonx.generate(prompt=req.message, system=persona_prompt)
    # 4. return the reply + the chunk ids it was grounded in
    from app.services import watsonx  # noqa: F401

    raise NotImplementedError("Real chat not wired up. Implement in chat.chat().")
