import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  config as fetchConfig,
  health as sidecarHealth,
  startSidecar,
} from "@/services/memory/memoryService";

type Status =
  | { ready: true; backend: string; llmProvider: string; llmModel: string }
  | { ready: false; message: string };

export function useSidecarBootstrap() {
  const [status, setStatus] = useState<Status>({ ready: false, message: "Starting..." });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Skip if not running inside Tauri (e.g., web build)
      if (typeof (window as any).__TAURI__ === "undefined") {
        setStatus({
          ready: false,
          message: "Sidecar unavailable in web build",
        });
        return;
      }

      try {
        await startSidecar();
        await sidecarHealth();
        const cfg = await fetchConfig();
        if (cancelled) return;
        setStatus({
          ready: true,
          backend: cfg.backend,
          llmProvider: cfg.llm_provider,
          llmModel: cfg.llm_model,
        });
      } catch (err) {
        console.error("[sidecar] bootstrap failed", err);
        if (cancelled) return;
        setStatus({
          ready: false,
          message: "Sidecar failed to start",
        });
        toast.error("Memory sidecar failed to start. Check config and restart.");
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
