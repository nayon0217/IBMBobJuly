"""Deterministic gender inference — zero LLM/API calls.

Gender is settled from signals the pipeline already collects: honorifics
attached to the character's names ("Mr Dursley", "Miss Bennet") and gendered
pronouns in the text right after their mentions in manuscript chunks.

Two uses:
  - New runs: fallback when the persona grounding call returns "unknown"
    (the model is asked for gender inside the SAME call — never a new one).
  - Previous runs: cards saved before the field existed carry key_scene_ids,
    so store.py backfills them by scanning those already-stored chunks.
"""

import re

_MALE_HONORIFICS = {
    "mr", "mister", "sir", "lord", "master", "king", "prince", "duke",
    "count", "baron", "father", "brother", "uncle", "monsieur", "herr",
}
_FEMALE_HONORIFICS = {
    "mrs", "ms", "miss", "lady", "madam", "madame", "queen", "princess",
    "duchess", "countess", "baroness", "mother", "sister", "aunt",
    "mademoiselle", "dame",
}

_MALE_PRONOUNS = re.compile(r"\b(?:he|him|his|himself)\b", re.IGNORECASE)
_FEMALE_PRONOUNS = re.compile(r"\b(?:she|her|hers|herself)\b", re.IGNORECASE)

# Pronouns are only counted this close after a mention, so a crowded scene
# doesn't attribute other characters' pronouns to this one.
_WINDOW_CHARS = 150
# The winning pronoun count must clear both an absolute floor and a dominance
# ratio over the other side, otherwise we return "" (unsettled).
_MIN_SIGNAL = 2
_DOMINANCE = 2

_VALID = {"male", "female", "nonbinary"}
_ALIASES_TO_VALID = {
    "m": "male", "man": "male", "boy": "male",
    "f": "female", "woman": "female", "girl": "female",
    "non-binary": "nonbinary", "nb": "nonbinary",
}


def normalize_gender(value: str | None) -> str:
    """Map a model-emitted gender onto the schema vocabulary; anything the
    text didn't settle ('unknown', prose, blank) becomes empty."""
    text = (value or "").strip().lower()
    if text in _VALID:
        return text
    return _ALIASES_TO_VALID.get(text, "")


def infer_gender(aliases: list[str], texts: list[str]) -> str:
    """Deterministic inference from names + passages. Honorifics are decisive
    when present; otherwise gendered pronouns near mentions are tallied."""
    from_honorific = _from_honorifics(aliases)
    if from_honorific:
        return from_honorific
    return _from_pronouns(aliases, texts)


def _from_honorifics(aliases: list[str]) -> str:
    for alias in aliases:
        first = alias.split()[0].rstrip(".").lower() if alias.split() else ""
        if first in _MALE_HONORIFICS:
            return "male"
        if first in _FEMALE_HONORIFICS:
            return "female"
    return ""


def _from_pronouns(aliases: list[str], texts: list[str]) -> str:
    pattern = _alias_pattern(aliases)
    male = female = 0
    for text in texts:
        for match in pattern.finditer(text):
            window = text[match.end() : match.end() + _WINDOW_CHARS]
            male += len(_MALE_PRONOUNS.findall(window))
            female += len(_FEMALE_PRONOUNS.findall(window))
    if male >= _MIN_SIGNAL and male >= female * _DOMINANCE:
        return "male"
    if female >= _MIN_SIGNAL and female >= male * _DOMINANCE:
        return "female"
    return ""


def _alias_pattern(aliases: list[str]) -> re.Pattern:
    parts = sorted({re.escape(a) for a in aliases if a}, key=len, reverse=True)
    if not parts:
        parts = ["\0"]  # match nothing
    return re.compile(r"\b(?:" + "|".join(parts) + r")\b", re.IGNORECASE)
