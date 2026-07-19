"""Thin wrapper around watsonx.ai / Granite.

Person A: this is the ONLY place that should know how to talk to IBM. Keep the
rest of the codebase calling `generate(...)` so swapping models or params never
leaks into the services. Install with: pip install ibm-watsonx-ai

The stub below raises until real credentials + client code are added, so it's
obvious when something accidentally hits the real path with BACKEND unset.
"""

from langchain_ibm import ChatWatsonx, WatsonxEmbeddings
from app.config import settings

llm = ChatWatsonx(
    model_id="mistralai/mistral-small-3-1-24b-instruct-2503",     # verify current model list
    url=settings.watsonx_url,
    api_key=settings.watsonx_api_key,
    project_id=settings.watsonx_project_id,
    params={"temperature": 0.2, "max_new_tokens": 2000},
)

embeddings = WatsonxEmbeddings(
    model_id="ibm/granite-embedding-278m-multilingual",
    url=settings.watsonx_url,
    api_key=settings.watsonx_api_key,
    project_id=settings.watsonx_project_id,
)

def check_connection():
    """Run me first. Prints embedding dimension — B needs this number."""
    vec = embeddings.embed_query("hello")
    print(f"Embedding dim: {len(vec)}")      # ← tell B this for index creation
    resp = llm.invoke("Say OK")
    print(f"LLM says: {resp.content}")

def generate(prompt: str, *, system: str = "", max_tokens: int = 512) -> str:
    """Send a prompt to the chat model and return the text response."""
    messages = []
    if system:
        messages.append(("system", system))
    messages.append(("human", prompt))
    return llm.invoke(messages).content

def embed(texts: list[str]) -> list[list[float]]:
    """Return one embedding vector per input text."""
    return embeddings.embed_documents(texts)


def _require_credentials() -> None:
    if not settings.watsonx_api_key or not settings.watsonx_project_id:
        raise RuntimeError(
            "WATSONX_API_KEY and WATSONX_PROJECT_ID must be set to use the "
            "watsonx backend. See .env.example."
        )

if __name__ == "__main__":
    check_connection()