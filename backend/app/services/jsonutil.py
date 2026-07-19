"""JSON parsing helpers for LLM output.

Extraction over a whole novel makes many structured-output calls; one bad
JSON blob shouldn't kill the run. `parse_json` tolerates markdown fences and
surrounding prose; `generate_json` retries on parse failure.
"""

import json
import re


def parse_json(raw: str) -> dict:
    """Parse model output as JSON, tolerating markdown code fences and any
    prose the model wraps around the object."""
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def generate_json(generate, prompt: str, *, max_tokens: int, retries: int = 2) -> dict:
    """Call `generate(prompt, max_tokens=...)` and parse the result as JSON,
    retrying on parse failure. Raises ValueError if all attempts fail."""
    last_error: Exception | None = None
    for _ in range(retries + 1):
        raw = generate(prompt, max_tokens=max_tokens)
        try:
            return parse_json(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
    raise ValueError(
        f"Model did not return valid JSON after {retries + 1} attempts: {last_error}"
    )
