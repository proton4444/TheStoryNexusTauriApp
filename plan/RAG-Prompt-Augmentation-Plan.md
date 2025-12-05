# RAG Prompt Augmentation Implementation Plan

**Date**: 2025-12-05  
**Status**: Planning  
**Goal**: Implement end-to-end memory-augmented generation (RAG) so that retrieved memories are prepended to the LLM prompt.

---

## Current State Analysis

### What Exists ✅
| Layer | Component | Status |
|-------|-----------|--------|
| Backend | `/completion` endpoint retrieves recent + semantic search results | ✅ Working |
| Backend | `injected` list populated with deduplicated memory content | ✅ Working |
| Backend | `augmented_prompt` prepends context to user prompt | ✅ **Recently Fixed** |
| Frontend | `useMemoryCompletion` hook calls `/completion` | ✅ Working |
| Frontend | `useAIStore.generateWithMemoryPrompt` updates `lastInjectedContext` | ✅ Working |
| Frontend | `ContextViewer` displays injected context in Memory Panel | ✅ Working |

### What's Missing ❌
| Gap | Description | Priority |
|-----|-------------|----------|
| **No streaming support** | `/completion` returns full response; no SSE/chunked transfer | P2 |
| **Semantic search inactive** | `stub_embeddings=true` by default → falls back to SQL LIKE | P1 |
| **No UI toggle** | User cannot enable/disable memory injection per-request | P2 |
| **Token budget unmanaged** | Context block size is unbounded; can exceed model limits | P1 |
| **No relevance scoring** | All memories weighted equally; no filtering by score | P2 |
| **Prompt format not configurable** | Hardcoded "Here is some relevant context..." template | P3 |

---

## Implementation Phases

### Phase 1: Core RAG Loop (Backend) — P1
**Goal**: Guarantee that memories flow into the LLM prompt correctly.

#### 1.1 Verify Current Fix
- [x] `augmented_prompt` is built when `injected` is non-empty (lines 540-546 in `memori_bridge.py`)
- [ ] Add unit test: mock backend returns 2 memories → assert they appear in the prompt sent to `llm_client.complete`
- [ ] Add integration test: POST `/completion` with story that has 3 memories → response `injected_memories` matches content

#### 1.2 Token Budget Management
**Problem**: If a story has 100 long memories, injecting all of them will overflow the context window.

**Solution**:
```python
# In CompletionRequest schema
max_context_tokens: int = Field(default=2000, ge=100, le=8000)
```

**Implementation**:
1. Accept `max_context_tokens` in request payload.
2. After collecting `injected` list, estimate token count (approx 4 chars/token).
3. Truncate oldest/lowest-score memories until under budget.
4. Log `injected_token_estimate` in response for debugging.

**Files**:
- `sidecar/memori_bridge.py`: Add field to `CompletionRequest`, truncation logic before prompt build.
- `src/services/memory/memoryService.ts`: Add optional `maxContextTokens` to `CompletionRequest` type.

#### 1.3 Enable Semantic Search
**Problem**: `stub_embeddings=true` disables vector recall; falls back to keyword SQL.

**Solution**:
1. Document how to set `MEMORI_SIDECAR_STUB_EMBEDDINGS=false`.
2. Ensure `sentence-transformers` is installed in sidecar venv.
3. Add a `/config` endpoint field: `"semantic_search_enabled": bool`.

**Files**:
- `sidecar/settings.py`: Already has `stub_embeddings` flag.
- `sidecar/backends.py`: Already uses `Recall.search_facts` when enabled.
- `plan/StoryNexus-Test-Checklist.md`: Add semantic search verification step.

---

### Phase 2: Frontend Integration — P1/P2
**Goal**: Let the user see and control memory injection.

#### 2.1 Display Injected Context After Generation
**Current**: `ContextViewer` shows `lastInjectedContext` but only updates after `generateWithMemoryPrompt`.

**Improvement**:
- Show a loading skeleton in `ContextViewer` while generation is in progress.
- Animate new entries appearing after completion.

**Files**:
- `src/features/memory/components/ContextViewer.tsx`

#### 2.2 Add "Use Memory" Toggle (Per-Request)
**Current**: `useAIStore.useMemory` exists but is not wired to UI.

**Improvement**:
1. Add a checkbox/switch in `ChatInterface.tsx` or `AIGenerateMenu.tsx`.
2. When toggled off, call standard `generateWithPrompt` instead of `generateWithMemoryPrompt`.
3. Persist preference in `localStorage` or `db.aiSettings`.

