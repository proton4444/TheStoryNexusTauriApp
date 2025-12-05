# Developer Guide

This guide covers the architecture and development workflow for TheStoryNexusTauriApp.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Components  │  │   Features   │  │     Services     │   │
│  │  - UI        │  │  - stories   │  │  - AIService     │   │
│  │  - Layouts   │  │  - chapters  │  │  - memoryService │   │
│  │              │  │  - memory    │  │  - database      │   │
│  └──────────────┘  │  - prompts   │  └──────────────────┘   │
│                    │  - brainstorm│                         │
│                    └──────────────┘                         │
├─────────────────────────────────────────────────────────────┤
│                   Tauri Bridge (Rust)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  memory_commands.rs - Sidecar management + proxies   │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                   Sidecar (Python/FastAPI)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  memori_bridge.py - REST API + Memori engine         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
TheStoryNexusTauriApp/
├── src/                      # Frontend source
│   ├── features/             # Feature modules (stories, chapters, memory, etc.)
│   │   └── memory/           # Memory integration
│   │       ├── components/   # MemoryPanel, MemoryCategoryCloud
│   │       └── store/        # useMemoryStore (Zustand)
│   ├── services/             # Service layer
│   │   ├── ai/               # AIService, memoriCompletionAdapter
│   │   └── memory/           # memoryService, memoriCompletion
│   ├── hooks/                # Custom hooks (useMemoryCompletion, useSidecarBootstrap)
│   └── components/           # Shared UI components
├── src-tauri/                # Tauri/Rust backend
│   └── src/
│       ├── lib.rs            # App entry, command registration
│       └── memory_commands.rs # Sidecar IPC commands
├── sidecar/                  # Python memory sidecar
│   ├── memori_bridge.py      # FastAPI app
│   ├── backends.py           # Stub/Memori backend implementations
│   └── settings.py           # Environment configuration
└── tests/                    # Test files
    └── e2e/                  # Playwright E2E tests
```

## Development Setup

### Prerequisites

- Node.js 18+
- Rust (stable toolchain)
- Python 3.10+
- pnpm or npm

### Install & Run

```bash
# Frontend
npm install
npm run dev

# Sidecar (separate terminal)
cd sidecar
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn sidecar.memori_bridge:app --reload --port 9876

# Tauri desktop (optional)
npm run tauri dev
```

## Testing

### Unit Tests (Vitest)

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
```

Test files: `src/**/__tests__/*.test.{ts,tsx}`

### E2E Tests (Playwright)

```bash
npx playwright test                    # Run all E2E
npx playwright test --headed           # With browser UI
npx playwright test --project=chromium # Specific browser
```

Test files: `tests/e2e/*.spec.ts`

### Rust Tests

```bash
cd src-tauri
cargo test
```

### Python Tests

```bash
cd sidecar
pytest
```

## Key Patterns

### Feature Module Structure

Each feature follows this pattern:
```
features/[name]/
├── components/        # React components
├── stores/            # Zustand stores
├── hooks/             # Feature-specific hooks
├── services/          # API/data layer
└── pages/             # Route pages
```

### State Management

We use **Zustand** for global state:

```typescript
// Example: useMemoryStore
const useMemoryStore = create<MemoryState>((set, get) => ({
  context: [],
  loading: false,
  refreshContext: async (storyId) => {
    set({ loading: true });
    const data = await getContext({ storyId });
    set({ context: data.memories, loading: false });
  },
}));
```

### Service Layer

Services abstract API calls:

```typescript
// memoryService.ts - Works in both Tauri and web
export async function searchMemories(req: MemorySearchRequest) {
  if (isTauri) {
    return invokeIfTauri<SearchResponse>('memori_search', { payload: req });
  }
  return postJSON<SearchResponse>('/search', req);
}
```

### Tauri Commands

Rust commands are registered in `lib.rs`:

```rust
#[tauri::command]
pub async fn memori_search(payload: SearchRequest) -> Result<SearchResponse, String> {
    post_json::<SearchResponse, _>("/search", &payload, port).await
}
```

## Adding a New Feature

1. Create feature directory: `src/features/[name]/`
2. Add Zustand store: `stores/use[Name]Store.ts`
3. Create components: `components/[Name].tsx`
4. Add to router if needed: `src/app.tsx`
5. Write tests: `__tests__/[Name].test.tsx`

## Memory Integration Points

### Adding Memory Awareness to a Feature

1. Import the hook:
```typescript
import { useMemoryCompletion } from '@/hooks/useMemoryCompletion';
```

2. Use in component:
```typescript
const { completeWithMemory } = useMemoryCompletion();
const result = await completeWithMemory({
  storyId,
  prompt: userInput,
});
```

### Ingestion Options

```typescript
useMemoryCompletion({
  ingestPrompt: true,      // Store user prompts
  ingestCompletion: true,  // Store AI responses (default)
  ingestInjected: true,    // Include injected memories in ingest
});
```

## CI/CD

GitHub Actions runs on push to `main`, `master`, `develop`:

| Job | What it does |
|-----|--------------|
| `frontend` | npm build |
| `frontend-tests` | Vitest unit tests |
| `sidecar` | Python pytest |
| `rust` | Cargo test |
| `e2e` | Playwright tests |

## Common Issues

### TypeScript Errors

Run `npx tsc --noEmit` to check types without building.

### Sidecar Connection Failed

1. Ensure port 9876 isn't in use
2. Check Python environment is activated
3. Verify `requirements.txt` installed

### Tauri Build Issues

```bash
cd src-tauri
cargo clean
cargo build
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/name`
3. Make changes with tests
4. Run all checks: `npm run build && npm test`
5. Submit a pull request to `develop`
