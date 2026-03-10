import json
import logging
import os

from openai import AsyncOpenAI

from app.models import Citation

logger = logging.getLogger(__name__)

_MAX_TEXT_LEN = 400

_SYSTEM_PROMPT = (
    "You are a citation relevance evaluator. Given a legal question, "
    "the response generated, and the retrieved law citations, return a "
    "JSON array of section identifiers for citations that are relevant "
    "to the response. Return ONLY valid JSON -- no prose, no markdown fences."
)


def _build_user_message(query: str, response: str, citations: list[Citation]) -> str:
    citation_lines = []
    for c in citations:
        text = c.text
        if len(text) > _MAX_TEXT_LEN:
            text = text[:_MAX_TEXT_LEN] + "..."
        citation_lines.append(f"- [{c.source}]: {text}")

    return f"Question: {query}\n\nResponse: {response}\n\nCitations:\n" + "\n".join(
        citation_lines
    )


async def filter_relevant_citations(
    query: str,
    response: str,
    citations: list[Citation],
) -> list[Citation]:
    if not citations:
        return []

    try:
        model = os.environ.get("CITATION_FILTER_MODEL", "o4-mini")
        client = AsyncOpenAI()

        result = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_message(query, response, citations),
                },
            ],
            max_completion_tokens=256,
        )

        raw = result.choices[0].message.content
        parsed = json.loads(raw)

        if not isinstance(parsed, list):
            raise ValueError(f"Expected JSON array, got {type(parsed).__name__}")

        valid_sources = {c.source for c in citations}
        relevant_set = {s for s in parsed if s in valid_sources}

        return [c for c in citations if c.source in relevant_set]

    except Exception:
        logger.warning("Citation filter failed, returning all citations")
        return list(citations)
