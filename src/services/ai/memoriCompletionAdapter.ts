import { createPromptParser } from "@/features/prompts/services/promptParser";
import { db } from "@/services/database";
import { PromptParserConfig } from "@/types/story";
import { memoriCompletion } from "@/services/memory/memoriCompletion";
import { ingestConversation, CompletionResponse } from "@/services/memory/memoryService";

export async function memoriCompletionAdapter(config: PromptParserConfig, storyId: string): Promise<CompletionResponse | null> {
  const parser = createPromptParser();
  const { messages, error } = await parser.parse(config);
  if (error || !messages.length) {
    throw new Error(error || "Failed to parse prompt");
  }
  const prompt = await db.prompts.get(config.promptId);
  const temperature = prompt?.temperature ?? 0.7;
  const maxTokens = prompt?.maxTokens ?? 2048;
  const promptText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const response = await memoriCompletion({ messages, temperature, maxTokens, storyId });
  // Best-effort extraction storage for future recall
  if (response?.completion) {
    await ingestConversation({
      storyId,
      prompt: promptText,
      completion: response.completion,
      injectedMemories: response.injected_memories,
      category: "ingest",
    });
  }
  return response;
}
