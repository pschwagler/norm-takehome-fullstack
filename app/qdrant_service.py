import logging
import os

import qdrant_client
from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.schema import TextNode
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client.models import FieldCondition, Filter, MatchValue

logger = logging.getLogger(__name__)


class QdrantService:
    def __init__(self):
        self.index: VectorStoreIndex | None = None
        self.storage_context: StorageContext | None = None
        self._client: qdrant_client.QdrantClient | None = None
        self._vector_store: QdrantVectorStore | None = None
        self._docstore: SimpleDocumentStore | None = None
        self._llm_model: str = ""

    @property
    def llm_model(self) -> str:
        return self._llm_model

    def connect(self) -> None:
        """Initialize Qdrant (in-memory), embeddings, and LLM."""
        llm_model = os.environ.get("LLM_MODEL", "gpt-5.2")
        embed_model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-large")

        self._llm_model = llm_model
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

    def delete_legislation(self, legislation_id: int) -> None:
        """Remove all nodes for a legislation entry from the index."""
        if self._client is None:
            return

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
