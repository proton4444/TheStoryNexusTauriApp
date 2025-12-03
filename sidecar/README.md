# Sidecar (FastAPI + Memori)

Lightweight Python sidecar that wraps Memori and exposes memory endpoints to the Tauri app.

## Quickstart (dev)
```bash
cd sidecar
python -m venv .venv
. .venv/Scripts/activate  # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn sidecar.memori_bridge:app --reload --port 9876
```

> Note: The current implementation defaults to an in-memory stub for endpoint shapes. Set `MEMORI_SIDECAR_BACKEND=memori` to try the Memori backend (requires heavy deps and a valid Python env). SQLite DB path can be set via `MEMORI_SIDECAR_MEMORI_DB_PATH`.

Env vars:
- `MEMORI_SIDECAR_BACKEND=stub|memori` (default `stub`)
- `MEMORI_SIDECAR_MEMORI_DB_PATH=memori.db` (SQLite path)
- `MEMORI_SIDECAR_PROCESS_ID=storynexus`
- `MEMORI_SIDECAR_LLM_PROVIDER=stub|openai|openrouter|local`
- `MEMORI_SIDECAR_LLM_MODEL=gpt-4o-mini`
- `MEMORI_SIDECAR_OPENAI_API_KEY`, `MEMORI_SIDECAR_OPENROUTER_API_KEY`

## Testing
```bash
cd sidecar
pytest
```

## Next steps
- Add completion/search/context/memory endpoints around Memori.
- Wire session/story attribution handling.
- Package sidecar start/stop with the Tauri sidecar launcher.
