"""Settings. Reads from environment; see .env.example at the repo root.

The important switch is BACKEND: 'mock' returns canned data so the frontend
can be built with zero AI dependencies, 'watsonx' calls the real models.
Person B can develop the whole UI with BACKEND=mock.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

from app.schemas import Backend

# Repo-root .env (backend/app/config.py -> repo root is two levels up from backend/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings:
    backend: Backend = Backend(os.getenv("BACKEND", "mock"))

    # watsonx.ai — only needed when backend == watsonx
    watsonx_api_key: str = os.getenv("WATSONX_API_KEY", "")
    watsonx_project_id: str = os.getenv("WATSONX_PROJECT_ID", "")
    watsonx_url: str = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    granite_model: str = os.getenv("GRANITE_MODEL", "ibm/granite-3-8b-instruct")

    # Anthropic Claude — only needed when backend == claude. Claude runs the
    # LLM stages (discovery / consolidation / grounding); it has no embeddings
    # API, so the claude backend embeds locally (see services/claude.py).
    claude_api_key: str = os.getenv("CLAUDE_API_KEY", "")
    claude_model: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")

    # Pinecone vector DB — the retrieval store when backend == watsonx
    pinecone_api_key: str = os.getenv("PINECONE_API_KEY", "")
    pinecone_index: str = os.getenv("PINECONE_INDEX", "manuscript-characters")
    pinecone_cloud: str = os.getenv("PINECONE_CLOUD", "aws")
    pinecone_region: str = os.getenv("PINECONE_REGION", "us-east-1")
    pinecone_namespace: str = os.getenv("PINECONE_NAMESPACE", "default")


settings = Settings()
