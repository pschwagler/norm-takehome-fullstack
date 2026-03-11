import json

from sqlmodel import Session, func, select

from app.models import Citation, Message, Thread


def create_thread(
    session: Session,
    first_query: str,
    jurisdiction: str | None = None,
) -> Thread:
    """Create a new conversation thread, using the query as the title."""
    title = first_query[:80] if len(first_query) > 80 else first_query
    thread = Thread(title=title, jurisdiction=jurisdiction)
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


def add_message(
    session: Session,
    thread_id: int,
    role: str,
    content: str,
    citations: list[Citation] | None = None,
) -> Message:
    """Append a user or assistant message to a thread."""
    citations_json = json.dumps(
        [c.model_dump() for c in citations] if citations else []
    )
    message = Message(
        thread_id=thread_id,
        role=role,
        content=content,
        citations=citations_json,
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


def list_threads(session: Session, limit: int = 50) -> list[Thread]:
    """Return the most recent threads, newest first."""
    statement = select(Thread).order_by(Thread.created_at.desc()).limit(limit)
    return list(session.exec(statement).all())


def get_thread(session: Session, thread_id: int) -> Thread | None:
    """Fetch a single thread by ID, or None if not found."""
    return session.get(Thread, thread_id)


def delete_thread(session: Session, thread_id: int) -> bool:
    """Delete a thread and its messages. Returns False if not found."""
    thread = session.get(Thread, thread_id)
    if thread is None:
        return False
    session.delete(thread)
    session.commit()
    return True


def get_thread_history(
    session: Session, thread_id: int, max_pairs: int = 6
) -> list[tuple[str, str]]:
    """Return last N user/assistant message pairs for context condensing."""
    statement = (
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
    )
    messages = list(session.exec(statement).all())

    pairs: list[tuple[str, str]] = []
    i = 0
    while i < len(messages) - 1:
        if messages[i].role == "user" and messages[i + 1].role == "assistant":
            pairs.append((messages[i].content, messages[i + 1].content))
            i += 2
        else:
            i += 1

    return pairs[-max_pairs:]


def get_thread_message_count(session: Session, thread_id: int) -> int:
    """Return the total number of messages in a thread."""
    statement = select(func.count(Message.id)).where(Message.thread_id == thread_id)
    return session.exec(statement).one()


def get_message_counts(session: Session, thread_ids: list[int]) -> dict[int, int]:
    """Batch-fetch message counts for multiple threads in a single query."""
    if not thread_ids:
        return {}
    statement = (
        select(Message.thread_id, func.count(Message.id))
        .where(Message.thread_id.in_(thread_ids))
        .group_by(Message.thread_id)
    )
    rows = session.exec(statement).all()
    counts = {tid: cnt for tid, cnt in rows}
    return {tid: counts.get(tid, 0) for tid in thread_ids}
