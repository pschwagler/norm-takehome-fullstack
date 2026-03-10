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
from app.database import get_session
from app.document_service import DocumentService
from app.models import (
    Citation,
    ConversationResponse,
    ConversationSummary,
    DocumentResponse,
    DocumentUploadResponse,
    HealthResponse,
    Law,
    LawGroupResponse,
    LawResponse,
    LegislationDocument,
    Output,
    QueryRequest,
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
doc_service = DocumentService()


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
    doc_count = session.exec(
        select(func.count(LegislationDocument.id))
    ).one()
    law_count = session.exec(select(func.count(Law.id))).one()
    return HealthResponse(
        status="ok",
        documents_loaded=doc_count,
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

            async for token, citation_list in qdrant_service.aquery(
                request.query, jurisdiction
            ):
                if citation_list is not None:
                    citations = citation_list
                elif token is not None:
                    full_response += token
                    yield _sse(json.dumps({"data": token}), "token")

            # Send citations
            yield _sse(
                json.dumps(
                    {"data": [c.model_dump() for c in citations]}
                ),
                "citations",
            )

            # Send complete output
            output = Output(
                query=request.query,
                response=full_response,
                citations=citations,
            )
            yield _sse(output.model_dump_json(), "done")

            # Fire-and-forget: save conversation
            try:
                from app.database import engine

                with Session(engine) as session:
                    conversation_service.create_conversation(
                        session=session,
                        query=request.query,
                        response=full_response,
                        citations=citations,
                        jurisdiction=jurisdiction,
                    )
            except Exception:
                logger.exception("Failed to save conversation")

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
    document_id: Optional[int] = None,
    jurisdiction: Optional[str] = None,
    session: Session = Depends(get_session),
):
    statement = select(Law)
    if document_id is not None:
        statement = statement.where(Law.document_id == document_id)
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
                    document_id=law.document_id,
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
        document_id=law.document_id,
    )


# --- Documents ---


@app.post("/documents", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    jurisdiction: str = Form("Kingdom-wide"),
    session: Session = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400, detail="File exceeds 10MB limit"
        )

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse PDF
    try:
        parsed_laws = doc_service.create_documents(file_path)
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
    document = LegislationDocument(
        name=name,
        file_name=file.filename,
        file_path=file_path,
        jurisdiction=jurisdiction,
    )
    session.add(document)
    session.commit()
    session.refresh(document)

    for parsed in parsed_laws:
        law = Law(
            document_id=document.id,
            section=parsed.section,
            topic=parsed.topic,
            section_title=parsed.section_title,
            text=parsed.text,
            jurisdiction=jurisdiction,
        )
        session.add(law)
    session.commit()

    # Index into Qdrant
    leaf_nodes, all_nodes = doc_service.create_nodes(
        parsed_laws, document.id, document.name, jurisdiction
    )
    qdrant_service.load(leaf_nodes, all_nodes)

    logger.info(
        "Uploaded document",
        extra={
            "document_id": document.id,
            "name": name,
            "laws_count": len(parsed_laws),
        },
    )

    return DocumentUploadResponse(
        id=document.id,
        name=document.name,
        file_name=document.file_name,
        laws_count=len(parsed_laws),
        uploaded_at=document.uploaded_at,
    )


@app.get("/documents", response_model=list[DocumentResponse])
def get_documents(session: Session = Depends(get_session)):
    documents = list(session.exec(select(LegislationDocument)).all())
    result = []
    for doc in documents:
        law_count = session.exec(
            select(func.count(Law.id)).where(Law.document_id == doc.id)
        ).one()
        result.append(
            DocumentResponse(
                id=doc.id,
                name=doc.name,
                file_name=doc.file_name,
                jurisdiction=doc.jurisdiction,
                laws_count=law_count,
                uploaded_at=doc.uploaded_at,
                uploaded_by=doc.uploaded_by,
            )
        )
    return result


@app.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, session: Session = Depends(get_session)):
    doc = session.get(LegislationDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    law_count = session.exec(
        select(func.count(Law.id)).where(Law.document_id == doc.id)
    ).one()
    return DocumentResponse(
        id=doc.id,
        name=doc.name,
        file_name=doc.file_name,
        jurisdiction=doc.jurisdiction,
        laws_count=law_count,
        uploaded_at=doc.uploaded_at,
        uploaded_by=doc.uploaded_by,
    )


@app.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int, session: Session = Depends(get_session)
):
    doc = session.get(LegislationDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from Qdrant
    qdrant_service.delete_document(document_id)

    # Delete laws from DB
    laws = list(
        session.exec(select(Law).where(Law.document_id == document_id)).all()
    )
    for law in laws:
        session.delete(law)

    # Delete document from DB
    session.delete(doc)
    session.commit()

    # Delete file from filesystem
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    logger.info("Deleted document", extra={"document_id": document_id})
    return JSONResponse(status_code=204, content=None)


# --- Conversations ---


@app.get("/conversations", response_model=list[ConversationSummary])
def get_conversations(
    limit: int = 50, session: Session = Depends(get_session)
):
    conversations = conversation_service.list_conversations(session, limit)
    return [
        ConversationSummary(
            id=c.id,
            query=c.query,
            jurisdiction=c.jurisdiction,
            created_at=c.created_at,
        )
        for c in conversations
    ]


@app.get(
    "/conversations/{conversation_id}", response_model=ConversationResponse
)
def get_conversation(
    conversation_id: int, session: Session = Depends(get_session)
):
    conv = conversation_service.get_conversation(session, conversation_id)
    if conv is None:
        raise HTTPException(
            status_code=404, detail="Conversation not found"
        )
    citations = [Citation(**c) for c in json.loads(conv.citations)]
    return ConversationResponse(
        id=conv.id,
        query=conv.query,
        response=conv.response,
        citations=citations,
        jurisdiction=conv.jurisdiction,
        created_at=conv.created_at,
    )


@app.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation_endpoint(
    conversation_id: int, session: Session = Depends(get_session)
):
    deleted = conversation_service.delete_conversation(
        session, conversation_id
    )
    if not deleted:
        raise HTTPException(
            status_code=404, detail="Conversation not found"
        )
    return JSONResponse(status_code=204, content=None)
