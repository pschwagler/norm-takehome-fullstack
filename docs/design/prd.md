# PRD: Westeros Legal Compliance Assistant

## Problem

Westeros Capital Group operates across all Seven Kingdoms. Their compliance team currently relies on manually reading through legislation to answer legal questions — slow, error-prone, and doesn't scale as laws change with each new ruler. The legal corpus is large and growing — hundreds of laws spanning many topics, applying at different jurisdiction levels (kingdom-wide, regional, local). They need a tool that lets them query the law in natural language and get answers with traceable citations back to specific statutes, even as the corpus scales.

## User Personas

### Tyrion Lannister — Royal Financial Advisor
The primary power user. Already in the system (see: HeaderNav). Advises the Crown and Great Houses on legal exposure and regulatory compliance. Needs reliable answers to "can I do X?" and "what's the penalty for Y?" questions. Cares deeply about citations — he can't advise a client based on an AI's unsourced opinion. Sophisticated user who asks cross-cutting questions like "what crimes carry the death penalty?"

### Samwell Tarly — Financial Analyst
Junior member of the WCG compliance team. Asks straightforward questions: "how are taxes collected?", "what happens if a baker mixes sawdust in flour?" Needs clear, plain-language answers. Browses legislation to read the actual text. Less likely to question the AI's output, which makes citation visibility even more important for him.

### Varys — Manager of Analysts (WCG)
Manages the compliance team at Westeros Capital Group. Responsible for ensuring the legislation corpus is current and complete. Uploads new law documents, manages document metadata, and oversees the accuracy of the system. Needs admin-level access to document management.

## User Stories — MVP

### Query Flow (Core)
- **As Tyrion**, I can type a question and get a thoughtful answer grounded in the laws
- **As Tyrion**, I see specific citations (law number + full text) alongside every answer, so I can verify the response
- **As Tyrion**, I can start a new query from scratch via the "New Conversation" button at the top of the conversation sidebar

### Legislation Browser
- **As Samwell**, I can browse the full legislation organized by topic (Peace, Taxes, Trials, etc.) so I can read the laws directly without asking a question
- **As Samwell**, I can see the hierarchical structure of laws (e.g., 4. Trials > 4.2 Trials by Combat > 4.2.1, 4.2.2...)

### Document Upload
- **As Varys**, I can upload a new law document by clicking an upload area or dragging a PDF into it
- **As Varys**, after selecting a file, a modal prompts me for a document name and optional jurisdiction
- **As Varys**, the uploaded document is parsed, stored on the server, persisted in the database, and indexed for querying
- **As Varys**, I can see a list of all uploaded legislation documents
- **As Varys**, I can delete a document that was uploaded in error, removing it and its laws from the system

### Conversation History
- **As Tyrion**, I can see a collapsible sidebar on the left with my past queries
- **As Tyrion**, I can click a past query to view its response and citations
- **As Tyrion**, I can delete a past conversation I no longer need
- **As Tyrion**, clicking "New Conversation" clears the current query and starts fresh

### Error / Edge Cases
- **As Tyrion**, I see a clear loading state while my query is being processed (LLM calls are slow)
- **As Tyrion**, I see a helpful error message if the service is unavailable
- **As Tyrion**, if I ask something outside the scope of the laws, the system tells me it can't find relevant legislation rather than hallucinating
- **As Tyrion**, I can see the response stream in when it's being returned by LLM to make it feel less slow

