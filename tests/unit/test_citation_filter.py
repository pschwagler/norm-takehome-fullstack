from unittest.mock import MagicMock

from app.citation_filter import filter_by_response_refs
from app.models import Citation


def _make_source_node(
    section: str,
    text: str = "Some law text",
    legislation_name: str | None = "Laws of the Seven Kingdoms",
    jurisdiction: str | None = "Kingdom-wide",
    legislation_id: int | None = 1,
):
    """Build a minimal source node compatible with filter_by_response_refs."""
    node = MagicMock()
    node.node.metadata = {
        "section": section,
        "legislation_name": legislation_name,
        "jurisdiction": jurisdiction,
        "legislation_id": legislation_id,
    }
    node.node.get_content.return_value = text
    return node


def test_empty_source_nodes_returns_response_unchanged():
    response, citations = filter_by_response_refs("Some text [1]", [])
    assert response == "Some text [1]"
    assert citations == []


def test_no_refs_in_response_returns_empty_citations():
    nodes = [_make_source_node("1.1")]
    response, citations = filter_by_response_refs("No citations here", nodes)
    assert response == "No citations here"
    assert citations == []


def test_single_ref_extracts_citation():
    nodes = [_make_source_node("1.1", text="Peace text", legislation_id=1)]
    response, citations = filter_by_response_refs("Laws say [1] peace.", nodes)
    assert response == "Laws say [1] peace."
    assert len(citations) == 1
    assert citations[0].source == "1.1"
    assert citations[0].text == "Peace text"
    assert citations[0].legislation_id == 1


def test_multiple_refs_extract_correct_citations():
    nodes = [
        _make_source_node("1.1", text="First law"),
        _make_source_node("2.3", text="Second law"),
    ]
    response, citations = filter_by_response_refs("See [1] and [2].", nodes)
    assert response == "See [1] and [2]."
    assert len(citations) == 2
    assert citations[0].source == "1.1"
    assert citations[1].source == "2.3"


def test_skipped_numbers_renumber_contiguously():
    nodes = [
        _make_source_node("1.1", text="First"),
        _make_source_node("2.2", text="Skipped"),
        _make_source_node("3.3", text="Third"),
    ]
    response, citations = filter_by_response_refs("See [1] and [3].", nodes)
    assert response == "See [1] and [2]."
    assert len(citations) == 2
    assert citations[0].source == "1.1"
    assert citations[1].source == "3.3"


def test_duplicate_sections_merge_to_single_citation():
    """Two source_nodes for the same section get merged; refs renumber."""
    nodes = [
        _make_source_node("6", text="Chunk A", legislation_id=1),
        _make_source_node("6", text="Chunk B", legislation_id=1),
        _make_source_node("10.1.1", text="Night's Watch", legislation_id=1),
    ]
    response, citations = filter_by_response_refs(
        "Thievery [1] [2]. Night's Watch [3].", nodes
    )
    assert response == "Thievery [1] [1]. Night's Watch [2]."
    assert len(citations) == 2
    assert citations[0].source == "6"
    assert citations[1].source == "10.1.1"


def test_out_of_range_ref_removed():
    nodes = [_make_source_node("1.1")]
    response, citations = filter_by_response_refs("See [1] and [99].", nodes)
    assert response == "See [1] and ."
    assert len(citations) == 1
    assert citations[0].source == "1.1"


def test_source_prefix_stripped():
    nodes = [_make_source_node("1.1", text="Source 1: Peace text")]
    response, citations = filter_by_response_refs("Laws [1].", nodes)
    assert citations[0].text == "Peace text"


def test_same_section_different_legislation_preserved():
    nodes = [
        _make_source_node("1.1", text="Law A", legislation_id=1),
        _make_source_node("1.1", text="Law B", legislation_id=2),
    ]
    response, citations = filter_by_response_refs("See [1] and [2].", nodes)
    assert len(citations) == 2
    assert citations[0].legislation_id == 1
    assert citations[1].legislation_id == 2


def test_repeated_ref_not_duplicated():
    nodes = [_make_source_node("1.1")]
    response, citations = filter_by_response_refs("See [1]. Also [1].", nodes)
    assert response == "See [1]. Also [1]."
    assert len(citations) == 1


def test_metadata_fields_populated():
    nodes = [
        _make_source_node(
            "3.1",
            text="Trade text",
            legislation_name="Trade Laws",
            jurisdiction="Dorne",
            legislation_id=42,
        )
    ]
    response, citations = filter_by_response_refs("See [1].", nodes)
    assert citations[0].source == "3.1"
    assert citations[0].legislation_name == "Trade Laws"
    assert citations[0].jurisdiction == "Dorne"
    assert citations[0].legislation_id == 42


def test_missing_metadata_defaults_to_none():
    node = MagicMock()
    node.node.metadata = {}
    node.node.get_content.return_value = "text"
    response, citations = filter_by_response_refs("See [1].", [node])
    assert citations[0].source == "Unknown"
    assert citations[0].legislation_id is None
    assert citations[0].legislation_name is None
    assert citations[0].jurisdiction is None


def test_preserves_unreferenced_text():
    """Text around citation markers is preserved exactly."""
    nodes = [_make_source_node("1.1")]
    response, _ = filter_by_response_refs(
        "Before [1] middle [1] after.", nodes
    )
    assert response == "Before [1] middle [1] after."


def test_complex_renumbering():
    """References [2], [4], [5] with 5 source nodes renumber to [1], [2], [3]."""
    nodes = [
        _make_source_node("1.1"),
        _make_source_node("2.2"),
        _make_source_node("3.3"),
        _make_source_node("4.4"),
        _make_source_node("5.5"),
    ]
    response, citations = filter_by_response_refs(
        "A [2], B [4], C [5].", nodes
    )
    assert response == "A [1], B [2], C [3]."
    assert len(citations) == 3
    assert [c.source for c in citations] == ["2.2", "4.4", "5.5"]


def test_zero_ref_ignored():
    """[0] is out of range (1-based indexing) and removed."""
    nodes = [_make_source_node("1.1")]
    response, citations = filter_by_response_refs("See [0] and [1].", nodes)
    assert response == "See  and [1]."
    assert len(citations) == 1
