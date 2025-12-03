import { useCallback } from "react";
import {
  completeWithMemory as sidecarComplete,
  CompletionRequest,
  CompletionResponse,
} from "@/services/memory/memoryService";

type Options = {
  port?: number;
  onError?: (err: unknown) => void;
};

export function useMemoryCompletion(options?: Options) {
  const { port, onError } = options || {};

  const completeWithMemory = useCallback(
    async (req: CompletionRequest): Promise<CompletionResponse | null> => {
      try {
        return await sidecarComplete(req, port);
      } catch (err) {
        console.error("[memory] completion failed", err);
        onError?.(err);
        return null;
      }
    },
    [onError, port],
  );

  return { completeWithMemory };
}
