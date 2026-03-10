import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.models import Law, Legislation


@pytest.fixture
def db_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    with Session(db_engine) as session:
        yield session


@pytest.fixture
def sample_legislation(db_session):
    legislation = Legislation(
        name="Laws of the Seven Kingdoms",
        file_name="laws.pdf",
        file_path="data/uploads/laws.pdf",
        jurisdiction="Kingdom-wide",
    )
    db_session.add(legislation)
    db_session.commit()
    db_session.refresh(legislation)
    return legislation


@pytest.fixture
def sample_laws(db_session, sample_legislation):
    laws_data = [
        ("1.1", "Peace", None, "The law requires petty lords..."),
        ("4.2.1", "Trials", "Trials by combat", "Any knight accused..."),
        ("6.1", "Thievery", None, "It is customary for a thief..."),
    ]
    laws = []
    for section, topic, section_title, text in laws_data:
        law = Law(
            legislation_id=sample_legislation.id,
            section=section,
            topic=topic,
            section_title=section_title,
            text=text,
            jurisdiction="Kingdom-wide",
        )
        db_session.add(law)
        laws.append(law)
    db_session.commit()
    for law in laws:
        db_session.refresh(law)
    return laws


@pytest.fixture
def sample_pdf_path():
    return "docs/laws.pdf"
