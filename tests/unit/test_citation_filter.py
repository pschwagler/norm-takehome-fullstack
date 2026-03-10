import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Citation


def _make_citation(source: str, text: str = "Some law text") -> Citation:
    return Citation(
        source=source,
        text=text,
        legislation_name="Laws of the Seven Kingdoms",
        jurisdiction="Kingdom-wide",
    )


@pytest.mark.asyncio
async def test_empty_citations_returns_empty():
    from app.citation_filter import filter_relevant_citations

    result = await filter_relevant_citations("query", "response", [])
    assert result == []


@pytest.mark.asyncio
async def test_filters_to_relevant_subset():
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1"), _make_citation("2.3")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(["1.1"])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 1
    assert result[0].source == "1.1"


@pytest.mark.asyncio
async def test_all_relevant_returns_all():
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1"), _make_citation("2.3")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(["1.1", "2.3"])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 2
    assert {c.source for c in result} == {"1.1", "2.3"}


@pytest.mark.asyncio
async def test_none_relevant_returns_empty():
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1"), _make_citation("2.3")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps([])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert result == []


@pytest.mark.asyncio
async def test_fallback_on_api_error(caplog):
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1"), _make_citation("2.3")]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(
        side_effect=RuntimeError("API down")
    )

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 2
    assert any("Citation filter failed" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_fallback_on_json_parse_error(caplog):
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "not json at all"

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 1
    assert any("Citation filter failed" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_fallback_on_wrong_json_shape(caplog):
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps({"x": 1})

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 1
    assert any("Citation filter failed" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_ignores_unknown_sections():
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1"), _make_citation("2.3")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(["1.1", "99.99"])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        result = await filter_relevant_citations("query", "response", citations)

    assert len(result) == 1
    assert result[0].source == "1.1"


@pytest.mark.asyncio
async def test_model_name_from_env():
    from app.citation_filter import filter_relevant_citations

    citations = [_make_citation("1.1")]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(["1.1"])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.citation_filter.AsyncOpenAI", return_value=mock_client),
        patch.dict("os.environ", {"CITATION_FILTER_MODEL": "gpt-4o"}),
    ):
        await filter_relevant_citations("query", "response", citations)

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_text_truncation_in_prompt():
    from app.citation_filter import filter_relevant_citations

    long_text = "x" * 800
    citations = [_make_citation("1.1", text=long_text)]

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(["1.1"])

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.citation_filter.AsyncOpenAI", return_value=mock_client):
        await filter_relevant_citations("query", "response", citations)

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    user_msg = call_kwargs["messages"][1]["content"]
    # The 800-char text should be truncated to 400 + "..."
    assert "x" * 400 + "..." in user_msg
    assert "x" * 401 not in user_msg
