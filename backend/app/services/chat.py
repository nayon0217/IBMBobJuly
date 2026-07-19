"""Single-character, in-voice, manuscript-grounded chat.

The character "agent" is a persona-grounded prompt: load the PersonaCard,
serialize it into a system prompt (identity + voice + timeline boundary +
retrieved passages), retrieve timeline-safe passages from the vector store,
then let the provider LLM generate a free-form in-voice reply.

Design notes tying back to the spec:
  - LLM/embedding calls go through the provider-agnostic module (providers.py),
    so persona-prompt building, retrieval, and generation stay swappable.
  - The timeline boundary is enforced TWICE: the retrieval filter
    (knowledge_up_to_chunk) AND an explicit prompt instruction, because for a
    public-domain novel the model has the plot memorized and filtering
    retrieval alone won't stop it leaking future events from parametric memory.
  - `grounded_in` is assembled in code from what we actually retrieved, never
    self-reported by the model (which can hallucinate chunk ids).
"""

import logging

from app.config import Backend, settings
from app.mock_data import mock_chat_reply
from app.schemas import ChatRequest, ChatResponse, ChatTurn
from app.services import providers, store
from app.services.extraction import get_character
from app.services.persona_prompt import build_system_prompt

logger = logging.getLogger(__name__)

_RETRIEVAL_TOP_K = 5
_MAX_REPLY_TOKENS = 800
# How many recent turns to fold into the retrieval query so dangling references
# ("Why did you refuse him?") embed against some context.
_HISTORY_TURNS_FOR_QUERY = 2


def chat(req: ChatRequest) -> ChatResponse:
    character = get_character(req.character_id)
    if character is None:
        raise ValueError(f"Unknown character: {req.character_id}")

    if settings.backend == Backend.MOCK:
        return ChatResponse(reply=mock_chat_reply(req.character_id), grounded_in=[])

    provider = providers.get_provider()

    # 1. Retrieve timeline-safe passages (filter + prompt both enforce the boundary).
    grounded_in, passages = _retrieve(req, provider)

    # 2. Build the persona system prompt from the card + retrieved passages.
    system = build_system_prompt(character, passages)

    # 3. Fold history + the new message into the user turn and generate.
    prompt = _build_user_prompt(character, req)
    reply_text = provider.generate(
        prompt, system=system, max_tokens=_MAX_REPLY_TOKENS
    ).strip()

    # 4. Assemble the envelope in code — grounded_in is what we retrieved.
    return ChatResponse(
        reply=ChatTurn(speaker_id=character.id, text=reply_text),
        grounded_in=grounded_in,
    )


def _retrieve(req: ChatRequest, provider) -> tuple[list[str], list[str]]:
    """Return (grounded_in ids, formatted passages). Best-effort: retrieval
    failures degrade to a persona-only reply rather than erroring the turn."""
    query = _retrieval_query(req)
    try:
        query_vec = provider.embed([query])[0]
        results = store.get_vector_store().search(
            query_vec,
            top_k=_RETRIEVAL_TOP_K,
            up_to_chunk=req.knowledge_up_to_chunk,
        )
    except Exception as exc:
        logger.warning("Chat retrieval failed for %s: %s", req.character_id, exc)
        return [], []

    grounded_in = [chunk_id for chunk_id, _ in results]
    passages = [f"[{chunk_id}] {text}" for chunk_id, text in results]
    return grounded_in, passages


def _retrieval_query(req: ChatRequest) -> str:
    """Fold the last turn or two into the query so unresolved references have
    some context to embed against (a cheap stand-in for full query rewriting)."""
    recent = [t.text for t in req.history[-_HISTORY_TURNS_FOR_QUERY:] if t.text]
    recent.append(req.message)
    return " ".join(recent).strip() or req.message


def _build_user_prompt(character, req: ChatRequest) -> str:
    id_to_name = {c.id: c.name for c in store.get_characters()}
    lines = []
    for turn in req.history:
        speaker = (
            "The writer"
            if turn.speaker_id == "writer"
            else id_to_name.get(turn.speaker_id, turn.speaker_id)
        )
        lines.append(f"{speaker}: {turn.text}")
    convo = "\n".join(lines)

    instruction = (
        f'Respond as {character.name}, in first person and fully in character.'
    )
    if convo:
        return (
            f"Conversation so far:\n{convo}\n\n"
            f'The writer now says: "{req.message}"\n\n{instruction}'
        )
    return f'The writer says: "{req.message}"\n\n{instruction}'
