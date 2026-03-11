# Entity-Relationship Diagram

## Entities

### `legislation`

Source law documents uploaded by admins.

| Field | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | INTEGER | -- | auto-increment | PK |
| `name` | TEXT | NO | -- | -- |
| `file_name` | TEXT | NO | -- | -- |
| `file_path` | TEXT | NO | -- | -- |
| `jurisdiction` | TEXT | NO | `"Kingdom-wide"` | -- |
| `uploaded_at` | TIMESTAMP | YES | `now(UTC)` | -- |
| `uploaded_by` | TEXT | YES | `NULL` | -- |

### `laws`

Individual law sections parsed from legislation PDFs.

| Field | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | INTEGER | -- | auto-increment | PK |
| `legislation_id` | INTEGER | NO | -- | FK -> `legislation.id` |
| `section` | TEXT | NO | -- | e.g. `"4.2.3"` |
| `topic` | TEXT | NO | -- | e.g. `"Trials"` |
| `section_title` | TEXT | YES | `NULL` | e.g. `"Trials by Combat"` |
| `text` | TEXT | NO | -- | full law content |
| `jurisdiction` | TEXT | NO | -- | inherited from legislation |
| `created_at` | TIMESTAMP | YES | `now(UTC)` | -- |

### `threads`

Conversation threads for multi-turn queries.

| Field | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | INTEGER | -- | auto-increment | PK |
| `title` | TEXT | NO | -- | first query, truncated ~80 chars |
| `jurisdiction` | TEXT | YES | `NULL` | display context |
| `created_at` | TIMESTAMP | YES | `now(UTC)` | -- |

### `messages`

Individual messages within a conversation thread.

| Field | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | INTEGER | -- | auto-increment | PK |
| `thread_id` | INTEGER | NO | -- | FK -> `threads.id` (CASCADE) |
| `role` | TEXT | NO | -- | `"user"` or `"assistant"` |
| `content` | TEXT | NO | -- | -- |
| `citations` | TEXT | NO | `"[]"` | JSON-serialized list of Citation |
| `created_at` | TIMESTAMP | YES | `now(UTC)` | -- |

## Relationships

```
legislation  1 ──── *  laws         (laws.legislation_id -> legislation.id)
threads      1 ──── *  messages     (messages.thread_id -> threads.id, cascade delete)
```

## Supporting Schemas (not persisted)

### `Citation`

Embedded in `messages.citations` as JSON.

| Field | Type | Nullable |
|---|---|---|
| `source` | str | NO |
| `text` | str | NO |
| `legislation_id` | int | YES |
| `legislation_name` | str | YES |
| `jurisdiction` | str | YES |

### `Jurisdiction` enum

14 values across 3 tiers:

- **Kingdom-wide** -- applies everywhere
- **Regional** (9): The North, The Reach, The Vale, The Westerlands, The Riverlands, The Stormlands, Dorne, The Iron Islands, The Crownlands
- **City** (4): King's Landing, Oldtown, Lannisport, White Harbor
