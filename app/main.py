import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import json as jsonlog

from app.legislation_service import LegislationService
from app.qdrant_service import QdrantService
from app.query_service import QueryService
from app.routes import health, laws, legislation, query, threads
from app.startup import startup

_handler = logging.StreamHandler()
_handler.setFormatter(
    jsonlog.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )
)
logging.basicConfig(level=logging.INFO, handlers=[_handler])

qdrant_service = QdrantService()
query_service = QueryService(qdrant_service)
legislation_service = LegislationService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks (DB init, seed data, Qdrant index) before serving."""
    startup(qdrant_service)
    yield


app = FastAPI(title="Westeros Legal Compliance Assistant", lifespan=lifespan)

# CORS
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire services into route modules
query.init(query_service)
legislation.init(qdrant_service, legislation_service)

# Register routers
app.include_router(health.router)
app.include_router(query.router)
app.include_router(laws.router)
app.include_router(legislation.router)
app.include_router(threads.router)
