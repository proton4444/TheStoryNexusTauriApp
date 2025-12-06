import { act, renderHook, waitFor } from "@testing-library/react";
import * as memoryService from "@/services/memory/memoryService";
import { useMemoryStore } from "../useMemoryStore";

// Mock the memory service
vi.mock("@/services/memory/memoryService", () => ({
    getContext: vi.fn(),
    searchMemories: vi.fn(),
    addMemory: vi.fn(),
    addMemories: vi.fn(),
    health: vi.fn().mockResolvedValue("ok"),
}));

// Mock the database
vi.mock("@/services/database", () => ({
    db: {
        lorebookEntries: {
            where: vi.fn(() => ({
                equals: vi.fn(() => ({
                    toArray: vi.fn().mockResolvedValue([
                        { name: "Hero", description: "Main character", category: "character" },
                        { name: "Castle", description: "Old fortress", category: "location" },
                    ]),
                })),
            })),
        },
    },
}));

describe("useMemoryStore", () => {
    beforeEach(() => {
        // Reset store state before each test
        useMemoryStore.setState({
            query: "",
            context: [],
            results: [],
            loading: false,
            importing: false,
            lastImported: null,
            error: undefined,
        });
        vi.clearAllMocks();
    });

    describe("setQuery", () => {
        it("updates the query state", () => {
            const { result } = renderHook(() => useMemoryStore());

            act(() => {
                result.current.setQuery("dragon");
            });

            expect(result.current.query).toBe("dragon");
        });
    });

    describe("refreshContext", () => {
        it("fetches and stores context memories", async () => {
            const mockMemories = [
                { memory_id: "1", content: "Castle on the hill", category: "location" },
                { memory_id: "2", content: "Hero's journey", category: "plot" },
            ];
            vi.mocked(memoryService.getContext).mockResolvedValue({ memories: mockMemories });

            const { result } = renderHook(() => useMemoryStore());

            await act(async () => {
                await result.current.refreshContext("story-1");
            });

            expect(result.current.context).toEqual(mockMemories);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeUndefined();
        });

        it("handles errors gracefully", async () => {
            vi.mocked(memoryService.getContext).mockRejectedValue(new Error("Network error"));

            const { result } = renderHook(() => useMemoryStore());

            await act(async () => {
                await result.current.refreshContext("story-1");
            });

            expect(result.current.error).toBe("Failed to fetch context");
            expect(result.current.loading).toBe(false);
        });
    });

    describe("search", () => {
        it("searches memories and stores results", async () => {
            const mockResults = [
                { memory_id: "3", content: "Dragon appears", category: "event" },
            ];
            vi.mocked(memoryService.searchMemories).mockResolvedValue({ results: mockResults });

            const { result } = renderHook(() => useMemoryStore());

            // Set query first
            act(() => {
                result.current.setQuery("dragon");
            });

            await act(async () => {
                await result.current.search("story-1");
            });

            expect(result.current.results).toEqual(mockResults);
            expect(memoryService.searchMemories).toHaveBeenCalledWith({
                storyId: "story-1",
                query: "dragon",
                limit: 10,
            });
        });

        it("clears results when query is empty", async () => {
            const { result } = renderHook(() => useMemoryStore());

            // Ensure query is empty
            act(() => {
                result.current.setQuery("");
            });

            await act(async () => {
                await result.current.search("story-1");
            });

            expect(result.current.results).toEqual([]);
            expect(memoryService.searchMemories).not.toHaveBeenCalled();
        });

        it("handles search errors", async () => {
            vi.mocked(memoryService.searchMemories).mockRejectedValue(new Error("Search failed"));

            const { result } = renderHook(() => useMemoryStore());

            act(() => {
                result.current.setQuery("dragon");
            });

            await act(async () => {
                await result.current.search("story-1");
            });

            expect(result.current.error).toBe("Search failed");
        });
    });

    describe("addMemory", () => {
        it("adds a memory and refreshes context", async () => {
            vi.mocked(memoryService.addMemory).mockResolvedValue({ memory_id: "new", story_id: "story-1" });
            vi.mocked(memoryService.getContext).mockResolvedValue({ memories: [] });

            const { result } = renderHook(() => useMemoryStore());

            // Set currentStoryId first (required for addMemory to work)
            act(() => {
                result.current.setCurrentStory("story-1");
            });

            await act(async () => {
                await result.current.addMemory("New memory content", "note");
            });

            expect(memoryService.addMemory).toHaveBeenCalledWith({
                storyId: "story-1",
                content: "New memory content",
                category: "note",
            });
            expect(memoryService.getContext).toHaveBeenCalled();
        });

        it("does nothing when content is empty", async () => {
            const { result } = renderHook(() => useMemoryStore());

            // Set currentStoryId first
            act(() => {
                result.current.setCurrentStory("story-1");
            });

            await act(async () => {
                await result.current.addMemory("   ", "note");
            });

            expect(memoryService.addMemory).not.toHaveBeenCalled();
        });

        it("handles add memory errors", async () => {
            vi.mocked(memoryService.addMemory).mockRejectedValue(new Error("Add failed"));

            const { result } = renderHook(() => useMemoryStore());

            // Set currentStoryId first
            act(() => {
                result.current.setCurrentStory("story-1");
            });

            await act(async () => {
                await result.current.addMemory("Content", "note");
            });

            expect(result.current.error).toBe("Could not add memory");
        });
    });

    describe("importLorebook", () => {
        it("imports lorebook entries and returns count", async () => {
            vi.mocked(memoryService.addMemories).mockResolvedValue({ story_id: "s", count: 2 });
            vi.mocked(memoryService.getContext).mockResolvedValue({ memories: [] });

            const { result } = renderHook(() => useMemoryStore());

            let count: number;
            await act(async () => {
                count = await result.current.importLorebook("story-1");
            });

            expect(count!).toBe(2);
            expect(result.current.lastImported).toBe(2);
            expect(result.current.importing).toBe(false);
            // Should have called bulk add once
            expect(memoryService.addMemories).toHaveBeenCalledTimes(1);
        });
    });
});
