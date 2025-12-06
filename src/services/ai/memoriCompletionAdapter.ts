import { createPromptParser } from "@/features/prompts/services/promptParser";
import { db } from "@/services/database";
import { PromptParserConfig } from "@/types/story";
import { memoriCompletion } from "@/services/memory/memoriCompletion";
import { CompletionResponse } from "@/services/memory/memoryService";
import { useAIStore } from "@/features/ai/stores/useAIStore";

type Options = {
  injectLimit?: number;
};

export async function memoriCompletionAdapter(
  config: PromptParserConfig,
  storyId: string,
  options?: Options,
): Promise<CompletionResponse | null> {
  const parser = createPromptParser();
  const { messages, error } = await parser.parse(config);
  if (error || !messages.length) {
    throw new Error(error || "Failed to parse prompt");
  }
  const prompt = await db.prompts.get(config.promptId);
  const temperature = prompt?.temperature ?? 0.7;
  const maxTokens = prompt?.maxTokens ?? 2048;
  const promptText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const settings = useAIStore.getState().settings;
  const model = settings?.defaultModel?.id;
  return memoriCompletion({
    messages,
    temperature,
    maxTokens,
    storyId,
    model,
    injectLimit: options?.injectLimit,
  });
}
