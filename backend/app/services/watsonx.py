"""Thin wrapper around watsonx.ai — the ONLY file that talks to IBM.

Keep the rest of the codebase calling `generate(...)` / `embed(...)` so
swapping models or params never leaks into the services.

The LangChain clients are created lazily on first use (not at import time) so
that BACKEND=mock keeps working with no credentials installed — main.py
imports the service chain at startup, and building the clients eagerly would
make even the mock server and the smoke tests require IBM credentials.
"""

from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def _llm():
    _require_credentials()
    from langchain_ibm import ChatWatsonx

    return ChatWatsonx(
        model_id="mistralai/mistral-small-3-1-24b-instruct-2503",  # verify current model list
        url=settings.watsonx_url,
        api_key=settings.watsonx_api_key,
        project_id=settings.watsonx_project_id,
        params={"temperature": 0.2},
    )


@lru_cache(maxsize=1)
def _embeddings():
    _require_credentials()
    from langchain_ibm import WatsonxEmbeddings

    return WatsonxEmbeddings(
        model_id="ibm/granite-embedding-278m-multilingual",
        url=settings.watsonx_url,
        api_key=settings.watsonx_api_key,
        project_id=settings.watsonx_project_id,
    )


def check_connection():
    """Run me first. Prints embedding dimension — B needs this number."""
    vec = _embeddings().embed_query("hello")
    print(f"Embedding dim: {len(vec)}")  # ← tell B this for index creation
    resp = _llm().invoke("Say OK")
    print(f"LLM says: {resp.content}")


def generate(prompt: str, *, system: str = "", max_tokens: int = 512) -> str:
    """Send a prompt to the chat model and return the text response."""
    messages = []
    if system:
        messages.append(("system", system))
    messages.append(("human", prompt))
    return _llm().invoke(messages, max_tokens=max_tokens).content


def embed(texts: list[str]) -> list[list[float]]:
    """Return one embedding vector per input text."""
    return _embeddings().embed_documents(texts)


def _require_credentials() -> None:
    if not settings.watsonx_api_key or not settings.watsonx_project_id:
        raise RuntimeError(
            "WATSONX_API_KEY and WATSONX_PROJECT_ID must be set to use the "
            "watsonx backend. See .env.example."
        )


if __name__ == "__main__":
    check_connection()
