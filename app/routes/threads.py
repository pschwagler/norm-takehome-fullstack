import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session

from app import conversation_service
from app.database import get_session
from app.models import MessageResponse, ThreadDetail, ThreadSummary

router = APIRouter()


@router.get("/threads", response_model=list[ThreadSummary])
def get_threads(limit: int = 50, session: Session = Depends(get_session)):
    threads = conversation_service.list_threads(session, limit)
    counts = conversation_service.get_message_counts(
        session, [t.id for t in threads]
    )
    return [
        ThreadSummary(
            id=t.id,
            title=t.title,
            jurisdiction=t.jurisdiction,
            message_count=counts.get(t.id, 0),
            created_at=t.created_at,
        )
        for t in threads
    ]


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: int, session: Session = Depends(get_session)):
    thread = conversation_service.get_thread(session, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = [
        MessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            citations=json.loads(m.citations),
            created_at=m.created_at,
        )
        for m in sorted(thread.messages, key=lambda m: m.created_at)
    ]

    return ThreadDetail(
        id=thread.id,
        title=thread.title,
        jurisdiction=thread.jurisdiction,
        messages=messages,
        created_at=thread.created_at,
    )


@router.delete("/threads/{thread_id}", status_code=204)
def delete_thread_endpoint(thread_id: int, session: Session = Depends(get_session)):
    deleted = conversation_service.delete_thread(session, thread_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thread not found")
    return JSONResponse(status_code=204, content=None)
