from sqlmodel import select

from app.models import Law, Legislation, Message, Thread


def test_create_legislation(db_session):
    legislation = Legislation(
        name="Test Laws",
        file_name="test.pdf",
        file_path="data/uploads/test.pdf",
        jurisdiction="Kingdom-wide",
    )
    db_session.add(legislation)
    db_session.commit()
    db_session.refresh(legislation)

    assert legislation.id is not None
    assert legislation.name == "Test Laws"
    assert legislation.jurisdiction == "Kingdom-wide"
    assert legislation.uploaded_at is not None


def test_create_law(db_session, sample_legislation):
    law = Law(
        legislation_id=sample_legislation.id,
        section="1.1",
        topic="Peace",
        text="The law requires...",
        jurisdiction="Kingdom-wide",
    )
    db_session.add(law)
    db_session.commit()
    db_session.refresh(law)

    assert law.id is not None
    assert law.legislation_id == sample_legislation.id
    assert law.section == "1.1"
    assert law.topic == "Peace"


def test_law_legislation_relationship(db_session, sample_legislation, sample_laws):
    for law in sample_laws:
        assert law.legislation_id == sample_legislation.id

    refreshed_legislation = db_session.get(Legislation, sample_legislation.id)
    assert len(refreshed_legislation.laws) == len(sample_laws)


def test_get_laws_by_legislation_id(db_session, sample_legislation, sample_laws):
    result = list(
        db_session.exec(
            select(Law).where(Law.legislation_id == sample_legislation.id)
        ).all()
    )
    assert len(result) == len(sample_laws)


def test_get_laws_grouped_by_topic(db_session, sample_legislation, sample_laws):
    laws = list(
        db_session.exec(
            select(Law).where(Law.legislation_id == sample_legislation.id)
        ).all()
    )
    grouped = {}
    for law in laws:
        grouped.setdefault(law.topic, []).append(law)

    assert "Peace" in grouped
    assert "Trials" in grouped
    assert "Thievery" in grouped
    assert len(grouped) == 3


def test_create_thread(db_session):
    thread = Thread(title="Test thread")
    db_session.add(thread)
    db_session.commit()
    db_session.refresh(thread)

    assert thread.id is not None
    assert thread.title == "Test thread"
    assert thread.created_at is not None


def test_create_message(db_session):
    thread = Thread(title="Test")
    db_session.add(thread)
    db_session.commit()
    db_session.refresh(thread)

    msg = Message(
        thread_id=thread.id,
        role="user",
        content="Hello",
    )
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)

    assert msg.id is not None
    assert msg.thread_id == thread.id
    assert msg.role == "user"
    assert msg.content == "Hello"


def test_thread_message_relationship(db_session):
    thread = Thread(title="Test")
    db_session.add(thread)
    db_session.commit()
    db_session.refresh(thread)

    msg1 = Message(thread_id=thread.id, role="user", content="Q1")
    msg2 = Message(thread_id=thread.id, role="assistant", content="A1")
    db_session.add(msg1)
    db_session.add(msg2)
    db_session.commit()

    refreshed = db_session.get(Thread, thread.id)
    assert len(refreshed.messages) == 2
