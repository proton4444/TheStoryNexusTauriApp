from __future__ import annotations

import logging
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from sidecar.settings import Settings

logger = logging.getLogger(__name__)


@dataclass
class MemoryEntry:
    memory_id: str
    story_id: str
    content: str
    category: Optional[str] = None
    session_id: Optional[str] = None


class MemoryBackend:
    def add_memory(
        self, story_id: str, content: str, category: Optional[str], session_id: Optional[str]
    ) -> MemoryEntry:
        raise NotImplementedError

    def search(self, story_id: str, query: str, limit: int) -> List[MemoryEntry]:
        raise NotImplementedError

    def recent(self, story_id: str, limit: int) -> List[MemoryEntry]:
        raise NotImplementedError

    def clear_story(self, story_id: str) -> int:
        raise NotImplementedError

    def clear_all(self) -> None:
        raise NotImplementedError


class InMemoryBackend(MemoryBackend):
    def __init__(self) -> None:
        self._memories: dict[str, list[MemoryEntry]] = {}

    def add_memory(
        self, story_id: str, content: str, category: Optional[str], session_id: Optional[str]
    ) -> MemoryEntry:
        memory_id = str(uuid.uuid4())
        entry = MemoryEntry(
            memory_id=memory_id,
            story_id=story_id,
            content=content,
            category=category,
            session_id=session_id,
        )
        self._memories.setdefault(story_id, []).append(entry)
        return entry

    def search(self, story_id: str, query: str, limit: int) -> List[MemoryEntry]:
        items = self._memories.get(story_id, [])
        q_lower = query.lower()
        results = [entry for entry in items if q_lower in entry.content.lower()]
        return results[:limit]

    def recent(self, story_id: str, limit: int) -> List[MemoryEntry]:
        items = self._memories.get(story_id, [])
        if limit <= 0:
            return []
        return list(reversed(items))[:limit]

    def clear_story(self, story_id: str) -> int:
        removed = len(self._memories.get(story_id, []))
        self._memories.pop(story_id, None)
        return removed

    def clear_all(self) -> None:
        self._memories.clear()


class SQLiteBackend(MemoryBackend):
    """Lightweight SQLite-based backend for persistence without ML dependencies."""

    def __init__(self, db_path: str = "memori.db") -> None:
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                memory_id TEXT PRIMARY KEY,
                story_id TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT,
                session_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_story_id ON memories(story_id)")
        conn.commit()
        conn.close()
        logger.info("SQLite backend initialized at %s", self.db_path)

    def add_memory(
        self, story_id: str, content: str, category: Optional[str], session_id: Optional[str]
    ) -> MemoryEntry:
        memory_id = str(uuid.uuid4())
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO memories (memory_id, story_id, content, category, session_id) VALUES (?, ?, ?, ?, ?)",
            (memory_id, story_id, content, category, session_id),
        )
        conn.commit()
        conn.close()
        return MemoryEntry(
            memory_id=memory_id,
            story_id=story_id,
            content=content,
            category=category,
            session_id=session_id,
        )

    def search(self, story_id: str, query: str, limit: int) -> List[MemoryEntry]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT memory_id, story_id, content, category, session_id
            FROM memories
            WHERE story_id = ? AND content LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (story_id, f"%{query}%", limit),
        )
        rows = cursor.fetchall()
        conn.close()
        return [
            MemoryEntry(
                memory_id=row[0],
                story_id=row[1],
                content=row[2],
                category=row[3],
                session_id=row[4],
            )
            for row in rows
        ]

    def recent(self, story_id: str, limit: int) -> List[MemoryEntry]:
        if limit <= 0:
            return []
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT memory_id, story_id, content, category, session_id
            FROM memories
            WHERE story_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (story_id, limit),
        )
        rows = cursor.fetchall()
        conn.close()
        return [
            MemoryEntry(
                memory_id=row[0],
                story_id=row[1],
                content=row[2],
                category=row[3],
                session_id=row[4],
            )
            for row in rows
        ]

    def clear_story(self, story_id: str) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memories WHERE story_id = ?", (story_id,))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return deleted

    def clear_all(self) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memories")
        conn.commit()
        conn.close()