**Files**:
- `src/features/brainstorm/components/ChatInterface.tsx`
- `src/components/ui/ai-generate-menu.tsx`
- `src/features/ai/stores/useAIStore.ts` (wire toggle state)

#### 2.3 Inject Limit Control
**Current**: `inject_limit` defaults to 3 in `CompletionRequest`.

**Improvement**:
- Add a slider (1–10) in AI Settings or a per-prompt override.
- Pass value through `memoriCompletionAdapter`.

**Files**:
- `src/services/ai/memoriCompletionAdapter.ts`
- `src/pages/settings/AISettingsPage.tsx`

---

### Phase 3: Quality & Observability — P2/P3

#### 3.1 Relevance Scoring & Filtering
**Problem**: All retrieved memories are injected equally; noise may dilute signal.

**Solution**:
1. In `MemoriBackend.search`, return `score` from `Recall.search_facts`.
2. Filter out memories below a configurable threshold (e.g., 0.3).
3. Sort remaining by score descending.

**Files**:
- `sidecar/backends.py`: Modify `search` to include `score`.
- `sidecar/memori_bridge.py`: Filter low-score results before injecting.

#### 3.2 Prompt Template Customization
**Problem**: Hardcoded English preamble may not suit all use cases.

**Solution**:
1. Store prompt templates in `db.promptTemplates` or a config file.
2. Allow user to edit via Settings.

**Files**:
- `src/pages/settings/AISettingsPage.tsx`
- `sidecar/settings.py` (or new `prompt_templates.json`)

#### 3.3 Logging & Metrics
**Goal**: Debug RAG issues in production.

**Actions**:
1. Log `injected_count`, `injected_token_estimate`, `search_time_ms` per request.
2. Surface these in a debug panel or dev tools.

**Files**:
- `sidecar/memori_bridge.py`
- `src/features/memory/components/MemoryPanel.tsx` (optional debug section)

---

### Phase 4: Streaming Support — P2

#### 4.1 SSE Endpoint for Streaming Completion
**Problem**: Current `/completion` blocks until full response; poor UX for long generations.

**Solution**:
1. Add `/completion/stream` endpoint using `StreamingResponse`.
2. Yield injected context metadata first, then stream tokens.
3. Update `useMemoryCompletion` to handle event stream.

**Files**:
- `sidecar/memori_bridge.py`
- `sidecar/llm.py` (add async generator versions of `_complete_*`)
- `src/hooks/useMemoryCompletion.ts`

---

## Testing Checklist

| Test | Type | Status |
|------|------|--------|
| Backend: `/completion` includes memories in prompt | Unit | ⬜ TODO |
| Backend: Token truncation works | Unit | ⬜ TODO |
| Backend: Semantic search returns ranked results | Integration | ⬜ TODO |
| Frontend: `ContextViewer` updates after generation | E2E | ⬜ TODO |
| Frontend: "Use Memory" toggle disables injection | E2E | ⬜ TODO |
| Frontend: Inject limit slider changes request | E2E | ⬜ TODO |

---

## Dependencies

| Dependency | Required For | Notes |
|------------|--------------|-------|
| `sentence-transformers` | Semantic search | Heavy; ~500MB download |
| `faiss-cpu` | Vector index | Already in Memori deps |
| `openai` | LLM calls | Already installed |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Embedding model slow on CPU | Offer "stub" mode for dev; recommend GPU for prod |
| Context overflow crashes LLM | Enforce token budget; log warnings |
| Irrelevant memories injected | Add relevance threshold; allow user to delete bad memories |

---

## Appendix: Code Snippets

### A. Token Budget Truncation (Python)
```python
def truncate_to_budget(items: list[str], max_tokens: int) -> list[str]:
    """Keep most recent items until token budget exhausted."""
    budget = max_tokens
    result = []
    for item in items:
        est = len(item) // 4  # ~4 chars per token
        if budget - est < 0:
            break
        budget -= est
        result.append(item)
    return result
```

### B. SSE Streaming (Python)
```python
from fastapi.responses import StreamingResponse

@app.post("/completion/stream")
async def completion_stream(payload: CompletionRequest):
    async def event_generator():
        # Yield metadata first
        yield f"data: {json.dumps({'injected_count': len(injected)})}\n\n"
        # Stream tokens
        async for token in llm_client.stream(augmented_prompt):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## Next Steps
1. **Immediate**: Write unit tests for the existing `augmented_prompt` logic.
2. **This Week**: Implement token budget management (Phase 1.2).
3. **Next Week**: Add "Use Memory" toggle in UI (Phase 2.2).
