import { create } from 'zustand';
import {
  addMemory as addMemoryApi,
  getContext as getContextApi,
  health as checkHealthApi,
  MemoryResult,
  searchMemories as searchMemoriesApi,
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
  addMemory: (content: string, category?: string, storyId?: string) => Promise<void>;
  importLorebook: (storyId?: string) => Promise<number>;

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

  // Add memory
  addMemory: async (content: string, category?: string, storyId?: string) => {
    const targetStoryId = storyId ?? get().currentStoryId;

    if (!targetStoryId) {
      set({ error: 'No story selected' });
      return;
    }

    if (!content.trim()) return;

    set({ loading: true, error: undefined });
    try {
      await addMemoryApi({ storyId: targetStoryId, content, category });
      // Refresh context after adding
      await get().refreshContext(targetStoryId);
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
      for (const entry of entries) {
        await addMemoryApi({
          storyId: targetStoryId,
          content: `${entry.name}: ${entry.description}`,
          category: entry.category,
        });
      }
      await get().refreshContext(targetStoryId);
      set({ importing: false, lastImported: entries.length });
      return entries.length;
    } catch (err) {
      console.error('[memory] lorebook import failed', err);
      set({ error: 'Lorebook import failed', importing: false, lastImported: null });
      return 0;
    }
  },

  // Reset store to initial state
  reset: () => set(initialState),
}));
