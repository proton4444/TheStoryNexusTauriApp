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

        self._embed_texts = embed_texts
        self._recall_cls = Recall
        self.process_external_id = settings.process_id

        def conn_factory():
            return sqlite3.connect(settings.memori_db_path)

        self.memori = Memori(conn=conn_factory)
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
        # Memori doesn't have a direct "recent facts" helper; reuse search with empty query.
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
    if settings.backend == "memori":
        try:
            logger.info("Initializing Memori backend with SQLite at %s", settings.memori_db_path)
            return MemoriBackend(settings)
        except Exception as exc:
            logger.warning("Falling back to stub backend: %s", exc)
    return InMemoryBackend()
