"""Pick the LLM provider for the active backend.

Both provider modules expose the same surface — `generate(prompt, *, system,
max_tokens)` and `embed(texts)` — so business logic (extraction, chat, scene)
depends on this seam instead of a specific vendor. Modules are imported lazily
so BACKEND=mock never pulls in watsonx/anthropic clients.
"""

from types import ModuleType

from app.config import Backend, settings


def get_provider() -> ModuleType:
    """Return the module providing `generate` / `embed` for the active backend."""
    if settings.backend == Backend.CLAUDE:
        from app.services import claude

        return claude

    from app.services import watsonx

    return watsonx
