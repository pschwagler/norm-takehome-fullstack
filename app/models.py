from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField, Relationship, SQLModel


class Jurisdiction(str, Enum):
    """Valid jurisdictions for the Westeros legal system."""

    KINGDOM_WIDE = "Kingdom-wide"
    THE_NORTH = "The North"
    THE_REACH = "The Reach"
    THE_VALE = "The Vale"
    THE_WESTERLANDS = "The Westerlands"
    THE_RIVERLANDS = "The Riverlands"
    THE_STORMLANDS = "The Stormlands"
    DORNE = "Dorne"
    THE_IRON_ISLANDS = "The Iron Islands"
    THE_CROWNLANDS = "The Crownlands"
    KINGS_LANDING = "King's Landing"
    OLDTOWN = "Oldtown"
    LANNISPORT = "Lannisport"
    WHITE_HARBOR = "White Harbor"


# --- SQLModel table models ---


class LegislationDocument(SQLModel, table=True):
    __tablename__ = "legislation_documents"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    name: str
    file_name: str
    file_path: str
    jurisdiction: str = SQLField(default="Kingdom-wide")
    uploaded_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None

    laws: list["Law"] = Relationship(back_populates="document")


class Law(SQLModel, table=True):
    __tablename__ = "laws"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    document_id: int = SQLField(foreign_key="legislation_documents.id")
    section: str
    topic: str
    section_title: Optional[str] = None
    text: str
    jurisdiction: str
    created_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)

    document: Optional[LegislationDocument] = Relationship(back_populates="laws")


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    query: str
    response: str
    citations: str  # JSON-serialized list
    jurisdiction: Optional[str] = None
    created_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)


# --- API schemas (Pydantic only, not SQLModel tables) ---


class Citation(BaseModel):
    source: str
    text: str
    document_name: Optional[str] = None
    jurisdiction: Optional[str] = None


class Output(BaseModel):
    query: str
    response: str
    citations: list[Citation]


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    jurisdiction: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    documents_loaded: int
    laws_indexed: int


class LawResponse(BaseModel):
    id: int
    section: str
    topic: str
    section_title: Optional[str]
    text: str
    jurisdiction: str
    document_id: int


class LawGroupResponse(BaseModel):
    topic: str
    section_title: Optional[str] = None
    laws: list[LawResponse]


class DocumentUploadResponse(BaseModel):
    id: int
    name: str
    file_name: str
    laws_count: int
    uploaded_at: datetime


class DocumentResponse(BaseModel):
    id: int
    name: str
    file_name: str
    jurisdiction: str
    laws_count: int
    uploaded_at: datetime
    uploaded_by: Optional[str]


class ConversationSummary(BaseModel):
    id: int
    query: str
    jurisdiction: Optional[str]
    created_at: datetime


class ConversationResponse(BaseModel):
    id: int
    query: str
    response: str
    citations: list[Citation]
    jurisdiction: Optional[str]
    created_at: datetime
