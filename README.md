# The Story Nexus

A powerful AI-driven story writing desktop application built with Tauri, React, and TypeScript.

## Overview

The Story Nexus is a local-first desktop application designed for writers who want to leverage AI to enhance their creative writing process. It provides a comprehensive environment for creating, organizing, and developing stories with the assistance of AI-powered tools.

## Key Features

- **Story Management**: Create and organize your stories with chapters, outlines, and summaries
- **Rich Text Editor**: Write and edit your stories using a powerful Lexical-based editor
- **AI Integration**: Generate content using AI models from providers like OpenAI and OpenRouter or use a locally hosted model
- **Custom Prompts**: Create and manage custom prompts to guide AI generation
- **Scene Beats Addon to Editor**: Press alt (option for mac) + s in editor to open Scene Beat AI command
- **Lorebook**: Maintain a database of characters, locations, items, events, and notes for your story
- **Local-First**: All your data is stored locally using IndexedDB with DexieJS

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **State Management**: Zustand
- **Routing**: React Router v7
- **Storage**: IndexedDB with DexieJS
- **Text Editor**: Lexical
- **Desktop Framework**: Tauri v2
- **UI Components**: Shadcn UI, Lucide React icons
- **Notifications**: React Toastify

## Getting Started

### Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. (Optional) Run Tauri dev (desktop shell):
   ```
   npm run tauri dev
   ```

### Sidecar (Memori) development
In a separate terminal:
```bash
cd sidecar
python -m venv .venv
. .venv/Scripts/activate  # or source .venv/bin/activate
pip install -r requirements.txt
uvicorn sidecar.memori_bridge:app --reload --port 9876
```
Env vars:
- `MEMORI_SIDECAR_BACKEND=stub|memori` (default `stub`)
- `MEMORI_SIDECAR_MEMORI_DB_PATH=memori.db` (SQLite path)
- `MEMORI_SIDECAR_PROCESS_ID=storynexus` (process attribution)
- `MEMORI_SIDECAR_LLM_PROVIDER=stub|openai|openrouter|local`
- `MEMORI_SIDECAR_LLM_MODEL=gpt-4o-mini`
- `MEMORI_SIDECAR_OPENAI_API_KEY`, `MEMORI_SIDECAR_OPENROUTER_API_KEY`
- `MEMORI_SIDECAR_STUB_EMBEDDINGS=1` (use lightweight embeddings/search for offline tests)

### Building

To build the application for production:

```
npm run build
```

To preview the production build:

```
npm run preview
```

To run Tauri commands:

```
npm run tauri
```

To run Tauri create debug release:

```
npm run tauri build -- --debug
```

To run Tauri create release build:

```
npm run tauri build
```

## Memory integration status

- A FastAPI sidecar (`sidecar/`) runs on `localhost:9876` and can be started automatically in the desktop build. It exposes health/config, search/context, manual memory add, and completion endpoints.
- The Story Dashboard now includes a Memory Panel (toggle on the right) that lets you search memories, view recent context, add new facts, and import lorebook entries scoped to the active story. In the web build the panel still works against the HTTP sidecar if it is running locally.
- Tauri now exposes proxy commands for memory endpoints to avoid CORS in the desktop shell; the frontend falls back to HTTP when not in Tauri.
- Partial ingestion: completions are written back to memory automatically, and prompts can be ingested (opt-in in `useMemoryCompletion`). Full “conscious ingest”/extraction remains on the roadmap.
- The sidecar exposes Swagger/ReDoc at `http://127.0.0.1:9876/docs` and `http://127.0.0.1:9876/redoc`. See `docs/api-reference.md`.

## Screenshots

![App Screenshot](screenshots/Home.jpg)
![App Screenshot](screenshots/Stories.jpg)
![App Screenshot](screenshots/Prompts.jpg)
![App Screenshot](screenshots/Lorebook.jpg)
![App Screenshot](screenshots/CreateChapter.jpg)
![App Screenshot](screenshots/Editor.jpg)
![App Screenshot](screenshots/SceneBeat.jpg)
![App Screenshot](screenshots/GeneratedProse.jpg)

## Project Structure

- `src/features/` - Main application features (stories, chapters, prompts, ai, lorebook)
- `src/components/` - Reusable UI components
- `src/Lexical/` - Text editor implementation
- `src/types/` - TypeScript type definitions
- `src/services/` - Application services
- `src/lib/` - Utility functions and helpers
- `src/hooks/` - Custom React hooks
- `src/pages/` - Application pages

## Prompts export/import

You can export and import prompts from the Prompts Manager UI.

-- Export: Click the export button to download a JSON file containing all non-system prompts (system prompts are excluded). The file format is:

```
{
   "version": "1.0",
   "type": "prompts",
   "prompts": [ /* array of prompt objects */ ]
}
```

-- Import: Click the import button and choose a JSON file in the format above. Imported prompts are validated (messages must be an array of `{role, content}` objects). Imported prompts are always created as non-system prompts (so you can edit or delete them). If a prompt name already exists it will get a unique ` (Imported)` suffix. New IDs and `createdAt` timestamps are generated for imported prompts.

If an imported prompt fails validation it will be skipped and a warning will be logged to the console.
