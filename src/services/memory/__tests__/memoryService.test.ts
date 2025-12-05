import {
    health,
    config,
    addMemory,
    searchMemories,
    getContext,
    completeWithMemory,
} from "../memoryService";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.__TAURI__ to force HTTP path
Object.defineProperty(window, "__TAURI__", {
    value: undefined,
    writable: true,
});

describe("memoryService", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe("health", () => {
        it("returns status from health endpoint", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: "ok" }),
            });

            const result = await health();
            expect(result).toBe("ok");
            expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:9876/health");
        });

        it("throws on failed health check", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
            });

            await expect(health()).rejects.toThrow("Health check failed: 500");
        });
    });

    describe("config", () => {
        it("returns config from endpoint", async () => {
            const mockConfig = {
                backend: "memori",
                host: "127.0.0.1",
                port: 9876,
                process_id: "storynexus",
                llm_provider: "openai",
                llm_model: "gpt-4",
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockConfig),
            });

            const result = await config();
            expect(result).toEqual(mockConfig);
        });
    });

    describe("addMemory", () => {
        it("sends POST request with memory data", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ memory_id: "123", story_id: "story-1" }),
            });

            const result = await addMemory({
                storyId: "story-1",
                content: "Test memory",
                category: "note",
            });

            expect(result).toEqual({ memory_id: "123", story_id: "story-1" });
            expect(mockFetch).toHaveBeenCalledWith(
                "http://127.0.0.1:9876/memory/add",
                expect.objectContaining({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        story_id: "story-1",
                        content: "Test memory",
                        category: "note",
                        session_id: undefined,
                    }),
                })
            );
        });
    });

    describe("searchMemories", () => {
        it("searches memories with query", async () => {
            const mockResults = {
                results: [{ memory_id: "1", content: "Dragon lore", category: "lore" }],
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResults),
            });

            const result = await searchMemories({
                storyId: "story-1",
                query: "dragon",
                limit: 10,
            });

            expect(result).toEqual(mockResults);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://127.0.0.1:9876/search",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining('"query":"dragon"'),
                })
            );
        });
    });

    describe("getContext", () => {
        it("fetches context memories", async () => {
            const mockContext = {
                memories: [{ memory_id: "1", content: "Recent memory", category: "note" }],
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockContext),
            });

            const result = await getContext({ storyId: "story-1", limit: 5 });

            expect(result).toEqual(mockContext);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://127.0.0.1:9876/context",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining('"story_id":"story-1"'),
                })
            );
        });
    });

    describe("completeWithMemory", () => {
        it("sends completion request and returns response", async () => {
            const mockResponse = {
                completion: "The dragon roared...",
                story_id: "story-1",
                session_id: "sess-1",
                injected_memories: ["Memory about dragons"],
                llm_provider: "openai",
                llm_model: "gpt-4",
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await completeWithMemory({
                storyId: "story-1",
                prompt: "Write about a dragon",
            });

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://127.0.0.1:9876/completion",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining('"prompt":"Write about a dragon"'),
                })
            );
        });
    });
});
