"""Multi-agent scene: two+ characters interact, a narrator reads the result.

Phase 3 work (Person A) — this is the win condition. Give it the most time.
"""

from app.config import Backend, settings
from app.mock_data import mock_scene
from app.schemas import SceneRequest, SceneResponse
from app.services.extraction import get_character


def run_scene(req: SceneRequest) -> SceneResponse:
    characters = [get_character(cid) for cid in req.character_ids]
    missing = [cid for cid, c in zip(req.character_ids, characters) if c is None]
    if missing:
        raise ValueError(f"Unknown character(s): {', '.join(missing)}")

    if settings.backend == Backend.MOCK:
        dialogue, suggestion = mock_scene(req.character_ids)
        return SceneResponse(dialogue=dialogue, suggestion=suggestion)

    # --- watsonx path (Person A) ---------------------------------------------
    # Loop for up to req.max_turns:
    #   - each character agent responds in turn, grounded in its PersonaCard and
    #     the running dialogue; inject req.twist partway through if present
    # Then a "narrator/director" agent reads the full exchange and produces a
    # PlotSuggestion (summary + concrete what_happens_next options).
    # This narrator output is the moment that wins the demo — make it land.
    from app.services import watsonx  # noqa: F401

    raise NotImplementedError(
        "Real scene orchestration not wired up. Implement in scene.run_scene()."
    )
