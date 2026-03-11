from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Law, LawGroupResponse, LawResponse

router = APIRouter()


def _law_to_response(law: Law) -> LawResponse:
    """Convert a Law ORM model to its API response schema."""
    return LawResponse(
        id=law.id,
        section=law.section,
        topic=law.topic,
        section_title=law.section_title,
        text=law.text,
        jurisdiction=law.jurisdiction,
        legislation_id=law.legislation_id,
    )


@router.get("/laws", response_model=list[LawGroupResponse])
def get_laws(
    legislation_id: Optional[int] = None,
    jurisdiction: Optional[str] = None,
    session: Session = Depends(get_session),
):
    statement = select(Law)
    if legislation_id is not None:
        statement = statement.where(Law.legislation_id == legislation_id)
    if jurisdiction is not None:
        statement = statement.where(Law.jurisdiction == jurisdiction)

    laws = list(session.exec(statement).all())

    # Group by topic, preserving order
    topic_order: list[str] = []
    grouped: dict[str, list[Law]] = {}
    for law in laws:
        if law.topic not in grouped:
            topic_order.append(law.topic)
            grouped[law.topic] = []
        grouped[law.topic].append(law)

    return [
        LawGroupResponse(
            topic=topic,
            laws=[_law_to_response(law) for law in grouped[topic]],
        )
        for topic in topic_order
    ]


@router.get("/laws/{law_id}", response_model=LawResponse)
def get_law(law_id: int, session: Session = Depends(get_session)):
    law = session.get(Law, law_id)
    if law is None:
        raise HTTPException(status_code=404, detail="Law not found")
    return _law_to_response(law)
