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
      const isTauri = typeof (window as any).__TAURI__ !== "undefined";

      try {
        // In Tauri, start the sidecar process
        if (isTauri) {
          await startSidecar();
        }

        // In both web and Tauri, check health via HTTP
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
        const message = isTauri
          ? "Sidecar failed to start"
          : "Sidecar unavailable - start manually with: uvicorn sidecar.memori_bridge:app --port 9876";
        setStatus({
          ready: false,
          message,
        });
        if (isTauri) {
          toast.error("Memory sidecar failed to start. Check config and restart.");
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

