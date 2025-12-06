import pytest
import os
import uuid
from sidecar.settings import Settings
from sidecar.backends import SQLiteBackend, MemoriBackend

@pytest.fixture
def temp_db(tmp_path):
    db_path = tmp_path / "test_dedup.db"
    return str(db_path)

@pytest.fixture
def sqlite_backend(temp_db):
    return SQLiteBackend(db_path=temp_db)

@pytest.fixture
def memori_backend(temp_db):
    try:
        from memori import Memori
        has_memori = True
    except ImportError:
        has_memori = False
        
    if not has_memori or os.environ.get("MEMORI_SIDECAR_STUB_EMBEDDINGS") != "1":
        pytest.skip("Skipping Memori backend test without stub embeddings or if memori not installed")

    settings = Settings(
        backend="memori",
        memori_db_path=temp_db,
        stub_embeddings=True, # Use stub to run fast without API keys
        llm_provider="local",
        llm_model="local"
    )
    return MemoriBackend(settings)

def test_sqlite_deduplication(sqlite_backend):
    story_id = str(uuid.uuid4())
    content = "The quick brown fox jumps over the lazy dog."
    
    # First add
    entry1 = sqlite_backend.add_memory(story_id, content, "test", None)
    
    # Second add (duplicate)
    entry2 = sqlite_backend.add_memory(story_id, content, "test", None)
    
    # Third add (different category, allowed for now but logic checks content only)
    entry3 = sqlite_backend.add_memory(story_id, content, "other", None)
    
    # Verify IDs match
    assert entry1.memory_id == entry2.memory_id
    assert entry1.memory_id == entry3.memory_id
    
    # Verify count is 1
    assert sqlite_backend.count_memories(story_id, "brown fox") == 1

    # Add different content
    entry4 = sqlite_backend.add_memory(story_id, "Another unique memory.", "test", None)
    assert entry4.memory_id != entry1.memory_id
    assert sqlite_backend.count_memories(story_id, None) == 2

def test_memori_deduplication(memori_backend):
    story_id = str(uuid.uuid4())
    content = "A duplicate entry in Memori."
    
    # First add
    entry1 = memori_backend.add_memory(story_id, content, "test", None)
    
    # Second add (duplicate)
    entry2 = memori_backend.add_memory(story_id, content, "test", None)
    
    # Verify IDs match
    assert entry1.memory_id == entry2.memory_id
    
    # Verify count is 1
    # MemoriBackend.count_memories uses the adapter directly so it should reflect 1 row
    assert memori_backend.count_memories(story_id, "duplicate") == 1
    
    # Cleanup for this test
    memori_backend.clear_story(story_id)
