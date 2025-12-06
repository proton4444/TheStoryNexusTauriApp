import { invoke } from '@tauri-apps/api/core';

type HealthResponse = string;

export type CompletionRequest = {
  storyId: string;
  prompt: string;
  sessionId?: string;
  injectLimit?: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxContextTokens?: number;
};

export type CompletionResponse = {
  completion: string;
  story_id: string;
  session_id: string;
  injected_memories: string[];
  extracted_entities?: string[];
  llm_provider?: string;
  llm_model?: string;
};

// Type alias for backward compatibility
export type MemoriCompletionResponse = CompletionResponse;

export type MemoryAddRequest = {
  storyId: string;
  content: string;
  category?: string;
  sessionId?: string;
};

export type MemorySearchRequest = {
  storyId: string;
  query: string;
  limit?: number;
};

export type MemoryResult = {
  memory_id: string;
  story_id?: string;
  content: string;
  category?: string;
  session_id?: string;
  created_at?: string;
};

export type MemoryContextRequest = {
  storyId: string;
  limit?: number;
};

export type ExtractionRequest = {
  storyId: string;
  prompt: string;
  completion: string;
  category?: string;
  sessionId?: string;
};

export type IngestRequest = {
  storyId: string;
  prompt: string;
  completion: string;
  injectedMemories?: string[];
  category?: string;
  sessionId?: string;
  llmProvider?: string;
  llmModel?: string;
  maxChars?: number;
};

const DEFAULT_PORT = 9876;
const isTauri = typeof (window as any).__TAURI__ !== "undefined";

async function invokeIfTauri<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error("Tauri runtime not available");
  }
  return invoke<T>(cmd, args);
}

export async function startSidecar(opts?: { pythonBin?: string; port?: number }) {
  await invoke('start_memori_sidecar', {
    pythonBin: opts?.pythonBin,
    port: opts?.port ?? DEFAULT_PORT,
  });
}

export async function stopSidecar() {
  await invoke('stop_memori_sidecar');
}

export async function health(port: number = DEFAULT_PORT): Promise<HealthResponse> {
  if (isTauri) {
    return invoke('memori_health', { port });
  }
  const url = `http://127.0.0.1:${port}/health`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Health check failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.status;
}

export type ConfigResponse = {
  backend: string;
  host: string;
  port: number;
  process_id: string;
  llm_provider: string;
  llm_model: string;
};

export async function config(port: number = DEFAULT_PORT): Promise<ConfigResponse> {
  if (isTauri) {
    return invokeIfTauri<ConfigResponse>('memori_config', { port });
  }
  const url = `http://127.0.0.1:${port}/config`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Config request failed: ${resp.status} ${resp.statusText}`);
  }
  return resp.json() as Promise<ConfigResponse>;
}

async function postJSON<T>(
  path: string,
  body: Record<string, unknown>,
  port = DEFAULT_PORT,
  timeoutMs = 30000, // 30 second default timeout
): Promise<T> {
  const url = `http://127.0.0.1:${port}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[memoryService] POST ${path} started`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Unknown error');
      console.error(`[memoryService] ${path} failed: ${resp.status} - ${errorText}`);
      throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
    }
    console.log(`[memoryService] POST ${path} succeeded`);
    return resp.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[memoryService] ${path} timed out after ${timeoutMs}ms`);
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    console.error(`[memoryService] ${path} error:`, error);
    throw error;
  }
}

export async function createSession(storyId: string, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri('memori_create_session', { payload: { story_id: storyId }, port });
  }
  return postJSON<{ story_id: string; session_id: string }>(
    '/session/new',
    { story_id: storyId },
    port,
  );
}

export type MemoryItem = {
  content: string;
  category?: string;
  session_id?: string;
};

export type MemoryBulkAddRequest = {
  storyId: string;
  items: MemoryItem[];
};

export async function addMemory(req: MemoryAddRequest, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri('memori_add_memory', {
      payload: {
        story_id: req.storyId,
        content: req.content,
        category: req.category,
        session_id: req.sessionId,
      },
      port,
    });
  }
  return postJSON<{ memory_id: string; story_id: string }>(
    '/memory/add',
    {
      story_id: req.storyId,
      content: req.content,
      category: req.category,
      session_id: req.sessionId,
    },
    port,
  );
}

export async function addMemories(req: MemoryBulkAddRequest, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri('memori_add_memories', {
      payload: {
        story_id: req.storyId,
        items: req.items,
      },
      port,
    });
  }
  return postJSON<{ story_id: string; count: number }>(
    '/memory/add/bulk',
    {
      story_id: req.storyId,
      items: req.items,
    },
    port,
  );
}

export async function deleteMemory(storyId: string, memoryId: string, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri<void>('memori_delete_memory', {
      storyId,
      memoryId,
      port,
    });
  }
  const url = `http://127.0.0.1:${port}/memory/${storyId}/${memoryId}`;
  const resp = await fetch(url, { method: 'DELETE' });
  if (!resp.ok) {
    throw new Error(`Delete failed: ${resp.status}`);
  }
  return resp.json();
}

