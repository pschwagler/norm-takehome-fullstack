from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from app.models import Jurisdiction
from app.qdrant_service import (
    QdrantService,
    _condense_question,
    _extract_citations,
    _resolve_jurisdiction_hierarchy,
    detect_jurisdiction,
)


# ---------------------------------------------------------------------------
# _condense_question
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_condense_question_no_history():
    """Empty or None history returns query unchanged, no LLM call."""
    result = await _condense_question("gpt-4.1", None, "What are the trade laws?")
    assert result == "What are the trade laws?"


@pytest.mark.asyncio
async def test_condense_question_empty_history():
    result = await _condense_question("gpt-4.1", [], "What are the trade laws?")
    assert result == "What are the trade laws?"


@pytest.mark.asyncio
async def test_condense_question_with_history():
    """Mock OpenAI.acomplete, verify prompt includes history and question."""
    history = [
        ("What are the trade laws?", "According to Section 4.2..."),
        ("Tell me more", "Section 4.2.1 states..."),
    ]

    mock_response = AsyncMock()
    mock_response.text = (
        "What are the specific penalties for trade law violations under Section 4.2?"
    )

    with patch("app.qdrant_service.OpenAI") as mock_openai_cls:
        mock_llm = mock_openai_cls.return_value
        mock_llm.acomplete = AsyncMock(return_value=mock_response)

        result = await _condense_question("gpt-4.1", history, "What about penalties?")

    assert result == mock_response.text

    prompt_arg = mock_llm.acomplete.call_args[0][0]
    assert "Human: What are the trade laws?" in prompt_arg
    assert "Assistant: According to Section 4.2..." in prompt_arg
    assert "Human: Tell me more" in prompt_arg
    assert "Assistant: Section 4.2.1 states..." in prompt_arg
    assert "What about penalties?" in prompt_arg


@pytest.mark.asyncio
async def test_condense_question_single_pair():
    """Single history pair formatted correctly."""
    history = [("Q1", "A1")]

    mock_response = AsyncMock()
    mock_response.text = "Standalone version of follow-up"

    with patch("app.qdrant_service.OpenAI") as mock_openai_cls:
        mock_llm = mock_openai_cls.return_value
        mock_llm.acomplete = AsyncMock(return_value=mock_response)

        result = await _condense_question("gpt-4.1", history, "Follow-up question")

    assert result == "Standalone version of follow-up"

    prompt_arg = mock_llm.acomplete.call_args[0][0]
    assert "Human: Q1" in prompt_arg
    assert "Assistant: A1" in prompt_arg
    assert "Follow-up question" in prompt_arg


# ---------------------------------------------------------------------------
# _extract_citations
# ---------------------------------------------------------------------------


def _make_source_node(section, text, legislation_name=None, jurisdiction=None):
    """Build a minimal source node compatible with _extract_citations."""
    node = MagicMock()
    node.node.metadata = {
        "section": section,
        "legislation_name": legislation_name,
        "jurisdiction": jurisdiction,
    }
    node.node.get_content.return_value = text
    return node


def test_extract_citations_single_node():
    nodes = [_make_source_node("1.1", "Peace text", "Laws", "Kingdom-wide")]
    citations = _extract_citations(nodes)
    assert len(citations) == 1
    assert citations[0].source == "1.1"
    assert citations[0].text == "Peace text"
    assert citations[0].legislation_name == "Laws"
    assert citations[0].jurisdiction == "Kingdom-wide"


def test_extract_citations_deduplicates_by_section():
    nodes = [
        _make_source_node("1.1", "First copy", "Laws", "Kingdom-wide"),
        _make_source_node("1.1", "Duplicate copy", "Laws", "Kingdom-wide"),
        _make_source_node("2.1", "Another section", "Laws", "Kingdom-wide"),
    ]
    citations = _extract_citations(nodes)
    assert len(citations) == 2
    sections = [c.source for c in citations]
    assert sections.count("1.1") == 1
    assert "2.1" in sections


def test_extract_citations_empty_nodes():
    citations = _extract_citations([])
    assert citations == []


