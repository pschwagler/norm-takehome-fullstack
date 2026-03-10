from sqlmodel import select

from app.models import Law, LegislationDocument


def test_create_legislation_document(db_session):
    doc = LegislationDocument(
        name="Test Laws",
        file_name="test.pdf",
        file_path="data/uploads/test.pdf",
        jurisdiction="Kingdom-wide",
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    assert doc.id is not None
    assert doc.name == "Test Laws"
    assert doc.jurisdiction == "Kingdom-wide"
    assert doc.uploaded_at is not None


def test_create_law(db_session, sample_document):
    law = Law(
        document_id=sample_document.id,
        section="1.1",
        topic="Peace",
        text="The law requires...",
        jurisdiction="Kingdom-wide",
    )
    db_session.add(law)
    db_session.commit()
    db_session.refresh(law)

    assert law.id is not None
    assert law.document_id == sample_document.id
    assert law.section == "1.1"
    assert law.topic == "Peace"


def test_law_document_relationship(db_session, sample_document, sample_laws):
    for law in sample_laws:
        assert law.document_id == sample_document.id

    refreshed_doc = db_session.get(LegislationDocument, sample_document.id)
    assert len(refreshed_doc.laws) == len(sample_laws)


def test_get_laws_by_document_id(db_session, sample_document, sample_laws):
    result = list(
        db_session.exec(
            select(Law).where(Law.document_id == sample_document.id)
        ).all()
    )
    assert len(result) == len(sample_laws)


def test_get_laws_grouped_by_topic(db_session, sample_document, sample_laws):
    laws = list(
        db_session.exec(
            select(Law).where(Law.document_id == sample_document.id)
        ).all()
    )
    grouped = {}
    for law in laws:
        grouped.setdefault(law.topic, []).append(law)

    assert "Peace" in grouped
    assert "Trials" in grouped
    assert "Thievery" in grouped
    assert len(grouped) == 3
