"""Staged character-extraction agent.

The hard problem here isn't finding names — it's *identity resolution*
("Elizabeth" / "Lizzy" / "Miss Bennet" are one person) — and keeping
*discovery* (breadth over the whole book) separate from *grounding* (depth on
one person). So this runs as four stages:

  Stage 1  Discovery      map over chunk batches -> messy candidate list
  Stage 2  Consolidation  reduce to a canonical roster + stable ids (alias merge)
  Stage 3  Appearance     deterministic string scan -> frequency, first/key chunks,
                          minor-character cutoff (importance + frequency, never hardcoded)
  Stage 4  Grounding      per character: retrieve real passages from the vector
                          store and write a persona card grounded in them

`generate` and `embed` are injected (watsonx in production, fakes in tests) so
this module never imports the IBM client directly. `progress` is an optional
callback emitting a human-readable line per stage (and per batch in Stage 1),
so the frontend has something real to show during a slow extraction.

Known limitation: an unnamed first-person narrator ("I") is not captured by
the deterministic scan and is unlikely to surface as a named candidate. Named
characters referred to only by pronoun/title in a passage are still caught by
the LLM discovery/consolidation passes.
"""

import logging
import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.schemas import PersonaCard
from app.services.gender import infer_gender, normalize_gender
from app.services.jsonutil import generate_json
from app.services.store import VectorStore

logger = logging.getLogger(__name__)

Generate = Callable[..., str]
Embed = Callable[[list[str]], list[list[float]]]
Progress = Callable[[str], None]

# Pack several chunks per discovery call up to this budget (~4 chars/token,
# so ~12k tokens of manuscript per call) rather than one call per chunk. Raised
# to keep the number of discovery calls low (a ~456k-char novel is ~10 batches
# instead of ~38); trade-off is the model has more text to attend to per call.
_DISCOVERY_BATCH_CHARS = 48_000
# Grounding retrieval / prompt sizing.
_KEY_CHUNKS_PER_CHARACTER = 4
_RETRIEVAL_TOP_K = 6
_GROUNDING_CHAR_BUDGET = 8_000
# Only ground the top-N most prominent characters (frequency-ranked). Grounding
# is one LLM call each, so this caps cost/latency; the rest still appear in the
# roster returned to the caller but without full persona cards.
_MAX_GROUNDED_CHARACTERS = 3
# Grounding calls are independent network I/O, so run them concurrently.
_GROUNDING_MAX_WORKERS = 8
# Minor-character cutoff (combined with the model's importance judgment).
_MINOR_MIN_MENTIONS = 2
_FALLBACK_ROSTER_SIZE = 8


DISCOVERY_PROMPT = """You are reading part of a novel. List every named character who appears in THIS excerpt.
For each, give the name exactly as written, any aliases/nicknames/titles used for them here, and a one-line descriptor.
Include characters referred to by title (e.g. "the Captain") if they are clearly a specific person.

Return ONLY valid JSON, no other text:
{{"characters": [{{"name": "Name", "aliases": ["nickname", "title"], "descriptor": "one line"}}]}}

EXCERPT:
{excerpt}"""

CONSOLIDATION_PROMPT = """Below is a messy list of character mentions collected from across a whole novel, with duplicates and alias variants from different parts of the book.

Collapse them into a canonical roster. Merge every alias that refers to the same person — for example "Elizabeth", "Lizzy", "Miss Bennet", and "Eliza" are ONE person. Use your judgment about which surface forms denote the same individual.

For each canonical character return:
- "canonical_name": the fullest/most formal name
- "aliases": ALL surface forms that refer to them (include the canonical name and every nickname/title)
- "rough_importance": one of "major", "minor", "background"

Return ONLY valid JSON, no other text:
{{"roster": [{{"canonical_name": "Name", "aliases": ["Name", "Nickname"], "rough_importance": "major"}}]}}

CANDIDATE MENTIONS:
{candidates}"""

