import { completeWithMemory } from "./memoryService";
import { PromptMessage } from "@/types/story";

type Request = {
  messages: PromptMessage[];
  temperature: number;
  maxTokens: number;
  storyId: string;
};

export async function memoriCompletion(req: Request) {
  const promptText = req.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  return completeWithMemory({
    prompt: promptText,
    storyId: req.storyId,
    injectLimit: 3,
  });
}
