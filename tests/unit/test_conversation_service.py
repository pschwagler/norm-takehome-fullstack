import json

import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.conversation_service import (
    add_message,
    create_thread,
    delete_thread,
    get_thread,
    get_thread_history,
    get_thread_message_count,
    list_threads,
)
from app.models import Citation, Message


@pytest.fixture
def db_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    with Session(db_engine) as session:
        yield session


def test_create_thread(db_session):
    thread = create_thread(db_session, "What are the trade laws?")
    assert thread.id is not None
    assert thread.title == "What are the trade laws?"
    assert thread.jurisdiction is None


def test_create_thread_truncates_title(db_session):
    long_query = "x" * 200
    thread = create_thread(db_session, long_query)
    assert len(thread.title) == 80


def test_create_thread_with_jurisdiction(db_session):
    thread = create_thread(db_session, "trade laws", jurisdiction="The North")
    assert thread.jurisdiction == "The North"


def test_add_message_user(db_session):
    thread = create_thread(db_session, "test")
    msg = add_message(db_session, thread.id, "user", "Hello")
    assert msg.id is not None
    assert msg.role == "user"
    assert msg.content == "Hello"
    assert msg.thread_id == thread.id
    assert json.loads(msg.citations) == []


def test_add_message_assistant_with_citations(db_session):
    thread = create_thread(db_session, "test")
    citations = [
        Citation(
            source="1.1",
            text="Test law",
            legislation_name="Laws",
            jurisdiction="Kingdom-wide",
        )
    ]
    msg = add_message(db_session, thread.id, "assistant", "Response", citations)
    parsed = json.loads(msg.citations)
    assert len(parsed) == 1
    assert parsed[0]["source"] == "1.1"


def test_list_threads(db_session):
    create_thread(db_session, "First")
    create_thread(db_session, "Second")
    threads = list_threads(db_session)
    assert len(threads) == 2
    # Most recent first
    assert threads[0].title == "Second"


def test_list_threads_limit(db_session):
    for i in range(5):
        create_thread(db_session, f"Thread {i}")
    threads = list_threads(db_session, limit=3)
    assert len(threads) == 3


def test_get_thread(db_session):
    thread = create_thread(db_session, "test")
    found = get_thread(db_session, thread.id)
    assert found is not None
    assert found.id == thread.id


def test_get_thread_not_found(db_session):
    assert get_thread(db_session, 999) is None


def test_delete_thread(db_session):
    thread = create_thread(db_session, "test")
    add_message(db_session, thread.id, "user", "Hello")
    assert delete_thread(db_session, thread.id) is True
    assert get_thread(db_session, thread.id) is None


def test_delete_thread_not_found(db_session):
    assert delete_thread(db_session, 999) is False


def test_get_thread_history(db_session):
    thread = create_thread(db_session, "test")
    add_message(db_session, thread.id, "user", "Q1")
    add_message(db_session, thread.id, "assistant", "A1")
    add_message(db_session, thread.id, "user", "Q2")
    add_message(db_session, thread.id, "assistant", "A2")

    history = get_thread_history(db_session, thread.id)
    assert len(history) == 2
    assert history[0] == ("Q1", "A1")
    assert history[1] == ("Q2", "A2")


def test_get_thread_history_max_pairs(db_session):
    thread = create_thread(db_session, "test")
    for i in range(10):
        add_message(db_session, thread.id, "user", f"Q{i}")
        add_message(db_session, thread.id, "assistant", f"A{i}")

    history = get_thread_history(db_session, thread.id, max_pairs=3)
    assert len(history) == 3
    # Should be the last 3 pairs
    assert history[0] == ("Q7", "A7")


def test_get_thread_history_empty(db_session):
    thread = create_thread(db_session, "test")
    history = get_thread_history(db_session, thread.id)
    assert history == []


def test_get_thread_message_count(db_session):
    thread = create_thread(db_session, "test")
    assert get_thread_message_count(db_session, thread.id) == 0

    add_message(db_session, thread.id, "user", "Q1")
    assert get_thread_message_count(db_session, thread.id) == 1

    add_message(db_session, thread.id, "assistant", "A1")
    assert get_thread_message_count(db_session, thread.id) == 2


def test_delete_thread_cascades_messages(db_session):
    thread = create_thread(db_session, "test")
    add_message(db_session, thread.id, "user", "Q1")
    add_message(db_session, thread.id, "assistant", "A1")

    delete_thread(db_session, thread.id)

    # Messages should also be gone
    from sqlmodel import select

    msgs = list(db_session.exec(select(Message)).all())
    assert len(msgs) == 0
