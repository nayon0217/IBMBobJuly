"""Canned data so the whole app runs with no AI backend.

Person B builds the frontend against these. Person A deletes reliance on them
service by service as the real watsonx calls come online. Keep the shapes here
identical to schemas.py — that's the whole point.
"""

from app.schemas import (
    ChatTurn,
    PersonaCard,
    PlotSuggestion,
)

SAMPLE_CHARACTERS: list[PersonaCard] = [
    PersonaCard(
        id="elizabeth-bennet",
        name="Elizabeth Bennet",
        traits=["witty", "independent", "quick to judge"],
        motivations=["marry for love, not security", "protect her sisters"],
        voice="Sharp, ironic, fond of a well-placed barb. Speaks in full, "
        "balanced sentences.",
        relationships={"fitzwilliam-darcy": "wary attraction, sparring partner"},
        key_scene_ids=["chunk-3", "chunk-11"],
    ),
    PersonaCard(
        id="fitzwilliam-darcy",
        name="Fitzwilliam Darcy",
        traits=["reserved", "proud", "loyal underneath"],
        motivations=["preserve family honour", "resist an unsuitable attachment"],
        voice="Formal, clipped, reveals feeling only under pressure.",
        relationships={"elizabeth-bennet": "reluctant admiration turning to love"},
        key_scene_ids=["chunk-3", "chunk-14"],
    ),
]


def mock_chat_reply(character_id: str) -> ChatTurn:
    name = {c.id: c.name for c in SAMPLE_CHARACTERS}.get(character_id, "Someone")
    return ChatTurn(
        speaker_id=character_id,
        text=f"[mock reply from {name}] I would answer you plainly, but the "
        f"real Granite-backed voice is not wired up yet.",
    )


def mock_scene(character_ids: list[str]) -> tuple[list[ChatTurn], PlotSuggestion]:
    a, b = character_ids[0], character_ids[1]
    dialogue = [
        ChatTurn(speaker_id=a, text=f"[mock] {a} opens the scene."),
        ChatTurn(speaker_id=b, text=f"[mock] {b} answers, tension rising."),
        ChatTurn(speaker_id=a, text=f"[mock] {a} presses the point."),
    ]
    suggestion = PlotSuggestion(
        summary="A latent conflict between the two surfaces under pressure.",
        what_happens_next=[
            "Force a choice that splits their loyalties.",
            "Reveal a secret one of them has been holding.",
            "Introduce a third party who benefits from their rift.",
        ],
    )
    return dialogue, suggestion
