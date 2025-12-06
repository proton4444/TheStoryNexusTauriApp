# StoryNexus Test Notes (supplemental)

## Credentials & env
- Sidecar env vars (when needed):
  - `MEMORI_SIDECAR_BACKEND=stub|memori` (stub recommended for tests)
  - `MEMORI_SIDECAR_LLM_PROVIDER=stub`
  - `MEMORI_SIDECAR_MEMORI_DB_PATH=memori.db` (temp path OK)
- AI keys: leave blank for local/stub; set dummy strings when exercising key save paths.

## Ports & URLs
- Web dev server: http://127.0.0.1:4173 (Playwright config)
- Sidecar: http://127.0.0.1:9876
- Swagger: http://127.0.0.1:9876/docs

## Test data tips
- Story export/import: keep a small sample JSON handy with 1 story, 1 chapter, 1 lore entry.
- Prompts import: use a JSON with 1–2 non-system prompts; expect `(Imported)` suffix on name collisions.
- Long ingest test: send >5000 chars prompt/completion to verify truncation flag in `/ingest` response.

## Known behaviors
- Memory Panel requires sidecar running; in web dev mode, routes are HTTP; in desktop, Tauri invoke is used.
- Ingest artifacts include provider/model metadata; when using stub, these may be “unknown.”
- Completion auto-ingest is best-effort; failures log to console but shouldn’t block UI.

## When things fail
- Sidecar won’t start: verify Python/venv, port 9876 free, and run `uvicorn sidecar.memori_bridge:app --reload --port 9876`.
- CORS in web dev: ensure sidecar on 127.0.0.1 and browser hitting same origin; Tauri build avoids CORS via invoke.
- Playwright failures: check that dev server at 4173 started (workflow uses reuseExistingServer).

## Quick commands
- Start sidecar (dev): `cd sidecar && . .venv/Scripts/activate && uvicorn sidecar.memori_bridge:app --reload --port 9876`
- Run all tests locally: `npm run build && npm test && npx playwright test && (cd sidecar && pytest) && (cd src-tauri && cargo test)`

## Browser Automation Test IDs

The following `data-testid` attributes are available for DOM selection in browser automation:

### Navigation (MainLayout & Home)
- `main-sidebar` - The fixed left sidebar
- `nav-home-button` - Home button in sidebar (also has `id="nav-home-button"`)
- `main-header` - Top header bar with sidecar status
- `sidecar-status` - Sidecar status container
- `sidecar-connected` / `sidecar-unavailable` - Sidecar status text
- `theme-toggle-button` - Theme toggle (also has `id="theme-toggle-button"`)
- `home-navigation` - Container for home page navigation buttons
- `nav-stories-button` - Stories button on home page (also has `id="nav-stories-button"`)
- `nav-ai-settings-button` - AI Settings button on home page (also has `id="nav-ai-settings-button"`)

### Story Creation
- `create-story-button` - "Create New Story" button (also has `id="create-story-button"`)
- `create-story-dialog` - Create story dialog container
- `story-title-input` - Title input field
- `story-author-input` - Author input field (now optional)
- `submit-story-button` - Submit button (also has `id="submit-story-button"`)

### Story Cards
- `story-card-{id}` - Story card with dynamic ID
- `story-title-{id}` - Story title within card

## Resolved Issues (2025-12-05)
- **DOM Detection**: Added `data-testid` attributes to key React components
- **Navigation Buttons**: Added `id` and `data-testid` to all navigation elements
- **Story Form Author Field**: Made optional (removed `required` attribute), now displays "Unknown Author" if blank
