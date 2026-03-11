from unittest.mock import MagicMock, patch

import pytest

from app.qdrant_service import QdrantService


# ---------------------------------------------------------------------------
# QdrantService.connect()
# ---------------------------------------------------------------------------


def test_connect_sets_embed_model():
    svc = QdrantService()
    with (
        patch("app.qdrant_service.OpenAIEmbedding") as mock_embed_cls,
        patch("app.qdrant_service.qdrant_client.QdrantClient"),
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext"),
        patch("app.qdrant_service.Settings") as mock_settings,
    ):
        svc.connect()

    mock_embed_cls.assert_called_once()
    assert mock_settings.embed_model is not None


def test_connect_sets_llm_model_property():
    svc = QdrantService()
    with (
        patch("app.qdrant_service.OpenAIEmbedding"),
        patch("app.qdrant_service.qdrant_client.QdrantClient"),
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext"),
        patch("app.qdrant_service.Settings"),
    ):
        svc.connect()

    assert svc.llm_model == "gpt-5.2"


def test_connect_uses_env_model_names(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")
    monkeypatch.setenv("EMBEDDING_MODEL", "text-embedding-ada-002")
    svc = QdrantService()

    with (
        patch("app.qdrant_service.OpenAIEmbedding") as mock_embed_cls,
        patch("app.qdrant_service.qdrant_client.QdrantClient"),
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext"),
        patch("app.qdrant_service.Settings"),
    ):
        svc.connect()

    assert svc.llm_model == "gpt-4o"

    embed_call_kwargs = mock_embed_cls.call_args
    called_embed_model = (
        embed_call_kwargs[1].get("model")
        if embed_call_kwargs[1]
        else embed_call_kwargs[0][0]
    )
    assert called_embed_model == "text-embedding-ada-002"


def test_connect_creates_in_memory_qdrant():
    svc = QdrantService()
    with (
        patch("app.qdrant_service.OpenAIEmbedding"),
        patch("app.qdrant_service.qdrant_client.QdrantClient") as mock_qdrant_cls,
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext"),
        patch("app.qdrant_service.Settings"),
    ):
        svc.connect()

    mock_qdrant_cls.assert_called_once_with(location=":memory:")


def test_connect_populates_storage_context():
    svc = QdrantService()
    mock_ctx = MagicMock()

    with (
        patch("app.qdrant_service.OpenAIEmbedding"),
        patch("app.qdrant_service.qdrant_client.QdrantClient"),
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext") as mock_storage_cls,
        patch("app.qdrant_service.Settings"),
    ):
        mock_storage_cls.from_defaults.return_value = mock_ctx
        svc.connect()

    assert svc.storage_context is mock_ctx


# ---------------------------------------------------------------------------
# QdrantService.load()
# ---------------------------------------------------------------------------


def _connected_service():
    """Return a QdrantService whose connect() dependencies are all mocked."""
    svc = QdrantService()
    svc.storage_context = MagicMock()
    svc._docstore = MagicMock()
    svc._docstore.docs = {}
    svc._llm_model = "gpt-5.2"
    return svc


def test_load_raises_when_not_connected():
    svc = QdrantService()
    with pytest.raises(RuntimeError, match="connect()"):
        svc.load([], [])


def test_load_calls_add_documents_and_builds_index():
    svc = _connected_service()
    leaf = [MagicMock()]
    all_nodes = [MagicMock(), MagicMock()]

    mock_index = MagicMock()
    with patch("app.qdrant_service.VectorStoreIndex") as mock_index_cls:
        mock_index_cls.return_value = mock_index
        svc.load(leaf, all_nodes)

    svc._docstore.add_documents.assert_called_once_with(all_nodes)
    mock_index_cls.assert_called_once_with(leaf, storage_context=svc.storage_context)
    assert svc.index is mock_index


def test_load_empty_nodes():
    svc = _connected_service()
    with patch("app.qdrant_service.VectorStoreIndex") as mock_index_cls:
        mock_index_cls.return_value = MagicMock()
        svc.load([], [])

    svc._docstore.add_documents.assert_called_once_with([])


# ---------------------------------------------------------------------------
# QdrantService.delete_legislation()
# ---------------------------------------------------------------------------


def _indexed_service():
    """Return a service with index and storage_context already set."""
    svc = _connected_service()
    svc.index = MagicMock()
    return svc


def test_delete_legislation_when_client_is_none():
    """Should silently return when _client is None (no connection)."""
    svc = QdrantService()
    svc._client = None
    svc.delete_legislation(42)


def test_delete_legislation_calls_qdrant_delete():
    svc = _indexed_service()
    svc._client = MagicMock()
    svc._docstore.docs = {}

    svc.delete_legislation(7)

    svc._client.delete.assert_called_once()
    call_kwargs = svc._client.delete.call_args[1]
    assert call_kwargs["collection_name"] == "legislation"


def test_delete_legislation_removes_from_docstore():
    svc = _indexed_service()
    svc._client = MagicMock()

    doc_a = MagicMock()
    doc_a.metadata = {"legislation_id": 7}
    doc_b = MagicMock()
    doc_b.metadata = {"legislation_id": 99}

    svc._docstore.docs = {"node-a": doc_a, "node-b": doc_b}

    svc.delete_legislation(7)

    svc._docstore.delete_document.assert_called_once_with("node-a")


def test_delete_legislation_no_matching_docs():
    svc = _indexed_service()
    svc._client = MagicMock()

    doc_a = MagicMock()
    doc_a.metadata = {"legislation_id": 99}
    svc._docstore.docs = {"node-a": doc_a}

    svc.delete_legislation(7)

    svc._docstore.delete_document.assert_not_called()


def test_delete_legislation_none_docstore():
    svc = _indexed_service()
    svc._client = MagicMock()
    svc._docstore = None

    svc.delete_legislation(7)

    svc._client.delete.assert_called_once()
