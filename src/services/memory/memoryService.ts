import { invoke } from '@tauri-apps/api/core';

type HealthResponse = string;

export type CompletionRequest = {
  storyId: string;
  prompt: string;
  sessionId?: string;
  injectLimit?: number;
};

export type CompletionResponse = {
  completion: string;
  story_id: string;
  session_id: string;
  injected_memories: string[];
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
  content: string;
  category?: string;
  session_id?: string;
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

async function postJSON<T>(path: string, body: Record<string, unknown>, port = DEFAULT_PORT): Promise<T> {
  const url = `http://127.0.0.1:${port}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
  }
  return resp.json() as Promise<T>;
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

export async function searchMemories(req: MemorySearchRequest, port = DEFAULT_PORT): Promise<{ results: MemoryResult[] }> {
  console.log('[memoryService] searchMemories called:', { storyId: req.storyId, query: req.query, limit: req.limit, isTauri });

  if (isTauri) {
    try {
      const result = await invokeIfTauri<{ results: MemoryResult[] }>('memori_search', {
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

  const result = await postJSON<{ results: MemoryResult[] }>(
    '/search',
    { story_id: req.storyId, query: req.query, limit: req.limit ?? 10 },
    port,
  );
  console.log('[memoryService] Fetch search result:', result);
  return result;
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
      },
      port,
    });
  }
  return postJSON<CompletionResponse>(
    '/completion',
    {
      story_id: req.storyId,
      prompt: req.prompt,
      session_id: req.sessionId,
      inject_limit: req.injectLimit ?? 3,
    },
    port,
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
