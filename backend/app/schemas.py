"""
schemas.py — THE CONTRACT.

Every request and response shape lives here. Both people agree on this file
first; after that, Person A builds the real service internals and Person B
builds the frontend against these shapes. Change this file only by mutual
agreement, because it's the seam that keeps your two tracks independent.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Core domain objects -----------------------------------------------------


class PersonaCard(BaseModel):
    """A character extracted from a manuscript. This is the unit everything
    else is built around: chat grounds a single card, scenes combine several."""

    id: str = Field(..., description="Stable slug, e.g. 'elizabeth-bennet'")
    name: str
    traits: list[str] = Field(default_factory=list)
    motivations: list[str] = Field(default_factory=list)
    voice: str = Field("", description="How they speak: register, quirks, tics")
    physical: str = Field(
        "",
        description="Physical appearance grounded in the text: build, age, "
        "hair, distinctive features. Empty when the manuscript never describes it.",
    )
    gender: str = Field(
        "",
        description="'male', 'female', or 'nonbinary'; empty when the text "
        "never settles it. Rides the existing grounding call and a "
        "deterministic honorific/pronoun scan — never a separate API call — "
        "so cards from runs that predate the field can be backfilled.",
    )
    relationships: dict[str, str] = Field(
        default_factory=dict,
        description="Maps another character id -> nature of the relationship",
    )
    key_scene_ids: list[str] = Field(
        default_factory=list, description="Manuscript chunk ids where they appear"
    )
    first_appearance_chunk: Optional[int] = Field(
        None,
        description="Index of the first chunk this character appears in; used "
        "to default the timeline. None if never matched by name.",
    )
    grounded: bool = Field(
        True,
        description="Whether the persona has been grounded (Stage 4). /extract "
        "now returns un-grounded stubs (id + name + timeline anchors) for the "
        "whole cast; the voice/traits/physical/gender fields are filled in "
        "lazily by /personas when a chat or scene is entered. Full cards "
        "(mock samples, cached grounded cards) are True.",
    )


class Emotion(str, Enum):
    """The speaker's facial expression for a line, mirrored index-for-index by
    the DiceBear avataaars `mouth` enum so the frontend can render it directly.
    Values match that enum verbatim; DEFAULT is the neutral fallback."""

    CONCERNED = "concerned"  # tight, slightly downturned lip
    DEFAULT = "default"  # closed, straight, emotionless line
    EATING = "eating"  # tongue visibly extended
    GRIMACE = "grimace"  # lips pulled tight in discomfort or tension
    SAD = "sad"  # pronounced frown with drooping corners
    SCREAM_OPEN = "screamOpen"  # mouth wide open, shouting or screaming
    SERIOUS = "serious"  # straighter, firmer line than the default
    SMILE = "smile"  # standard, friendly closed-lip smile
    TONGUE = "tongue"  # playful, tongue poking out
    TWINKLE = "twinkle"  # expressive, wider grin


class ChatTurn(BaseModel):
    """One line of a conversation, from the writer or a character."""

    speaker_id: str = Field(..., description="'writer' or a character id")
    text: str
    emotion: Emotion = Field(
        Emotion.DEFAULT,
        description="The speaker's facial expression for this line. Populated "
        "for character replies from the same generation call (no extra API "
        "call); writer turns keep the neutral default.",
    )


# --- /extract ----------------------------------------------------------------


class TimelineEntry(BaseModel):
    """A very short summary of a span of manuscript chunks, produced during
    ingestion so the frontend can show *what happens* at each point on the
    timeline slider (and it backs the knowledge_up_to_chunk spoiler control)."""

    chunk_start: int = Field(..., description="First chunk index in this span")
    chunk_end: int = Field(..., description="Last chunk index in this span (inclusive)")
    summary: str = Field("", description="One-line recap of the span")


class ExtractRequest(BaseModel):
    manuscript_text: str = Field(..., description="Raw manuscript text")
    title: Optional[str] = None


class ExtractResponse(BaseModel):
    # Un-grounded character stubs (id + name + timeline anchors). Persona cards
    # are grounded later, on demand, by /personas — see PersonaCard.grounded.
    characters: list[PersonaCard]
    chunk_count: int = Field(..., description="How many chunks were embedded")
    timeline: list[TimelineEntry] = Field(
        default_factory=list,
        description="Per-span summaries of the manuscript, in chunk order.",
    )


# --- /personas (lazy Stage 4 grounding) --------------------------------------


class PersonaRequest(BaseModel):
    # The characters the writer is about to chat with / stage a scene with.
    character_ids: list[str] = Field(..., min_length=1)
    # Timeline boundary: ground each persona from ONLY what the character has
    # experienced up to this chunk, so their personality reflects that point in
    # the story (spoiler-safe). None = the whole manuscript.
    knowledge_up_to_chunk: Optional[int] = None


class PersonaResponse(BaseModel):
    # Fully grounded persona cards, aligned index-for-index with the request.
    characters: list[PersonaCard]


# --- /chat (single character) ------------------------------------------------


class ChatRequest(BaseModel):
    character_id: str
    message: str
    history: list[ChatTurn] = Field(default_factory=list)
    # A character only knows what they'd know by this point in the story.
    # Front-end lets the writer set it; backend uses it to filter retrieval.
    knowledge_up_to_chunk: Optional[int] = None


class ChatResponse(BaseModel):
    reply: ChatTurn
    # Chunk ids the answer was grounded in — useful for a "sources" UI later.
    grounded_in: list[str] = Field(default_factory=list)


# --- /scene (multi-agent, the differentiator) --------------------------------


class SceneRequest(BaseModel):
    # One character is a soliloquy; two+ is a conversation. Either is valid.
    character_ids: list[str] = Field(..., min_length=1)
    situation: str = Field(..., description="The setup the writer drops them into")
    twist: Optional[str] = Field(None, description="Optional mid-scene curveball")
    max_turns: int = Field(6, ge=1, le=20)
    # Same timeline boundary as /chat and /personas: the characters only know
    # events up to this chunk, applied to both grounding and scene retrieval.
    knowledge_up_to_chunk: Optional[int] = None


class PlotSuggestion(BaseModel):
    summary: str = Field(..., description="Third-person recap of what happened")
    character_feelings: list[str] = Field(
        default_factory=list,
        description="How each character feels after the scene, in voice; aligned "
        "index-for-index with SceneRequest.character_ids.",
    )


class SceneResponse(BaseModel):
    """The payoff object: the dialogue that unfolded plus the narrator's read."""

    dialogue: list[ChatTurn]
    suggestion: PlotSuggestion


# --- health ------------------------------------------------------------------


class Backend(str, Enum):
    MOCK = "mock"
    WATSONX = "watsonx"
    CLAUDE = "claude"


class HealthResponse(BaseModel):
    status: str = "ok"
    backend: Backend
