// Barrel export for memory feature
// Provides cleaner imports with standardized naming

export {
    completeWithMemory,              // → memori_completion
    searchMemories,                  // → memori_search
    getContext as getStoryContext,   // → memori_context
    addMemory as addManualMemory,    // → memori_add_memory
    health as checkMemoriHealth,     // → memori_health
    config as getMemoriConfig,       // → memori_config
    createSession,                   // → memori_create_session
    startSidecar,                    // → start_memori_sidecar
    stopSidecar,                     // → stop_memori_sidecar
    extractAndStore,                 // → memori_extract
    ingestConversation,              // → memori_ingest
} from '../../services/memory/memoryService';

// Export types
export type {
    CompletionRequest,
    CompletionResponse,
    MemoriCompletionResponse,
    MemoryAddRequest,
    MemorySearchRequest,
    MemoryResult,
    MemoryContextRequest,
    ExtractionRequest,
    IngestRequest,
    ConfigResponse,
} from '../../services/memory/memoryService';

// Re-export store
export { useMemoryStore } from './store/useMemoryStore';

// Re-export components
export { MemoryPanel } from './components/MemoryPanel';
