import "@testing-library/jest-dom";
import "css.escape";

// Mock ResizeObserver for Lexical/tests
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserver;
