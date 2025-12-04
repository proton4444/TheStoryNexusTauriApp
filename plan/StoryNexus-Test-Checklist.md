# StoryNexus + Memori Test Checklist (IDE-friendly)

## Environments
- [ ] Web (npm run dev)
- [ ] Desktop (npm run tauri dev)
- [ ] Sidecar live at http://127.0.0.1:9876 (uvicorn sidecar.memori_bridge:app --reload --port 9876)

## Smoke setup
- [ ] npm install
- [ ] npm run dev (or npm run tauri dev) reachable
- [ ] python -m venv .venv && pip install -r sidecar/requirements.txt
- [ ] Sidecar health: GET /health returns 200 {"status":"ok"}

## Story management
- [ ] Create story via UI; verify it appears on Home grid.
- [ ] Edit story title; verify updated.
- [ ] Export story JSON; re-import and see “(Imported)” suffix.
- [ ] Delete story and confirm related chapters/notes gone.

## Chapters & editor
- [ ] Create chapter; add content; verify saved and reloaded.
- [ ] Navigate to last edited chapter via sidebar shortcut.
- [ ] Scene beat command (Alt/Option+S) opens; cancellation does not crash.

## Prompts
- [ ] Open Prompts page; create custom prompt; edit; delete.
- [ ] Export prompts JSON; import same file; names get `(Imported)` suffix on duplicates.
- [ ] System prompts remain read-only.

## AI settings
- [ ] Set OpenAI key (dummy ok); Save; Refresh Models shows list or handles failure gracefully.
- [ ] Set OpenRouter key; Refresh Models; handles failure.
- [ ] Update Local API URL; Refresh Models; fallback model available if unreachable.

## Memory sidecar integration
- [ ] Sidecar status visible in MainLayout banner.
- [ ] Story Dashboard Memory Panel toggles on/off.
- [ ] Recent context loads (shows count badge).
- [ ] Search returns mocked results when sidecar up; graceful error when down.
- [ ] Add memory via panel; entry appears in context.
- [ ] Import lorebook entries; summary shows imported count; category cloud updates.
- [ ] Stats toggle shows counts and category chips.

## Ingest/ingestion flow
- [ ] Trigger AI completion via memori path (prompts adapter); verify completion and prompt are stored (search “Prompt:” text in context).
- [ ] Injected memories appear in ingest artifact (look for “Injected memories:” lines).
- [ ] Ingest truncation guard: send very long prompt/completion; truncated flag returned (via /ingest) and no crash.

## Sidecar API spot checks (via curl/Postman)
- [ ] POST /memory/add (story_id=a) then /search finds entry.
- [ ] POST /context returns most recent first.
- [ ] POST /completion returns completion text and injected_memories array.
- [ ] POST /extract stores prompt+completion pair; visible via /context.
- [ ] POST /ingest stores prompt+completion+injected with provider/model metadata.
- [ ] Story isolation: memories from story A do not show in story B search/context.

## Lorebook
- [ ] Create lorebook entry with tags; searchable; import to memory works (from Memory Panel).
- [ ] Disable entry; ensure it hides where expected.

## Notes/brainstorm
- [ ] Create note; edit; delete; verify timestamps update.
- [ ] Brainstorm page loads without errors.

## Routing/navigation
- [ ] Main layout nav buttons work (Home, AI Settings, Guide).
- [ ] Dashboard sidebar expands/collapses and persists state.

## Theming/UI
- [ ] Theme toggle switches light/dark; persists.
- [ ] Memory Panel badges/labels render correctly in both themes.

## Tests/CI hooks (local)
- [ ] npm run build
- [ ] npm test (Vitest)
- [ ] npx playwright test (E2E memory panel stubs)
- [ ] (sidecar) pytest sidecar/tests
- [ ] (rust) cargo test in src-tauri

## Error handling
- [ ] Sidecar down: Memory Panel shows error/toast but app stays usable.
- [ ] Missing API keys: AI Settings shows graceful errors on Refresh Models.
- [ ] Import malformed story/prompt JSON: shows error and no crash.
