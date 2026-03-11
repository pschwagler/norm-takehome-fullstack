# Westeros Legal Compliance Assistant

Full-stack RAG application for querying Westeros Capital Group's legal compliance obligations. FastAPI + LlamaIndex backend, Next.js + Chakra UI frontend.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose (for containerized builds)
- An `OPENAI_API_KEY` in a `.env` file at the project root

## Running

### Docker (recommended)

```sh
npm run build          # build and start both services via Docker Compose
```

Backend runs on `http://localhost:80`, frontend on `http://localhost:3000`.

### Local development

```sh
npm run dev            # start backend (port 8000) and frontend (port 3000) concurrently
npm run dev:backend    # backend only (uvicorn with --reload)
npm run dev:frontend   # frontend only (Next.js dev server)
```

## Testing

```sh
npm test               # run backend and frontend tests sequentially
npm run test:backend   # pytest
npm run test:frontend  # vitest
```

## Linting & Formatting

```sh
npm run lint           # ESLint (frontend)
npm run format         # Prettier write (frontend)
npm run format:check   # Prettier check (frontend)
```
