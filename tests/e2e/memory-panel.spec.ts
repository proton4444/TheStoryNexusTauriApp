import { test, expect } from "@playwright/test";

test.describe("Memory Panel", () => {
  test("searches, shows context, and adds memory", async ({ page }) => {
    await page.route("**/context", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          memories: [
            { memory_id: "1", content: "Castle fact", category: "lore" },
          ],
        }),
      });
    });
    await page.route("**/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { memory_id: "2", content: "Hero note", category: "note" },
          ],
        }),
      });
    });
    await page.route("**/memory/add", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ memory_id: "3", story_id: "story-1" }),
      });
    });
    await page.route("**/ingest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ memory_id: "4", story_id: "story-1", truncated: false }),
      });
    });

    await page.goto("/dashboard/story-1/chapters");

    await expect(page.getByText("Story Memory")).toBeVisible();
    await expect(page.getByText("Castle fact")).toBeVisible();

    await page.getByPlaceholder("e.g. dragon, castle, protagonist").fill("hero");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Hero note")).toBeVisible();

    await page.getByPlaceholder("Add a new fact, character detail, or plot point").fill("New lore");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("lore · 1")).toBeVisible();
  });
});
