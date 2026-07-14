"""Settings. Reads from environment; see .env.example at the repo root.

The important switch is BACKEND: 'mock' returns canned data so the frontend
can be built with zero AI dependencies, 'watsonx' calls the real models.
Person B can develop the whole UI with BACKEND=mock.
"""

import os

from app.schemas import Backend


class Settings:
    backend: Backend = Backend(os.getenv("BACKEND", "mock"))

    # watsonx.ai — only needed when backend == watsonx
    watsonx_api_key: str = os.getenv("WATSONX_API_KEY", "")
    watsonx_project_id: str = os.getenv("WATSONX_PROJECT_ID", "")
    watsonx_url: str = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    granite_model: str = os.getenv("GRANITE_MODEL", "ibm/granite-3-8b-instruct")


settings = Settings()
