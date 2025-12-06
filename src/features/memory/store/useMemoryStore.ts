import { create } from 'zustand';
import {
  addMemory as addMemoryApi,
  addMemories as addMemoriesApi,
  deleteMemory as deleteMemoryApi,
  getContext as getContextApi,
  health as checkHealthApi,
  MemoryResult,
  searchMemories as searchMemoriesApi,
  extractFromText as extractFromTextApi,
  ExtractFromTextResponse,
} from '@/services/memory/memoryService';
import { db } from '@/services/database';

type MemoryState = {
  // Connection state
  isConnected: boolean;

  // Current story isolation
  currentStoryId: string | null;

  // Panel visibility
  isPanelOpen: boolean;

  // Search state
  query: string;
  results: MemoryResult[];

  // Context state
  context: MemoryResult[];

  // Loading states
  loading: boolean;
  importing: boolean;
  lastImported: number | null;

  // Error state
  error?: string;

  // Actions - Connection
  checkHealth: () => Promise<boolean>;

  // Actions - Story
  setCurrentStory: (storyId: string | null) => void;

  // Actions - Panel
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Actions - Search
  setQuery: (value: string) => void;
  search: (storyId?: string, limit?: number) => Promise<void>;

  // Actions - Context
  refreshContext: (storyId?: string, limit?: number) => Promise<void>;

  // Actions - Memory management
  addMemory: (content: string, category?: string) => Promise<void>;
  deleteMemory: (memoryId: string) => Promise<void>;
  importLorebook: (storyId?: string) => Promise<number>;
  extractFromText: (text: string, model?: string) => Promise<ExtractFromTextResponse>;

  // Actions - Reset
  reset: () => void;
};

const initialState = {
  isConnected: false,
  currentStoryId: null,
  isPanelOpen: false,
  query: '',
  results: [],
  context: [],
  loading: false,
  importing: false,
  lastImported: null,
  error: undefined,
};

export const useMemoryStore = create<MemoryState>((set, get) => ({
  ...initialState,

  // Check sidecar health
  checkHealth: async () => {
    try {
      const status = await checkHealthApi();
      const connected = status === 'ok';
      set({ isConnected: connected, error: undefined });
      return connected;
    } catch (err) {
      console.error('[memory] health check failed', err);
      set({ isConnected: false, error: 'Sidecar not connected' });
      return false;
    }
  },

  // Set current story (isolates memories per story)
  setCurrentStory: (storyId: string | null) => {
    const prev = get().currentStoryId;
    if (prev !== storyId) {
      // Reset context and results when switching stories
      set({
        currentStoryId: storyId,
        context: [],
        results: [],
        error: undefined,
      });
      // Auto-refresh context for new story
      if (storyId) {
        get().refreshContext(storyId);
      }
    }
  },

  // Panel visibility
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),

  // Search
  setQuery: (value: string) => set({ query: value }),

  search: async (storyId?: string, limit = 10) => {
    const { query, currentStoryId } = get();
    const targetStoryId = storyId ?? currentStoryId;

    if (!targetStoryId) {
      set({ error: 'No story selected' });
      return;
    }

    if (!query.trim()) {
      set({ results: [] });
      return;
    }

    set({ loading: true, error: undefined });
    try {
      const response = await searchMemoriesApi({ storyId: targetStoryId, query, limit });
      set({ results: response.results, loading: false });
    } catch (err) {
      console.error('[memory] search failed', err);
      set({ error: 'Search failed', loading: false });
    }
  },

  // Context
  refreshContext: async (storyId?: string, limit = 5) => {
    const targetStoryId = storyId ?? get().currentStoryId;

    if (!targetStoryId) {
      return;
    }

    set({ loading: true, error: undefined });
    try {
      const response = await getContextApi({ storyId: targetStoryId, limit });
      set({ context: response.memories, loading: false });
    } catch (err) {
      console.error('[memory] context load failed', err);
      set({ error: 'Failed to fetch context', loading: false });
    }
  },

  // Add memory - always uses currentStoryId from store to enforce story isolation
  addMemory: async (content: string, category?: string) => {
    const { currentStoryId } = get();

    if (!currentStoryId) {
      set({ error: 'No story selected' });
      return;
    }

    if (!content.trim()) return;

    set({ loading: true, error: undefined });
    try {
      await addMemoryApi({ storyId: currentStoryId, content, category });
      // Refresh context after adding
      await get().refreshContext(currentStoryId);
      set({ loading: false });
    } catch (err) {
      console.error('[memory] add failed', err);
      set({ error: 'Could not add memory', loading: false });
    }
  },

  // Import lorebook entries
  importLorebook: async (storyId?: string) => {
    const targetStoryId = storyId ?? get().currentStoryId;

    if (!targetStoryId) {
      set({ error: 'No story selected' });
      return 0;
    }

    set({ importing: true, error: undefined, lastImported: null });
    try {
      const entries = await db.lorebookEntries.where('storyId').equals(targetStoryId).toArray();
      const memoryItems = entries.map(entry => ({
        content: `${entry.name}: ${entry.description}`,
        category: entry.category,
      }));

      await addMemoriesApi({
        storyId: targetStoryId,
        items: memoryItems,
      });

      await get().refreshContext(targetStoryId);
      set({ importing: false, lastImported: entries.length });
      return entries.length;
    } catch (err) {
      console.error('[memory] lorebook import failed', err);
      set({ error: 'Lorebook import failed', importing: false, lastImported: null });
      return 0;
    }
  },

  extractFromText: async (text: string, model?: string) => {
    const { currentStoryId } = get();
    if (!currentStoryId) {
      set({ error: 'No story selected' });
      return { extracted_count: 0, memories: [] };
    }
    set({ loading: true, error: undefined });
    try {
      const resp = await extractFromTextApi({ storyId: currentStoryId, text, model });
      await get().refreshContext(currentStoryId);
      set({ loading: false });
      return resp;
    } catch (err) {
      console.error('[memory] extraction failed', err);
      set({ error: 'Extraction failed', loading: false });
      return { extracted_count: 0, memories: [] };
    }
  },

  deleteMemory: async (memoryId: string) => {
    const { currentStoryId } = get();
    if (!currentStoryId) return;

    try {
      await deleteMemoryApi(currentStoryId, memoryId);
      // Remove from local state to avoid full refresh
      set(state => ({
        context: state.context.filter(m => m.memory_id !== memoryId),
        results: state.results.filter(m => m.memory_id !== memoryId),
      }));
    } catch (err) {
      console.error('[memory] delete failed', err);
      set({ error: 'Could not delete memory' });
    }
  },

  // Reset store to initial state
  reset: () => set(initialState),
}));
