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

> Note: The current implementation is an in-memory stub for endpoint shapes only. It is not persistent or production-ready; wiring to Memori + storage comes next.

## Testing
```bash
cd sidecar
pytest
```

## Next steps
- Add completion/search/context/memory endpoints around Memori.
- Wire session/story attribution handling.
- Package sidecar start/stop with the Tauri sidecar launcher.