PERSONA_PROMPT = """You are writing a character persona card grounded ONLY in the passages provided below. Do not use outside knowledge; do not invent facts. If the passages do not support a field, use "unknown" (for voice/physical) or an empty list (for traits/motivations).

CHARACTER: {name}
ALSO KNOWN AS: {aliases}

Other characters in this story — use THESE EXACT IDS as relationship keys, and only include a relationship if the passages support it:
{roster}

Return ONLY valid JSON, no other text:
{{"traits": ["adjective", ...], "motivations": ["what they want", ...], "voice": "how they speak: register, tics, sentence style", "physical": "appearance grounded in the text: build, age, hair, clothing, distinctive features", "gender": "male, female, or nonbinary — only as the text establishes it, else unknown", "relationships": {{"character-id": "nature of the relationship"}}}}

PASSAGES:
{passages}"""


# --- public entry point -------------------------------------------------------


def extract_characters(
    chunks: list[str],
    vector_store: VectorStore,
    *,
    generate: Generate,
    embed: Embed,
    progress: Optional[Progress] = None,
) -> list[PersonaCard]:
    emit = _progress_emitter(progress)

    candidates = _discover(chunks, generate, emit)
    roster = _consolidate(candidates, generate, emit)
    survivors = _appearance_scan(roster, chunks, emit)

    # Cap grounding to the most prominent characters (survivors are already
    # frequency-ranked, most-mentioned first).
    grounded = survivors[:_MAX_GROUNDED_CHARACTERS]
    if len(survivors) > len(grounded):
        emit(
            f"Grounding the top {len(grounded)} of {len(survivors)} characters "
            "(cap) to keep extraction fast."
        )

    cards = _build_cards(grounded, chunks, vector_store, generate, embed, emit)

    emit(f"Done — {len(cards)} character cards built.")
    return cards


# --- Stage 1: discovery -------------------------------------------------------


def _discover(chunks: list[str], generate: Generate, emit: Progress) -> list[dict]:
    batches = _batch_chunks(chunks, _DISCOVERY_BATCH_CHARS)
    candidates: list[dict] = []
    for i, batch in enumerate(batches, start=1):
        emit(f"Stage 1/4 · discovering characters — batch {i} of {len(batches)}…")
        try:
            data = generate_json(
                generate,
                DISCOVERY_PROMPT.format(excerpt=batch),
                max_tokens=1500,
            )
        except ValueError as exc:
            # One bad batch shouldn't kill extraction over a whole novel.
            logger.warning("Discovery batch %d returned unparseable JSON: %s", i, exc)
            continue
        for c in data.get("characters", []):
            name = (c.get("name") or "").strip()
            if name:
                candidates.append(
                    {
                        "name": name,
                        "aliases": [a for a in (c.get("aliases") or []) if a],
                        "descriptor": (c.get("descriptor") or "").strip(),
                    }
                )
    return candidates


# --- Stage 2: consolidation / alias merge -------------------------------------


def _consolidate(candidates: list[dict], generate: Generate, emit: Progress) -> list[dict]:
    emit("Stage 2/4 · merging aliases into a canonical roster…")
    if not candidates:
        return []

    payload = "\n".join(
        f"- {c['name']}"
        + (f" (aka {', '.join(c['aliases'])})" if c["aliases"] else "")
        + (f": {c['descriptor']}" if c["descriptor"] else "")
        for c in candidates
    )
    data = generate_json(
        generate,
        CONSOLIDATION_PROMPT.format(candidates=payload),
        max_tokens=3000,
    )

    roster: list[dict] = []
    used_ids: set[str] = set()
    for entry in data.get("roster", []):
        canonical = (entry.get("canonical_name") or "").strip()
        if not canonical:
            continue
        aliases = [a for a in (entry.get("aliases") or []) if a]
        if canonical not in aliases:
            aliases = [canonical, *aliases]
        roster.append(
            {
                "id": _unique_slug(canonical, used_ids),
                "canonical_name": canonical,
                "aliases": _dedupe_preserving_order(aliases),
                "rough_importance": (entry.get("rough_importance") or "minor").lower(),
            }
        )
    return roster


# --- Stage 3: deterministic appearance scan -----------------------------------


