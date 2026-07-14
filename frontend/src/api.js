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
export const extract = (manuscriptText, title) =>
  post("/extract", { manuscript_text: manuscriptText, title });

// ChatRequest -> ChatResponse
export const chat = (characterId, message, history = []) =>
  post("/chat", { character_id: characterId, message, history });

// SceneRequest -> SceneResponse
export const runScene = (characterIds, situation, twist) =>
  post("/scene", { character_ids: characterIds, situation, twist });
