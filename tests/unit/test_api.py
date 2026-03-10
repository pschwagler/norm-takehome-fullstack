import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.models import (
    Citation,
    Law,
    Legislation,
    Message,
    Output,
    Thread,
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
                legislation_name="Laws of the Seven Kingdoms",
                jurisdiction="Kingdom-wide",
            )
        ],
    )

    async def mock_aquery(query_str, jurisdiction=None, chat_history=None):
        yield "Test ", None
        yield "response", None
        yield (
            None,
            [
                Citation(
                    source="1.1",
                    text="Test law text",
                    legislation_name="Laws of the Seven Kingdoms",
                    jurisdiction="Kingdom-wide",
                )
            ],
        )

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
            with patch(
                "app.main.filter_relevant_citations",
                new_callable=AsyncMock,
                side_effect=lambda q, r, c: c,
            ):
                with TestClient(fastapi_app, raise_server_exceptions=False) as c:
                    yield c

    app_module.qdrant_service = original_qdrant
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(client, test_engine):
    """Client with seed data in the database."""
    with Session(test_engine) as session:
        legislation = Legislation(
            name="Laws of the Seven Kingdoms",
            file_name="laws.pdf",
            file_path="data/uploads/laws.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(legislation)
        session.commit()
        session.refresh(legislation)

        law = Law(
            legislation_id=legislation.id,
            section="1.1",
            topic="Peace",
            text="The law requires petty lords...",
            jurisdiction="Kingdom-wide",
        )
        session.add(law)

        thread = Thread(
            title="What about peace?",
            jurisdiction=None,
        )
        session.add(thread)
        session.commit()
        session.refresh(thread)

        user_msg = Message(
            thread_id=thread.id,
            role="user",
            content="What about peace?",
            citations="[]",
        )
        session.add(user_msg)

        assistant_msg = Message(
            thread_id=thread.id,
            role="assistant",
            content="According to Section 1.1...",
            citations=json.dumps(
                [
                    {
                        "source": "1.1",
                        "text": "The law requires...",
                        "legislation_name": "Laws of the Seven Kingdoms",
                        "jurisdiction": "Kingdom-wide",
                    }
                ]
            ),
        )
        session.add(assistant_msg)
        session.commit()
    return client


# --- Health ---


def test_health_endpoint(seeded_client):
    response = seeded_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["legislation_loaded"] >= 1
    assert data["laws_indexed"] >= 1


# --- Query ---


def test_query_valid(client):
    response = client.post(
        "/query",
        json={"query": "what happens if I steal?"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]


def test_query_with_thread_id(seeded_client):
    response = seeded_client.post(
        "/query",
        json={"query": "tell me more", "thread_id": 1},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]


def test_query_empty_string(client):
    response = client.post("/query", json={"query": ""})
    assert response.status_code == 422


def test_query_missing_body(client):
    response = client.post("/query")
    assert response.status_code == 422


def test_query_creates_thread(client, test_engine):
    """POST /query without thread_id should create a new thread."""
    response = client.post(
        "/query",
        json={"query": "What are the trade laws?"},
    )
    assert response.status_code == 200

    # Parse SSE events to find done event with thread_id
    events = response.text.split("\n\n")
    done_event = None
    for event in events:
        if "event: done" in event:
            data_line = [
                line for line in event.split("\n") if line.startswith("data:")
            ][0]
            done_event = json.loads(data_line[5:])
            break

    assert done_event is not None
    assert "thread_id" in done_event
    assert done_event["thread_id"] is not None


# --- Laws ---


def test_get_laws_returns_list(seeded_client):
    response = seeded_client.get("/laws")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "topic" in data[0]
    assert "laws" in data[0]


def test_get_laws_filter_by_legislation(seeded_client):
    response = seeded_client.get("/laws?legislation_id=1")
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


# --- Legislation ---


def test_get_legislation_list(seeded_client):
    response = seeded_client.get("/legislation")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "laws_count" in data[0]


def test_get_legislation_by_id(seeded_client):
    response = seeded_client.get("/legislation/1")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Laws of the Seven Kingdoms"


def test_get_legislation_not_found(client):
    response = client.get("/legislation/999")
    assert response.status_code == 404


def test_delete_legislation(seeded_client, mock_qdrant):
    response = seeded_client.delete("/legislation/1")
    assert response.status_code == 204

    response = seeded_client.get("/legislation/1")
    assert response.status_code == 404


def test_delete_legislation_not_found(client):
    response = client.delete("/legislation/999")
    assert response.status_code == 404


def test_upload_legislation_non_pdf(client):
    response = client.post(
        "/legislation",
        files={"file": ("test.txt", b"hello", "text/plain")},
        data={"name": "Test", "jurisdiction": "Kingdom-wide"},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_upload_legislation_valid_pdf(client, mock_qdrant, tmp_path):
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
        patch("app.main.legislation_service") as mock_legislation_svc,
        patch("app.main.UPLOAD_DIR", str(tmp_path)),
    ):
        mock_legislation_svc.create_legislation.return_value = mock_parsed
        mock_legislation_svc.create_nodes.return_value = ([], [])

        pdf_path = "docs/laws.pdf"
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        response = client.post(
            "/legislation",
            files={"file": ("laws.pdf", pdf_bytes, "application/pdf")},
            data={"name": "Test Laws", "jurisdiction": "Kingdom-wide"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Laws"
    assert data["file_name"] == "laws.pdf"
    assert data["laws_count"] == 1


# --- Threads ---


def test_get_threads_list(seeded_client):
    response = seeded_client.get("/threads")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "title" in data[0]
    assert "message_count" in data[0]
    assert data[0]["message_count"] == 2


def test_get_thread_by_id(seeded_client):
    response = seeded_client.get("/threads/1")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "What about peace?"
    assert "messages" in data
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"
    assert len(data["messages"][1]["citations"]) >= 1


def test_get_thread_not_found(client):
    response = client.get("/threads/999")
    assert response.status_code == 404


def test_delete_thread(seeded_client):
    response = seeded_client.delete("/threads/1")
    assert response.status_code == 204

    response = seeded_client.get("/threads/1")
    assert response.status_code == 404


def test_delete_thread_not_found(client):
    response = client.delete("/threads/999")
    assert response.status_code == 404


# --- Citation filter integration ---


def test_query_calls_citation_filter(test_engine, mock_qdrant):
    import app.main as app_module
    from app.database import get_session

    fastapi_app = app_module.app

    def override_session():
        with Session(test_engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session

    original_qdrant = app_module.qdrant_service
    app_module.qdrant_service = mock_qdrant

    mock_filter = AsyncMock(side_effect=lambda q, r, c: c)

    with patch("app.main.startup"):
        with patch("app.database.engine", test_engine):
            with patch("app.main.filter_relevant_citations", mock_filter):
                with TestClient(fastapi_app, raise_server_exceptions=False) as c:
                    c.post(
                        "/query",
                        json={"query": "What are the trade laws?"},
                    )

    mock_filter.assert_called_once()
    args = mock_filter.call_args[0]
    assert args[0] == "What are the trade laws?"
    assert "Test response" in args[1]
    assert len(args[2]) == 1
    assert args[2][0].source == "1.1"

    app_module.qdrant_service = original_qdrant
    fastapi_app.dependency_overrides.clear()


def test_query_filter_failure_still_streams(test_engine, mock_qdrant):
    import app.main as app_module
    from app.database import get_session

    fastapi_app = app_module.app

    def override_session():
        with Session(test_engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session

    original_qdrant = app_module.qdrant_service
    app_module.qdrant_service = mock_qdrant

    mock_filter = AsyncMock(side_effect=RuntimeError("filter exploded"))

    with patch("app.main.startup"):
        with patch("app.database.engine", test_engine):
            with patch("app.main.filter_relevant_citations", mock_filter):
                with TestClient(fastapi_app, raise_server_exceptions=False) as c:
                    response = c.post(
                        "/query",
                        json={"query": "What are the trade laws?"},
                    )

    assert response.status_code == 200
    # The error event should appear since the filter exception
    # propagates inside event_generator's try block
    text = response.text
    assert "event: error" in text or "event: done" in text

    app_module.qdrant_service = original_qdrant
    fastapi_app.dependency_overrides.clear()
