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


def get_llm_client(model: Optional[str] = None) -> CompletionClient:
    effective_model = model or settings.llm_model
    cfg = LlmConfig(
        provider=settings.llm_provider,
        model=effective_model,
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
    max_tokens: Optional[int] = Field(default=512, ge=1, le=8192)
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2.0)
    max_context_tokens: int = Field(default=2000, ge=100, le=8000)


class CompletionResponse(BaseModel):
    completion: str
    story_id: str
    session_id: str
    injected_memories: List[str]
    extracted_entities: List[str] = Field(default_factory=list)
    llm_provider: str | None = None
    llm_model: str | None = None


class SearchRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    query: str
    limit: int = Field(default=10, ge=1, le=50)


class MemoryResult(BaseModel):
    memory_id: str
    story_id: str
    content: str
    category: Optional[str] = None
    session_id: Optional[str] = None
    created_at: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[MemoryResult]
    total: Optional[int] = None


class ContextRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=0, le=50)


class ContextResponse(BaseModel):
    memories: List[MemoryResult]


class MemoryListRequest(BaseModel):
    story_id: Optional[str] = None
    query: Optional[str] = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class MemoryListResponse(BaseModel):
    memories: List[MemoryResult]
    total: int


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


class ExtractFromTextRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    extract_types: List[str] = Field(default=["characters", "locations", "items", "facts"])
    model: Optional[str] = None  # LLM model to use (defaults to settings.llm_model)


class ExtractedMemory(BaseModel):
    memory_id: str
    content: str
    category: str


class ExtractFromTextResponse(BaseModel):
    extracted_count: int
    memories: List[ExtractedMemory]


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


async def _extract_entities_from_text(
    text: str,
    extract_types: List[str] = None,
    model: Optional[str] = None,
) -> dict:
    """
    Extract entities from text using LLM or stub fallback.
    Returns a dict mapping category -> list of entity strings.
    """
    import json as json_module
    
    if extract_types is None:
        extract_types = ["characters", "locations", "items", "facts"]
    
    extracted_data: dict = {}
    
    # Check if we're using stub provider - use regex fallback
    if settings.llm_provider == "stub":
        logger.debug("Using stub extraction fallback (regex-based)")
        words = text.split()
        potential_entities = []
        
        i = 0
        while i < len(words):
            word = words[i].strip(".,!?;:\"'()")
            if word and len(word) > 1 and word[0].isupper():
                entity_parts = [word]
                j = i + 1
                while j < len(words):
                    next_word = words[j].strip(".,!?;:\"'()")
                    if next_word and next_word[0].isupper():
                        entity_parts.append(next_word)
                        j += 1
                    else:
                        break
                entity_name = " ".join(entity_parts)
                skip_words = {"The", "A", "An", "In", "On", "At", "To", "For", "With", "From", "By", "As", "It", "Is", "Was", "Were", "Are", "Be", "Been", "Being", "Have", "Has", "Had", "Do", "Does", "Did", "Will", "Would", "Could", "Should", "May", "Might", "Must", "Shall", "Can", "But", "And", "Or", "If", "Then", "So", "Yet", "No", "Not", "Only", "Just", "Also", "Very", "Too", "Even", "Still", "Already", "I", "You", "He", "She", "We", "They"}
                if entity_name not in skip_words and len(entity_name) > 1:
                    potential_entities.append(entity_name)
                i = j
            else:
                i += 1
        
        seen = set()
        unique_entities = []
        for e in potential_entities:
            if e.lower() not in seen:
                seen.add(e.lower())
                unique_entities.append(e)
        
        if "characters" in extract_types:
            extracted_data["characters"] = [f"{e}: A character" for e in unique_entities[:3]]
        if "locations" in extract_types:
            locations = [e for e in unique_entities if " " in e]
            extracted_data["locations"] = [f"{e}: A location" for e in locations[:3]]
        if "items" in extract_types:
            item_keywords = ["key", "sword", "ring", "book", "scroll", "potion", "gem", "stone", "artifact", "staff", "wand", "amulet", "crown", "treasure"]
            items = [e for e in unique_entities if any(kw in e.lower() for kw in item_keywords)]
            extracted_data["items"] = [f"{e}: An item" for e in items[:3]]
        if "facts" in extract_types and len(text) > 50:
            # Only add fact if text is substantial
            extracted_data["facts"] = [text[:200] + "..." if len(text) > 200 else text]
    else:
        # Real LLM extraction
        types_str = ", ".join(extract_types)
        extraction_prompt = f"""Extract all {types_str} from this text. Return ONLY valid JSON with no additional text:
{{"characters": ["name: description", ...], "locations": ["name: description", ...], "items": ["name: description", ...], "facts": ["fact statement", ...]}}

Only include categories that were requested. If none found for a category, use empty array.

Text:
{text}"""
        
        try:
            llm_client = get_llm_client(model)
            print(f"DEBUG_EXTRACT: Sending extraction request. Text len: {len(text)}", flush=True)
            llm_response = await llm_client.complete(extraction_prompt)
            print(f"DEBUG_EXTRACT: LLM response: {llm_response}", flush=True)
            
            response_text = llm_response.strip()
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}") + 1
            if start_idx != -1 and end_idx > 0:
                json_str = response_text[start_idx:end_idx]
                extracted_data = json_module.loads(json_str)
        except Exception as exc:
            logger.warning("LLM extraction failed, returning empty: %s", exc)
    
    return extracted_data


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


