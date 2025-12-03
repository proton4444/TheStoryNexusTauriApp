from __future__ import annotations

import logging
import uuid
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from sidecar.backends import MemoryEntry, select_backend
from sidecar.settings import Settings
from sidecar.llm import CompletionClient, LlmConfig

logger = logging.getLogger(__name__)

# Minimal FastAPI app; endpoints are wired to a pluggable backend (stub or Memori).
app = FastAPI(
    title="Memori Sidecar",
    version="0.3.0",
    description="FastAPI wrapper around Memori for StoryNexus integration.",
)
settings = Settings()
backend = select_backend(settings)
app.state.backend = backend


def get_backend():
    return app.state.backend


def get_llm_client() -> CompletionClient:
    cfg = LlmConfig(
        provider=settings.llm_provider,
        model=settings.llm_model,
        openai_api_key=settings.openai_api_key,
        openrouter_api_key=settings.openrouter_api_key,
        local_api_url=settings.local_api_url,
    )
    return CompletionClient(cfg)


class CompletionRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    story_id: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    inject_limit: int = Field(default=3, ge=0, le=50)
    model: Optional[str] = None
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)


class CompletionResponse(BaseModel):
    completion: str
    story_id: str
    session_id: str
    injected_memories: List[str]
    llm_provider: str | None = None
    llm_model: str | None = None


class SearchRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    query: str
    limit: int = Field(default=10, ge=1, le=50)


class MemoryResult(BaseModel):
    memory_id: str
    content: str
    category: Optional[str] = None
    session_id: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[MemoryResult]


class ContextRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=0, le=50)


class ContextResponse(BaseModel):
    memories: List[MemoryResult]


class SessionNewRequest(BaseModel):
    story_id: str = Field(..., min_length=1)


class SessionNewResponse(BaseModel):
    story_id: str
    session_id: str


class MemoryAddRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    category: Optional[str] = None
    session_id: Optional[str] = None


class MemoryAddResponse(BaseModel):
    memory_id: str
    story_id: str


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Lightweight health probe for the sidecar."""
    return {"status": "ok"}


@app.post("/session/new", tags=["session"], response_model=SessionNewResponse)
async def session_new(payload: SessionNewRequest) -> SessionNewResponse:
    session_id = str(uuid.uuid4())
    return SessionNewResponse(story_id=payload.story_id, session_id=session_id)


@app.post("/memory/add", tags=["memory"], response_model=MemoryAddResponse)
async def memory_add(payload: MemoryAddRequest) -> MemoryAddResponse:
    entry = get_backend().add_memory(
        story_id=payload.story_id,
        content=payload.content,
        category=payload.category,
        session_id=payload.session_id,
    )
    return MemoryAddResponse(memory_id=entry.memory_id, story_id=entry.story_id)


@app.delete("/memory/{story_id}", tags=["memory"])
async def clear_memory(story_id: str) -> dict[str, int | str]:
    cleared = get_backend().clear_story(story_id)
    return {"story_id": story_id, "cleared": cleared}


@app.post("/search", tags=["memory"], response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    results = get_backend().search(
        story_id=payload.story_id, query=payload.query, limit=payload.limit
    )
    return SearchResponse(
        results=[
            MemoryResult(
                memory_id=entry.memory_id,
                content=entry.content,
                category=entry.category,
                session_id=entry.session_id,
            )
            for entry in results
        ]
    )


@app.post("/context", tags=["memory"], response_model=ContextResponse)
async def context(payload: ContextRequest) -> ContextResponse:
    memories = get_backend().recent(story_id=payload.story_id, limit=payload.limit)
    return ContextResponse(
        memories=[
            MemoryResult(
                memory_id=entry.memory_id,
                content=entry.content,
                category=entry.category,
                session_id=entry.session_id,
            )
            for entry in memories
        ]
    )


@app.post("/completion", tags=["memory"], response_model=CompletionResponse)
async def completion(payload: CompletionRequest) -> CompletionResponse:
    session_id = payload.session_id or str(uuid.uuid4())
    chosen_model = payload.model or settings.llm_model
    chosen_provider = settings.llm_provider
    injected = [
        entry.content
        for entry in get_backend().recent(
            story_id=payload.story_id, limit=payload.inject_limit
        )
    ]
    llm_client = get_llm_client()
    try:
        completion_text = await llm_client.complete(payload.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - runtime failure path
        logger.error("LLM completion failed: %s", exc)
        raise HTTPException(status_code=500, detail="LLM completion failed") from exc
    return CompletionResponse(
        completion=completion_text,
        story_id=payload.story_id,
        session_id=session_id,
        injected_memories=injected,
        llm_provider=chosen_provider,
        llm_model=chosen_model,
    )
