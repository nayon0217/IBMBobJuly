"""Thin wrapper around watsonx.ai / Granite.

Person A: this is the ONLY place that should know how to talk to IBM. Keep the
rest of the codebase calling `generate(...)` so swapping models or params never
leaks into the services. Install with: pip install ibm-watsonx-ai

The stub below raises until real credentials + client code are added, so it's
obvious when something accidentally hits the real path with BACKEND unset.
"""

from app.config import settings


def generate(prompt: str, *, system: str = "", max_tokens: int = 512) -> str:
    """Send a prompt to Granite and return the text completion.

    TODO (Person A): implement using ibm-watsonx-ai, e.g.

        from ibm_watsonx_ai.foundation_models import ModelInference
        model = ModelInference(
            model_id=settings.granite_model,
            credentials={"apikey": settings.watsonx_api_key,
                         "url": settings.watsonx_url},
            project_id=settings.watsonx_project_id,
        )
        return model.generate_text(prompt=f"{system}\n\n{prompt}",
                                   params={"max_new_tokens": max_tokens})
    """
    raise NotImplementedError(
        "watsonx.generate() is not implemented yet. Run with BACKEND=mock, or "
        "fill this in once credentials are set."
    )


def embed(texts: list[str]) -> list[list[float]]:
    """Return embeddings for a list of texts (for RAG retrieval).

    TODO (Person A): implement with a watsonx embeddings model and store the
    vectors in your chosen vector DB (Milvus/Chroma). Called by extraction.
    """
    raise NotImplementedError("watsonx.embed() is not implemented yet.")


def _require_credentials() -> None:
    if not settings.watsonx_api_key or not settings.watsonx_project_id:
        raise RuntimeError(
            "WATSONX_API_KEY and WATSONX_PROJECT_ID must be set to use the "
            "watsonx backend. See .env.example."
        )
