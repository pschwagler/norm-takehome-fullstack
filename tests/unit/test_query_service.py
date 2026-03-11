from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.query_service import QueryService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_source_node(
    section, text, legislation_name=None, jurisdiction=None, legislation_id=None
):
    """Build a minimal source node compatible with _extract_citations."""
    node = MagicMock()
    node.node.metadata = {
        "section": section,
        "legislation_name": legislation_name,
        "jurisdiction": jurisdiction,
        "legislation_id": legislation_id,
    }
    node.node.get_content.return_value = text
    return node


def _query_service_with_index() -> QueryService:
    """Return a QueryService backed by a mocked QdrantService with index set."""
    qdrant = MagicMock()
    qdrant.index = MagicMock()
    qdrant.storage_context = MagicMock()
    qdrant.llm_model = "gpt-5.2"
    return QueryService(qdrant)


# ---------------------------------------------------------------------------
# _condense_question (now a method on QueryService)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_condense_question_no_history():
    """Empty or None history returns query unchanged, no LLM call."""
    svc = _query_service_with_index()
    result = await svc._condense_question(None, "What are the trade laws?")
    assert result == "What are the trade laws?"


@pytest.mark.asyncio
async def test_condense_question_empty_history():
    svc = _query_service_with_index()
    result = await svc._condense_question([], "What are the trade laws?")
    assert result == "What are the trade laws?"


@pytest.mark.asyncio
async def test_condense_question_with_history():
    """Mock OpenAI.acomplete, verify prompt includes history and question."""
    svc = _query_service_with_index()
    history = [
        ("What are the trade laws?", "According to Section 4.2..."),
        ("Tell me more", "Section 4.2.1 states..."),
    ]

    mock_response = AsyncMock()
    mock_response.text = (
        "What are the specific penalties for trade law violations under Section 4.2?"
    )

    with patch("app.query_service.OpenAI") as mock_openai_cls:
        mock_llm = mock_openai_cls.return_value
        mock_llm.acomplete = AsyncMock(return_value=mock_response)

        result = await svc._condense_question(history, "What about penalties?")

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
    svc = _query_service_with_index()
    history = [("Q1", "A1")]

    mock_response = AsyncMock()
    mock_response.text = "Standalone version of follow-up"

    with patch("app.query_service.OpenAI") as mock_openai_cls:
        mock_llm = mock_openai_cls.return_value
        mock_llm.acomplete = AsyncMock(return_value=mock_response)

        result = await svc._condense_question(history, "Follow-up question")

    assert result == "Standalone version of follow-up"

    prompt_arg = mock_llm.acomplete.call_args[0][0]
    assert "Human: Q1" in prompt_arg
    assert "Assistant: A1" in prompt_arg
    assert "Follow-up question" in prompt_arg


# ---------------------------------------------------------------------------
# QueryService.aquery()
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aquery_raises_when_not_initialized():
    qdrant = MagicMock()
    qdrant.index = None
    qdrant.storage_context = None
    svc = QueryService(qdrant)
    with pytest.raises(RuntimeError, match="not initialized"):
        async for _ in svc.aquery("test"):
            pass


@pytest.mark.asyncio
async def test_aquery_yields_tokens_then_source_nodes():
    svc = _query_service_with_index()
    source_nodes = [_make_source_node("1.1", "Peace text", "Laws", "Kingdom-wide", 1)]

    streaming_result = MagicMock()
    streaming_result.response_gen = iter(["Token1", " Token2"])
    streaming_result.source_nodes = source_nodes

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.query_service.AutoMergingRetriever"),
        patch("app.query_service.CitationQueryEngine") as mock_cqe,
        patch("app.query_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        collected = []
        async for item in svc.aquery("test query"):
            collected.append(item)

    assert collected[0] == ("Token1", None)
    assert collected[1] == (" Token2", None)
    token, nodes = collected[-1]
    assert token is None
    assert nodes is source_nodes


@pytest.mark.asyncio
async def test_aquery_calls_condense_question_with_history():
    svc = _query_service_with_index()
    history = [("prev question", "prev answer")]

    streaming_result = MagicMock()
    streaming_result.response_gen = iter(["ok"])
    streaming_result.source_nodes = []

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.query_service.AutoMergingRetriever"),
        patch("app.query_service.CitationQueryEngine") as mock_cqe,
        patch("app.query_service.OpenAI"),
        patch.object(svc, "_condense_question", new=AsyncMock(return_value="condensed query")) as mock_condense,
    ):
        mock_cqe.from_args.return_value = mock_engine
        async for _ in svc.aquery("follow-up", chat_history=history):
            pass

    mock_condense.assert_called_once_with(history, "follow-up")
    mock_engine.query.assert_called_once_with("condensed query")


