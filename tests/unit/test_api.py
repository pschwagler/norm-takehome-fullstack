import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.models import (
    Citation,
    Conversation,
    Law,
    LegislationDocument,
    Output,
)


@pytest.fixture
def test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def mock_qdrant():
    mock = MagicMock()
    mock.query.return_value = Output(
        query="test",
        response="Test response",
        citations=[
            Citation(
                source="1.1",
                text="Test law text",
                document_name="Laws of the Seven Kingdoms",
                jurisdiction="Kingdom-wide",
            )
        ],
    )

    async def mock_aquery(query_str, jurisdiction=None):
        yield "Test ", None
        yield "response", None
        yield None, [
            Citation(
                source="1.1",
                text="Test law text",
                document_name="Laws of the Seven Kingdoms",
                jurisdiction="Kingdom-wide",
            )
        ]

    mock.aquery = mock_aquery
    return mock


@pytest.fixture
def client(test_engine, mock_qdrant):
    import app.main as app_module
    from app.database import get_session

    fastapi_app = app_module.app

    def override_session():
        with Session(test_engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session

    original_qdrant = app_module.qdrant_service
    app_module.qdrant_service = mock_qdrant

    with patch("app.main.startup"):
        with patch("app.database.engine", test_engine):
            with TestClient(fastapi_app, raise_server_exceptions=False) as c:
                yield c

    app_module.qdrant_service = original_qdrant
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(client, test_engine):
    """Client with seed data in the database."""
    with Session(test_engine) as session:
        doc = LegislationDocument(
            name="Laws of the Seven Kingdoms",
            file_name="laws.pdf",
            file_path="data/uploads/laws.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)

        law = Law(
            document_id=doc.id,
            section="1.1",
            topic="Peace",
            text="The law requires petty lords...",
            jurisdiction="Kingdom-wide",
        )
        session.add(law)

        conv = Conversation(
            query="What about peace?",
            response="According to Section 1.1...",
            citations=json.dumps(
                [
                    {
                        "source": "1.1",
                        "text": "The law requires...",
                        "document_name": "Laws of the Seven Kingdoms",
                        "jurisdiction": "Kingdom-wide",
                    }
                ]
            ),
            jurisdiction=None,
        )
        session.add(conv)
        session.commit()
    return client


# --- Health ---


def test_health_endpoint(seeded_client):
    response = seeded_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["documents_loaded"] >= 1
    assert data["laws_indexed"] >= 1


# --- Query ---


def test_query_valid(client):
    response = client.post(
        "/query",
        json={"query": "what happens if I steal?"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]


def test_query_empty_string(client):
    response = client.post("/query", json={"query": ""})
    assert response.status_code == 422


def test_query_missing_body(client):
    response = client.post("/query")
    assert response.status_code == 422


# --- Laws ---


def test_get_laws_returns_list(seeded_client):
    response = seeded_client.get("/laws")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "topic" in data[0]
    assert "laws" in data[0]


def test_get_laws_filter_by_document(seeded_client):
    response = seeded_client.get("/laws?document_id=1")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_law_by_id(seeded_client):
    response = seeded_client.get("/laws/1")
    assert response.status_code == 200
    data = response.json()
    assert data["section"] == "1.1"


def test_get_law_not_found(client):
    response = client.get("/laws/999")
    assert response.status_code == 404


# --- Documents ---


def test_get_documents_list(seeded_client):
    response = seeded_client.get("/documents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "laws_count" in data[0]


def test_get_document_by_id(seeded_client):
    response = seeded_client.get("/documents/1")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Laws of the Seven Kingdoms"


def test_get_document_not_found(client):
    response = client.get("/documents/999")
    assert response.status_code == 404


def test_delete_document(seeded_client, mock_qdrant):
    response = seeded_client.delete("/documents/1")
    assert response.status_code == 204

    response = seeded_client.get("/documents/1")
    assert response.status_code == 404


def test_delete_document_not_found(client):
    response = client.delete("/documents/999")
    assert response.status_code == 404


def test_upload_document_non_pdf(client):
    response = client.post(
        "/documents",
        files={"file": ("test.txt", b"hello", "text/plain")},
        data={"name": "Test", "jurisdiction": "Kingdom-wide"},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_upload_document_valid_pdf(client, mock_qdrant, tmp_path):
    from app.pdf_parser import ParsedLaw

    mock_parsed = [
        ParsedLaw(
            section="1.1",
            topic="Peace",
            section_title=None,
            text="All lords shall keep the peace.",
        ),
    ]

    with (
        patch("app.main.doc_service") as mock_doc_svc,
        patch("app.main.UPLOAD_DIR", str(tmp_path)),
    ):
        mock_doc_svc.create_documents.return_value = mock_parsed
        mock_doc_svc.create_nodes.return_value = ([], [])

        pdf_path = "docs/laws.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        response = client.post(
            "/documents",
            files={"file": ("laws.pdf", pdf_bytes, "application/pdf")},
            data={"name": "Test Laws", "jurisdiction": "Kingdom-wide"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Laws"
    assert data["file_name"] == "laws.pdf"
    assert data["laws_count"] == 1


# --- Conversations ---


def test_get_conversations_list(seeded_client):
    response = seeded_client.get("/conversations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "query" in data[0]
    # Summary should NOT include response/citations
    assert "response" not in data[0]


def test_get_conversation_by_id(seeded_client):
    response = seeded_client.get("/conversations/1")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "What about peace?"
    assert "response" in data
    assert "citations" in data
    assert len(data["citations"]) >= 1


def test_get_conversation_not_found(client):
    response = client.get("/conversations/999")
    assert response.status_code == 404


def test_delete_conversation(seeded_client):
    response = seeded_client.delete("/conversations/1")
    assert response.status_code == 204

    response = seeded_client.get("/conversations/1")
    assert response.status_code == 404


def test_delete_conversation_not_found(client):
    response = client.delete("/conversations/999")
    assert response.status_code == 404
