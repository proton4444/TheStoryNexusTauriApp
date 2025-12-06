import { describe, it, expect, vi, beforeEach } from "vitest";
import { memoriCompletion } from "../memoriCompletion";
import * as memoryService from "../memoryService";

vi.mock("../memoryService", () => ({
  completeWithMemory: vi.fn(),
}));

describe("memoriCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through injectLimit, maxTokens, and temperature", async () => {
    vi.mocked(memoryService.completeWithMemory).mockResolvedValue({
      completion: "ok",
      story_id: "s",
      session_id: "sess",
      injected_memories: [],
    });

    await memoriCompletion({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
      temperature: 0.9,
      maxTokens: 123,
      storyId: "story-1",
      model: "test-model",
      injectLimit: 7,
    });

    expect(memoryService.completeWithMemory).toHaveBeenCalledWith({
      prompt: "user: Hello\nassistant: Hi",
      storyId: "story-1",
      injectLimit: 7,
      model: "test-model",
      maxTokens: 123,
      temperature: 0.9,
    });
  });

  it("defaults injectLimit to 3 when not provided", async () => {
    vi.mocked(memoryService.completeWithMemory).mockResolvedValue({
      completion: "ok",
      story_id: "s",
      session_id: "sess",
      injected_memories: [],
    });

    await memoriCompletion({
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.5,
      maxTokens: 50,
      storyId: "story-2",
    });

    expect(memoryService.completeWithMemory).toHaveBeenCalledWith(
      expect.objectContaining({ injectLimit: 3 }),
    );
  });
});
