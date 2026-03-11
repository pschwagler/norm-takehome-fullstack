# Project: Norm AI Take-Home (Westeros Capital Group)

Full-stack legal compliance assistant. FastAPI + LlamaIndex backend, Next.js + Chakra UI frontend.

## Architecture

```
app/           Python backend (FastAPI, Pydantic, LlamaIndex, Qdrant)
frontend/      Next.js 14 App Router (React 18, TypeScript, Chakra UI)
docs/          Assignment spec, design docs, legal data (laws.pdf)
```

## Testing

- **TDD is required.** Write tests before implementation.
- **100% test coverage** target for all new code.
- **Comprehensive E2E tests** for critical user flows.
- Run tests locally before every commit.

## Frontend Conventions

### Formatting (Prettier-enforced)
- Single quotes, semicolons, trailing commas (es5)
- 2-space indent, 80-char line width

### Components
- Functional components, exported default
- Explicit return types: `React.ReactNode` or `JSX.Element`
- Props defined as `interface` (not `type`), destructured in function signature
- Composable via spread: `{ ...rest }` with extended Chakra props (e.g., `FlexProps`)
- `'use client'` only on components/pages that need interactivity

### Naming
- PascalCase: components, enums
- camelCase: variables, functions, props
- SCREAMING_SNAKE: enum values
- `@/` path alias for imports from project root

### Styling
- **Chakra UI prop-based styling is primary.** Do not use raw CSS or lean on Tailwind.
- Responsive via object syntax: `{{ base: 4, md: 8 }}`
- Stick to the Norm brand palette:
  - `#2800D7` brand purple
  - `#5E6272` neutral gray
  - `#FBFBFB` background
  - `#DBDCE1` border
  - `#EEEBFF` hover purple (light)
- `react-icons` for standard icons; inline SVG only for one-offs
- Hover state via `useState` + mouse events (not CSS-only) when behavior differs

### Patterns
- Runtime validation for conflicting props (`throw new Error`)
- No premature abstractions -- keep components single-responsibility
- No state management library yet; local state with `useState`

## Backend Conventions

### Style
- `snake_case` for modules, functions, variables
- `PascalCase` for classes
- Type hints on all method signatures
- Minimal comments; docstrings only where non-obvious

### Models
- Pydantic `BaseModel` for anything crossing the API boundary
- `@dataclass` for internal-only data structures

### Architecture
- Service-class pattern: encapsulate domain logic, expose clean methods (e.g., `connect()`, `load()`, `query()`)
- FastAPI for endpoints, Pydantic for serialization
- LlamaIndex for RAG orchestration
- Environment variables via `os.environ` (fail loud if missing)

## General

- No emojis in code, comments, or documentation
- Prefer immutability
- Many small files over few large ones (200-400 lines typical, 800 max)
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Small, focused commits
