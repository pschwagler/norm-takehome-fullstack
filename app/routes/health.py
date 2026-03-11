from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.database import get_session
from app.models import HealthResponse, Law, Legislation

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(session: Session = Depends(get_session)):
    legislation_count = session.exec(select(func.count(Legislation.id))).one()
    law_count = session.exec(select(func.count(Law.id))).one()
    return HealthResponse(
        status="ok",
        legislation_loaded=legislation_count,
        laws_indexed=law_count,
    )
