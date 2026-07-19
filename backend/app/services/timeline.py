"""Timeline summaries — a very short recap of each span of the manuscript.

Built once during ingestion (alongside embedding + roster discovery) so the
frontend timeline slider can show *what happens* at each point, and so the
knowledge_up_to_chunk spoiler control has human-readable anchors. Chunks are
summarized a couple at a time to keep the number of LLM calls down.

`generate` is injected (watsonx in production, fakes in tests) so this module
never imports a vendor client directly.
"""

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.schemas import TimelineEntry

logger = logging.getLogger(__name__)

Generate = Callable[..., str]
Progress = Callable[[str], None]

# How many chunks fold into a single timeline summary ("each chunk or two").
_CHUNKS_PER_SUMMARY = 2
# Cap the text handed to the model per summary so a big span can't blow tokens.
_SUMMARY_INPUT_BUDGET = 6_000
_MAX_SUMMARY_TOKENS = 120
# Summaries are independent network I/O, so run them concurrently.
_MAX_WORKERS = 8

SUMMARY_PROMPT = """Summarize this passage from a novel in ONE short sentence (max 25 words). \
Describe only what happens in it — no preamble, no quotation, no commentary.

PASSAGE:
{passage}"""


def build_timeline(
    chunks: list[str],
    *,
    generate: Generate,
    progress: Optional[Progress] = None,
    chunks_per_summary: int = _CHUNKS_PER_SUMMARY,
) -> list[TimelineEntry]:
    """Return one TimelineEntry per span of `chunks_per_summary` chunks, in
    manuscript order. Best-effort: a failed summary degrades to an empty string
    rather than breaking ingestion."""
    if progress:
        progress("Summarizing the timeline…")
    if not chunks:
        return []

    spans = [
        (start, min(start + chunks_per_summary - 1, len(chunks) - 1))
        for start in range(0, len(chunks), chunks_per_summary)
    ]

    def summarize(span: tuple[int, int]) -> TimelineEntry:
        start, end = span
        passage = "\n\n".join(chunks[start : end + 1])[:_SUMMARY_INPUT_BUDGET]
        try:
            summary = generate(
                SUMMARY_PROMPT.format(passage=passage),
                max_tokens=_MAX_SUMMARY_TOKENS,
            ).strip()
        except Exception as exc:  # a bad span must not kill the whole timeline
            logger.warning("Timeline summary failed for chunks %d–%d: %s", start, end, exc)
            summary = ""
        return TimelineEntry(chunk_start=start, chunk_end=end, summary=summary)

    workers = min(_MAX_WORKERS, len(spans))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(summarize, spans))