def test_extract_citations_missing_metadata_fields():
    """Nodes without optional fields default to None."""
    node = MagicMock()
    node.node.metadata = {}
    node.node.get_content.return_value = "some text"
    citations = _extract_citations([node])
    assert len(citations) == 1
    assert citations[0].source == "Unknown"
    assert citations[0].legislation_name is None
    assert citations[0].jurisdiction is None


def test_extract_citations_preserves_order():
    sections = ["3.1", "1.1", "2.1"]
    nodes = [_make_source_node(s, f"text {s}") for s in sections]
    citations = _extract_citations(nodes)
    assert [c.source for c in citations] == sections


# ---------------------------------------------------------------------------
# _resolve_jurisdiction_hierarchy
# ---------------------------------------------------------------------------


def test_resolve_jurisdiction_hierarchy_non_kingdom_wide():
    values = _resolve_jurisdiction_hierarchy(Jurisdiction.THE_NORTH.value)
    assert Jurisdiction.THE_NORTH.value in values
    assert Jurisdiction.KINGDOM_WIDE.value in values
    assert len(values) == 2


def test_resolve_jurisdiction_hierarchy_kingdom_wide():
    """Kingdom-wide should not duplicate itself."""
    values = _resolve_jurisdiction_hierarchy(Jurisdiction.KINGDOM_WIDE.value)
    assert values == [Jurisdiction.KINGDOM_WIDE.value]
    assert len(values) == 1


def test_resolve_jurisdiction_hierarchy_city():
    values = _resolve_jurisdiction_hierarchy(Jurisdiction.KINGS_LANDING.value)
    assert Jurisdiction.KINGS_LANDING.value in values
    assert Jurisdiction.KINGDOM_WIDE.value in values


def test_resolve_jurisdiction_hierarchy_all_non_kingdom_wide_include_kingdom():
    for j in Jurisdiction:
        if j == Jurisdiction.KINGDOM_WIDE:
            continue
        values = _resolve_jurisdiction_hierarchy(j.value)
        assert Jurisdiction.KINGDOM_WIDE.value in values, f"Missing Kingdom-wide for {j}"


# ---------------------------------------------------------------------------
# QdrantService.connect()
# ---------------------------------------------------------------------------


def test_connect_sets_llm_and_embed_model():
    svc = QdrantService()
    with (
        patch("app.qdrant_service.OpenAI") as mock_openai_cls,
        patch("app.qdrant_service.OpenAIEmbedding") as mock_embed_cls,
        patch("app.qdrant_service.qdrant_client.QdrantClient") as mock_qdrant_cls,
        patch("app.qdrant_service.QdrantVectorStore") as mock_vector_store_cls,
        patch("app.qdrant_service.SimpleDocumentStore") as mock_docstore_cls,
        patch("app.qdrant_service.StorageContext") as mock_storage_ctx,
        patch("app.qdrant_service.Settings") as mock_settings,
    ):
        svc.connect()

    mock_openai_cls.assert_called_once()
    mock_embed_cls.assert_called_once()
    assert mock_settings.llm is not None
    assert mock_settings.embed_model is not None