export async function searchMemories(
  req: MemorySearchRequest,
  port = DEFAULT_PORT,
): Promise<{ results: MemoryResult[]; total?: number }> {
  console.log('[memoryService] searchMemories called:', { storyId: req.storyId, query: req.query, limit: req.limit, isTauri });

  if (isTauri) {
    try {
      const result = await invokeIfTauri<{ results: MemoryResult[]; total?: number }>('memori_search', {
        payload: {
          story_id: req.storyId,
          query: req.query,
          limit: req.limit ?? 10,
        },
        port,
      });
      console.log('[memoryService] Tauri search result:', result);
      return result;
    } catch (err) {
      console.warn('[memoryService] Tauri invoke failed, falling back to fetch:', err);
      // Fall through to fetch
    }
  }

  const result = await postJSON<{ results: MemoryResult[]; total?: number }>(
    '/search',
    { story_id: req.storyId, query: req.query, limit: req.limit ?? 10 },
    port,
  );
  console.log('[memoryService] Fetch search result:', result);
  return result;
}

export async function listMemories(
  req: MemoryListRequest,
  port = DEFAULT_PORT,
): Promise<MemoryListResponse> {
  const payload = {
    story_id: req.storyId,
    query: req.query,
    limit: req.limit ?? 100,
    offset: req.offset ?? 0,
  };

  if (isTauri) {
    return invokeIfTauri<MemoryListResponse>('memori_list_memories', {
      payload,
      port,
    });
  }

  return postJSON<MemoryListResponse>('/memory/list', payload, port);
}

export async function getContext(req: MemoryContextRequest, port = DEFAULT_PORT): Promise<{ memories: MemoryResult[] }> {
  if (isTauri) {
    return invokeIfTauri<{ memories: MemoryResult[] }>('memori_context', {
      payload: {
        story_id: req.storyId,
        limit: req.limit ?? 5,
      },
      port,
    });
  }
  return postJSON<{ memories: MemoryResult[] }>(
    '/context',
    { story_id: req.storyId, limit: req.limit ?? 5 },
    port,
  );
}

export async function completeWithMemory(req: CompletionRequest, port = DEFAULT_PORT): Promise<CompletionResponse> {
  if (isTauri) {
    return invokeIfTauri<CompletionResponse>('memori_completion', {
      payload: {
        story_id: req.storyId,
        prompt: req.prompt,
        session_id: req.sessionId,
        inject_limit: req.injectLimit ?? 3,
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        max_context_tokens: req.maxContextTokens ?? 2000,
      },
      port,
    });
  }
  // LLM completion + auto-extraction can take a while, use 120 second timeout
  return postJSON<CompletionResponse>(
    '/completion',
    {
      story_id: req.storyId,
      prompt: req.prompt,
      session_id: req.sessionId,
      inject_limit: req.injectLimit ?? 3,
      model: req.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      max_context_tokens: req.maxContextTokens ?? 2000,
    },
    port,
    120000, // 120 seconds timeout for LLM completion
  );
}

/**
 * Best-effort extraction: stores a combined prompt+completion text to the memory store.
 * This is a stopgap until sidecar-native extraction is available.
 */
export async function extractAndStore(req: ExtractionRequest, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri('memori_extract', {
      payload: {
        story_id: req.storyId,
        prompt: req.prompt,
        completion: req.completion,
        category: req.category,
        session_id: req.sessionId,
      },
      port,
    });
  }
  return postJSON(
    '/extract',
    {
      story_id: req.storyId,
      prompt: req.prompt,
      completion: req.completion,
      category: req.category ?? "extraction",
      session_id: req.sessionId,
    },
    port,
  );
}

export async function ingestConversation(req: IngestRequest, port = DEFAULT_PORT) {
  const injected = req.injectedMemories ?? [];
  if (isTauri) {
    return invokeIfTauri('memori_ingest', {
      payload: {
        story_id: req.storyId,
        prompt: req.prompt,
        completion: req.completion,
        injected_memories: injected,
        category: req.category,
        session_id: req.sessionId,
        llm_provider: req.llmProvider,
        llm_model: req.llmModel,
        max_chars: req.maxChars,
      },
      port,
    });
  }
  return postJSON(
    '/ingest',
    {
      story_id: req.storyId,
      prompt: req.prompt,
      completion: req.completion,
      injected_memories: injected,
      category: req.category ?? "ingest",
      session_id: req.sessionId,
      llm_provider: req.llmProvider,
      llm_model: req.llmModel,
      max_chars: req.maxChars ?? 4000,
    },
    port,
  );
}

export type ExtractFromTextRequest = {
  storyId: string;
  text: string;
  extractTypes?: string[];
  model?: string;
};

export type ExtractedMemory = {
  memory_id: string;
  content: string;
  category: string;
};

export type ExtractFromTextResponse = {
  extracted_count: number;
  memories: ExtractedMemory[];
};

export type MemoryListRequest = {
  storyId?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export type MemoryListResponse = {
  memories: MemoryResult[];
  total: number;
};

export async function extractFromText(req: ExtractFromTextRequest, port = DEFAULT_PORT) {
  if (isTauri) {
    return invokeIfTauri<ExtractFromTextResponse>('memori_extract_from_text', {
      payload: {
        story_id: req.storyId,
        text: req.text,
        extract_types: req.extractTypes ?? ["characters", "locations", "items", "facts"],
        model: req.model,
      },
      port,
    });
  }
  // LLM extraction can take a while, use 60 second timeout
  return postJSON<ExtractFromTextResponse>(
    '/extract-from-text',
    {
      story_id: req.storyId,
      text: req.text,
      extract_types: req.extractTypes ?? ["characters", "locations", "items", "facts"],
      model: req.model,
    },
    port,
    60000, // 60 seconds timeout for LLM extraction
  );
}
