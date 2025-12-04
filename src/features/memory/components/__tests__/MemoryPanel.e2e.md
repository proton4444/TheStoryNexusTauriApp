# Memory Panel E2E plan (to implement)

Scenarios:
- Load Story Dashboard for a story, ensure Memory Panel renders status, context list, and import button.
- Add memory via form, verify it appears in context.
- Run search, verify results list.
- Import lorebook, verify import summary and category cloud updates.

Notes:
- Implement with Playwright targeting the web build; stub sidecar API with MSW or intercept fetch calls.
- For desktop, consider smoke test against real sidecar in CI later.
