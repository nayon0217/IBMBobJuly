"""Gender inference tests: deterministic (no API calls) and backfill of cards
from runs that predate the field."""

from app.schemas import PersonaCard
from app.services import store
from app.services.gender import infer_gender, normalize_gender
from app.services.store import InMemoryVectorStore


def test_normalize_gender_vocabulary():
    assert normalize_gender("Female") == "female"
    assert normalize_gender("M") == "male"
    assert normalize_gender("non-binary") == "nonbinary"
    assert normalize_gender("unknown") == ""
    assert normalize_gender(None) == ""
    assert normalize_gender("a tall person") == ""


def test_infer_from_honorific_beats_pronouns():
    # Honorific is decisive even with no passages at all.
    assert infer_gender(["Mrs Dursley", "Petunia"], []) == "female"
    assert infer_gender(["Mr Dursley"], []) == "male"


def test_infer_from_pronouns_near_mentions():
    texts = [
        "Petunia looked up. She frowned, and her hands tightened on the rail.",
        "Petunia said nothing. She turned away.",
    ]
    assert infer_gender(["Petunia"], texts) == "female"


def test_infer_stays_empty_when_unsettled():
    assert infer_gender(["Alex"], ["Alex arrived. The room went quiet."]) == ""


def test_backfill_previous_run_cards(monkeypatch):
    """A card saved by a previous run (no gender) gains one on save, inferred
    from the chunks its key_scene_ids already point at — zero API calls."""
    vs = InMemoryVectorStore()
    vs.save_manuscript(
        [
            "Harry woke early. He dressed quietly and crept downstairs, "
            "hoping his uncle would not hear him.",
        ],
        [[1.0]],
    )
    monkeypatch.setattr(store, "get_vector_store", lambda: vs)

    old_card = PersonaCard(id="harry", name="Harry", key_scene_ids=["chunk-0"])
    assert old_card.gender == ""  # schema default keeps old payloads valid

    store.save_characters([old_card])
    try:
        assert store.get_character("harry").gender == "male"
    finally:
        store.clear_characters()
