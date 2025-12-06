import { useCallback, useState } from "react";
import {
  addMemory,
  completeWithMemory as sidecarComplete,
  CompletionResponse,
  ingestConversation,
} from "@/services/memory/memoryService";

type Options = {
  storyId: string; // Required - enforces story isolation upfront
  port?: number;
  onError?: (err: unknown) => void;
  ingestPrompt?: boolean;
  ingestCompletion?: boolean;
  ingestInjected?: boolean;
};

type CompleteRequest = {
  prompt: string;
  sessionId?: string;
  injectLimit?: number;
};

type UseMemoryCompletionReturn = {
  complete: (req: CompleteRequest) => Promise<CompletionResponse | null>;
  completeWithMemory: (req: CompleteRequest) => Promise<CompletionResponse | null>;
  isLoading: boolean;
  error: string | null;
  memoriesUsed: string[];
  lastResponse: CompletionResponse | null;
  reset: () => void;
  storyId: string; // Expose the bound storyId
};

/**
 * Hook for memory-aware AI completions.
 * Requires storyId upfront to enforce story isolation.
 * 
 * @example
 * const { complete, isLoading, memoriesUsed } = useMemoryCompletion({ storyId: "story-123" });
 * const response = await complete({ prompt: "Continue the story..." });
 */
export function useMemoryCompletion(options: Options): UseMemoryCompletionReturn {
  const {
    storyId,
    port,
    onError,
    ingestPrompt = false,
    ingestCompletion = true,
    ingestInjected = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoriesUsed, setMemoriesUsed] = useState<string[]>([]);
  const [lastResponse, setLastResponse] = useState<CompletionResponse | null>(null);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setMemoriesUsed([]);
    setLastResponse(null);
  }, []);

  const complete = useCallback(
    async (req: CompleteRequest): Promise<CompletionResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await sidecarComplete(
          {
            storyId, // Always use the bound storyId
            prompt: req.prompt,
            sessionId: req.sessionId,
            injectLimit: req.injectLimit,
          },
          port,
        );

        if (response) {
          // Track injected memories
          setMemoriesUsed(response.injected_memories || []);
          setLastResponse(response);

          // Best-effort prompt ingestion for future searches/context
          if (ingestPrompt) {
            await addMemory({
              storyId, // Always use the bound storyId
              content: req.prompt,
              category: "prompt",
              sessionId: req.sessionId,
            }).catch(console.warn);
          }

          // Ingest the conversation for memory
          if (ingestCompletion) {
            await ingestConversation({
              storyId, // Always use the bound storyId
              prompt: req.prompt,
              completion: response.completion,
              injectedMemories: ingestInjected ? response.injected_memories : [],
              sessionId: req.sessionId ?? response.session_id,
              category: "ingest",
              llmProvider: response.llm_provider,
              llmModel: response.llm_model,
            }).catch(console.warn);
          }
        }

        setIsLoading(false);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Completion failed";
        console.error("[memory] completion failed", err);
        setError(errorMessage);
        setIsLoading(false);
        onError?.(err);
        return null;
      }
    },
    [storyId, ingestPrompt, ingestCompletion, ingestInjected, onError, port],
  );

  return {
    complete,
    completeWithMemory: complete, // Alias for backward compatibility
    isLoading,
    error,
    memoriesUsed,
    lastResponse,
    reset,
    storyId, // Expose the bound storyId for reference
  };
}

// Alias export for convenience
export const useAICompletion = useMemoryCompletion;

