import { render, screen } from "@testing-library/react";
import { MemoryCategoryCloud } from "../MemoryCategoryCloud";

describe("MemoryCategoryCloud", () => {
  it("renders top categories with counts", () => {
    render(
      <MemoryCategoryCloud
        entries={[
          { category: "lore" },
          { category: "lore" },
          { category: "note" },
          { category: undefined },
        ]}
      />,
    );

    expect(screen.getByText(/lore · 2/i)).toBeInTheDocument();
    expect(screen.getByText(/note · 1/i)).toBeInTheDocument();
    expect(screen.getByText(/uncategorized · 1/i)).toBeInTheDocument();
  });
});
