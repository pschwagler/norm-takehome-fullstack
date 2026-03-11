import re

from app.models import Citation

_REF_RE = re.compile(r"\[(\d+)\]")
_SOURCE_PREFIX_RE = re.compile(r"^Source \d+:\s*")


def filter_by_response_refs(
    response: str,
    source_nodes: list,
) -> tuple[str, list[Citation]]:
    """Keep only citations referenced as [N] in the response and renumber
    markers to be contiguous starting at [1].

    The main LLM decides which sources to cite via [N] markers in its
    response. This function extracts those references, builds a
    deduplicated citation list (keyed on legislation_id + section), and
    rewrites the markers so they are contiguous (e.g. [1], [3] becomes
    [1], [2]).

    Returns (corrected_response, citations).
    """
    if not source_nodes:
        return response, []

    refs = sorted({int(m) for m in _REF_RE.findall(response)})
    if not refs:
        return response, []

    citations: list[Citation] = []
    key_to_new: dict[tuple[int | None, str], int] = {}
    old_to_new: dict[int, int] = {}

    for ref in refs:
        idx = ref - 1
        if idx < 0 or idx >= len(source_nodes):
            continue

        node = source_nodes[idx]
        meta = node.node.metadata
        section = meta.get("section", "Unknown")
        leg_id = meta.get("legislation_id")
        key = (leg_id, section)

        if key not in key_to_new:
            text = _SOURCE_PREFIX_RE.sub("", node.node.get_content())
            citations.append(
                Citation(
                    source=section,
                    text=text,
                    legislation_id=leg_id,
                    legislation_name=meta.get("legislation_name"),
                    jurisdiction=meta.get("jurisdiction"),
                )
            )
            key_to_new[key] = len(citations)  # 1-based

        old_to_new[ref] = key_to_new[key]

    def _replace_ref(match: re.Match) -> str:
        old_num = int(match.group(1))
        new_num = old_to_new.get(old_num)
        return f"[{new_num}]" if new_num is not None else ""

    corrected = _REF_RE.sub(_replace_ref, response)
    return corrected, citations
