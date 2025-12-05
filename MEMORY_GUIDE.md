# Memori Integration Guide

This guide explains how to use the AI Memory feature in The Story Nexus.

## Overview

The Memori system provides **persistent AI memory** for your stories. When you generate content with AI, the system:

1. **Injects relevant context** - Memories about your story are automatically added to the AI prompt
2. **Generates with awareness** - The AI responds with knowledge of your characters, locations, and plot
3. **Extracts and stores** - New facts from the conversation are saved for future use

## Getting Started

### 1. Start the Memory Sidecar

**Desktop App (Tauri):** The sidecar starts automatically.

**Web Development:**
```bash
cd sidecar
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn sidecar.memori_bridge:app --reload --port 9876
```

### 2. Configure the Backend

Set environment variables before starting the sidecar:

| Variable | Values | Description |
|----------|--------|-------------|
| `MEMORI_SIDECAR_BACKEND` | `stub` or `memori` | `stub` for testing, `memori` for real persistence |
| `MEMORI_SIDECAR_MEMORI_DB_PATH` | Path | SQLite database location (default: `memori.db`) |
| `MEMORI_SIDECAR_LLM_PROVIDER` | `stub`, `openai`, `openrouter`, `local` | Which LLM to use |
| `MEMORI_SIDECAR_LLM_MODEL` | Model name | e.g., `gpt-4o-mini` |
| `MEMORI_SIDECAR_OPENAI_API_KEY` | API key | For OpenAI provider |
| `MEMORI_SIDECAR_OPENROUTER_API_KEY` | API key | For OpenRouter provider |

### 3. Verify Connection

The app header shows sidecar status:
- ✅ `Sidecar: memori | LLM: openai (gpt-4o-mini)` - Connected
- ⚠️ `Sidecar: Unavailable` - Not running

## Using the Memory Panel

The Memory Panel appears on the right side of the Story Dashboard.

### Toggle Visibility

Click **"Show/Hide Memory Panel"** in the toolbar.

### Features

#### Recent Context
Shows the most recent memories for your story. Click **Refresh** to reload.

#### Search Memories
Type a query (e.g., "dragon", "protagonist", "castle") and click **Search** to find relevant memories.

#### Add Memory
Manually add a fact about your story:
1. Enter a category (optional: `character`, `location`, `plot`, `lore`, etc.)
2. Type the memory content
3. Click **Add**

#### Import from Lorebook
Click **"Import lorebook entries"** to add all your Lorebook entries as memories. Great for bootstrapping a new story!

#### Stats
Toggle **"Show stats"** to see:
- Total recent items
- Search match count
- Category cloud visualization

## Memory-Aware Generation

### In Brainstorm Chat

1. Toggle **"Use Memory"** (enabled by default)
2. Write your prompt and send
3. The AI receives injected context automatically
4. Responses are stored for future context

### How It Works

```
┌─────────────────────────────────────────────┐
│           Your Prompt                       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  1. INJECT: Search memories → Add to prompt │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  2. GENERATE: LLM creates response          │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  3. INGEST: Store prompt+response as memory │
└─────────────────────────────────────────────┘
```

## Story Isolation

Memories are **scoped to each story**. 

- Story A's memories never leak into Story B
- Each story has its own memory database partition
- Deleting a story removes its memories

## Best Practices

### Building Good Context

1. **Be specific** - "Elena is a skilled archer from the Northern Kingdom" beats "character info"
2. **Add relationships** - "Elena's mentor is the wizard Aldric"
3. **Include key plot points** - "The dragon was defeated in Chapter 3"

### Managing Memory Size

- Memories are automatically ranked by relevance
- Only the most relevant memories are injected (default: 3)
- Older/less relevant memories are still searchable

### Lorebook Integration

Your Lorebook entries are the foundation. Import them to memory, then let the AI discover new details through generation.

## Troubleshooting

### Sidecar Won't Start

1. Check Python 3.10+ is installed
2. Verify virtual environment is activated
3. Check port 9876 isn't in use: `lsof -i :9876`

### Memories Not Appearing

1. Click **Refresh** in the Memory Panel
2. Verify sidecar is running (check header status)
3. Check browser console for errors

### Search Returns Nothing

- Try broader terms
- Memory search is semantic - "hero" matches "protagonist"
- With `stub` backend, search is keyword-based only

## API Reference

The sidecar exposes a REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/config` | GET | Current configuration |
| `/context` | POST | Get recent memories |
| `/search` | POST | Search memories |
| `/memory/add` | POST | Add a memory |
| `/completion` | POST | Memory-aware completion |
| `/ingest` | POST | Store prompt+completion |

Full API docs: `http://127.0.0.1:9876/docs` (Swagger) or `/redoc` (ReDoc)