def _appearance_scan(roster: list[dict], chunks: list[str], emit: Progress) -> list[dict]:
    emit("Stage 3/4 · scanning appearances and filtering minor characters…")

    for entry in roster:
        pattern = _alias_pattern(entry["aliases"])
        per_chunk = [len(pattern.findall(chunk)) for chunk in chunks]
        entry["frequency"] = sum(per_chunk)
        entry["first_appearance_chunk"] = next(
            (i for i, n in enumerate(per_chunk) if n), None
        )
        ranked = sorted(
            (i for i, n in enumerate(per_chunk) if n),
            key=lambda i: (-per_chunk[i], i),
        )
        entry["key_chunk_ids"] = [f"chunk-{i}" for i in ranked[:_KEY_CHUNKS_PER_CHARACTER]]

    survivors = [e for e in roster if _keep(e)]

    # Never return an empty cast: fall back to the most-mentioned candidates.
    if not survivors and roster:
        survivors = roster[:_FALLBACK_ROSTER_SIZE]

    # Prominence order (most-mentioned first) so downstream "top N" is meaningful.
    survivors.sort(key=lambda e: -e["frequency"])

    emit(
        f"Stage 3/4 · kept {len(survivors)} of {len(roster)} candidates "
        "by importance + frequency."
    )
    return survivors


def _keep(entry: dict) -> bool:
    """Combine the model's importance judgment with the deterministic frequency
    signal: majors always survive, borderline minors need real recurrence, and
    model-judged background names are dropped (they inflate on generic nouns
    like "owl", so frequency must not rescue them)."""
    importance = entry["rough_importance"]
    if importance == "major":
        return True
    if importance == "minor":
        return entry["frequency"] >= _MINOR_MIN_MENTIONS
    return False  # background


# --- Stage 4: grounded persona cards ------------------------------------------


def _build_cards(
    roster: list[dict],
    chunks: list[str],
    vector_store: VectorStore,
    generate: Generate,
    embed: Embed,
    emit: Progress,
) -> list[PersonaCard]:
    alias_to_id = _alias_to_id_map(roster)
    id_to_name = {e["id"]: e["canonical_name"] for e in roster}
    roster_lines = "\n".join(f"- {e['id']}: {e['canonical_name']}" for e in roster)
    total = len(roster)

    def build_one(indexed: tuple[int, dict]) -> PersonaCard:
        i, entry = indexed
        name = entry["canonical_name"]
        emit(f"Stage 4/4 · grounding persona {i} of {total}: {name}…")

        passages = _grounding_passages(entry, chunks, vector_store, embed)
        try:
            data = generate_json(
                generate,
                PERSONA_PROMPT.format(
                    name=name,
                    aliases=", ".join(entry["aliases"]),
                    roster=roster_lines,
                    passages=passages,
                ),
                max_tokens=1500,
            )
        except ValueError as exc:
            logger.warning("Persona generation failed for %s: %s", name, exc)
            data = {}

        # Gender rides the same grounding call; if the model didn't settle it,
        # fall back to the deterministic honorific/pronoun scan (no extra call).
        gender = normalize_gender(data.get("gender")) or infer_gender(
            entry["aliases"], chunks
        )

        return PersonaCard(
            id=entry["id"],
            name=name,
            traits=data.get("traits") or [],
            motivations=data.get("motivations") or [],
            voice=data.get("voice") or "",
            physical=_clean_physical(data.get("physical")),
            gender=gender,
            relationships=_normalize_relationships(
                data.get("relationships"), alias_to_id, id_to_name, entry["id"]
            ),
            key_scene_ids=entry["key_chunk_ids"],
            first_appearance_chunk=entry["first_appearance_chunk"],
        )

    if not roster:
        return []

    # Grounding calls are independent, so fan them out; keep the returned cards
    # in the input (frequency) order regardless of completion order.
    workers = min(_GROUNDING_MAX_WORKERS, total)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(build_one, enumerate(roster, start=1)))


