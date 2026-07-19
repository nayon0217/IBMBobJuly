"""FastAPI entrypoint. Run: uvicorn app.main:app --reload

Endpoints map 1:1 to the services. Keep this file thin — routing, validation,
and error translation only. All logic lives in app/services/.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ExtractRequest,
    ExtractResponse,
    HealthResponse,
    PersonaRequest,
    PersonaResponse,
    SceneRequest,
    SceneResponse,
)
from app.services import chat as chat_service
from app.services import extraction as extraction_service
from app.services import scene as scene_service

app = FastAPI(title="Manuscript Characters API", version="0.1.0")

# Wide-open CORS for local dev so the Vite frontend can call in. Tighten before
# any public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(backend=settings.backend)


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    return extraction_service.extract(req)


@app.post("/personas", response_model=PersonaResponse)
def personas(req: PersonaRequest) -> PersonaResponse:
    """Ground (Stage 4) and return the requested persona cards. Called when the
    writer enters a chat or scene, after /extract returned un-grounded stubs."""
    try:
        return PersonaResponse(
            characters=extraction_service.ensure_personas(
                req.character_ids, req.knowledge_up_to_chunk
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        return chat_service.chat(req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/scene", response_model=SceneResponse)
def scene(req: SceneRequest) -> SceneResponse:
    try:
        return scene_service.run_scene(req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
