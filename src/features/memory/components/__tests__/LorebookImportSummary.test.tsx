import { render, screen } from "@testing-library/react";
import { LorebookImportSummary } from "../LorebookImportSummary";

describe("LorebookImportSummary", () => {
    it("renders nothing when count is 0", () => {
        const { container } = render(<LorebookImportSummary count={0} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when count is negative", () => {
        const { container } = render(<LorebookImportSummary count={-1} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders singular message for count 1", () => {
        render(<LorebookImportSummary count={1} />);
        expect(screen.getByText("Imported 1 lorebook entry into memory")).toBeInTheDocument();
    });

    it("renders plural message for count > 1", () => {
        render(<LorebookImportSummary count={5} />);
        expect(screen.getByText("Imported 5 lorebook entries into memory")).toBeInTheDocument();
    });

    it("applies correct styling", () => {
        render(<LorebookImportSummary count={3} />);
        const message = screen.getByText(/Imported 3 lorebook entries/);
        expect(message).toHaveClass("text-xs", "text-muted-foreground");
    });
});
