import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse
from pythonjsonlogger import json as jsonlog
from sqlmodel import Session, func, select

from app import conversation_service
from app.citation_filter import filter_relevant_citations
from app.database import get_session
from app.legislation_service import LegislationService
from app.models import (
    Citation,
    HealthResponse,
    Law,
    LawGroupResponse,
    LawResponse,
    Legislation,
    LegislationResponse,
    LegislationUploadResponse,
    MessageResponse,
    Output,
    QueryRequest,
    ThreadDetail,
    ThreadSummary,
)
from app.qdrant_service import QdrantService, detect_jurisdiction
from app.startup import UPLOAD_DIR, startup

_handler = logging.StreamHandler()
_handler.setFormatter(
    jsonlog.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )
)
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(__name__)

qdrant_service = QdrantService()
legislation_service = LegislationService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup(qdrant_service)
    yield


app = FastAPI(title="Westeros Legal Compliance Assistant", lifespan=lifespan)

# CORS
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---


@app.get("/health", response_model=HealthResponse)
def health(session: Session = Depends(get_session)):
    legislation_count = session.exec(select(func.count(Legislation.id))).one()
    law_count = session.exec(select(func.count(Law.id))).one()
    return HealthResponse(
        status="ok",
        legislation_loaded=legislation_count,
        laws_indexed=law_count,
    )


# --- SSE helper ---


def _sse(data: str, event: str) -> str:
    """Format a Server-Sent Event as a string."""
    return f"event: {event}\ndata: {data}\n\n"


# --- Query ---


@app.post("/query")
async def query_laws(request: QueryRequest):
    jurisdiction = request.jurisdiction or detect_jurisdiction(request.query)

    async def event_generator():
        try:
            full_response = ""
            citations: list[Citation] = []

            # Load chat history if thread_id provided
            chat_history: list[tuple[str, str]] = []
            if request.thread_id is not None:
                from app.database import engine

                with Session(engine) as session:
                    chat_history = conversation_service.get_thread_history(
                        session, request.thread_id
                    )

            async for token, citation_list in qdrant_service.aquery(
                request.query, jurisdiction, chat_history
            ):
                if citation_list is not None:
                    citations = citation_list
                elif token is not None:
                    full_response += token
                    yield _sse(json.dumps({"data": token}), "token")

            # Filter citations for relevance
            citations = await filter_relevant_citations(
                request.query, full_response, citations
            )

            # Send citations
            yield _sse(
                json.dumps({"data": [c.model_dump() for c in citations]}),
                "citations",
            )

            # Persist thread + messages
            thread_id = request.thread_id
            try:
                from app.database import engine

                with Session(engine) as session:
                    if thread_id is None:
                        thread = conversation_service.create_thread(
                            session=session,
                            first_query=request.query,
                            jurisdiction=jurisdiction,
                        )
                        thread_id = thread.id

                    conversation_service.add_message(
                        session=session,
                        thread_id=thread_id,
                        role="user",
                        content=request.query,
                    )
                    conversation_service.add_message(
                        session=session,
                        thread_id=thread_id,
                        role="assistant",
                        content=full_response,
                        citations=citations,
                    )
            except Exception:
                logger.exception("Failed to save thread/messages")

            # Send done with thread_id
            done_payload = Output(
                query=request.query,
                response=full_response,
                citations=citations,
            ).model_dump()
            done_payload["thread_id"] = thread_id
            yield _sse(json.dumps(done_payload), "done")

        except Exception as e:
            logger.exception("Query failed")
            yield _sse(json.dumps({"detail": str(e)}), "error")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


# --- Laws ---


@app.get("/laws", response_model=list[LawGroupResponse])
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
            laws=[
                LawResponse(
                    id=law.id,
                    section=law.section,
                    topic=law.topic,
                    section_title=law.section_title,
                    text=law.text,
                    jurisdiction=law.jurisdiction,
                    legislation_id=law.legislation_id,
                )
                for law in grouped[topic]
            ],
        )
        for topic in topic_order
    ]


@app.get("/laws/{law_id}", response_model=LawResponse)
def get_law(law_id: int, session: Session = Depends(get_session)):
    law = session.get(Law, law_id)
    if law is None:
        raise HTTPException(status_code=404, detail="Law not found")
    return LawResponse(
        id=law.id,
        section=law.section,
        topic=law.topic,
        section_title=law.section_title,
        text=law.text,
        jurisdiction=law.jurisdiction,
        legislation_id=law.legislation_id,
    )


# --- Legislation ---


