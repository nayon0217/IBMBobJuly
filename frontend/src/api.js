// api.js — mirrors backend/app/schemas.py. When the contract changes, change
// both. Person B owns this file; it's the frontend's single source of truth
// for talking to the backend.

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}

export const health = () => fetch(`${BASE}/health`).then((r) => r.json());

// ExtractRequest -> ExtractResponse
// Returns un-grounded character stubs (id + name + timeline anchors) plus the
// timeline summaries. Persona cards are grounded lazily via /personas.
export const extract = (manuscriptText, title) =>
  post("/extract", { manuscript_text: manuscriptText, title });

// PersonaRequest -> PersonaResponse
// Grounds (Stage 4) and returns full persona cards for the given ids. Called
// when entering a chat or scene; the backend caches results so re-entry is fast.
// knowledgeUpToChunk is the timeline boundary the writer picked — the personas
// reflect who the characters are up to that point only.
export const personas = (characterIds, knowledgeUpToChunk = null) =>
  post("/personas", {
    character_ids: characterIds,
    ...(knowledgeUpToChunk != null
      ? { knowledge_up_to_chunk: knowledgeUpToChunk }
      : {}),
  });

// ChatRequest -> ChatResponse
export const chat = (characterId, message, history = [], knowledgeUpToChunk = null) =>
  post("/chat", {
    character_id: characterId,
    message,
    history,
    ...(knowledgeUpToChunk != null ? { knowledge_up_to_chunk: knowledgeUpToChunk } : {}),
  });

// SceneRequest -> SceneResponse
// opts is optional: { twist, maxTurns, knowledgeUpToChunk }. The timeline the
// writer picks in setup rides along as knowledge_up_to_chunk so the backend can
// keep the scene spoiler-safe (mirrors /chat); extra fields are ignored until
// the backend adopts them.
export const runScene = (characterIds, situation, opts = {}) =>
  post("/scene", {
    character_ids: characterIds,
    situation,
    twist: opts.twist ?? null,
    ...(opts.maxTurns != null ? { max_turns: opts.maxTurns } : {}),
    ...(opts.knowledgeUpToChunk != null
      ? { knowledge_up_to_chunk: opts.knowledgeUpToChunk }
      : {}),
  });
