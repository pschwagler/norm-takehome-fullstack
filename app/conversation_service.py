import json

from sqlmodel import Session, select

from app.models import Citation, Conversation


def create_conversation(
    session: Session,
    query: str,
    response: str,
    citations: list[Citation],
    jurisdiction: str | None = None,
) -> Conversation:
    citations_json = json.dumps([c.model_dump() for c in citations])
    conversation = Conversation(
        query=query,
        response=response,
        citations=citations_json,
        jurisdiction=jurisdiction,
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


def list_conversations(
    session: Session, limit: int = 50
) -> list[Conversation]:
    statement = (
        select(Conversation)
        .order_by(Conversation.created_at.desc())
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_conversation(
    session: Session, conversation_id: int
) -> Conversation | None:
    return session.get(Conversation, conversation_id)


def delete_conversation(session: Session, conversation_id: int) -> bool:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None:
        return False
    session.delete(conversation)
    session.commit()
    return True
