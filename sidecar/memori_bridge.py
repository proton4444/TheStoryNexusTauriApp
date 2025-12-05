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

tags_metadata = [
    {"name": "system", "description": "Health and configuration endpoints"},
    {"name": "memory", "description": "Manual memory management endpoints"},
    {"name": "session", "description": "Session lifecycle endpoints"},
    {"name": "completion", "description": "Memory-aware LLM completion"},
]

# Minimal FastAPI app; endpoints are wired to a pluggable backend (stub or Memori).
app = FastAPI(
    title="Memori Sidecar",
    version="0.4.0",
    description="FastAPI wrapper around Memori for StoryNexus integration.",
    openapi_tags=tags_metadata,
)

# Add CORS middleware to allow requests from web dev server
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://127.0.0.1:1420", "http://localhost:4173", "http://127.0.0.1:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class ExtractionRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    completion: str = Field(..., min_length=1)
    category: Optional[str] = None
    session_id: Optional[str] = None


class ExtractionResponse(BaseModel):
    memory_id: str
    story_id: str


class IngestRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    completion: str = Field(..., min_length=1)
    injected_memories: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    session_id: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    max_chars: int = Field(default=4000, ge=500, le=20000)


class IngestResponse(BaseModel):
    memory_id: str
    story_id: str
    truncated: bool


def _build_ingest_content(
    prompt: str,
    completion: str,
    injected: List[str],
    provider: Optional[str],
    model: Optional[str],
    max_chars: int,
) -> tuple[str, bool]:
    header = f"Provider: {provider or 'unknown'} | Model: {model or 'unknown'} | Injected: {len(injected)}"
    combined = (
        f"{header}\n\n"
        f"Prompt:\n{prompt}\n\n"
        f"Completion:\n{completion}\n\n"
        f"Injected memories:\n" + "\n".join(injected)
    )
    if len(combined) <= max_chars:
        return combined, False
    return combined[:max_chars], True


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Lightweight health probe for the sidecar."""
    return {"status": "ok"}


@app.get("/config", tags=["system"])
async def config_snapshot() -> dict[str, str | int | None]:
    """Return a minimal snapshot of configured backend/LLM settings (redacted keys)."""
    return {
        "backend": settings.backend,
        "host": settings.host,
        "port": settings.port,
        "process_id": settings.process_id,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
    }


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


@app.post("/extract", tags=["memory"], response_model=ExtractionResponse)
async def extract(payload: ExtractionRequest) -> ExtractionResponse:
    """Store a combined prompt+completion artifact for later recall."""
    combined = f"Prompt:\\n{payload.prompt}\\n\\nCompletion:\\n{payload.completion}"
    entry = get_backend().add_memory(
        story_id=payload.story_id,
        content=combined,
        category=payload.category or "extraction",
        session_id=payload.session_id,
    )
    return ExtractionResponse(memory_id=entry.memory_id, story_id=entry.story_id)


@app.post("/ingest", tags=["memory"], response_model=IngestResponse)
async def ingest(payload: IngestRequest) -> IngestResponse:
    """Store prompt, completion, and injected memories in one artifact."""
    combined, truncated = _build_ingest_content(
        prompt=payload.prompt,
        completion=payload.completion,
        injected=payload.injected_memories,
        provider=payload.llm_provider,
        model=payload.llm_model,
        max_chars=payload.max_chars,
    )
    entry = get_backend().add_memory(
        story_id=payload.story_id,
        content=combined,
        category=payload.category or "ingest",
        session_id=payload.session_id,
    )
    return IngestResponse(memory_id=entry.memory_id, story_id=entry.story_id, truncated=truncated)


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
    
    # Get recent memories
    recent_memories = get_backend().recent(
        story_id=payload.story_id, limit=payload.inject_limit
    )
    
    # Also search for relevant memories based on prompt
    search_results = get_backend().search(
        story_id=payload.story_id, query=payload.prompt[:500], limit=payload.inject_limit
    )
    
    # Merge unique memories (recent + relevant)
    seen_ids = set()
    injected = []
    for entry in recent_memories + search_results:
        if entry.memory_id not in seen_ids:
            seen_ids.add(entry.memory_id)
            injected.append(entry.content)
        if len(injected) >= payload.inject_limit * 2:  # Cap at 2x limit
            break
    llm_client = get_llm_client()
    try:
        completion_text = await llm_client.complete(payload.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - runtime failure path
        logger.error("LLM completion failed: %s", exc)
        raise HTTPException(status_code=500, detail="LLM completion failed") from exc
    # Store the completion text as a memory entry for downstream context.
    try:
        get_backend().add_memory(
            story_id=payload.story_id,
            content=completion_text,
            category="completion",
            session_id=session_id,
        )
    except Exception as exc:  # pragma: no cover - best-effort persistence
        logger.warning("Could not persist completion memory: %s", exc)

    # Store combined prompt + completion + injected memories for conscious ingest.
    try:
        combined, truncated = _build_ingest_content(
            prompt=payload.prompt,
            completion=completion_text,
            injected=injected,
            provider=chosen_provider,
            model=chosen_model,
            max_chars=payload.inject_limit * 2000 if payload.inject_limit else 4000,
        )
        get_backend().add_memory(
            story_id=payload.story_id,
            content=combined,
            category="ingest",
            session_id=session_id,
        )
    except Exception as exc:  # pragma: no cover - best-effort persistence
        logger.warning("Could not persist ingest artifact: %s", exc)

    return CompletionResponse(
        completion=completion_text,
        story_id=payload.story_id,
        session_id=session_id,
        injected_memories=injected,
        llm_provider=chosen_provider,
        llm_model=chosen_model,
    )