@app.post("/legislation", response_model=LegislationUploadResponse, status_code=201)
async def upload_legislation(
    file: UploadFile = File(...),
    name: str = Form(...),
    jurisdiction: str = Form("Kingdom-wide"),
    session: Session = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse PDF
    try:
        parsed_laws = legislation_service.create_legislation(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail=f"Could not extract any laws from PDF: {e}",
        )

    if not parsed_laws:
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail="Could not extract any laws from PDF",
        )

    # Persist to database
    legislation = Legislation(
        name=name,
        file_name=file.filename,
        file_path=file_path,
        jurisdiction=jurisdiction,
    )
    session.add(legislation)
    session.commit()
    session.refresh(legislation)

    for parsed in parsed_laws:
        law = Law(
            legislation_id=legislation.id,
            section=parsed.section,
            topic=parsed.topic,
            section_title=parsed.section_title,
            text=parsed.text,
            jurisdiction=jurisdiction,
        )
        session.add(law)
    session.commit()

    # Index into Qdrant
    leaf_nodes, all_nodes = legislation_service.create_nodes(
        parsed_laws, legislation.id, legislation.name, jurisdiction
    )
    qdrant_service.load(leaf_nodes, all_nodes)

    logger.info(
        "Uploaded legislation",
        extra={
            "legislation_id": legislation.id,
            "name": name,
            "laws_count": len(parsed_laws),
        },
    )

    return LegislationUploadResponse(
        id=legislation.id,
        name=legislation.name,
        file_name=legislation.file_name,
        laws_count=len(parsed_laws),
        uploaded_at=legislation.uploaded_at,
    )


@app.get("/legislation", response_model=list[LegislationResponse])
def get_legislation_list(session: Session = Depends(get_session)):
    legislation_list = list(session.exec(select(Legislation)).all())
    result = []
    for legislation in legislation_list:
        law_count = session.exec(
            select(func.count(Law.id)).where(Law.legislation_id == legislation.id)
        ).one()
        result.append(
            LegislationResponse(
                id=legislation.id,
                name=legislation.name,
                file_name=legislation.file_name,
                jurisdiction=legislation.jurisdiction,
                laws_count=law_count,
                uploaded_at=legislation.uploaded_at,
                uploaded_by=legislation.uploaded_by,
            )
        )
    return result


@app.get("/legislation/{legislation_id}", response_model=LegislationResponse)
def get_legislation(legislation_id: int, session: Session = Depends(get_session)):
    legislation = session.get(Legislation, legislation_id)
    if legislation is None:
        raise HTTPException(status_code=404, detail="Legislation not found")
    law_count = session.exec(
        select(func.count(Law.id)).where(Law.legislation_id == legislation.id)
    ).one()
    return LegislationResponse(
        id=legislation.id,
        name=legislation.name,
        file_name=legislation.file_name,
        jurisdiction=legislation.jurisdiction,
        laws_count=law_count,
        uploaded_at=legislation.uploaded_at,
        uploaded_by=legislation.uploaded_by,
    )


@app.delete("/legislation/{legislation_id}", status_code=204)
def delete_legislation(legislation_id: int, session: Session = Depends(get_session)):
    legislation = session.get(Legislation, legislation_id)
    if legislation is None:
        raise HTTPException(status_code=404, detail="Legislation not found")

    # Delete from Qdrant
    qdrant_service.delete_legislation(legislation_id)

    # Delete laws from DB
    laws = list(
        session.exec(select(Law).where(Law.legislation_id == legislation_id)).all()
    )
    for law in laws:
        session.delete(law)

    # Delete legislation from DB
    session.delete(legislation)
    session.commit()

    # Delete file from filesystem
    if os.path.exists(legislation.file_path):
        os.remove(legislation.file_path)

    logger.info("Deleted legislation", extra={"legislation_id": legislation_id})
    return JSONResponse(status_code=204, content=None)


# --- Threads ---


@app.get("/threads", response_model=list[ThreadSummary])
def get_threads(limit: int = 50, session: Session = Depends(get_session)):
    threads = conversation_service.list_threads(session, limit)
    return [
        ThreadSummary(
            id=t.id,
            title=t.title,
            jurisdiction=t.jurisdiction,
            message_count=conversation_service.get_thread_message_count(session, t.id),
            created_at=t.created_at,
        )
        for t in threads
    ]


@app.get("/threads/{thread_id}", response_model=ThreadDetail)
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


@app.delete("/threads/{thread_id}", status_code=204)
def delete_thread_endpoint(thread_id: int, session: Session = Depends(get_session)):
    deleted = conversation_service.delete_thread(session, thread_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thread not found")
    return JSONResponse(status_code=204, content=None)
