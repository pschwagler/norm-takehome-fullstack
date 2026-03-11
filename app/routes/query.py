import json
import logging

from fastapi import APIRouter
from starlette.responses import StreamingResponse

from app.models import Output, QueryRequest
from app.query_service import QueryService, stream_and_filter

logger = logging.getLogger(__name__)

router = APIRouter()

# Injected by main.py at startup
_query_service: QueryService | None = None


def init(service: QueryService) -> None:
    """Inject the shared QueryService instance from the app entrypoint."""
    global _query_service
    _query_service = service


def _sse(data: str, event: str) -> str:
    """Format a single Server-Sent Event frame."""
    return f"event: {event}\ndata: {data}\n\n"


@router.post("/query")
async def query_laws(request: QueryRequest):
    async def event_generator():
        try:
            full_response = ""
            final_citations = []
            thread_id = request.thread_id

            async for token, citations, tid, corrected in stream_and_filter(
                _query_service,
                request.query,
                request.jurisdiction,
                request.thread_id,
            ):
                if token is not None:
                    full_response += token
                    yield _sse(json.dumps({"data": token}), "token")
                elif citations is not None:
                    final_citations = citations
                    if corrected is not None:
                        full_response = corrected
                    yield _sse(
                        json.dumps({"data": [c.model_dump() for c in citations]}),
                        "citations",
                    )
                elif tid is not None:
                    thread_id = tid

            done_event = Output(
                query=request.query,
                response=full_response,
                citations=final_citations,
                thread_id=thread_id,
            )
            yield _sse(done_event.model_dump_json(), "done")

        except Exception as e:
            logger.exception("Query failed")
            yield _sse(json.dumps({"detail": str(e)}), "error")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
