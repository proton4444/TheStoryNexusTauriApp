import { useCallback } from "react";
import {
  addMemory,
  completeWithMemory as sidecarComplete,
  CompletionRequest,
  CompletionResponse,
  extractAndStore,
  ingestConversation,
} from "@/services/memory/memoryService";

type Options = {
  port?: number;
  onError?: (err: unknown) => void;
  ingestPrompt?: boolean;
  ingestCompletion?: boolean;
  ingestInjected?: boolean;
};

export function useMemoryCompletion(options?: Options) {
  const {
    port,
    onError,
    ingestPrompt = false,
    ingestCompletion = true,
    ingestInjected = true,
  } = options || {};

  const completeWithMemory = useCallback(
    async (req: CompletionRequest): Promise<CompletionResponse | null> => {
      try {
        const response = await sidecarComplete(req, port);
        if (response && ingestPrompt) {
          // Best-effort prompt ingestion for future searches/context
          await addMemory({
            storyId: req.storyId,
            content: req.prompt,
            category: "prompt",
            sessionId: req.sessionId,
          });
        }
        if (response && ingestCompletion) {
          await ingestConversation({
            storyId: req.storyId,
            prompt: req.prompt,
            completion: response.completion,
            injectedMemories: ingestInjected ? response.injected_memories : [],
            sessionId: req.sessionId ?? response.session_id,
            category: "ingest",
            llmProvider: response.llm_provider,
            llmModel: response.llm_model,
          });
        }
        return response;
      } catch (err) {
        console.error("[memory] completion failed", err);
        onError?.(err);
        return null;
      }
    },
    [ingestPrompt, onError, port],
  );

  return { completeWithMemory };
}