class MemoriBackend(MemoryBackend):
    """Adapter to the Memori engine with SQLite storage.

    Note: this requires heavy dependencies (sentence-transformers, faiss, etc.) and is
    expected to run in environments where those are available. If initialization fails,
    prefer the stub backend.
    """

    def __init__(self, settings: Settings):
        try:
            from memori import Memori
            from memori.storage._builder import Builder
            from memori.llm._embeddings import embed_texts
            from memori.memory.recall import Recall
        except Exception as exc:  # pragma: no cover - import-time failure handled
            # Attempt to load from vendored subtree if available
            repo_memori = Path(__file__).resolve().parent.parent / "src" / "memori"
            if repo_memori.exists():
                import sys

                sys.path.append(str(repo_memori))
                from memori import Memori  # type: ignore
                from memori.storage._builder import Builder  # type: ignore
                from memori.llm._embeddings import embed_texts  # type: ignore
                from memori.memory.recall import Recall  # type: ignore
            else:
                raise RuntimeError(f"Memori backend unavailable: {exc}") from exc

        self.use_stub_embeddings = settings.stub_embeddings
        if self.use_stub_embeddings:
            self._embed_texts = lambda texts: [[0.0] * 384 for _ in texts]  # type: ignore
        else:
            self._embed_texts = embed_texts
        self._recall_cls = Recall
        self.process_external_id = settings.process_id

        def conn_factory():
            return sqlite3.connect(settings.memori_db_path)

        self.memori = Memori(conn=conn_factory)
        
        # Apply LLM-related settings
        self.memori.config.llm.provider = settings.llm_provider
        self.memori.config.llm.version = settings.llm_model
        if settings.openai_api_key:
            self.memori.config.api_key = settings.openai_api_key
            
        # Set recall configuration for better memory retrieval
        self.memori.config.recall_facts_limit = 5
        self.memori.config.recall_relevance_threshold = 0.1
        
        # Register OpenAI client if API key is available
        if settings.openai_api_key and settings.llm_provider == "openai":
            try:
                from openai import OpenAI
                openai_client = OpenAI(api_key=settings.openai_api_key)
                self.memori.openai.register(openai_client)
                logger.info("Registered OpenAI client with Memori")
            except ImportError:
                logger.warning("OpenAI package not available for Memori registration")
            except Exception as e:
                logger.warning(f"Could not register OpenAI client: {e}")
        
        # Build schema (no banner)
        builder = Builder(self.memori.config)
        builder.display_banner = False
        builder.execute()

    def _ensure_entity_and_process(self, story_id: str):
        driver = self.memori.config.storage.driver
        entity_id = driver.entity.create(story_id)
        process_id = driver.process.create(self.process_external_id)
        return entity_id, process_id

    def add_memory(
        self, story_id: str, content: str, category: Optional[str], session_id: Optional[str]
    ) -> MemoryEntry:
        entity_id, _process_id = self._ensure_entity_and_process(story_id)

        embeddings = self._embed_texts(content if isinstance(content, list) else [content])
        self.memori.config.storage.driver.entity_fact.create(
            entity_id, [content], fact_embeddings=embeddings
        )

        return MemoryEntry(
            memory_id=str(uuid.uuid4()),
            story_id=story_id,
            content=content,
            category=category,
            session_id=session_id,
        )

    def search(self, story_id: str, query: str, limit: int) -> List[MemoryEntry]:
        entity_id, _process_id = self._ensure_entity_and_process(story_id)
        if self.use_stub_embeddings:
            adapter = self.memori.config.storage.adapter
            rows = (
                adapter.execute(
                    """
                    SELECT uuid, content
                      FROM memori_entity_fact
                     WHERE entity_id = ?
                       AND content LIKE ?
                     ORDER BY date_last_time DESC
                     LIMIT ?
                    """,
                    (entity_id, f"%{query}%", limit),
                )
                .mappings()
                .fetchall()
            )
            return [
                MemoryEntry(
                    memory_id=row.get("uuid") or str(uuid.uuid4()),
                    story_id=story_id,
                    content=row.get("content", ""),
                    category=None,
                    session_id=None,
                )
                for row in rows
            ]

        recall_results = self._recall_cls(self.memori.config).search_facts(
            query, limit=limit, entity_id=entity_id
        )
        entries: list[MemoryEntry] = []
        for fact in recall_results:
            entries.append(
                MemoryEntry(
                    memory_id=str(fact.get("uuid", uuid.uuid4())),
                    story_id=story_id,
                    content=fact.get("content", ""),
                    category=fact.get("category"),
                    session_id=None,
                )
            )
        return entries[:limit]

    def recent(self, story_id: str, limit: int) -> List[MemoryEntry]:
        entity_id, _process_id = self._ensure_entity_and_process(story_id)
        if self.use_stub_embeddings:
            adapter = self.memori.config.storage.adapter
            rows = (
                adapter.execute(
                    """
                    SELECT uuid, content
                      FROM memori_entity_fact
                     WHERE entity_id = ?
                     ORDER BY date_last_time DESC
                     LIMIT ?
                    """,
                    (entity_id, limit),
                )
                .mappings()
                .fetchall()
            )
            return [
                MemoryEntry(
                    memory_id=row.get("uuid") or str(uuid.uuid4()),
                    story_id=story_id,
                    content=row.get("content", ""),
                    category=None,
                    session_id=None,
                )
                for row in rows
            ]

        return self.search(story_id, query="", limit=limit)

    def clear_story(self, story_id: str) -> int:
        driver = self.memori.config.storage.driver
        entity_id = driver.entity.create(story_id)
        # There is no bulk delete; clear by dropping rows for this entity.
        adapter = self.memori.config.storage.adapter
        deleted = adapter.execute(
            "DELETE FROM memori_entity_fact WHERE entity_id = ?", (entity_id,)
        )
        adapter.commit()
        # rows affected not exposed via wrapper; return 0 to indicate best-effort
        return 0

    def clear_all(self) -> None:
        adapter = self.memori.config.storage.adapter
        adapter.execute("DELETE FROM memori_entity_fact")
        adapter.commit()


def select_backend(settings: Settings) -> MemoryBackend:
    if settings.backend == "sqlite":
        logger.info("Initializing SQLite backend at %s", settings.memori_db_path)
        return SQLiteBackend(settings.memori_db_path)
    if settings.backend == "memori":
        try:
            logger.info("Initializing Memori backend with SQLite at %s", settings.memori_db_path)
            return MemoriBackend(settings)
        except Exception as exc:
            logger.warning("Falling back to stub backend: %s", exc)
    return InMemoryBackend()

