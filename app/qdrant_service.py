import logging
import os

import qdrant_client
from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.query_engine import CitationQueryEngine
from llama_index.core.retrievers import AutoMergingRetriever
from llama_index.core.schema import TextNode
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.qdrant import QdrantVectorStore

from app.models import Citation, Jurisdiction, Output

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a legal compliance assistant for Westeros Capital Group. Your role is to
answer questions about the laws and regulations of the Seven Kingdoms.

RULES:
- Answer ONLY based on the provided source documents. Do not use outside knowledge.
- Cite specific law sections (e.g., "Section 4.2.1") in your response when referencing a law.
- If the provided sources do not contain information relevant to the question, say:
  "I could not find relevant legislation addressing this question. Please consult
  with a legal advisor or try refining your query."
- Do not speculate, infer, or extrapolate beyond what the sources explicitly state.
- Be concise and direct. Use plain language appropriate for a compliance professional.
- When multiple laws are relevant, address each one and explain how they relate to the question.
- When citing laws, always note the jurisdiction they apply to (e.g., "Kingdom-wide", "The North").
- If a question is jurisdiction-specific, distinguish between kingdom-wide laws (which always apply)
  and region-specific laws. Do not cite laws from unrelated jurisdictions."""


class QdrantService:
    def __init__(self, k: int | None = None):
        self.k = k or int(os.environ.get("SIMILARITY_TOP_K", "8"))
        self.index: VectorStoreIndex | None = None
        self.storage_context: StorageContext | None = None
        self._client: qdrant_client.QdrantClient | None = None
        self._vector_store: QdrantVectorStore | None = None
        self._docstore: SimpleDocumentStore | None = None

    def connect(self) -> None:
        """Initialize Qdrant (in-memory), embeddings, and LLM."""
        llm_model = os.environ.get("LLM_MODEL", "gpt-4.1")
        embed_model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-large")

        self._llm_model = llm_model
        Settings.llm = OpenAI(model=llm_model)
        Settings.embed_model = OpenAIEmbedding(model=embed_model)

        self._client = qdrant_client.QdrantClient(location=":memory:")
        self._vector_store = QdrantVectorStore(
            client=self._client, collection_name="legislation"
        )
        self._docstore = SimpleDocumentStore()
        self.storage_context = StorageContext.from_defaults(
            docstore=self._docstore,
            vector_store=self._vector_store,
        )

        logger.info(
            "QdrantService connected",
            extra={"llm_model": llm_model, "embed_model": embed_model},
        )

    def load(self, leaf_nodes: list[TextNode], all_nodes: list[TextNode]) -> None:
        """Load nodes into docstore and vector index."""
        if self.storage_context is None:
            raise RuntimeError("Must call connect() before load()")

        self._docstore.add_documents(all_nodes)
        self.index = VectorStoreIndex(
            leaf_nodes,
            storage_context=self.storage_context,
        )

        logger.info(
            "Loaded nodes into index",
            extra={
                "leaf_count": len(leaf_nodes),
                "total_count": len(all_nodes),
            },
        )

    def query(self, query_str: str, jurisdiction: str | None = None) -> Output:
        """Run a query against the legislation corpus."""
        if self.index is None or self.storage_context is None:
            raise RuntimeError(
                "Index not initialized. Call connect() and load() first."
            )

        # Build retriever with optional jurisdiction filter
        retriever_kwargs: dict = {"similarity_top_k": self.k}

        if jurisdiction:
            from qdrant_client.models import FieldCondition, Filter, MatchAny

            jurisdiction_values = _resolve_jurisdiction_hierarchy(jurisdiction)
            qdrant_filters = Filter(
                should=[
                    FieldCondition(
                        key="jurisdiction",
                        match=MatchAny(any=jurisdiction_values),
                    )
                ]
            )
            retriever_kwargs["vector_store_kwargs"] = {"qdrant_filters": qdrant_filters}

        base_retriever = self.index.as_retriever(**retriever_kwargs)
        retriever = AutoMergingRetriever(
            base_retriever,
            self.storage_context,
            simple_ratio_thresh=0.5,
        )

        query_engine = CitationQueryEngine.from_args(
            self.index,
            retriever=retriever,
            citation_chunk_size=512,
            llm=OpenAI(model=self._llm_model, system_prompt=SYSTEM_PROMPT),
        )

        result = query_engine.query(query_str)

        citations = _extract_citations(result.source_nodes)
        response_text = str(result)
        if not response_text.strip() or response_text.strip() == "Empty Response":
            response_text = (
                "I could not find relevant legislation addressing this question. "
                "Please consult with a legal advisor or try refining your query."
            )

        return Output(
            query=query_str,
            response=response_text,
            citations=citations,
        )

    async def aquery(
        self,
        query_str: str,
        jurisdiction: str | None = None,
        chat_history: list[tuple[str, str]] | None = None,
    ):
        """Async streaming query. Yields (token, None) for text tokens
        and (None, citations) when complete.

        chat_history: list of (user_message, assistant_message) pairs
        for multi-turn context.
        """
        if self.index is None or self.storage_context is None:
            raise RuntimeError("Index not initialized.")

        retriever_kwargs: dict = {"similarity_top_k": self.k}

        if jurisdiction:
            from qdrant_client.models import FieldCondition, Filter, MatchAny

            jurisdiction_values = _resolve_jurisdiction_hierarchy(jurisdiction)
            qdrant_filters = Filter(
                should=[
                    FieldCondition(
                        key="jurisdiction",
                        match=MatchAny(any=jurisdiction_values),
                    )
                ]
            )
            retriever_kwargs["vector_store_kwargs"] = {"qdrant_filters": qdrant_filters}

        condensed_query = await _condense_question(
            self._llm_model, chat_history, query_str
        )

        base_retriever = self.index.as_retriever(**retriever_kwargs)
        retriever = AutoMergingRetriever(
            base_retriever,
            self.storage_context,
            simple_ratio_thresh=0.5,
        )

        query_engine = CitationQueryEngine.from_args(
            self.index,
            retriever=retriever,
            citation_chunk_size=512,
            streaming=True,
            llm=OpenAI(model=self._llm_model, system_prompt=SYSTEM_PROMPT),
        )

        streaming_response = query_engine.query(condensed_query)

        # Stream tokens
        for token in streaming_response.response_gen:
            yield token, None

        # Extract citations after streaming completes
        citations = _extract_citations(streaming_response.source_nodes)
        yield None, citations

    def delete_legislation(self, legislation_id: int) -> None:
        """Remove all nodes for a legislation entry from the index."""
        if self._client is None:
            return

        from qdrant_client.models import FieldCondition, Filter, MatchValue

        self._client.delete(
            collection_name="legislation",
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="legislation_id",
                        match=MatchValue(value=legislation_id),
                    )
                ]
            ),
        )

        # Also remove from docstore
        if self._docstore is not None:
            doc_ids_to_remove = [
                doc_id
                for doc_id, doc in self._docstore.docs.items()
                if doc.metadata.get("legislation_id") == legislation_id
            ]
            for doc_id in doc_ids_to_remove:
                self._docstore.delete_document(doc_id)

        logger.info(
            "Deleted legislation from index",
            extra={"legislation_id": legislation_id},
        )


async def _condense_question(
    llm_model: str,
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

    llm = OpenAI(model=llm_model)
    response = await llm.acomplete(prompt)
    return response.text


def _extract_citations(source_nodes) -> list[Citation]:
    """Extract deduplicated citations from source nodes."""
    citations = []
    seen_sections = set()
    for node in source_nodes:
        meta = node.node.metadata
        section = meta.get("section", "Unknown")
        if section in seen_sections:
            continue
        seen_sections.add(section)
        citations.append(
            Citation(
                source=section,
                text=node.node.get_content(),
                legislation_name=meta.get("legislation_name"),
                jurisdiction=meta.get("jurisdiction"),
            )
        )
    return citations


def _resolve_jurisdiction_hierarchy(jurisdiction: str) -> list[str]:
    """Given a jurisdiction, return it plus Kingdom-wide (always applies)."""
    values = [jurisdiction]
    if jurisdiction != Jurisdiction.KINGDOM_WIDE.value:
        values.append(Jurisdiction.KINGDOM_WIDE.value)
    return values


def detect_jurisdiction(query: str) -> str | None:
    """Simple keyword-based jurisdiction detection from query text."""
    query_lower = query.lower()
    for j in Jurisdiction:
        if j.value.lower() in query_lower:
            if j == Jurisdiction.KINGDOM_WIDE:
                continue
            return j.value
    return None
