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


class Legislation(SQLModel, table=True):
    __tablename__ = "legislation"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    name: str
    file_name: str
    file_path: str
    jurisdiction: str = SQLField(default="Kingdom-wide")
    uploaded_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None

    laws: list["Law"] = Relationship(back_populates="legislation")


class Law(SQLModel, table=True):
    __tablename__ = "laws"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    legislation_id: int = SQLField(foreign_key="legislation.id")
    section: str
    topic: str
    section_title: Optional[str] = None
    text: str
    jurisdiction: str
    created_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)

    legislation: Optional[Legislation] = Relationship(back_populates="laws")


class Thread(SQLModel, table=True):
    __tablename__ = "threads"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    title: str
    jurisdiction: Optional[str] = None
    created_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)

    messages: list["Message"] = Relationship(
        back_populates="thread",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    thread_id: int = SQLField(foreign_key="threads.id")
    role: str  # "user" | "assistant"
    content: str
    citations: str = SQLField(default="[]")  # JSON-serialized list
    created_at: Optional[datetime] = SQLField(default_factory=datetime.utcnow)

    thread: Optional[Thread] = Relationship(back_populates="messages")


# --- API schemas (Pydantic only, not SQLModel tables) ---


class Citation(BaseModel):
    source: str
    text: str
    legislation_name: Optional[str] = None
    jurisdiction: Optional[str] = None


class Output(BaseModel):
    query: str
    response: str
    citations: list[Citation]


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    jurisdiction: Optional[str] = None
    thread_id: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    legislation_loaded: int
    laws_indexed: int


class LawResponse(BaseModel):
    id: int
    section: str
    topic: str
    section_title: Optional[str]
    text: str
    jurisdiction: str
    legislation_id: int


class LawGroupResponse(BaseModel):
    topic: str
    section_title: Optional[str] = None
    laws: list[LawResponse]


class LegislationUploadResponse(BaseModel):
    id: int
    name: str
    file_name: str
    laws_count: int
    uploaded_at: datetime


class LegislationResponse(BaseModel):
    id: int
    name: str
    file_name: str
    jurisdiction: str
    laws_count: int
    uploaded_at: datetime
    uploaded_by: Optional[str]


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: list[Citation]
    created_at: datetime


class ThreadSummary(BaseModel):
    id: int
    title: str
    jurisdiction: Optional[str]
    message_count: int
    created_at: datetime


class ThreadDetail(BaseModel):
    id: int
    title: str
    jurisdiction: Optional[str]
    messages: list[MessageResponse]
    created_at: datetime
