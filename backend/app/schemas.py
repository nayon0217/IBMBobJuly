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


class ChatTurn(BaseModel):
    """One line of a conversation, from the writer or a character."""

    speaker_id: str = Field(..., description="'writer' or a character id")
    text: str


# --- /extract ----------------------------------------------------------------


class ExtractRequest(BaseModel):
    manuscript_text: str = Field(..., description="Raw manuscript text")
    title: Optional[str] = None


class ExtractResponse(BaseModel):
    characters: list[PersonaCard]
    chunk_count: int = Field(..., description="How many chunks were embedded")


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
    character_ids: list[str] = Field(..., min_length=2)
    situation: str = Field(..., description="The setup the writer drops them into")
    twist: Optional[str] = Field(None, description="Optional mid-scene curveball")
    max_turns: int = Field(6, ge=2, le=20)


class PlotSuggestion(BaseModel):
    summary: str = Field(..., description="What emerged, in one or two sentences")
    what_happens_next: list[str] = Field(
        default_factory=list, description="Concrete directions the writer could take"
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
