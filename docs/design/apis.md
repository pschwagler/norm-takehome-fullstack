# API Reference

Base URL: `http://localhost:80` (Docker) or `http://localhost:8000` (local dev)

## Health

### `GET /health`

System health check with indexed counts.

**Response `200`:**
```json
{
  "status": "ok",
  "legislation_loaded": 3,
  "laws_indexed": 147
}
```

---

## Query

### `POST /query`

Submit a natural-language legal query. Returns an SSE stream.

**Request:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `query` | string | YES | 1-1000 chars |
| `jurisdiction` | string | NO | -- |
| `thread_id` | int | NO | existing thread to append to |

**Response:** `text/event-stream`

| SSE Event | Payload |
|---|---|
| `token` | `{"data": "<token>"}` |
| `citations` | `{"data": [Citation, ...]}` |
| `done` | `{"query": "...", "response": "...", "citations": [...], "thread_id": 42}` |
| `error` | `{"detail": "<message>"}` |

---

## Laws

### `GET /laws`

List all laws grouped by topic. Optionally filter by legislation or jurisdiction.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `legislation_id` | int | filter by source legislation |
| `jurisdiction` | string | filter by jurisdiction |

**Response `200`:** `list[LawGroup]`
```json
[
  {
    "topic": "Trials",
    "laws": [
      {
        "id": 1,
        "section": "4.2.3",
        "topic": "Trials",
        "section_title": "Trials by Combat",
        "text": "...",
        "jurisdiction": "Kingdom-wide",
        "legislation_id": 1
      }
    ]
  }
]
```

### `GET /laws/{law_id}`

Get a single law by ID.

**Response `200`:** `Law`
**Response `404`:** `{"detail": "Law not found"}`

---

## Legislation

### `POST /legislation`

Upload a new legislation PDF. Parses, persists, and indexes for RAG retrieval.

**Request:** `multipart/form-data`
| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | YES | PDF only, max 10 MB |
| `name` | string | YES | display name |
| `jurisdiction` | string | NO | default `"Kingdom-wide"` |

**Response `201`:**
```json
{
  "id": 2,
  "name": "Laws of the Seven Kingdoms",
  "file_name": "laws.pdf",
  "laws_count": 147,
  "uploaded_at": "2026-03-11T00:00:00Z"
}
```

**Response `400`:** not PDF, exceeds 10 MB, or no parseable laws.

### `GET /legislation`

List all uploaded legislation documents with law counts.

**Response `200`:** `list[Legislation]`
```json
[
  {
    "id": 1,
    "name": "Laws of the Seven Kingdoms",
    "file_name": "laws.pdf",
    "jurisdiction": "Kingdom-wide",
    "laws_count": 147,
    "uploaded_at": "2026-03-11T00:00:00Z",
    "uploaded_by": null
  }
]
```

### `GET /legislation/{legislation_id}`

Get a single legislation document by ID.

**Response `200`:** `Legislation` (same shape as list item)
**Response `404`:** `{"detail": "Legislation not found"}`

### `DELETE /legislation/{legislation_id}`

Delete legislation, its laws, Qdrant vectors, and the PDF file.

**Response `204`:** no content
**Response `404`:** `{"detail": "Legislation not found"}`

---

## Threads

### `GET /threads`

List conversation threads (most recent first).

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 50 | max threads to return |

**Response `200`:** `list[ThreadSummary]`
```json
[
  {
    "id": 5,
    "title": "What crimes carry the death penalty?",
    "jurisdiction": null,
    "message_count": 4,
    "created_at": "2026-03-11T00:00:00Z"
  }
]
```

### `GET /threads/{thread_id}`

Get a thread with its full message history.

**Response `200`:** `ThreadDetail`
```json
{
  "id": 5,
  "title": "What crimes carry the death penalty?",
  "jurisdiction": null,
  "created_at": "2026-03-11T00:00:00Z",
  "messages": [
    {
      "id": 10,
      "role": "user",
      "content": "What crimes carry the death penalty?",
      "citations": [],
      "created_at": "2026-03-11T00:00:00Z"
    },
    {
      "id": 11,
      "role": "assistant",
      "content": "Under the Laws of the Seven Kingdoms...",
      "citations": [{"source": "4.1.3", "text": "...", "legislation_id": 1, "legislation_name": "Laws of the Seven Kingdoms", "jurisdiction": "Kingdom-wide"}],
      "created_at": "2026-03-11T00:00:00Z"
    }
  ]
}
```

**Response `404`:** `{"detail": "Thread not found"}`

### `DELETE /threads/{thread_id}`

Delete a thread and all its messages (cascade).

**Response `204`:** no content
**Response `404`:** `{"detail": "Thread not found"}`

---

## Summary

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check + counts |
| POST | `/query` | SSE streaming RAG query |
| GET | `/laws` | List laws grouped by topic |
| GET | `/laws/{law_id}` | Get single law |
| POST | `/legislation` | Upload legislation PDF |
| GET | `/legislation` | List all legislation |
| GET | `/legislation/{id}` | Get single legislation |
| DELETE | `/legislation/{id}` | Delete legislation + laws + vectors |
| GET | `/threads` | List conversation threads |
| GET | `/threads/{id}` | Get thread with messages |
| DELETE | `/threads/{id}` | Delete thread + messages |
