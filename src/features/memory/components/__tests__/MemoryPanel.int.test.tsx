import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryPanel } from "../MemoryPanel";
import * as memoryService from "@/services/memory/memoryService";

const mockContext = { memories: [{ memory_id: "1", content: "Castle fact", category: "lore" }] };
const mockSearch = { results: [{ memory_id: "2", content: "Hero note", category: "note" }] };

vi.spyOn(memoryService, "getContext").mockResolvedValue(mockContext);
vi.spyOn(memoryService, "searchMemories").mockResolvedValue(mockSearch);
vi.spyOn(memoryService, "addMemory").mockResolvedValue({ memory_id: "x", story_id: "s" });
vi.spyOn(memoryService, "extractAndStore").mockResolvedValue({ memory_id: "ex", story_id: "s" });
vi.spyOn(memoryService, "createSession").mockResolvedValue({ story_id: "s", session_id: "sess" });

describe("MemoryPanel integration-ish", () => {
  it("shows context and runs search", async () => {
    render(<MemoryPanel storyId="story-1" />);

    expect(await screen.findByText(/Castle fact/i)).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/dragon/i), "hero");
    await userEvent.click(screen.getByRole("button", { name: /Search/i }));
    await waitFor(() => expect(screen.getByText(/Hero note/i)).toBeInTheDocument());
  });
});
