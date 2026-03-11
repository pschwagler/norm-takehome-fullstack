import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlmodel import Session, func, select

from app.database import get_session
from app.legislation_service import LegislationService
from app.models import Law, Legislation, LegislationResponse, LegislationUploadResponse
from app.qdrant_service import QdrantService
from app.startup import UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter()

# Injected by main.py at startup
qdrant_service: QdrantService | None = None
legislation_service: LegislationService | None = None


def init(qs: QdrantService, ls: LegislationService) -> None:
    """Inject shared service instances from the app entrypoint."""
    global qdrant_service, legislation_service
    qdrant_service = qs
    legislation_service = ls


def _legislation_to_response(
    legislation: Legislation, law_count: int
) -> LegislationResponse:
    """Convert a Legislation ORM model to its API response schema."""
    return LegislationResponse(
        id=legislation.id,
        name=legislation.name,
        file_name=legislation.file_name,
        jurisdiction=legislation.jurisdiction,
        laws_count=law_count,
        uploaded_at=legislation.uploaded_at,
        uploaded_by=legislation.uploaded_by,
    )


def _count_laws(session: Session, legislation_id: int) -> int:
    """Return the number of laws belonging to a legislation entry."""
    return session.exec(
        select(func.count(Law.id)).where(Law.legislation_id == legislation_id)
    ).one()


@router.post("/legislation", response_model=LegislationUploadResponse, status_code=201)
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

    # Save file (sanitize filename to prevent path traversal)
    safe_name = os.path.basename(file.filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, safe_name)
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
        file_name=safe_name,
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


@router.get("/legislation", response_model=list[LegislationResponse])
def get_legislation_list(session: Session = Depends(get_session)):
    legislation_list = list(session.exec(select(Legislation)).all())
    return [
        _legislation_to_response(leg, _count_laws(session, leg.id))
        for leg in legislation_list
    ]


@router.get("/legislation/{legislation_id}", response_model=LegislationResponse)
def get_legislation(legislation_id: int, session: Session = Depends(get_session)):
    legislation = session.get(Legislation, legislation_id)
    if legislation is None:
        raise HTTPException(status_code=404, detail="Legislation not found")
    return _legislation_to_response(
        legislation, _count_laws(session, legislation.id)
    )


@router.delete("/legislation/{legislation_id}", status_code=204)
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