@pytest.mark.asyncio
async def test_aquery_uses_streaming_citation_engine():
    svc = _query_service_with_index()

    streaming_result = MagicMock()
    streaming_result.response_gen = iter([])
    streaming_result.source_nodes = []

    mock_engine = MagicMock()
    mock_engine.query.return_value = streaming_result

    with (
        patch("app.query_service.AutoMergingRetriever"),
        patch("app.query_service.CitationQueryEngine") as mock_cqe,
        patch("app.query_service.OpenAI"),
    ):
        mock_cqe.from_args.return_value = mock_engine
        async for _ in svc.aquery("q"):
            pass

    _, from_args_kwargs = mock_cqe.from_args.call_args
    assert from_args_kwargs.get("streaming") is True


# ---------------------------------------------------------------------------
# QueryService k parameter
# ---------------------------------------------------------------------------


def test_query_service_default_k():
    qdrant = MagicMock()
    svc = QueryService(qdrant)
    assert svc.k == 12


def test_query_service_custom_k():
    qdrant = MagicMock()
    svc = QueryService(qdrant, k=5)
    assert svc.k == 5


def test_query_service_k_from_env(monkeypatch):
    monkeypatch.setenv("SIMILARITY_TOP_K", "20")
    qdrant = MagicMock()
    svc = QueryService(qdrant)
    assert svc.k == 20


# ---------------------------------------------------------------------------
# Cross-service wiring
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_query_engine_passes_k_to_retriever():
    """Verify self.k flows through as similarity_top_k on the base retriever."""
    svc = _query_service_with_index()
    svc.k = 7

    with (
        patch("app.query_service.AutoMergingRetriever"),
        patch("app.query_service.CitationQueryEngine"),
        patch("app.query_service.OpenAI"),
    ):
        svc._build_query_engine()

    svc._qdrant_service.index.as_retriever.assert_called_once_with(
        similarity_top_k=7
    )


@pytest.mark.asyncio
async def test_build_query_engine_uses_qdrant_llm_model():
    """Verify _build_query_engine reads llm_model from the qdrant service."""
    svc = _query_service_with_index()
    svc._qdrant_service.llm_model = "gpt-4o"

    with (
        patch("app.query_service.AutoMergingRetriever"),
        patch("app.query_service.CitationQueryEngine"),
        patch("app.query_service.OpenAI") as mock_openai_cls,
    ):
        svc._build_query_engine()

    mock_openai_cls.assert_called_once()
    assert mock_openai_cls.call_args[1]["model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_condense_question_uses_qdrant_llm_model():
    """Verify _condense_question reads llm_model from the qdrant service."""
    svc = _query_service_with_index()
    svc._qdrant_service.llm_model = "gpt-4o"

    mock_response = AsyncMock()
    mock_response.text = "standalone question"

    with patch("app.query_service.OpenAI") as mock_openai_cls:
        mock_llm = mock_openai_cls.return_value
        mock_llm.acomplete = AsyncMock(return_value=mock_response)

        await svc._condense_question([("Q", "A")], "follow-up")

    mock_openai_cls.assert_called_once()
    assert mock_openai_cls.call_args[1]["model"] == "gpt-4o"
