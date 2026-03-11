import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedLaw:
    section: str
    topic: str
    section_title: str | None
    text: str


def parse_pdf(file_path: str) -> list[ParsedLaw]:
    """Parse a legislation PDF into structured law entries.

    Uses pymupdf4llm for markdown extraction, then regex to split
    on the hierarchical numbering scheme (e.g. 1.1, 4.2.3, 10.1.1.4).
    """
    if not file_path.lower().endswith(".pdf"):
        raise ValueError("File must be a PDF")

    import pymupdf4llm

    md_text = pymupdf4llm.to_markdown(file_path)

    return _parse_markdown(md_text)


def _parse_markdown(md_text: str) -> list[ParsedLaw]:
    """Parse markdown text extracted from a legislation PDF."""
    lines = md_text.split("\n")

    # First pass: extract topics (bold top-level numbers like **1.** **Peace**)
    topic_pattern = re.compile(r"^\*\*(\d+)\.\*\*\s+\*\*([^*]+)\*\*\s*$")
    # Sub-topic headers (bold, like **4.1.** **Trials of the Crown**)
    subtopic_pattern = re.compile(r"^\*\*(\d+\.\d+\.?)\*\*\s+\*\*([^*]+)\*\*\s*$")
    # Law entries (non-bold numbered items like "4.2.1. Any knight...")
    law_pattern = re.compile(r"^(\d+(?:\.\d+)+)\.?\s+(.+)")

    topics: dict[str, str] = {}  # topic_num -> topic_name
    subtopics: dict[str, str] = {}  # section_prefix -> section_title
    raw_entries: list[dict] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Check for topic header
        topic_match = topic_pattern.match(line)
        if topic_match:
            topic_num = topic_match.group(1)
            topic_name = topic_match.group(2).strip()
            topics[topic_num] = topic_name
            i += 1
            continue

        # Check for sub-topic header
        subtopic_match = subtopic_pattern.match(line)
        if subtopic_match:
            section = subtopic_match.group(1).rstrip(".")
            title = subtopic_match.group(2).strip()
            subtopics[section] = title
            i += 1
            continue

        # Check for law entry
        law_match = law_pattern.match(line)
        if law_match:
            section = law_match.group(1)
            text_start = law_match.group(2).strip()

            # Collect continuation lines (indented text that follows)
            full_text_parts = [text_start]
            i += 1
            while i < len(lines):
                next_line = lines[i]
                stripped = next_line.strip()
                # Stop at empty lines, new sections, topic headers, page breaks
                if not stripped or stripped == "-----":
                    break
                if topic_pattern.match(stripped):
                    break
                if subtopic_pattern.match(stripped):
                    break
                if law_pattern.match(stripped):
                    break
                if stripped.startswith("**") and stripped.endswith("**"):
                    break
                # Skip citation links at the end
                if stripped.startswith("[http") or stripped.startswith("http"):
                    i += 1
                    continue
                full_text_parts.append(stripped)
                i += 1

            full_text = " ".join(full_text_parts)
            # Clean up any markdown artifacts
            full_text = full_text.replace("  ", " ").strip()

            raw_entries.append(
                {
                    "section": section,
                    "text": full_text,
                }
            )
            continue

        i += 1

    # Second pass: assign topic and section_title to each entry
    laws = []
    for entry in raw_entries:
        section = entry["section"]
        top_level = section.split(".")[0]
        topic = topics.get(top_level, "Unknown")

        # Find applicable section_title by checking if this section
        # falls under a known sub-topic
        section_title = _find_section_title(section, subtopics)

        laws.append(
            ParsedLaw(
                section=section,
                topic=topic,
                section_title=section_title,
                text=entry["text"],
            )
        )

    return laws


def _find_section_title(section: str, subtopics: dict[str, str]) -> str | None:
    """Find the section_title for a given section number.

    A law like 4.2.3 falls under sub-topic 4.2 ("Trials by combat").
    We check progressively shorter prefixes.
    """
    parts = section.split(".")
    # Check from longest prefix to shortest (excluding the full section itself)
    for length in range(len(parts) - 1, 1, -1):
        prefix = ".".join(parts[:length])
        if prefix in subtopics:
            return subtopics[prefix]
    return None
