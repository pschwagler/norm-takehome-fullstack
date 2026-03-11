import logging
import os
from collections.abc import AsyncGenerator

from llama_index.core.query_engine import CitationQueryEngine
from llama_index.core.retrievers import AutoMergingRetriever
from llama_index.llms.openai import OpenAI
from sqlmodel import Session

from app import conversation_service
from app.citation_filter import filter_by_response_refs
from app.database import engine
from app.models import Citation
from app.qdrant_service import QdrantService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a legal compliance assistant for Westeros Capital Group. Your role is to
answer questions about the laws and regulations of the Seven Kingdoms.

RULES:
- Answer ONLY based on the provided source documents. Do not use outside knowledge.
- Use only the [N] bracket notation provided by the source context to cite laws. Do not repeat section numbers or jurisdiction names inline -- the citation sidebar shows that detail.
- If the sources partially address the question, share what you found and clearly
  note which aspects of the question the sources do not cover.
- If the provided sources contain nothing related to the topic at all, say:
  "I could not find relevant legislation addressing this question. Please consult
  with a legal advisor or try refining your query."
- Do not speculate, infer, or extrapolate beyond what the sources explicitly state.
- Be concise and direct. Use plain language appropriate for a compliance professional.
- Format responses with markdown: headings for distinct topics, and bulleted or numbered lists when comparing multiple provisions.
- When answering about a specific topic, also address any general rules or alternative
  consequences found in the sources that could apply (e.g., alternative punishments,
  broad kingdom-wide provisions).
- When multiple laws are relevant, address each one and explain how they relate to the question.
- If a question is jurisdiction-specific, distinguish between kingdom-wide laws (which always apply)
  and region-specific laws. Do not cite laws from unrelated jurisdictions."""


class QueryService:
    def __init__(
        self, qdrant_service: QdrantService, k: int | None = None
    ) -> None:
        self._qdrant_service = qdrant_service
        self.k = k or int(os.environ.get("SIMILARITY_TOP_K", "12"))

    def _build_query_engine(
        self, streaming: bool = False
    ) -> CitationQueryEngine:
        """Build retriever + query engine."""
        index = self._qdrant_service.index
        storage_context = self._qdrant_service.storage_context
        if index is None or storage_context is None:
            raise RuntimeError(
                "Index not initialized. Call connect() and load() first."
            )

        base_retriever = index.as_retriever(similarity_top_k=self.k)
        retriever = AutoMergingRetriever(
            base_retriever,
            storage_context,
            simple_ratio_thresh=0.5,
        )

        return CitationQueryEngine.from_args(
            index,
            retriever=retriever,
            citation_chunk_size=512,
            streaming=streaming,
            llm=OpenAI(
                model=self._qdrant_service.llm_model,
                temperature=0.1,
                reasoning_effort="high",
                system_prompt=SYSTEM_PROMPT,
            ),
        )

    async def aquery(
        self,
        query_str: str,
        chat_history: list[tuple[str, str]] | None = None,
    ):
        """Async streaming query. Yields (token, None) for text tokens
        and (None, source_nodes) when complete.

        chat_history: list of (user_message, assistant_message) pairs
        for multi-turn context.
        """
        condensed_query = await self._condense_question(
            chat_history, query_str
        )

        query_engine = self._build_query_engine(streaming=True)
        streaming_response = query_engine.query(condensed_query)

        for token in streaming_response.response_gen:
            yield token, None

        yield None, streaming_response.source_nodes

    async def _condense_question(
        self,
        chat_history: list[tuple[str, str]] | None,
        question: str,
    ) -> str:
        """Rewrite a follow-up question into a standalone query using chat history.

        Returns the question unchanged (no LLM call) when there is no history.
        """
        if not chat_history:
            return question

        history_lines = []
        for user_msg, assistant_msg in chat_history:
            history_lines.append(f"Human: {user_msg}")
            history_lines.append(f"Assistant: {assistant_msg}")

        history_block = "\n".join(history_lines)

        prompt = (
            "Given a conversation (between Human and Assistant) and a follow up message from Human, "
            "rewrite the message to be a standalone question that captures all relevant context "
            "from the conversation.\n\n"
            "<Chat History>\n"
            f"{history_block}\n"
            "</Chat History>\n\n"
            f"<Follow Up Message>\n{question}\n</Follow Up Message>\n\n"
            "<Standalone question>\n"
        )

        llm = OpenAI(
            model=self._qdrant_service.llm_model,
            temperature=0.1,
            reasoning_effort="low",
        )
        response = await llm.acomplete(prompt)
        return response.text


async def stream_and_filter(
    query_service: QueryService,
    query: str,
    jurisdiction: str | None = None,
    thread_id: int | None = None,
) -> AsyncGenerator[
    tuple[str | None, list[Citation] | None, int | None, str | None], None
]:
    """Run the full query pipeline: retrieve, stream, filter, persist.

    Yields tuples of (token, citations, thread_id, corrected_response):
      - (token, None, None, None)                  for each streamed token
      - (None, citations, None, corrected_response) when citations are ready
      - (None, None, thread_id, None)               when persistence is complete
    """
    chat_history: list[tuple[str, str]] = []
    if thread_id is not None:
        with Session(engine) as session:
            chat_history = conversation_service.get_thread_history(
                session, thread_id
            )

    response = ""
    source_nodes: list = []

    async for token, nodes in query_service.aquery(query, chat_history):
        if nodes is not None:
            source_nodes = nodes
        elif token is not None:
            response += token
            yield token, None, None, None

    corrected_response, citations = filter_by_response_refs(
        response, source_nodes
    )
    yield None, citations, None, corrected_response

    tid = _persist_thread_and_messages(
        thread_id, query, corrected_response, citations, jurisdiction
    )
    yield None, None, tid, None


def _persist_thread_and_messages(
    thread_id: int | None,
    query: str,
    response: str,
    citations: list[Citation],
    jurisdiction: str | None,
) -> int | None:
    """Save the query/response pair to the DB, creating a thread if needed.

    Exceptions are logged but swallowed so a persistence failure never
    breaks the streamed response that was already sent to the client.
    """
    try:
        with Session(engine) as session:
            if thread_id is None:
                thread = conversation_service.create_thread(
                    session=session,
                    first_query=query,
                    jurisdiction=jurisdiction,
                )
                thread_id = thread.id

            conversation_service.add_message(
                session=session,
                thread_id=thread_id,
                role="user",
                content=query,
            )
            conversation_service.add_message(
                session=session,
                thread_id=thread_id,
                role="assistant",
                content=response,
                citations=citations,
            )
    except Exception:
        logger.exception("Failed to save thread/messages")

    return thread_id
