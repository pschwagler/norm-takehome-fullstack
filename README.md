# Westeros Legal Compliance Assistant

Full-stack RAG application for querying Westeros Capital Group's legal compliance obligations. FastAPI + LlamaIndex backend, Next.js + Chakra UI frontend.

# Reflective Response Section

## What unique challenges do you foresee in developing and integrating AI regulatory agents for legal compliance from a full-stack perspective? How would you address these challenges to make the system robust and user-friendly?

There is an abundance of complexity and challenges in developing and deploying AI regulatory agents.

LLMs and surrounding technology is very new. LLM responses can sometimes be a black box, and the technology is progressing at an immense pace. The way to solve a problem with AI today may be completely different from what was necessary even just a few months ago.

Legal compliance is complex and can sometimes be ambiguous. There is a lot of unstructured, messy data, and is constantly is changing. There are new laws and amendments, changing policies, and laws can affect different jurisdictions, business teams, and topics. There are also different interpretations of those laws by attorneys, compliance officers, and regulatory agencies. The stakes are often also very high - compliance mishaps can be dangerous, costly, and affect companies' public standing.

The good news on LLM progression is that developers constantly have better tools for innovating and building solutions. AI coding has enabled good developers to build quickly and spend more of their effort on problem solving and big picture thinking. Building in test coverage, monitoring, and testing POCs is now much cheaper and can be invested in much more easily. Good monitoring is especially important in this era. The pace of new code being deployed is high, leaving more room for potential issues. Monitoring is paramount for understanding when things are broken or not behaving correctly. 

Code quality is also paramount. A coding agent comes into existance without any prior knowledge and has to find clues in the repo and learn how the app works before responding to a new developer query. Quality code means the agent will learn with fewer tokens and enable easier response to new requirements. Simpler solutions also allow for fewer points of failure or compounding error. In this exercise, I introduced a separate LLM call to filter the citations, but quickly realized the additional complexity was actually a much worse solution and harder to coordinate.

For the complexity and ambiguity of compliance, building solutions that work well solve for the real requirements helps users gain trust in the company and naturally offers better adoption. This requires a deep understanding of current work flows and pain points, and success criteria of the users to come up with the true requirements. Parsing the underlying requirements well and identifying edge cases is paramount. Also, building trust through consistency always helps. When a user comes with a problem, it's important to aknowledge it and consistently deliver solutions / improvements.


## Documentation

- [Product Requirements (PRD)](docs/design/prd.md) -- features, user stories, architecture, and technical spec
- [API Reference](docs/design/apis.md) -- all REST endpoints with request/response schemas
- [Entity-Relationship Diagram](docs/design/erd.md) -- database models and relationships
- [Assignment Spec](docs/assignment.md) -- original take-home prompt

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
npm test               # run all tests (backend + frontend)
npm run test:backend   # pytest (Python unit/integration tests)
npm run test:frontend  # vitest (React component + unit tests)
npx playwright test    # Playwright E2E tests (requires running app)
```

### Coverage

```sh
# backend -- pytest with coverage report
pytest tests/ --cov=app --cov-report=term-missing

# frontend -- vitest with v8 coverage
npm run test:run --prefix frontend -- --coverage
```

## Linting & Formatting

```sh
npm run lint           # ESLint (frontend)
npm run format         # Prettier auto-fix (frontend)
npm run format:check   # Prettier check (frontend)
```

### Run all checks

```sh
npm run format:check && npm run lint && npm test
```