def test_connect_uses_env_model_names(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")
    monkeypatch.setenv("EMBEDDING_MODEL", "text-embedding-ada-002")
    svc = QdrantService()

    with (
        patch("app.qdrant_service.OpenAI") as mock_openai_cls,
        patch("app.qdrant_service.OpenAIEmbedding") as mock_embed_cls,
        patch("app.qdrant_service.qdrant_client.QdrantClient"),
        patch("app.qdrant_service.QdrantVectorStore"),
        patch("app.qdrant_service.SimpleDocumentStore"),
        patch("app.qdrant_service.StorageContext"),
        patch("app.qdrant_service.Settings"),
    ):
        svc.connect()

    openai_call_kwargs = mock_openai_cls.call_args
    assert openai_call_kwargs[1].get("model") == "gpt-4o" or openai_call_kwargs[0][0] == "gpt-4o" if openai_call_kwargs[0] else openai_call_kwargs[1].get("model") == "gpt-4o"

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
        patch("app.qdrant_service.OpenAI"),
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
        patch("app.qdrant_service.OpenAI"),
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
    svc._llm_model = "gpt-4.1"
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
# QdrantService.query()
# ---------------------------------------------------------------------------


def _indexed_service():
    """Return a service with index and storage_context already set."""
    svc = _connected_service()
    svc.index = MagicMock()
    return svc


def _make_query_engine_result(response_text, source_nodes=None):
    result = MagicMock()
    result.__str__ = lambda self: response_text
    result.source_nodes = source_nodes or []
    return result


def test_query_raises_when_not_initialized():
    svc = QdrantService()
    with pytest.raises(RuntimeError, match="connect()"):
        svc.query("What is the law?")


def test_query_returns_output_with_response():
    svc = _indexed_service()
    source_nodes = [_make_source_node("1.1", "Peace text", "Laws", "Kingdom-wide")]
    query_result = _make_query_engine_result("According to Section 1.1...", source_nodes)

    mock_engine = MagicMock()
    mock_engine.query.return_value = query_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        result = svc.query("What about peace?")

    assert result.query == "What about peace?"
    assert result.response == "According to Section 1.1..."
    assert len(result.citations) == 1
    assert result.citations[0].source == "1.1"


def test_query_empty_response_returns_fallback():
    svc = _indexed_service()
    query_result = _make_query_engine_result("Empty Response", [])

    mock_engine = MagicMock()
    mock_engine.query.return_value = query_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        result = svc.query("Unknown question")

    assert "could not find relevant legislation" in result.response


def test_query_blank_response_returns_fallback():
    svc = _indexed_service()
    query_result = _make_query_engine_result("   ", [])

    mock_engine = MagicMock()
    mock_engine.query.return_value = query_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        result = svc.query("Blank answer")

    assert "could not find relevant legislation" in result.response


def test_query_with_jurisdiction_adds_filter():
    svc = _indexed_service()
    query_result = _make_query_engine_result("A response", [])
    mock_engine = MagicMock()
    mock_engine.query.return_value = query_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        result = svc.query("What are the laws?", jurisdiction=Jurisdiction.THE_NORTH.value)

    # as_retriever should have been called with vector_store_kwargs
    call_kwargs = svc.index.as_retriever.call_args[1]
    assert "vector_store_kwargs" in call_kwargs
    assert "qdrant_filters" in call_kwargs["vector_store_kwargs"]


def test_query_without_jurisdiction_no_filter():
    svc = _indexed_service()
    query_result = _make_query_engine_result("A response", [])
    mock_engine = MagicMock()
    mock_engine.query.return_value = query_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        svc.query("What are the laws?")

    call_kwargs = svc.index.as_retriever.call_args[1]
    assert "vector_store_kwargs" not in call_kwargs


# ---------------------------------------------------------------------------
# QdrantService.aquery()
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aquery_raises_when_not_initialized():
    svc = QdrantService()
    with pytest.raises(RuntimeError, match="not initialized"):
        async for _ in svc.aquery("test"):
            pass


@pytest.mark.asyncio
async def test_aquery_yields_tokens_then_citations():
    svc = _indexed_service()
    source_nodes = [_make_source_node("1.1", "Peace text", "Laws", "Kingdom-wide")]

    streaming_result = MagicMock()
    streaming_result.response_gen = iter(["Token1", " Token2"])
    streaming_result.source_nodes = source_nodes

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
        patch("app.qdrant_service._condense_question", new=AsyncMock(return_value="test query")),
    ):
        mock_cqe.from_args.return_value = mock_engine
        collected = []
        async for item in svc.aquery("test query"):
            collected.append(item)

    # First two items should be (token, None), last is (None, citations)
    assert collected[0] == ("Token1", None)
    assert collected[1] == (" Token2", None)
    token, citations = collected[-1]
    assert token is None
    assert len(citations) == 1
    assert citations[0].source == "1.1"


