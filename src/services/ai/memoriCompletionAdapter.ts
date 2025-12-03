import { createPromptParser } from "@/features/prompts/services/promptParser";
import { db } from "@/services/database";
import { PromptParserConfig, PromptMessage } from "@/types/story";
import { memoriCompletion } from "@/services/memory/memoriCompletion";

export async function memoriCompletionAdapter(config: PromptParserConfig, storyId: string) {
  const parser = createPromptParser();
  const { messages, error } = await parser.parse(config);
  if (error || !messages.length) {
    throw new Error(error || "Failed to parse prompt");
  }
  const prompt = await db.prompts.get(config.promptId);
  const temperature = prompt?.temperature ?? 0.7;
  const maxTokens = prompt?.maxTokens ?? 2048;
  return memoriCompletion({ messages, temperature, maxTokens, storyId });
}