def _grounding_passages(
    entry: dict,
    chunks: list[str],
    vector_store: VectorStore,
    embed: Embed,
) -> str:
    """Gather real passages for this character: the deterministic key chunks
    (exact) unioned with a semantic vector query against the store (recall).
    This is the "retrieve on the vector database" step."""
    collected: dict[str, str] = {}

    # Exact: the chunks that mention this character most (Stage 3).
    for chunk_id in entry["key_chunk_ids"]:
        idx = _chunk_index(chunk_id)
        if idx is not None and 0 <= idx < len(chunks):
            collected[chunk_id] = chunks[idx]

    # Semantic: query the vector store for the character's name + descriptor.
    query = " ".join([entry["canonical_name"], *entry["aliases"]])
    try:
        query_vec = embed([query])[0]
        for chunk_id, text in vector_store.search(query_vec, top_k=_RETRIEVAL_TOP_K):
            collected.setdefault(chunk_id, text)
    except Exception as exc:  # retrieval is best-effort; key chunks still ground
        logger.warning("Vector retrieval failed for %s: %s", entry["canonical_name"], exc)

    # Order by chunk index and cap the total size sent to the model.
    ordered = sorted(collected.items(), key=lambda kv: _chunk_index(kv[0]) or 0)
    out, size = [], 0
    for chunk_id, text in ordered:
        out.append(f"[{chunk_id}] {text}")
        size += len(text)
        if size >= _GROUNDING_CHAR_BUDGET:
            break
    return "\n\n".join(out) or "(no passages found)"


# --- helpers ------------------------------------------------------------------


def _batch_chunks(chunks: list[str], max_chars: int) -> list[str]:
    batches: list[str] = []
    current: list[str] = []
    size = 0
    for chunk in chunks:
        if current and size + len(chunk) > max_chars:
            batches.append("\n\n".join(current))
            current, size = [], 0
        current.append(chunk)
        size += len(chunk)
    if current:
        batches.append("\n\n".join(current))
    return batches


def _alias_pattern(aliases: list[str]) -> re.Pattern:
    parts = sorted({re.escape(a) for a in aliases if a}, key=len, reverse=True)
    if not parts:
        parts = ["\0"]  # match nothing
    return re.compile(r"\b(?:" + "|".join(parts) + r")\b", re.IGNORECASE)


def _alias_to_id_map(roster: list[dict]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for entry in roster:
        for alias in [entry["canonical_name"], *entry["aliases"]]:
            mapping[alias.lower()] = entry["id"]
    return mapping


def _normalize_relationships(
    raw: Optional[dict],
    alias_to_id: dict[str, str],
    id_to_name: dict[str, str],
    self_id: str,
) -> dict[str, str]:
    """Resolve relationship keys to valid character ids. The model is asked to
    key by id, but we defensively remap names/aliases and drop danglers so the
    relationship graph never points at characters that don't exist."""
    out: dict[str, str] = {}
    for key, nature in (raw or {}).items():
        if not key or not nature:
            continue
        if key in id_to_name:
            other_id = key
        else:
            other_id = alias_to_id.get(key.lower())
        if other_id and other_id != self_id:
            out[other_id] = nature
    return out


def _unique_slug(name: str, used: set[str]) -> str:
    base = _slugify(name)
    slug = base
    n = 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "unknown"


def _clean_physical(value: Optional[str]) -> str:
    """Normalize the model's physical description: treat 'unknown'/blank as
    empty so the frontend can simply hide the field when nothing was described."""
    text = (value or "").strip()
    return "" if text.lower() in {"", "unknown", "n/a", "none"} else text


def _dedupe_preserving_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        low = item.lower()
        if low not in seen:
            seen.add(low)
            out.append(item)
    return out


def _chunk_index(chunk_id: str) -> Optional[int]:
    try:
        return int(chunk_id.removeprefix("chunk-"))
    except ValueError:
        return None


def _progress_emitter(progress: Optional[Progress]) -> Progress:
    def emit(message: str) -> None:
        logger.info(message)
        if progress is not None:
            try:
                progress(message)
            except Exception:  # progress reporting must never break extraction
                logger.debug("progress callback raised", exc_info=True)

    return emit
