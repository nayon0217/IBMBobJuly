"""Multi-agent scene: one+ characters interact, a narrator reads the result.

Flow (real backends):
  1. Validate + load the persona cards named in the request.
  2. Ground each character ONCE against the situation (private grounding).
  3. Run a round-robin turn loop up to max_turns, where each character produces
     only its own next line. A name-callout heuristic overrides the rotation:
     if a speaker names another character, that character replies next.
  4. Fire the closing passes concurrently — one in-voice reflection per
     character ("how do you feel now?") plus one third-person narrator summary.
  5. Assemble {dialogue, suggestion:{summary, character_feelings}}.

Backend split is inherited from the shared seams: providers.get_provider()
picks claude/watsonx, and store.get_vector_store() is Pinecone only for
watsonx and the in-memory cosine store otherwise (mock, tests, claude).
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor

from app.config import Backend, settings
from app.mock_data import mock_scene
from app.schemas import ChatTurn, PlotSuggestion, SceneRequest, SceneResponse
from app.services import providers, store
from app.services.chat import _EMOTION_INSTRUCTION, _split_emotion
from app.services.extraction import ensure_personas
from app.services.persona_prompt import build_system_prompt

logger = logging.getLogger(__name__)

_RETRIEVAL_TOP_K = 5
_MAX_LINE_TOKENS = 300
_MAX_REFLECT_TOKENS = 200
_MAX_SUMMARY_TOKENS = 300

_NARRATOR_SYSTEM = (
    "You are a perceptive literary narrator. You read a scene of dialogue and "
    "summarize it in the third person, present tense — concise and vivid. Never "
    "write in first person, never invent events beyond what the dialogue shows."
)


def run_scene(req: SceneRequest) -> SceneResponse:
    if settings.backend == Backend.MOCK:
        dialogue, suggestion = mock_scene(req.character_ids)
        return SceneResponse(dialogue=dialogue, suggestion=suggestion)

    # 1. Validate + load, grounding each persona on first use (Stage 4) at the
    #    requested timeline boundary. Fail fast on a bad id so it never surfaces
    #    mid-loop.
    characters = ensure_personas(req.character_ids, req.knowledge_up_to_chunk)

    provider = providers.get_provider()
    id_to_name = {c.id: c.name for c in characters}
    by_id = {c.id: c for c in characters}

    # 2. Ground each character once, privately, seeded on the situation. The
    #    same timeline boundary keeps their scene knowledge spoiler-safe.
    grounding = {
        c.id: _ground(provider, req.situation, c, req.knowledge_up_to_chunk)
        for c in characters
    }

    # 3. Transcript. The situation is scene context, not a spoken line.
    dialogue: list[ChatTurn] = []

    # 4. Turn loop: round-robin, overridden when a speaker calls a name.
    speaker = characters[0]
    for _ in range(req.max_turns):
        system = build_system_prompt(speaker, grounding[speaker.id])
        prompt = _build_scene_prompt(speaker, req.situation, dialogue, id_to_name)
        raw = provider.generate(
            prompt, system=system, max_tokens=_MAX_LINE_TOKENS
        ).strip()
        # The generation self-reports the speaker's expression on a tagged first
        # line (same trick as the one-on-one chat), so the scene avatars can
        # emote per line with no extra API round-trip.
        emotion, line = _split_emotion(raw)
        line = _own_line_only(line, speaker, id_to_name)
        dialogue.append(ChatTurn(speaker_id=speaker.id, text=line, emotion=emotion))

        # Heuristic: if this line names another character, they reply next;
        # otherwise fall back to the round-robin successor.
        called = _find_called_character(line, speaker, characters)
        if called is not None:
            speaker = called
        else:
            idx = req.character_ids.index(speaker.id)
            speaker = by_id[req.character_ids[(idx + 1) % len(req.character_ids)]]

    # 5. Closing passes — N reflections + 1 narrator, all independent → run
    #    them concurrently (the one spot where latency can be clawed back).
    script = _script(dialogue, id_to_name)
    with ThreadPoolExecutor(max_workers=len(characters) + 1) as pool:
        summary_future = pool.submit(_narrate, provider, script, id_to_name)
        feeling_futures = [
            pool.submit(_reflect, provider, c, grounding[c.id], script)
            for c in characters
        ]
        summary = summary_future.result()
        # Aligned index-for-index with req.character_ids (== characters order).
        character_feelings = [f.result() for f in feeling_futures]

    # 6. Assemble + return.
    return SceneResponse(
        dialogue=dialogue,
        suggestion=PlotSuggestion(summary=summary, character_feelings=character_feelings),
    )


# --- grounding ---------------------------------------------------------------


def _ground(provider, situation: str, character, up_to_chunk=None) -> list[str]:
    """One retrieval per character, seeded on the situation + who they are so
    each character's grounding is genuinely their own. `up_to_chunk` keeps it
    spoiler-safe. Best-effort: retrieval failures degrade to a persona-only
    prompt rather than erroring the scene."""
    query = f"{situation}\n{character.name}: {', '.join(character.traits)}"
    try:
        query_vec = provider.embed([query])[0]
        results = store.get_vector_store().search(
            query_vec, top_k=_RETRIEVAL_TOP_K, up_to_chunk=up_to_chunk
        )
    except Exception as exc:
        logger.warning("Scene grounding failed for %s: %s", character.id, exc)
        return []
    return [f"[{chunk_id}] {text}" for chunk_id, text in results]


# --- prompts -----------------------------------------------------------------


def _build_scene_prompt(speaker, situation: str, dialogue, id_to_name) -> str:
    header = f"The scene: {situation}\n\n"
    if dialogue:
        header += f"The scene so far:\n{_script(dialogue, id_to_name)}\n\n"
    return header + (
        f"Continue the scene as {speaker.name}. Write ONLY your single next line of "
        f"dialogue, in the first person and fully in character. Do not narrate, and "
        f"do not write lines for anyone else. If it feels natural, address another "
        f"character by name.\n\n"
        f"{_EMOTION_INSTRUCTION}"
    )


def _reflect(provider, character, passages, script: str) -> str:
    system = build_system_prompt(character, passages)
    prompt = (
        f"This scene just happened:\n{script}\n\n"
        f"In one or two sentences, in your own voice and the first person, how do "
        f"you feel now that it's over?"
    )
    return provider.generate(
        prompt, system=system, max_tokens=_MAX_REFLECT_TOKENS
    ).strip()


def _narrate(provider, script: str, id_to_name) -> str:
    names = ", ".join(id_to_name.values())
    prompt = (
        f"The scene, between {names}:\n{script}\n\n"
        f"Write a two-to-three sentence, third-person summary of what happened."
    )
    return provider.generate(
        prompt, system=_NARRATOR_SYSTEM, max_tokens=_MAX_SUMMARY_TOKENS
    ).strip()


def _script(dialogue, id_to_name) -> str:
    """The transcript as a labeled script ("Elizabeth: … / Darcy: …") — fed as
    plain text, never mapped onto alternating chat roles (which breaks past two
    speakers)."""
    return "\n".join(
        f"{id_to_name.get(t.speaker_id, t.speaker_id)}: {t.text}" for t in dialogue
    )


# --- heuristics --------------------------------------------------------------


def _name_tokens(name: str) -> list[str]:
    """Full name plus each significant word, so both "Elizabeth" and "Bennet"
    (or "Darcy") trigger a callout."""
    tokens = [name] + [w for w in re.split(r"\s+", name) if len(w) >= 3]
    seen, out = set(), []
    for tok in tokens:
        low = tok.lower()
        if low not in seen:
            seen.add(low)
            out.append(tok)
    return out


def _find_called_character(line: str, speaker, characters):
    """If the line names another character, return the first-named one so they
    speak next; otherwise None (keep the round-robin)."""
    lower = line.lower()
    best, best_pos = None, len(line) + 1
    for c in characters:
        if c.id == speaker.id:
            continue
        for token in _name_tokens(c.name):
            m = re.search(rf"\b{re.escape(token.lower())}\b", lower)
            if m and m.start() < best_pos:
                best, best_pos = c, m.start()
    return best


def _own_line_only(text: str, speaker, id_to_name) -> str:
    """Defensive trim: strip a leading "Speaker:" label the model may add, and
    cut the moment it starts writing another character's labeled line."""
    names = {n.lower() for n in id_to_name.values()}
    speaker_name = speaker.name.lower()
    out = []
    for i, raw in enumerate(text.split("\n")):
        stripped = raw.strip()
        m = re.match(r"^([^:]{1,40}):\s*(.*)$", stripped)
        if m:
            label = m.group(1).strip().lower()
            if label in names and label != speaker_name and i > 0:
                break  # another character has started speaking — stop here
            if label == speaker_name:
                stripped = m.group(2)
        out.append(stripped)
    return "\n".join(out).strip() or text.strip()
