import importlib
import os
from fastapi.testclient import TestClient
import pytest

from sidecar import memori_bridge
from sidecar.memori_bridge import app, get_backend


@pytest.fixture(autouse=True)
def reset_backend():
    backend = get_backend()
    backend.clear_all()
    yield
    backend.clear_all()


def test_health_ok():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_session_new_creates_id():
    client = TestClient(app)
    response = client.post("/session/new", json={"story_id": "story-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["story_id"] == "story-1"
    assert body["session_id"]


def test_add_memory_and_search():
    client = TestClient(app)
    add_resp = client.post(
        "/memory/add",
        json={"story_id": "story-1", "content": "Dragon in the cave", "category": "lore"},
    )
    assert add_resp.status_code == 200

    search_resp = client.post(
        "/search", json={"story_id": "story-1", "query": "dragon", "limit": 5}
    )
    assert search_resp.status_code == 200
    results = search_resp.json()["results"]
    assert len(results) == 1
    assert results[0]["content"] == "Dragon in the cave"
    assert results[0]["category"] == "lore"


def test_context_returns_most_recent_first():
    client = TestClient(app)
    client.post("/memory/add", json={"story_id": "story-1", "content": "Old fact"})
    client.post("/memory/add", json={"story_id": "story-1", "content": "Recent fact"})

    context_resp = client.post("/context", json={"story_id": "story-1", "limit": 1})
    assert context_resp.status_code == 200
    memories = context_resp.json()["memories"]
    assert len(memories) == 1
    assert memories[0]["content"] == "Recent fact"


def test_completion_injects_recent_memories_and_sets_session(monkeypatch):
    # Force stub LLM for deterministic output
    monkeypatch.setenv("MEMORI_SIDECAR_LLM_PROVIDER", "stub")
    module = importlib.reload(memori_bridge)
    client = TestClient(module.app)
    client.post("/memory/add", json={"story_id": "story-1", "content": "Memory A"})
    client.post("/memory/add", json={"story_id": "story-1", "content": "Memory B"})

    completion_resp = client.post(
        "/completion",
        json={"story_id": "story-1", "prompt": "Tell me", "inject_limit": 2},
    )

    assert completion_resp.status_code == 200
    body = completion_resp.json()
    assert body["story_id"] == "story-1"
    assert body["session_id"]
    assert "completion" in body
    # Should inject newest first
    assert body["injected_memories"] == ["Memory B", "Memory A"]


def test_clear_memory_removes_story_memories():
    client = TestClient(app)
    client.post("/memory/add", json={"story_id": "story-1", "content": "A"})
    client.post("/memory/add", json={"story_id": "story-1", "content": "B"})

    clear_resp = client.delete("/memory/story-1")
    assert clear_resp.status_code == 200
    assert clear_resp.json() == {"story_id": "story-1", "cleared": 2}

    search_resp = client.post(
        "/search", json={"story_id": "story-1", "query": "A", "limit": 5}
    )
    assert search_resp.status_code == 200
    assert search_resp.json()["results"] == []


def test_memori_backend_stub_embeddings(monkeypatch, tmp_path):
    pytest.importorskip("memori")
    monkeypatch.setenv("MEMORI_SIDECAR_BACKEND", "memori")
    monkeypatch.setenv("MEMORI_SIDECAR_MEMORI_DB_PATH", str(tmp_path / "memori.db"))
    monkeypatch.setenv("MEMORI_SIDECAR_STUB_EMBEDDINGS", "1")
    monkeypatch.setenv("MEMORI_SIDECAR_LLM_PROVIDER", "stub")
    module = importlib.reload(memori_bridge)
    client = TestClient(module.app)

    add_resp = client.post(
        "/memory/add",
        json={"story_id": "story-xyz", "content": "Castle on the hill"},
    )
    assert add_resp.status_code == 200

    search_resp = client.post(
        "/search",
        json={"story_id": "story-xyz", "query": "Castle", "limit": 5},
    )
    assert search_resp.status_code == 200
    results = search_resp.json()["results"]
    assert len(results) == 1
    assert results[0]["content"] == "Castle on the hill"


def test_config_snapshot():
    client = TestClient(app)
    resp = client.get("/config")
    assert resp.status_code == 200
    body = resp.json()
    assert "backend" in body
    assert "llm_provider" in body
