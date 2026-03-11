from unittest.mock import patch

import pytest

from app.legislation_service import LegislationService, _build_topic_number_map
from app.pdf_parser import ParsedLaw, parse_pdf


# ---------------------------------------------------------------------------
# PDF-based parse tests (integration with actual docs/laws.pdf)
# ---------------------------------------------------------------------------


@pytest.fixture
def parsed_laws(sample_pdf_path):
    return parse_pdf(sample_pdf_path)


def test_parse_laws_pdf_legislation_count(parsed_laws):
    assert len(parsed_laws) == 31


def test_parse_laws_pdf_first_law(parsed_laws):
    first = parsed_laws[0]
    assert first.section == "1.1"
    assert first.topic == "Peace"
    assert "petty lords" in first.text


def test_parse_laws_pdf_nested_law(parsed_laws):
    deep = [law for law in parsed_laws if law.section == "10.1.1.4"]
    assert len(deep) == 1
    assert deep[0].topic == "Watch"
    assert "Women" in deep[0].text


def test_parse_laws_pdf_subtopic_title(parsed_laws):
    combat_laws = [law for law in parsed_laws if law.section.startswith("4.2.")]
    assert all(law.section_title == "Trials by combat" for law in combat_laws)
    assert len(combat_laws) == 4


def test_parse_laws_pdf_all_topics_present(parsed_laws):
    topics = {law.topic for law in parsed_laws}
    expected = {
        "Peace",
        "Religion",
        "Widows",
        "Trials",
        "Taxes",
        "Thievery",
        "Poaching",
        "Outlawry",
        "Slavery",
        "Watch",
        "Baking",
    }
    assert topics == expected


def test_parse_laws_pdf_text_not_empty(parsed_laws):
    for law in parsed_laws:
        assert law.text.strip(), f"Law {law.section} has empty text"


def test_parse_empty_pdf(tmp_path):
    empty_pdf = tmp_path / "empty.pdf"
    empty_pdf.write_bytes(b"")
    with pytest.raises(Exception):
        parse_pdf(str(empty_pdf))


def test_parse_non_pdf_file():
    with pytest.raises(ValueError, match="File must be a PDF"):
        parse_pdf("docs/assignment.md")


# ---------------------------------------------------------------------------
# LegislationService.create_legislation()
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_parsed_laws():
    return [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Lords shall keep peace."),
        ParsedLaw(section="1.2", topic="Peace", section_title=None, text="Violations are punished."),
        ParsedLaw(section="4.2.1", topic="Trials", section_title="Trials by combat", text="Any knight accused..."),
        ParsedLaw(section="4.2.2", topic="Trials", section_title="Trials by combat", text="The victor is innocent."),
        ParsedLaw(section="6.1", topic="Thievery", section_title=None, text="A thief shall lose a hand."),
    ]


def test_create_legislation_calls_parse_pdf():
    svc = LegislationService()
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Some law.")
    ]
    with patch("app.legislation_service.parse_pdf", return_value=mock_laws) as mock_parse:
        result = svc.create_legislation("path/to/laws.pdf")

    mock_parse.assert_called_once_with("path/to/laws.pdf")
    assert result == mock_laws


def test_create_legislation_returns_parsed_laws():
    svc = LegislationService()
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Text A."),
        ParsedLaw(section="2.1", topic="Religion", section_title=None, text="Text B."),
    ]
    with patch("app.legislation_service.parse_pdf", return_value=mock_laws):
        result = svc.create_legislation("any.pdf")

    assert len(result) == 2
    assert result[0].section == "1.1"
    assert result[1].section == "2.1"


def test_create_legislation_propagates_parse_errors():
    svc = LegislationService()
    with patch("app.legislation_service.parse_pdf", side_effect=ValueError("not a pdf")):
        with pytest.raises(ValueError, match="not a pdf"):
            svc.create_legislation("bad.txt")


# ---------------------------------------------------------------------------
# LegislationService.create_nodes()
# ---------------------------------------------------------------------------


def test_create_nodes_returns_leaf_and_all_nodes(sample_parsed_laws):
    svc = LegislationService()
    leaf_nodes, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws of Seven Kingdoms", "Kingdom-wide")

    # 3 topics -> 3 parent nodes; 5 laws -> 5 leaf nodes
    assert len(leaf_nodes) == 5
    assert len(all_nodes) == 8  # 3 parents + 5 leaves


def test_create_nodes_leaf_metadata(sample_parsed_laws):
    svc = LegislationService()
    leaf_nodes, _ = svc.create_nodes(sample_parsed_laws, 42, "My Laws", "The North")

    peace_leaves = [n for n in leaf_nodes if n.metadata.get("section") == "1.1"]
    assert len(peace_leaves) == 1
    node = peace_leaves[0]
    assert node.metadata["topic"] == "Peace"
    assert node.metadata["legislation_name"] == "My Laws"
    assert node.metadata["legislation_id"] == 42
    assert node.metadata["jurisdiction"] == "The North"
    assert node.metadata["chunk_type"] == "law"
    assert node.text == "Lords shall keep peace."


