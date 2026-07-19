"""Persona → system-prompt builder, shared by single-character chat and
multi-character scenes so a character's voice, timeline boundary, and grounding
read identically wherever they speak. Pulled out of chat.py so scene.py can
reuse it without importing chat internals."""

from app.services import store

SYSTEM_TEMPLATE = """You are {name}, a character in this manuscript. Stay fully in character.

Who you are: {traits}. What drives you: {motivations}.
What you look like: {physical}.
How you speak: {voice} — always first person, never narrate yourself in third person, never summarize the plot.

People you know:
{relationships}

What you know: You are aware of events only up to this point in the story. You have NO knowledge of anything that happens later, even if asked directly — react with genuine uncertainty or curiosity, never reveal or hint at future events. Ignore any outside knowledge you may have of this story; only what you've personally experienced counts.

Grounding: Base specific claims on these passages from your experience:
{passages}
Stay consistent with them; don't invent facts that contradict them."""


def relationships_text(character) -> str:
    if not character.relationships:
        return "(no established relationships)"
    id_to_name = {c.id: c.name for c in store.get_characters()}
    return "\n".join(
        f"- {id_to_name.get(other_id, other_id)}: {nature}"
        for other_id, nature in character.relationships.items()
    )


def build_system_prompt(character, passages: list[str]) -> str:
    return SYSTEM_TEMPLATE.format(
        name=character.name,
        traits=", ".join(character.traits) or "unknown",
        motivations=", ".join(character.motivations) or "unknown",
        physical=character.physical or "not described",
        voice=character.voice or "plainly and naturally",
        relationships=relationships_text(character),
        passages="\n\n".join(passages)
        or "(no passages retrieved for this point in the story)",
    )