@pytest.mark.asyncio
async def test_aquery_with_jurisdiction_adds_filter():
    svc = _indexed_service()

    streaming_result = MagicMock()
    streaming_result.response_gen = iter(["response"])
    streaming_result.source_nodes = []

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
        patch("app.qdrant_service._condense_question", new=AsyncMock(return_value="q")),
    ):
        mock_cqe.from_args.return_value = mock_engine
        async for _ in svc.aquery("q", jurisdiction=Jurisdiction.THE_NORTH.value):
            pass

    call_kwargs = svc.index.as_retriever.call_args[1]
    assert "vector_store_kwargs" in call_kwargs


@pytest.mark.asyncio
async def test_aquery_calls_condense_question_with_history():
    svc = _indexed_service()
    history = [("prev question", "prev answer")]

    streaming_result = MagicMock()
    streaming_result.response_gen = iter(["ok"])
    streaming_result.source_nodes = []

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    mock_condense = AsyncMock(return_value="condensed query")

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
        patch("app.qdrant_service._condense_question", mock_condense),
    ):
        mock_cqe.from_args.return_value = mock_engine
        async for _ in svc.aquery("follow-up", chat_history=history):
            pass

    mock_condense.assert_called_once_with(svc._llm_model, history, "follow-up")
    mock_engine.query.assert_called_once_with("condensed query")


@pytest.mark.asyncio
async def test_aquery_uses_streaming_citation_engine():
    svc = _indexed_service()

    streaming_result = MagicMock()
    streaming_result.response_gen = iter([])
    streaming_result.source_nodes = []

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.qdrant_service.AutoMergingRetriever"),
        patch("app.qdrant_service.CitationQueryEngine") as mock_cqe,
        patch("app.qdrant_service.OpenAI"),
        patch("app.qdrant_service._condense_question", new=AsyncMock(return_value="q")),
    ):
        mock_cqe.from_args.return_value = mock_engine
        async for _ in svc.aquery("q"):
            pass

    _, from_args_kwargs = mock_cqe.from_args.call_args
    assert from_args_kwargs.get("streaming") is True


# ---------------------------------------------------------------------------
# QdrantService.delete_legislation()
# ---------------------------------------------------------------------------


def test_delete_legislation_when_client_is_none():
    """Should silently return when _client is None (no connection)."""
    svc = QdrantService()
    svc._client = None
    # Should not raise
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

    # Simulate two docs: one belonging to legislation 7, one belonging to 99
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

    # Should not raise when _docstore is None
    svc.delete_legislation(7)

    svc._client.delete.assert_called_once()


# ---------------------------------------------------------------------------
# detect_jurisdiction()
# ---------------------------------------------------------------------------


def test_detect_jurisdiction_returns_matched_jurisdiction():
    result = detect_jurisdiction("What are the laws in The North?")
    assert result == Jurisdiction.THE_NORTH.value


def test_detect_jurisdiction_returns_none_when_no_match():
    result = detect_jurisdiction("What are the general laws?")
    assert result is None


def test_detect_jurisdiction_ignores_kingdom_wide():
    """'Kingdom-wide' in query should not match -- function skips it."""
    result = detect_jurisdiction("Tell me about kingdom-wide regulations")
    assert result is None


def test_detect_jurisdiction_case_insensitive():
    result = detect_jurisdiction("laws in dorne")
    assert result == Jurisdiction.DORNE.value


def test_detect_jurisdiction_city_level():
    result = detect_jurisdiction("regulations in King's Landing")
    assert result == Jurisdiction.KINGS_LANDING.value


# ---------------------------------------------------------------------------
# QdrantService k parameter
# ---------------------------------------------------------------------------


def test_qdrant_service_default_k():
    svc = QdrantService()
    assert svc.k == 8


def test_qdrant_service_custom_k():
    svc = QdrantService(k=5)
    assert svc.k == 5


def test_qdrant_service_k_from_env(monkeypatch):
    monkeypatch.setenv("SIMILARITY_TOP_K", "12")
    svc = QdrantService()
    assert svc.k == 12