### Jurisdiction-Aware Queries
- **As Tyrion**, I can see which jurisdiction each law applies to (kingdom-wide, The North, King's Landing, etc.)
- **As Tyrion**, when I query "what are the tax laws in the North?", the system retrieves laws from both The North and kingdom-wide jurisdictions, but not laws specific to other regions
- **As Varys**, when uploading a document, I can specify the jurisdiction it applies to

## User Stories — Future (Out of Scope, Documented for Roadmap)
- Document versioning with effective/sunset dates (ruler changes laws)
- Multi-turn follow-up questions (conversation history is MVP, but each query is standalone)
- Auth/RBAC — no public endpoints, route to login if unauthenticated

---

## Starter Code Contract

The repository includes starter code that defines the interface contract. Preserve these interfaces where possible; deviations should be justified.

**Keep as-is (interface):**
- `DocumentService` class — implement `create_documents()` method returning `list[Document]`
- `QdrantService` class — implement `query()` method returning `Output`
- `QdrantService.connect()` and `QdrantService.load()` — already implemented (update imports only)
- `Output` Pydantic model shape — `query`, `response`, `citations`
- `app/main.py` as the FastAPI entrypoint

**Migrate (justified by llama-index version upgrade):**
- Old monolithic imports (`from llama_index import ...`) → modular packages (`from llama_index.core import ...`, `from llama_index.llms.openai import OpenAI`, etc.)
- `ServiceContext.from_defaults()` → `Settings` singleton (`ServiceContext` was fully removed in llama-index 0.11, not just deprecated)
- `OpenAIEmbedding()` (no model) → `OpenAIEmbedding(model="text-embedding-3-large")`
- `OpenAI(model="gpt-4")` → `OpenAI(model="gpt-5.4")` (configurable via env var)
- `k=2` → `k=8` (configurable via `SIMILARITY_TOP_K` env var) — 2 is too few for a multi-topic, multi-jurisdiction corpus

**Standardize (justified by serialization correctness):**
- `Citation` dataclass → Pydantic `BaseModel` (dataclass inside Pydantic BaseModel causes serialization issues with FastAPI JSON responses)
- `Input` dataclass → replace with Pydantic `BaseModel` for `POST /query` request body (drop `file_path` field; queries don't reference files)

**Add (new functionality beyond starter):**
- SQLModel database layer (`LegislationDocument`, `Law` models)
- Additional API endpoints (`/health`, `/laws`, `/documents`)
- PDF parsing logic in `DocumentService.create_documents()`
- SSE streaming for `/query` endpoint
- File structure: break `utils.py` into focused modules as the codebase grows

---

## Technical Design

### Data Model

The PDF has a clean hierarchical numbering scheme. Each top-level number is a topic with a title:

```
1. Peace
2. Religion
3. Widows
4. Trials (with sub-topics: 4.1 Trials of the Crown, 4.2 Trials by Combat)
5. Taxes
6. Thievery
7. Poaching
8. Outlawry
9. Slavery
10. Watch
11. Baking
```

**Document chunking strategy:** Two levels of chunks are indexed:

1. **Leaf chunks (law-level):** Each leaf-level law (e.g., 4.2.3) becomes one TextNode. These are the primary retrieval targets and citation sources.
2. **Parent chunks (topic-level):** Each top-level topic (e.g., "4. Trials") gets a summary node containing all its child laws. These provide broader context when multiple related laws are relevant.

Metadata on every chunk:
- `document_name`: name of the source legislation document (e.g., "Laws of the Seven Kingdoms")
- `document_id`: FK to `legislation_documents` table
- `topic`: top-level category name (e.g., "Trials")
- `section`: full section number (e.g., "4.2.3") — or topic number for parent chunks
- `section_title`: sub-topic title if applicable (e.g., "Trials by Combat")
- `jurisdiction`: where the law applies (e.g., "Kingdom-wide", "The North", "King's Landing")
- `chunk_type`: `"law"` or `"topic"` — distinguishes leaf vs parent chunks

Parent-child relationships are established via `node.relationships[NodeRelationship.PARENT]` and `node.relationships[NodeRelationship.CHILD]` on the TextNode objects (not metadata). This is how `AutoMergingRetriever` traverses the hierarchy.

This gives the RAG pipeline semantic chunks that are small enough to be precise citations but large enough to carry meaning. Parent context (topic + section title + document name + jurisdiction) travels as metadata so the LLM can reason about hierarchy and applicability. Citations trace back to their source document and jurisdiction unambiguously.

```python
from llama_index.core.schema import TextNode, NodeRelationship, RelatedNodeInfo

# Parent chunk (topic-level) — stored in docstore + vector index
parent = TextNode(
    id_="doc_1_topic_4",
    metadata={
        "document_name": "Laws of the Seven Kingdoms",
        "document_id": 1,
        "topic": "Trials",
        "section": "4",
        "jurisdiction": "Kingdom-wide",
        "chunk_type": "topic"
    },
    text="4. Trials\n4.1 Trials of the Crown\n4.1.1 Trials, at least among the nobility...\n..."
)

# Leaf chunk (law-level) — stored in docstore + vector index
child = TextNode(
    id_="doc_1_law_4.2.3",
    metadata={
        "document_name": "Laws of the Seven Kingdoms",
        "document_id": 1,
        "topic": "Trials",
        "section": "4.2.3",
        "section_title": "Trials by combat",
        "jurisdiction": "Kingdom-wide",
        "chunk_type": "law",
    },
    text="A more ancient custom, though seldom used, is a trial of seven..."
)

# Establish parent-child relationship (required for AutoMergingRetriever)
child.relationships[NodeRelationship.PARENT] = parent.as_related_node_info()
parent.relationships[NodeRelationship.CHILD] = [child.as_related_node_info()]
```

### Database Schema (SQLite via SQLModel)

```sql
legislation_documents
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── name            TEXT NOT NULL          -- e.g., "Laws of the Seven Kingdoms"
├── file_name       TEXT NOT NULL          -- original uploaded filename
├── file_path       TEXT NOT NULL          -- path on server filesystem
├── jurisdiction    TEXT NOT NULL DEFAULT 'Kingdom-wide'  -- e.g., "The North", "King's Landing"
├── uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
└── uploaded_by     TEXT                   -- user who uploaded

laws
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── document_id     INTEGER NOT NULL FK(legislation_documents.id)
├── section         TEXT NOT NULL          -- e.g., "4.2.3"
├── topic           TEXT NOT NULL          -- e.g., "Trials"
├── section_title   TEXT                   -- e.g., "Trials by Combat" (nullable)
├── text            TEXT NOT NULL          -- the law content
├── jurisdiction    TEXT NOT NULL          -- inherited from parent document on insert
└── created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

conversations
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── query           TEXT NOT NULL          -- the user's original question
├── response        TEXT NOT NULL          -- the full LLM response text
├── citations       TEXT NOT NULL          -- JSON-serialized list of citation objects
├── jurisdiction    TEXT                   -- jurisdiction filter used (nullable = all)
└── created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

Documents stored on filesystem under `data/uploads/`. SQLite is the source of truth for metadata; Qdrant is the search index (rebuilt from DB on startup).

#### Jurisdiction Enum

Jurisdiction is a constrained string field. Valid values for the Westeros legal system:

```python
class Jurisdiction(str, Enum):
    """Valid jurisdictions for the Westeros legal system."""

    # Tier 1: Realm-wide (applies everywhere)
    KINGDOM_WIDE = "Kingdom-wide"

    # Tier 2: Major regions / Great Houses
    THE_NORTH = "The North"              # Ruled from Winterfell
    THE_REACH = "The Reach"              # Ruled from Highgarden
    THE_VALE = "The Vale"                # Ruled from the Eyrie
    THE_WESTERLANDS = "The Westerlands"  # Ruled from Casterly Rock
    THE_RIVERLANDS = "The Riverlands"    # Ruled from Riverrun
    THE_STORMLANDS = "The Stormlands"    # Ruled from Storm's End
    DORNE = "Dorne"                      # Ruled from Sunspear
    THE_IRON_ISLANDS = "The Iron Islands"  # Ruled from Pyke
    THE_CROWNLANDS = "The Crownlands"    # Direct Crown holdings

    # Tier 3: Major cities (city-level ordinances)
    KINGS_LANDING = "King's Landing"     # Capital city
    OLDTOWN = "Oldtown"                  # Cultural center, the Reach
    LANNISPORT = "Lannisport"            # Primary port, the Westerlands
    WHITE_HARBOR = "White Harbor"        # Only city in the North
```

Jurisdiction hierarchy: Kingdom-wide laws always apply everywhere. Regional laws apply within that region and its cities. City laws apply only within that city. When querying with a jurisdiction filter, always include "Kingdom-wide" results alongside the specified jurisdiction.

### Backend Architecture

```
┌───────────────────┐     ┌──────────────┐     ┌──────────────────┐
│   FastAPI          │────▶│ QdrantService│────▶│ Qdrant (in-mem)  │
│   POST /query      │     │  .query()    │     │ vector store     │
│   GET  /laws       │     └──────────────┘     └──────────────────┘
│   POST /documents  │            │
│   DEL  /documents  │            │
│   GET  /documents  │            ▼
└───────────────────┘     ┌──────────────┐
       │                  │ OpenAI       │
       │                  │ configurable │
       ▼                  └──────────────┘
┌──────────────┐     ┌──────────────┐
│ DocumentSvc   │────▶│   SQLite     │
│ (PDF parsing) │     │   (SQLModel) │
└──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  Filesystem   │
│  data/uploads │
└──────────────┘
```

#### API Endpoints

**`GET /health`**
- Purpose: Health check for container orchestration and frontend connection validation
- Response `200`: `{ "status": "ok", "documents_loaded": 3, "laws_indexed": 27 }`

---

**`POST /query`** (streaming SSE)
- Purpose: Natural language query against the legislation corpus
- Request body:
  ```json
  { "query": "what happens if I steal from the Sept?", "jurisdiction": "The North" }
  ```
- `jurisdiction` is optional — when provided, retrieval filters to that jurisdiction + "Kingdom-wide". When omitted, searches all jurisdictions.
- Validation: `query` required, non-empty, max 1000 chars
- Response `200` (SSE stream):
  - Event `token`: `{ "data": "partial text..." }` — streamed as LLM generates
  - Event `citations`: `{ "data": [{ "source": "6.3", "text": "Those who steal...", "document_name": "Laws of the Seven Kingdoms", "jurisdiction": "Kingdom-wide" }] }` — sent once after response completes
  - Event `done`: `{ "data": { "query": "...", "response": "full text", "citations": [...] } }` — final complete Output
- Response `422`: Invalid/missing query
- Response `503`: OpenAI API unreachable or Qdrant not initialized
- Notes: If no relevant laws found, LLM should respond saying so rather than hallucinating. System prompt enforces this.

---

**`GET /laws`**
- Purpose: Return all laws as structured JSON, grouped by topic. Powers the legislation browser.
- Query params: `?document_id=1` (optional, filter by document), `?jurisdiction=The North` (optional, filter by jurisdiction); omit for all
- Response `200`:
  ```json
  [
    {
      "topic": "Trials",
      "section_title": null,
      "laws": [
        {
          "id": 12,
          "section": "4.1.1",
          "section_title": "Trials of the Crown",
          "text": "Trials, at least among the nobility...",
          "document_id": 1
        }
      ]
    }
  ]
  ```
- Response `200` (empty array): No laws in database yet

---

**`GET /laws/{law_id}`**
- Purpose: Get a single law by ID (for deep-linking from citations)
- Response `200`: Single law object with full metadata
- Response `404`: `{ "detail": "Law not found" }`

---

**`POST /documents`**
- Purpose: Upload a new legislation PDF, parse it, persist and index
- Request: `multipart/form-data`
  - `file`: PDF file (required, max 10MB, must be `.pdf`)
  - `name`: string (required, document display name)
  - `jurisdiction`: string (required, e.g., "Kingdom-wide", "The North", "King's Landing")
- Response `201`:
  ```json
  {
    "id": 2,
    "name": "Laws of the Seven Kingdoms",
    "file_name": "laws.pdf",
    "laws_count": 27,
    "uploaded_at": "2026-03-08T12:00:00Z"
  }
  ```
- Response `400`: `{ "detail": "File must be a PDF" }`
- Response `422`: Missing name or file
- Flow: save file to `data/uploads/` → parse PDF → insert document + laws into SQLite (with jurisdiction) → index law + topic chunks into Qdrant (with jurisdiction in payload) → return metadata

---

**`GET /documents`**
- Purpose: List all uploaded legislation documents
- Response `200`:
  ```json
  [
    {
      "id": 1,
      "name": "Laws of the Seven Kingdoms",
      "file_name": "laws.pdf",
      "laws_count": 27,
      "uploaded_at": "2026-03-08T12:00:00Z",
      "uploaded_by": null
    }
  ]
  ```

---

**`GET /documents/{document_id}`**
- Purpose: Get a single document with its law count
- Response `200`: Document metadata
- Response `404`: `{ "detail": "Document not found" }`

---

**`DELETE /documents/{document_id}`**
- Purpose: Remove a document and all its associated laws
- Flow: delete laws from Qdrant index → delete laws from SQLite → delete document from SQLite → delete file from filesystem
- Response `204`: No content (success)
- Response `404`: `{ "detail": "Document not found" }`

---

**`GET /conversations`**
- Purpose: List past conversations (most recent first)
- Query params: `?limit=50` (optional, default 50)
- Response `200`:
  ```json
  [
    {
      "id": 1,
      "query": "What are the tax laws in the North?",
      "jurisdiction": "The North",
      "created_at": "2026-03-09T14:30:00Z"
    }
  ]
  ```
- Note: List endpoint returns summaries only (no response/citations) to keep payload small

---

**`GET /conversations/{conversation_id}`**
- Purpose: Get a single conversation with full response and citations
- Response `200`:
  ```json
  {
    "id": 1,
    "query": "What are the tax laws in the North?",
    "response": "According to Section 5.1...",
    "citations": [{ "source": "5.1", "text": "...", "document_name": "...", "jurisdiction": "Kingdom-wide" }],
    "jurisdiction": "The North",
    "created_at": "2026-03-09T14:30:00Z"
  }
  ```
- Response `404`: `{ "detail": "Conversation not found" }`

---

**`DELETE /conversations/{conversation_id}`**
- Purpose: Delete a single conversation
- Response `204`: No content (success)
- Response `404`: `{ "detail": "Conversation not found" }`

---

Conversation persistence: The `POST /query` endpoint saves the completed response to the `conversations` table after streaming finishes (after the `done` SSE event is emitted). Saving is fire-and-forget -- a DB write failure does not affect the user's response.

#### Startup Flow
1. Initialize SQLite database (create tables if not exist)
2. Ensure `data/` and `data/uploads/` directories exist (create if missing)
3. If no documents in DB (first run): seed `docs/laws.pdf` using `DocumentService.create_documents()` to parse the PDF, then persist to SQLite and copy to `data/uploads/`
4. `QdrantService.connect()` initializes in-memory Qdrant + OpenAI embeddings
5. Load all laws from SQLite into Qdrant vector store (re-index on every startup since Qdrant is in-memory)
6. Server ready to accept queries

#### Configuration (`.env`)
```env
OPENAI_API_KEY=sk-...           # required
LLM_MODEL=gpt-5.4              # default: gpt-5.4
EMBEDDING_MODEL=text-embedding-3-large  # default: text-embedding-3-large (3072 dims)
DATABASE_URL=sqlite:///data/norm.db     # default
UPLOAD_DIR=data/uploads                 # default
SIMILARITY_TOP_K=8                      # default: 8 (number of chunks retrieved per query)
CORS_ORIGINS=http://localhost:3000      # comma-separated
```

Frontend configuration (Next.js `.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:80  # backend URL (default for local dev)
```

All frontend `fetch` calls should use `process.env.NEXT_PUBLIC_API_URL` as the base URL.

#### System Prompt

```
You are a legal compliance assistant for Westeros Capital Group. Your role is to
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
  and region-specific laws. Do not cite laws from unrelated jurisdictions.
```

This prompt is the key guardrail against hallucination. The `CitationQueryEngine` will prepend the retrieved source chunks before this prompt. The explicit refusal instruction for out-of-scope questions is critical — without it, the LLM will confidently make things up. The jurisdiction instructions ensure the model correctly handles the overlap between kingdom-wide and regional laws.

#### Key Implementation Decisions
- **PDF parsing**: Use `pymupdf4llm` for clean markdown extraction, then regex to split on the numbering scheme (`\d+\.\d+\.?...`). The structure is consistent enough that regex is more reliable than LLM-based parsing.
- **LLM/RAG approach**: llama-index 0.14.x (modular) with `CitationQueryEngine` (`from llama_index.core.query_engine import CitationQueryEngine`). Use `Settings` singleton (`from llama_index.core import Settings`) — `ServiceContext` was removed in 0.11. Modular packages: `llama-index-core`, `llama-index-llms-openai`, `llama-index-embeddings-openai`, `llama-index-vector-stores-qdrant`.
- **Streaming**: FastAPI SSE (`from fastapi.sse import EventSourceResponse, ServerSentEvent`) piping OpenAI streaming responses to the frontend. Frontend consumes via `@microsoft/fetch-event-source` (supports POST with body, unlike native `EventSource`).

### AI & RAG Strategy

This section documents the decisions behind how we embed, index, retrieve, and generate — designed to handle a growing corpus of hundreds of laws across many topics and jurisdictions.

**Guiding principle:** Westeros Capital Group has a high token budget and prioritizes accuracy over speed. For legal compliance, a wrong answer is far more costly than a slow one. We optimize for correctness first — using the most capable models, higher-dimensional embeddings, and generous retrieval (k=8). Faster, cheaper models and approaches are on the roadmap once we have broad testing and validation infrastructure (LLM-as-judge, E2E evals) to confirm they don't degrade answer quality.

#### Models

| Concern | Model | Rationale |
|---|---|---|
| **Chat / generation** | `gpt-5.4` | Latest and most capable. Configurable via `LLM_MODEL` env var. |
| **Embeddings** | `text-embedding-3-large` (3072 dims) | Higher accuracy on legal text vs `-small` (~5% improvement). With a growing multi-jurisdiction corpus, disambiguation quality matters more than cost savings. Cost is negligible at our scale. |

#### Chunking Strategy

**Two-tier chunking** — leaf chunks and parent chunks:

1. **Leaf chunks (law-level):** Each individual law (e.g., Section 4.2.3) is one TextNode. These are the citation sources — small enough to be precise, large enough to be self-contained. No overlap between law chunks because they are discrete semantic units (unlike prose paragraphs where overlap prevents boundary artifacts).

2. **Parent chunks (topic-level):** Each top-level topic (e.g., "4. Trials") becomes a TextNode containing all its child laws concatenated. Purpose: when a query is broad ("tell me about trial procedures"), the `AutoMergingRetriever` can return the parent chunk instead of 5 fragmented child chunks, giving the LLM better context. Parent chunks are stored in the docstore alongside leaf chunks.

Implementation builds parent-child relationships manually in the PDF parser (not `HierarchicalNodeParser`, which is designed for prose chunking by character count — our structure is already cleanly segmented by the law numbering scheme). The parser sets `NodeRelationship.PARENT` / `CHILD` on each TextNode so `AutoMergingRetriever` can traverse the hierarchy.

#### Context-Enriched Embeddings

Before embedding, each chunk's text is automatically prepended with its metadata — this is built into LlamaIndex via `MetadataMode.EMBED` and the default `text_template: "{metadata_str}\n\n{content}"`.

For a law like Section 4.2.3, the embedding model sees:
```
topic: Trials
section_title: Trials by combat
jurisdiction: Kingdom-wide
document_name: Laws of the Seven Kingdoms

A more ancient custom, though seldom used, is a trial of seven...
```

This means a query about "combat trials in the North" will have stronger similarity to laws with matching topic/jurisdiction metadata, even if the law text itself doesn't repeat those words. We control which metadata fields reach the embedding vs the LLM via `excluded_embed_metadata_keys` and `excluded_llm_metadata_keys`.

#### Retrieval Strategy

**k=8** (configurable via `SIMILARITY_TOP_K`). Rationale:
- With a large multi-jurisdiction corpus, a query like "tax obligations for merchants in the North" may touch 3-4 tax laws + 2-3 jurisdiction-specific laws. k=4 risks missing relevant chunks.
- The LLM is the final filter — it reads all k chunks but only cites the ones that actually answer the question. Irrelevant chunks are ignored. The bigger risk is *missing* a relevant chunk, not including an irrelevant one.
- 8 paragraph-sized chunks is well within context window limits and doesn't meaningfully impact latency or cost.

**Jurisdiction-aware retrieval via Qdrant payload filtering:**
- Every chunk stored in Qdrant carries `jurisdiction` in its payload, with a payload index for fast filtering.
- When a query references a specific jurisdiction (e.g., "laws in the North"), retrieval filters to `jurisdiction IN ["The North", "Kingdom-wide"]` — region-specific + kingdom-wide laws that always apply.
- When no jurisdiction is specified, no filter is applied (search all).
- Jurisdiction detection from the query is handled by a simple keyword match for MVP (region names are known). Roadmap: LLM-based intent extraction for ambiguous queries.

**`AutoMergingRetriever` for parent-child promotion (`from llama_index.core.retrievers import AutoMergingRetriever`):**
- When multiple child chunks from the same parent topic are retrieved, `AutoMergingRetriever` replaces them with the single parent chunk. This gives the LLM a coherent overview of the topic instead of fragmented pieces.
- Threshold: `simple_ratio_thresh=0.5` — if >=50% of a parent's children match, promote to parent.
- Requires a `SimpleDocumentStore` (`from llama_index.core.storage.docstore import SimpleDocumentStore`) alongside the Qdrant vector store. Both are wired into a shared `StorageContext`:
  - **Docstore** stores ALL nodes (parent + leaf) for ID-based lookup during merge traversal
  - **Vector store** (Qdrant) indexes only leaf nodes for similarity search
  - Both are in-memory, which is architecturally consistent (Qdrant is already in-memory)
- At scale (1000s of nodes across 100s of documents), in-memory docstore uses ~50-100MB — acceptable. For production persistence, `docstore.persist()` / `SimpleDocumentStore.from_persist_dir()` can serialize to disk.
- Composes with `CitationQueryEngine` by passing the retriever directly: `CitationQueryEngine(retriever=auto_merging_retriever, ...)`

#### Generation & Citation

**Retrieval → Generation pipeline assembly:**

```python
from llama_index.core import StorageContext, VectorStoreIndex
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.retrievers import AutoMergingRetriever
from llama_index.core.query_engine import CitationQueryEngine

# 1. Docstore holds all nodes (parent + leaf)
docstore = SimpleDocumentStore()
docstore.add_documents(all_nodes)

# 2. StorageContext wires docstore + vector store
storage_context = StorageContext.from_defaults(
    docstore=docstore,
    vector_store=qdrant_vector_store,
)

# 3. Index only leaf nodes into Qdrant
index = VectorStoreIndex(leaf_nodes, storage_context=storage_context)

# 4. Base retriever → AutoMergingRetriever → CitationQueryEngine
base_retriever = index.as_retriever(similarity_top_k=8)
retriever = AutoMergingRetriever(base_retriever, storage_context, simple_ratio_thresh=0.5)
query_engine = CitationQueryEngine(retriever=retriever, citation_chunk_size=512)
```

- **`CitationQueryEngine`** manages the generate step: it prepends retrieved chunks to the system prompt, the LLM generates a response, and citations are extracted referencing which source chunks were used.
- The LLM decides which retrieved chunks actually apply. A chunk retrieved by vector similarity but not relevant to the specific question is simply not cited. This is the key reason we can afford k=8 — over-retrieval is cheap, under-retrieval is not.
- System prompt explicitly instructs the model to refuse when sources don't support an answer, and to note jurisdiction applicability in citations.

### Frontend Architecture

#### Pages / Routes

**`/` — Home / Query Page**
The main experience. Contains:
- `ConversationSidebar` — collapsible left panel listing past conversations (query text + timestamp), click to load, delete button. Hidden by default on mobile, toggled via hamburger or button. When collapsed, shows a pencil icon (inline SVG) to start a new conversation. When expanded, shows the pencil icon + "New Conversation" label.
- `QueryInput` — text input + submit button, centered when no results, moves to top after submission
- `QueryResponse` — streaming AI answer text with citations
- `CitationList` — expandable citation cards showing section number + law text
- Loading skeleton while waiting for response

**`/documents` — Legislation Browser & Upload**
Linked from the "Documents" nav button. Update `HeaderNav.tsx`: change Documents `linkPath="/"` to `linkPath="/documents"`, and remove the "New Conversation" `NavButton` (moved to conversation sidebar). Contains:
- `UploadDropZone` — click-to-upload or drag-and-drop area. On file selection, opens `UploadModal`.
- `UploadModal` — modal dialog with document name (required) and jurisdiction select (optional, defaults to "Kingdom-wide"). Confirm triggers upload.
- `DocumentList` — list of uploaded legislation documents with upload date, law count, delete button
- `LegislationBrowser` — single-column nested accordion. Top level: topics (1. Peace, 2. Religion...). Expand to reveal sub-topics and individual laws with section numbers and full text. No sidebar/panel split -- one column, collapsible sections.

#### Component Tree
```
Layout (shared)
├── ConversationSidebar (collapsible left)
│   ├── SidebarToggle
│   ├── NewConversationButton (pencil SVG; collapsed = icon only, expanded = icon + "New Conversation")
│   └── ConversationItem[] (query text, timestamp, delete)
└── Main Content

Page (/)
├── HeaderNav (existing)
└── QueryView
    ├── QueryInput (centered initially, top after submit)
    │   ├── TextInput (Chakra)
    │   └── SubmitButton
    ├── QueryResponse (conditional, streams in)
    │   ├── ResponseText (markdown-rendered)
    │   └── CitationList
    │       └── CitationCard[] (section, jurisdiction, text, expandable)
    └── LoadingSkeleton (conditional)

Page (/documents)
├── HeaderNav (existing)
└── DocumentsView
    ├── UploadDropZone (click or drag PDF)
    │   └── UploadModal (on file select)
    │       ├── DocumentNameInput (required)
    │       └── JurisdictionSelect (optional, defaults to Kingdom-wide)
    ├── DocumentList
    │   └── DocumentCard[] (name, upload date, law count, delete)
    └── LegislationBrowser (when document selected)
        └── TopicAccordion[]
            ├── TopicHeader (e.g., "4. Trials")
            └── LawEntry[] (hierarchical, indented by depth)
                ├── SectionNumber (e.g., "4.2.1")
                └── LawText
```

#### UI Mockups

**Query Page -- initial state (sidebar expanded)**
```
+------------------------------------------------------------------+
|            [Norm Logo] | WCG              [Home][Docs]  Tyrion    |
+----------+-------------------------------------------------------+
| [=]      |                                                        |
| [/] New  |                                                        |
|  Conver- |       Westeros Legal Compliance Assistant              |
|  sation  |       Ask a question about the laws of the             |
|----------|       Seven Kingdoms.                                  |
| > Tax    |                                                        |
|   laws.. |       +--------------------------------------+ [Ask]   |
|   3/9    |       | Enter your question...               |         |
|----------|       +--------------------------------------+         |
| > What   |                                                        |
|   happe..|                                                        |
|   3/8    |                                                        |
+----------+-------------------------------------------------------+
```

**Query Page -- after submit (sidebar collapsed)**
```
+------------------------------------------------------------------+
|            [Norm Logo] | WCG              [Home][Docs]  Tyrion    |
+--+---------------------------------------------------------------|
|[=]| +---------------------------------------------------+        |
|[/]| | What are the tax laws in the North?           [Ask]|        |
|   | +---------------------------------------------------+        |
|   |                                                               |
|   | According to the laws of the Seven Kingdoms,                  |
|   | tax obligations in the North include...                       |
|   | [streaming...]                                                |
|   |                                                               |
|   | Citations:                                                    |
|   | +-----------------------------------------------------------+ |
|   | | # 5.1 -- Kingdom-wide                                     | |
|   | | "All lords must pay a tenth of their harvest..."            | |
|   | +-----------------------------------------------------------+ |
|   | | # 5.3 -- The North                                         | |
|   | | "Northern houses owe an additional winter levy..."          | |
|   | +-----------------------------------------------------------+ |
+--+----------------------------------------------------------------+
```

**Documents Page**
```
+------------------------------------------------------------------+
| [=]            [Norm Logo] | WCG     [Home][Docs]  Tyrion  |
+----------+-------------------------------------------------------+
|          |                                                        |
|          |  +--------------------------------------------------+  |
|          |  |                                                  |  |
|          |  |     Drag and drop a PDF here, or click to        |  |
|          |  |     browse                                       |  |
|          |  |                                                  |  |
|          |  +--------------------------------------------------+  |
|          |                                                        |
|          |  Documents                                             |
|          |  +--------------------------------------------------+  |
|          |  | Laws of the Seven Kingdoms  | 27 | 3/8 | [x]    |  |
|          |  +--------------------------------------------------+  |
|          |  | Northern Edicts             | 12 | 3/9 | [x]    |  |
|          |  +--------------------------------------------------+  |
|          |                                                        |
|          |  v 1. Peace                                            |
|          |    1.1 The king's peace shall extend...                |
|          |    1.2 No lord may raise banners...                    |
|          |  > 2. Religion                                         |
|          |  > 3. Widows                                           |
|          |  v 4. Trials                                           |
|          |    v 4.1 Trials of the Crown                           |
|          |      4.1.1 Trials, at least among the nobility...      |
|          |    v 4.2 Trials by Combat                              |
|          |      4.2.1 Any man accused of a crime has the...       |
|          |      4.2.2 The accuser must also name a champion...    |
|          |  > 5. Taxes                                            |
|          |  ...                                                   |
+----------+-------------------------------------------------------+
```

**Upload Modal (appears after file drop/select)**
```
+------------------------------------------+
|  Upload Legislation                   [x] |
|                                           |
|  File: northern-edicts.pdf                |
|                                           |
|  Document Name *                          |
|  +-------------------------------------+ |
|  | Northern Edicts                      | |
|  +-------------------------------------+ |
|                                           |
|  Jurisdiction (optional)                  |
|  +-------------------------------------+ |
|  | The North                          v | |
|  +-------------------------------------+ |
|                                           |
|              [Cancel]  [Upload]           |
+------------------------------------------+
```

#### Styling
- Consistent with existing Norm AI palette: `#2800D7` (primary purple), `#5E6272` (gray), `#FBFBFB` (bg), `#DBDCE1` (borders), `#EEEBFF` (hover bg)
- Use Chakra UI v2 components (already in the project at `^2.8.2` — staying on v2; v3 is a full rewrite not worth the migration cost for this scope)
- Citations get a left-border accent in primary purple to visually distinguish them from the response

### Docker / Infrastructure
- Existing Dockerfile is fine, just needs `requirements.txt` updated
- Add `docker-compose.yml` for convenience (backend on :80, frontend on :3000)
- CORS middleware on FastAPI to allow frontend requests
- `OPENAI_API_KEY` passed via environment variable

### Logging

Structured logging via Python `logging` module with JSON output. Log levels:
- **INFO**: query received, document uploaded, document deleted, startup/seed events
- **WARNING**: slow query (>10s), low relevance score on retrieved chunks
- **ERROR**: OpenAI API failure, Qdrant failure, PDF parse failure, DB write failure

Each log entry includes: timestamp, level, event name, and relevant context (query text, document_id, duration_ms, error detail). No sensitive data (API keys) in logs.

### Error Handling Strategy

| Layer | Error | Surfaced as |
|---|---|---|
| OpenAI API | Rate limit / timeout / key invalid | `503` with `{ "detail": "LLM service unavailable" }` |
| Qdrant | Not initialized / query failure | `503` with `{ "detail": "Search service unavailable" }` |
| PDF parsing | Unparseable PDF / no laws extracted | `400` with `{ "detail": "Could not extract any laws from PDF" }` |
| File upload | Not a PDF / exceeds 10MB | `400` with descriptive message |
| Query | Empty or too long | `422` validation error (Pydantic) |
| Database | SQLite write failure | `500` with `{ "detail": "Database error" }` |

Frontend displays error messages in a toast/alert consistent with Chakra UI patterns. SSE stream errors emit an `error` event that the client handles gracefully.

### Frontend Data Fetching

- **SSE consumption**: Use `@microsoft/fetch-event-source` for `POST /query` (native `EventSource` only supports GET; this library supports POST with request body and typed event handling)
- **REST calls**: Plain `fetch` with a thin wrapper for error handling — no heavy data-fetching library needed for this scope
- **State management**: React `useState`/`useReducer` — no global store needed. Query page state is local (query text, streaming response, citations, loading/error, active conversation ID). Conversation sidebar fetches list on mount and refreshes after each query completes. Documents page fetches on mount.

---

### Testing Strategy

#### Backend Unit Tests (`pytest`)

**PDF Parser — `test_document_service.py`**
| Test | Validates |
|---|---|
| `test_parse_laws_pdf_document_count` | Correct number of leaf-level laws extracted (expected: 27) |
| `test_parse_laws_pdf_first_law` | First law has section="1.1", topic="Peace", correct text |
| `test_parse_laws_pdf_nested_law` | Deeply nested law (e.g., 10.1.1.4) has correct section, topic="Watch", section_title |
| `test_parse_laws_pdf_subtopic_title` | Laws under 4.2.x have section_title="Trials by combat" |
| `test_parse_laws_pdf_all_topics_present` | All 11 topics extracted (Peace through Baking) |
| `test_parse_laws_pdf_text_not_empty` | Every extracted law has non-empty text |
| `test_parse_empty_pdf` | Gracefully returns empty list or raises descriptive error |
| `test_parse_non_pdf_file` | Raises error for non-PDF input |

**Database Models — `test_models.py`**
| Test | Validates |
|---|---|
| `test_create_legislation_document` | Insert and read back document with all fields |
| `test_create_law` | Insert law with FK to document, read back |
| `test_law_document_relationship` | Laws correctly reference their parent document |
| `test_get_laws_by_document_id` | Filter laws by document returns correct subset |
| `test_get_laws_grouped_by_topic` | Grouping logic returns correct structure |

**Qdrant Service — `test_qdrant_service.py`**
| Test | Validates |
|---|---|
| `test_connect_initializes_index` | After connect(), index is not None |
| `test_load_documents` | Loading docs doesn't raise; documents are searchable |
| `test_query_returns_output_shape` | Response has query, response (str), citations (list) |
| `test_query_citations_have_source_and_text` | Each citation has non-empty source and text |
| `test_query_respects_k` | Number of citations <= k |
| `test_query_empty_corpus` | Handles gracefully when no documents loaded |

Note: Qdrant + LLM tests require `OPENAI_API_KEY`. Mark with `@pytest.mark.integration` and skip in CI if key not present.

**API Endpoints — `test_api.py`** (using `httpx.AsyncClient` + FastAPI `TestClient`)
| Test | Validates |
|---|---|
| `test_health_endpoint` | Returns 200 with status, document/law counts |
| `test_query_valid` | POST /query with valid query returns SSE stream |
| `test_query_empty_string` | POST /query with "" returns 422 |
| `test_query_missing_body` | POST /query with no body returns 422 |
| `test_get_laws_returns_list` | GET /laws returns grouped law structure |
| `test_get_laws_filter_by_document` | GET /laws?document_id=1 returns only that doc's laws |
| `test_get_law_by_id` | GET /laws/1 returns single law |
| `test_get_law_not_found` | GET /laws/999 returns 404 |
| `test_upload_document_pdf` | POST /documents with valid PDF returns 201 + metadata |
| `test_upload_document_non_pdf` | POST /documents with .txt returns 400 |
| `test_upload_document_missing_name` | POST /documents without name returns 422 |
| `test_get_documents_list` | GET /documents returns list with law counts |
| `test_get_document_by_id` | GET /documents/1 returns single document |
| `test_get_document_not_found` | GET /documents/999 returns 404 |
| `test_delete_document` | DELETE /documents/1 returns 204, document and laws gone from DB |
| `test_delete_document_not_found` | DELETE /documents/999 returns 404 |
| `test_delete_document_removes_from_qdrant` | After delete, queries no longer return citations from deleted doc |
| `test_upload_then_query` | Upload PDF → query about its content → get relevant citations |
| `test_get_conversations_list` | GET /conversations returns list sorted by most recent |
| `test_get_conversation_by_id` | GET /conversations/1 returns full response + citations |
| `test_get_conversation_not_found` | GET /conversations/999 returns 404 |
| `test_delete_conversation` | DELETE /conversations/1 returns 204, conversation gone |
| `test_delete_conversation_not_found` | DELETE /conversations/999 returns 404 |
| `test_query_saves_conversation` | POST /query → GET /conversations shows new entry |

#### Frontend Unit Tests (`vitest` + React Testing Library)

**Components**
| Test | Validates |
|---|---|
| `QueryInput: renders and accepts text` | Input field present, can type, submit button enabled |
| `QueryInput: calls onSubmit with query text` | Submitting fires callback with input value |
| `QueryInput: disables submit when empty` | Button disabled when input is empty |
| `CitationCard: renders section and text` | Displays section number and law text |
| `CitationCard: expands on click` | Collapsed by default, shows full text on click |
| `CitationList: renders multiple citations` | Renders correct count of CitationCard components |
| `DocumentCard: renders name and date` | Displays document name, upload date, law count |
| `UploadDropZone: accepts PDF drag and drop` | Drop zone triggers modal on valid PDF |
| `UploadDropZone: rejects non-PDF` | Shows error for non-PDF file |
| `UploadModal: submits with name and file` | Calls upload handler with form data |
| `UploadModal: jurisdiction is optional` | Can submit without selecting jurisdiction |
| `LawEntry: renders section number and text` | Hierarchical display with correct indentation |
| `ConversationSidebar: renders past queries` | Shows list of conversations with timestamps |
| `ConversationSidebar: click loads conversation` | Clicking item fires onSelect callback |
| `ConversationSidebar: delete removes item` | Delete button fires onDelete callback |
| `TopicAccordion: expands to show laws` | Click topic header reveals child laws |

#### E2E Tests (Playwright)

Requires both backend and frontend running. Use `docker-compose up` as test fixture.

**Query Flow — `query.spec.ts`**
| Test | Validates |
|---|---|
| `can submit a query and see streaming response` | Type question → submit → response text appears progressively → citations appear after stream completes |
| `citations display section number and text` | Each citation card shows section (e.g., "6.3") and law text |
| `can click citation to expand full text` | Citation card expands to show complete law text |
| `empty query shows validation error` | Submit with empty input → error message or disabled button |
| `new conversation clears previous results` | Click "New Conversation" in sidebar → query input cleared, previous response gone |
| `query appears in conversation sidebar` | Submit query → sidebar shows new conversation entry |
| `can click past conversation to reload` | Click sidebar item → response and citations displayed |
| `can delete a conversation` | Click delete on sidebar item → item removed |
| `error state when backend unavailable` | Kill backend → submit query → error message displayed |

**Document Upload — `documents.spec.ts`**
| Test | Validates |
|---|---|
| `can navigate to documents page` | Click "Documents" nav → documents page loads |
| `displays pre-seeded document` | "Laws of the Seven Kingdoms" visible in document list |
| `can upload a new PDF document` | Drop/select file → modal opens → enter name → upload → document appears in list |
| `upload modal allows optional jurisdiction` | Select jurisdiction in modal → document saved with jurisdiction |
| `upload shows law count after processing` | Newly uploaded document shows correct law count |
| `rejects non-PDF file` | Drop .txt file → error message shown |
| `can browse laws within a document` | Click document → topics expand → individual laws visible |
| `can delete a document` | Click delete on document → confirm → document removed from list |
| `deleted document laws no longer appear in queries` | Delete document → query that previously cited it → no citations from deleted doc |

**Legislation Browser — `legislation.spec.ts`**
| Test | Validates |
|---|---|
| `displays all topics` | All 11 topics visible (Peace through Baking) |
| `topics expand to show laws` | Click topic → child laws displayed with section numbers |
| `nested laws display hierarchy` | Trials > Trials by Combat > 4.2.1, 4.2.2, etc. correctly nested |
| `law text is complete and accurate` | Spot-check specific law text matches PDF source |

#### Test Infrastructure

```
tests/
├── conftest.py              # shared fixtures: test DB, test client, mock services
├── unit/
│   ├── test_document_service.py
│   ├── test_models.py
│   ├── test_qdrant_service.py
│   └── test_api.py
├── integration/
│   └── test_query_pipeline.py   # full flow: parse → index → query (needs API key)
└── e2e/
    ├── playwright.config.ts
    ├── query.spec.ts
    ├── documents.spec.ts
    └── legislation.spec.ts

frontend/
├── __tests__/
│   ├── QueryInput.test.tsx
│   ├── CitationCard.test.tsx
│   ├── CitationList.test.tsx
│   ├── DocumentCard.test.tsx
│   ├── UploadDropZone.test.tsx
│   ├── UploadModal.test.tsx
│   ├── ConversationSidebar.test.tsx
│   ├── TopicAccordion.test.tsx
│   └── LawEntry.test.tsx
```

**Running tests:**
```bash
# Backend unit tests (no API key needed)
pytest tests/unit/ -v

# Backend integration tests (needs OPENAI_API_KEY)
pytest tests/integration/ -v -m integration

# Frontend unit tests
cd frontend && pnpm test

# E2E tests (needs docker-compose up)
cd tests/e2e && npx playwright test
```

---

## Scope Summary

| Feature | MVP | Future |
|---|---|---|
| Natural language query with citations | Yes | |
| Streaming responses (SSE) | Yes | |
| Structured PDF parsing with metadata | Yes | |
| Legislation browser | Yes | |
| Document upload (PDF + name + jurisdiction) | Yes | |
| Document deletion | Yes | |
| SQLite persistence (documents + laws) | Yes | |
| Filesystem document storage | Yes | |
| Configurable LLM model (`gpt-5.4` default) | Yes | |
| `text-embedding-3-large` embeddings (3072 dims) | Yes | |
| Context-enriched embeddings (metadata in embedding text) | Yes | |
| Two-tier chunking (leaf + parent topic chunks) | Yes | |
| `AutoMergingRetriever` for parent-child promotion | Yes | |
| `SimpleDocumentStore` for node hierarchy | Yes | |
| Jurisdiction-aware retrieval (Qdrant payload filtering) | Yes | |
| k=8 retrieval with LLM-based relevance filtering | Yes | |
| System prompt with hallucination guardrails | Yes | |
| Structured logging | Yes | |
| Auto-seed laws.pdf on first run | Yes | |
| Loading/error states | Yes | |
| Docker containerization | Yes | |
| CORS for frontend-backend | Yes | |
| LLM-as-judge validation | | Yes |
| Document versioning / effective dates | | Yes |
| LLM-based jurisdiction intent extraction | | Yes |
| Qdrant `group_by` for result diversity | | Yes |
| Conversation history (persist + sidebar) | Yes | |
| Upload drop zone + modal | Yes | |
| Auth / RBAC | | Yes |

## Library Decisions

| Concern | Choice | Rationale |
|---|---|---|
| RAG / LLM orchestration | **llama-index 0.14.x** (modular packages) | Assignment references it. Migrate from old monolithic imports to `llama-index-core` + integration packages. `ServiceContext` removed in 0.11 — use `Settings` singleton. Core class: `CitationQueryEngine` from `llama_index.core.query_engine`. |
| PDF parsing | **pymupdf4llm** | Best text quality for structured docs, outputs clean markdown, purpose-built for RAG pipelines. |
| Database ORM | **SQLModel** | Built on Pydantic — a model class is simultaneously a Pydantic schema + SQLAlchemy model. Made by the FastAPI author, zero serialization duplication. |
| SSE streaming | **FastAPI built-in** `EventSourceResponse` | `from fastapi.sse import EventSourceResponse, ServerSentEvent`. Available in FastAPI >= 0.135. No extra backend dependency. Frontend uses `@microsoft/fetch-event-source` for POST SSE. |
| Vector store | **qdrant-client** (in-memory) | Already in starter code, solid library, in-memory mode perfect for demo. |
| Embeddings | **OpenAI `text-embedding-3-large`** via llama-index | 3072 dims, best accuracy on legal text. Higher fidelity disambiguation for large multi-jurisdiction corpus. |
| LLM | **OpenAI `gpt-5.4`** via llama-index | Latest model. Configurable via `LLM_MODEL` env var. |

### Python packages

```
# Core
fastapi>=0.135
uvicorn[standard]
pydantic>=2.5
python-multipart      # for file uploads

# LLM / RAG
llama-index-core
llama-index-llms-openai
llama-index-embeddings-openai
llama-index-vector-stores-qdrant
qdrant-client

# PDF parsing
pymupdf4llm

# Database
sqlmodel

# Testing
pytest
pytest-asyncio
httpx                 # for FastAPI async test client
```

### Frontend packages (additions to existing)

```
# SSE client (POST support for EventSource)
@microsoft/fetch-event-source

# Testing
vitest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event

# E2E
@playwright/test
```

## Roadmap / Potential Improvements

### Near-term
- **Qdrant `group_by` for result diversity**: Group retrieval results by `topic` payload field (`group_size=2`) to prevent one heavily-represented topic from dominating all k result slots. This is a native qdrant-client feature (not exposed through llama-index's retriever abstraction), so implementation requires a custom retriever that calls `qdrant_client.query_points_groups()` directly and wraps results back into llama-index `NodeWithScore` objects for CitationQueryEngine. Worth adding once the corpus grows beyond ~50 documents with uneven topic coverage.
- **Drop llama-index for direct OpenAI SDK + qdrant-client**: The `CitationQueryEngine` is essentially 3 steps — embed query, search Qdrant for top-k, prompt LLM with retrieved chunks and a citation instruction. Doing this directly with `openai` SDK + `qdrant-client` would reduce dependencies from ~10 llama-index packages to 2 stable libraries, give full control over the citation prompt template, make streaming trivial (direct OpenAI streaming vs. llama-index abstractions), and simplify debugging. ~50 lines of code replaces the framework layer. Worth doing once the MVP ships and the core flow is proven.
- **LLM-as-judge validation layer**: Run a second (cheaper) model call to validate the primary response — check that cited sections actually support the claims made, flag responses where the model extrapolates beyond sources, and surface a confidence indicator to the user. Critical for legal compliance where a wrong answer has real consequences. Could use a smaller model as judge to keep costs low.
- **LLM-based jurisdiction intent extraction**: Replace keyword-based jurisdiction detection with an LLM call that extracts jurisdiction intent from ambiguous queries (e.g., "can I do X near Winterfell?" → The North).

### Medium-term
- **HyDE (Hypothetical Document Embeddings)**: Generate a hypothetical answer before searching — embed the hypothetical answer instead of the raw query for better retrieval alignment. Particularly useful for complex legal questions where the query phrasing differs from how laws are written.
- **Reranking**: Add a cross-encoder reranking step after initial vector retrieval to improve precision. Retrieve k=20 cheaply via vector search, rerank to top-8 with a cross-encoder model. Trades latency for accuracy.
- Document versioning with effective/sunset dates
- Multi-turn conversation history
- Bulk document upload / batch processing

### Long-term
- Auth/RBAC with role-based document management
- Persistent Qdrant (move off in-memory for production scale)
- Dimension reduction on embeddings (3072 → 1536) if storage/latency becomes a concern at scale