class MemoryItem(BaseModel):
    content: str = Field(..., min_length=1)
    category: Optional[str] = None
    session_id: Optional[str] = None


class MemoryBulkAddRequest(BaseModel):
    story_id: str = Field(..., min_length=1)
    items: List[MemoryItem]


class MemoryBulkAddResponse(BaseModel):
    story_id: str
    count: int


@app.post("/memory/add/bulk", tags=["memory"], response_model=MemoryBulkAddResponse)
async def memory_add_bulk(payload: MemoryBulkAddRequest) -> MemoryBulkAddResponse:
    items = [item.dict() for item in payload.items]
    entries = get_backend().add_memories(story_id=payload.story_id, items=items)
    return MemoryBulkAddResponse(story_id=payload.story_id, count=len(entries))


@app.delete("/memory/{story_id}/{memory_id}", tags=["memory"])
async def delete_memory(story_id: str, memory_id: str) -> dict[str, bool]:
    deleted = get_backend().delete_memory(story_id=story_id, memory_id=memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": deleted}


@app.post("/memory/list", tags=["memory"], response_model=MemoryListResponse)
async def list_memories(payload: MemoryListRequest) -> MemoryListResponse:
    results = get_backend().list_memories(
        story_id=payload.story_id,
        query=payload.query,
        limit=payload.limit,
        offset=payload.offset,
    )
    try:
        total = get_backend().count_memories(payload.story_id, payload.query)
    except Exception as exc:
        logger.warning("Could not compute memory total: %s", exc)
        total = payload.offset + len(results)

    return MemoryListResponse(
        memories=[
            MemoryResult(
                memory_id=entry.memory_id,
                story_id=entry.story_id,
                content=entry.content,
                category=entry.category,
                session_id=entry.session_id,
                created_at=entry.created_at,
            )
            for entry in results
        ],
        total=total,
    )


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


@app.post("/extract-from-text", tags=["memory"], response_model=ExtractFromTextResponse)
async def extract_from_text(payload: ExtractFromTextRequest) -> ExtractFromTextResponse:
    """Use LLM to extract structured entities from text and store as memories."""
    # Use the shared extraction function with the model from payload
    extracted_data = await _extract_entities_from_text(
        text=payload.text,
        extract_types=payload.extract_types,
        model=payload.model,
    )
    
    # Store each extracted item as a memory
    memories: List[ExtractedMemory] = []
    
    for category in payload.extract_types:
        items = extracted_data.get(category, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not item or not isinstance(item, str):
                continue
            entry = get_backend().add_memory(
                story_id=payload.story_id,
                content=item,
                category=category.rstrip("s"),  # "characters" -> "character"
                session_id=None,
            )
            memories.append(ExtractedMemory(
                memory_id=entry.memory_id,
                content=item,
                category=category.rstrip("s"),
            ))
    
    return ExtractFromTextResponse(extracted_count=len(memories), memories=memories)


@app.delete("/memory/{story_id}", tags=["memory"])
async def clear_memory(story_id: str) -> dict[str, int | str]:
    cleared = get_backend().clear_story(story_id)
    return {"story_id": story_id, "cleared": cleared}


@app.post("/search", tags=["memory"], response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    results = get_backend().search(
        story_id=payload.story_id, query=payload.query, limit=payload.limit
    )
    try:
        total = get_backend().count_memories(payload.story_id, payload.query)
    except Exception as exc:
        logger.warning("Could not compute search total: %s", exc)
        total = len(results)
    return SearchResponse(
        results=[
            MemoryResult(
                memory_id=entry.memory_id,
                story_id=entry.story_id,
                content=entry.content,
                category=entry.category,
                session_id=entry.session_id,
                created_at=entry.created_at,
            )
            for entry in results
        ],
        total=total,
    )


@app.post("/context", tags=["memory"], response_model=ContextResponse)
async def context(payload: ContextRequest) -> ContextResponse:
    memories = get_backend().recent(story_id=payload.story_id, limit=payload.limit)
    return ContextResponse(
        memories=[
            MemoryResult(
                memory_id=entry.memory_id,
                story_id=entry.story_id,
                content=entry.content,
                category=entry.category,
                session_id=entry.session_id,
                created_at=entry.created_at,
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
    augmented_prompt = payload.prompt
    if injected:
        # Simple token estimation: ~4 characters per token
        current_context_tokens = 0
        budget = payload.max_context_tokens
        kept_memories = []
        
        # Prioritize keeping the most recent/relevant ones (already sorted/deduped)
        for mem in injected:
            est_tokens = len(mem) // 4 + 2  # +2 for bullet point overhead
            if current_context_tokens + est_tokens > budget:
                break
            kept_memories.append(mem)
            current_context_tokens += est_tokens
            
        if kept_memories:
            context_block = "\n".join(f"- {m}" for m in kept_memories)
            augmented_prompt = (
                f"Here is some relevant context from the story:\n{context_block}\n\n"
                f"Use the above context if relevant to answer or continue the following:\n{payload.prompt}"
            )
            injected = kept_memories  # reflect what was actually injected
            logger.info("Injected %d memories (~%d tokens)", len(kept_memories), current_context_tokens)
        else:
            logger.info("Context budget too small, dropped all %d memories", len(injected))

    llm_client = get_llm_client(chosen_model)
    try:
        completion_text = await llm_client.complete(
            augmented_prompt,
            max_tokens=payload.max_tokens or 512,
            temperature=payload.temperature or 0.7,
        )
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

    # Auto-extract entities from the completion text and store as memories
    extracted_entities: List[str] = []
    try:
        extraction_data = await _extract_entities_from_text(
            completion_text,
            extract_types=["characters", "locations", "items"],  # Skip "facts" to avoid duplication
            model=chosen_model,
        )
        for category, items in extraction_data.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not item or not isinstance(item, str):
                    continue
                # Store each extracted entity as a memory
                get_backend().add_memory(
                    story_id=payload.story_id,
                    content=item,
                    category=category.rstrip("s"),  # "characters" -> "character"
                    session_id=session_id,
                )
                extracted_entities.append(item)
        logger.info("Auto-extracted %d entities from completion", len(extracted_entities))
    except Exception as exc:  # pragma: no cover - best-effort extraction
        logger.warning("Could not auto-extract entities: %s", exc)

    return CompletionResponse(
        completion=completion_text,
        story_id=payload.story_id,
        session_id=session_id,
        injected_memories=injected,
        extracted_entities=extracted_entities,
        llm_provider=chosen_provider,
        llm_model=chosen_model,
    )
