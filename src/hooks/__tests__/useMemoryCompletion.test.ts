import { renderHook, act, waitFor } from "@testing-library/react";
import { useMemoryCompletion } from "../useMemoryCompletion";
import * as memoryService from "@/services/memory/memoryService";

// Mock the memory service
vi.mock("@/services/memory/memoryService", () => ({
    completeWithMemory: vi.fn(),
    addMemory: vi.fn(),
    ingestConversation: vi.fn(),
}));

describe("useMemoryCompletion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requires storyId in options", () => {
        const { result } = renderHook(() => useMemoryCompletion({ storyId: "story-1" }));
        expect(result.current.storyId).toBe("story-1");
    });

    it("completes with memory and returns response", async () => {
        const mockResponse = {
            completion: "The hero embarked on a journey...",
            story_id: "story-1",
            session_id: "sess-1",
            injected_memories: ["Hero is brave"],
            llm_provider: "openai",
            llm_model: "gpt-4",
        };
        vi.mocked(memoryService.completeWithMemory).mockResolvedValue(mockResponse);
        vi.mocked(memoryService.ingestConversation).mockResolvedValue({});

        const { result } = renderHook(() => useMemoryCompletion({ storyId: "story-1" }));

        let response;
        await act(async () => {
            response = await result.current.completeWithMemory({
                prompt: "Write about a hero",
            });
        });

        expect(response).toEqual(mockResponse);
        expect(memoryService.completeWithMemory).toHaveBeenCalledWith(
            { storyId: "story-1", prompt: "Write about a hero", sessionId: undefined, injectLimit: undefined },
            undefined
        );
    });

    it("ingests completion when ingestCompletion is true (default)", async () => {
        const mockResponse = {
            completion: "The dragon...",
            story_id: "story-1",
            session_id: "sess-1",
            injected_memories: [],
        };
        vi.mocked(memoryService.completeWithMemory).mockResolvedValue(mockResponse);
        vi.mocked(memoryService.ingestConversation).mockResolvedValue({});

        const { result } = renderHook(() => useMemoryCompletion({ storyId: "story-1", ingestCompletion: true }));

        await act(async () => {
            await result.current.completeWithMemory({
                prompt: "Test prompt",
            });
        });

        expect(memoryService.ingestConversation).toHaveBeenCalledWith(
            expect.objectContaining({
                storyId: "story-1",
                prompt: "Test prompt",
                completion: "The dragon...",
            })
        );
    });

    it("does not ingest completion when ingestCompletion is false", async () => {
        const mockResponse = {
            completion: "Response",
            story_id: "story-1",
            session_id: "sess-1",
            injected_memories: [],
        };
        vi.mocked(memoryService.completeWithMemory).mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useMemoryCompletion({ storyId: "story-1", ingestCompletion: false }));

        await act(async () => {
            await result.current.completeWithMemory({
                prompt: "Test prompt",
            });
        });

        expect(memoryService.ingestConversation).not.toHaveBeenCalled();
    });

    it("ingests prompt when ingestPrompt is true", async () => {
        const mockResponse = {
            completion: "Response",
            story_id: "story-1",
            session_id: "sess-1",
            injected_memories: [],
        };
        vi.mocked(memoryService.completeWithMemory).mockResolvedValue(mockResponse);
        vi.mocked(memoryService.addMemory).mockResolvedValue({});

        const { result } = renderHook(() =>
            useMemoryCompletion({ storyId: "story-1", ingestPrompt: true, ingestCompletion: false })
        );

        await act(async () => {
            await result.current.completeWithMemory({
                prompt: "My prompt",
            });
        });

        expect(memoryService.addMemory).toHaveBeenCalledWith({
            storyId: "story-1",
            content: "My prompt",
            category: "prompt",
            sessionId: undefined,
        });
    });

    it("returns null and calls onError on failure", async () => {
        const mockError = new Error("API error");
        vi.mocked(memoryService.completeWithMemory).mockRejectedValue(mockError);

        const onError = vi.fn();
        const { result } = renderHook(() => useMemoryCompletion({ storyId: "story-1", onError }));

        let response;
        await act(async () => {
            response = await result.current.completeWithMemory({
                prompt: "Test",
            });
        });

        expect(response).toBeNull();
        expect(onError).toHaveBeenCalledWith(mockError);
    });
});
