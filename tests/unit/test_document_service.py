import pytest

from app.pdf_parser import parse_pdf


@pytest.fixture
def parsed_laws(sample_pdf_path):
    return parse_pdf(sample_pdf_path)


def test_parse_laws_pdf_document_count(parsed_laws):
    assert len(parsed_laws) == 31


def test_parse_laws_pdf_first_law(parsed_laws):
    first = parsed_laws[0]
    assert first.section == "1.1"
    assert first.topic == "Peace"
    assert "petty lords" in first.text


def test_parse_laws_pdf_nested_law(parsed_laws):
    deep = [l for l in parsed_laws if l.section == "10.1.1.4"]
    assert len(deep) == 1
    assert deep[0].topic == "Watch"
    assert "Women" in deep[0].text


def test_parse_laws_pdf_subtopic_title(parsed_laws):
    combat_laws = [l for l in parsed_laws if l.section.startswith("4.2.")]
    assert all(l.section_title == "Trials by combat" for l in combat_laws)
    assert len(combat_laws) == 4


def test_parse_laws_pdf_all_topics_present(parsed_laws):
    topics = {l.topic for l in parsed_laws}
    expected = {
        "Peace", "Religion", "Widows", "Trials", "Taxes",
        "Thievery", "Poaching", "Outlawry", "Slavery", "Watch", "Baking",
    }
    assert topics == expected


def test_parse_laws_pdf_text_not_empty(parsed_laws):
    for law in parsed_laws:
        assert law.text.strip(), f"Law {law.section} has empty text"


def test_parse_empty_pdf(tmp_path):
    # Create an empty PDF-like file
    empty_pdf = tmp_path / "empty.pdf"
    empty_pdf.write_bytes(b"")
    with pytest.raises(Exception):
        parse_pdf(str(empty_pdf))


def test_parse_non_pdf_file():
    with pytest.raises(ValueError, match="File must be a PDF"):
        parse_pdf("docs/assignment.md")