def test_create_nodes_parent_metadata(sample_parsed_laws):
    svc = LegislationService()
    _, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws", "Kingdom-wide")

    parent_nodes = [n for n in all_nodes if n.metadata.get("chunk_type") == "topic"]
    topics = {n.metadata["topic"] for n in parent_nodes}
    assert topics == {"Peace", "Trials", "Thievery"}

    for parent in parent_nodes:
        assert parent.metadata["legislation_name"] == "Laws"
        assert parent.metadata["legislation_id"] == 1
        assert parent.metadata["jurisdiction"] == "Kingdom-wide"


def test_create_nodes_parent_text_contains_all_laws(sample_parsed_laws):
    svc = LegislationService()
    _, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws", "Kingdom-wide")

    peace_parent = next(
        n for n in all_nodes
        if n.metadata.get("chunk_type") == "topic" and n.metadata["topic"] == "Peace"
    )
    assert "Lords shall keep peace." in peace_parent.text
    assert "Violations are punished." in peace_parent.text


def test_create_nodes_leaf_has_parent_relationship(sample_parsed_laws):
    from llama_index.core.schema import NodeRelationship

    svc = LegislationService()
    leaf_nodes, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws", "Kingdom-wide")

    parent_nodes = [n for n in all_nodes if n.metadata.get("chunk_type") == "topic"]
    parent_ids = {p.node_id for p in parent_nodes}

    for leaf in leaf_nodes:
        assert NodeRelationship.PARENT in leaf.relationships
        parent_ref = leaf.relationships[NodeRelationship.PARENT]
        assert parent_ref.node_id in parent_ids


def test_create_nodes_parent_has_child_relationships(sample_parsed_laws):
    from llama_index.core.schema import NodeRelationship

    svc = LegislationService()
    leaf_nodes, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws", "Kingdom-wide")

    parent_nodes = [n for n in all_nodes if n.metadata.get("chunk_type") == "topic"]
    leaf_ids = {n.node_id for n in leaf_nodes}

    for parent in parent_nodes:
        assert NodeRelationship.CHILD in parent.relationships
        children = parent.relationships[NodeRelationship.CHILD]
        assert len(children) >= 1
        for child_ref in children:
            assert child_ref.node_id in leaf_ids


def test_create_nodes_section_title_in_metadata():
    svc = LegislationService()
    laws = [
        ParsedLaw(section="4.2.1", topic="Trials", section_title="Trials by combat", text="A knight..."),
    ]
    leaf_nodes, _ = svc.create_nodes(laws, 1, "Laws", "Kingdom-wide")
    assert leaf_nodes[0].metadata["section_title"] == "Trials by combat"


def test_create_nodes_no_section_title_omitted():
    svc = LegislationService()
    laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Some law."),
    ]
    leaf_nodes, _ = svc.create_nodes(laws, 1, "Laws", "Kingdom-wide")
    assert "section_title" not in leaf_nodes[0].metadata


def test_create_nodes_deterministic_ids():
    """Same input always produces same node IDs."""
    svc = LegislationService()
    laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Some law."),
    ]
    leaf1, all1 = svc.create_nodes(laws, 1, "Laws", "Kingdom-wide")
    leaf2, all2 = svc.create_nodes(laws, 1, "Laws", "Kingdom-wide")

    assert leaf1[0].node_id == leaf2[0].node_id
    assert all1[0].node_id == all2[0].node_id


def test_create_nodes_different_legislation_ids_produce_different_ids():
    svc = LegislationService()
    laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="Some law."),
    ]
    leaf1, _ = svc.create_nodes(laws, 1, "Laws", "Kingdom-wide")
    leaf2, _ = svc.create_nodes(laws, 2, "Laws", "Kingdom-wide")

    assert leaf1[0].node_id != leaf2[0].node_id


def test_create_nodes_empty_laws():
    svc = LegislationService()
    leaf_nodes, all_nodes = svc.create_nodes([], 1, "Laws", "Kingdom-wide")
    assert leaf_nodes == []
    assert all_nodes == []


def test_create_nodes_excluded_metadata_keys(sample_parsed_laws):
    svc = LegislationService()
    leaf_nodes, all_nodes = svc.create_nodes(sample_parsed_laws, 1, "Laws", "Kingdom-wide")

    for node in leaf_nodes + all_nodes:
        assert "chunk_type" in node.excluded_llm_metadata_keys
        assert "legislation_id" in node.excluded_llm_metadata_keys
        assert "chunk_type" in node.excluded_embed_metadata_keys
        assert "legislation_id" in node.excluded_embed_metadata_keys


# ---------------------------------------------------------------------------
# _build_topic_number_map
# ---------------------------------------------------------------------------


def test_build_topic_number_map_basic():
    laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="a"),
        ParsedLaw(section="1.2", topic="Peace", section_title=None, text="b"),
        ParsedLaw(section="4.1", topic="Trials", section_title=None, text="c"),
    ]
    mapping = _build_topic_number_map(laws)
    assert mapping["Peace"] == "1"
    assert mapping["Trials"] == "4"


def test_build_topic_number_map_first_occurrence_wins():
    """If two sections with different top-level numbers somehow share a topic,
    the first one encountered wins."""
    laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="a"),
        ParsedLaw(section="2.1", topic="Peace", section_title=None, text="b"),
    ]
    mapping = _build_topic_number_map(laws)
    assert mapping["Peace"] == "1"


def test_build_topic_number_map_empty():
    assert _build_topic_number_map([]) == {}
