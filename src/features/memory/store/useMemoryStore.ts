import { create } from 'zustand';
import {
  addMemory as addMemoryApi,
  getContext as getContextApi,
  MemoryResult,
  searchMemories as searchMemoriesApi,
} from '@/services/memory/memoryService';
import { db } from '@/services/database';

type MemoryState = {
  query: string;
  context: MemoryResult[];
  results: MemoryResult[];
  loading: boolean;
  importing: boolean;
  lastImported: number | null;
  error?: string;
  setQuery: (value: string) => void;
  refreshContext: (storyId: string, limit?: number) => Promise<void>;
  search: (storyId: string, limit?: number) => Promise<void>;
  addMemory: (storyId: string, content: string, category?: string) => Promise<void>;
  importLorebook: (storyId: string) => Promise<number>;
};

export const useMemoryStore = create<MemoryState>((set, get) => ({
  query: '',
  context: [],
  results: [],
  loading: false,
  importing: false,
  lastImported: null,
  error: undefined,
  setQuery: (value: string) => set({ query: value }),
  refreshContext: async (storyId: string, limit = 5) => {
    set({ loading: true, error: undefined });
    try {
      const response = await getContextApi({ storyId, limit });
      set({ context: response.memories, loading: false });
    } catch (err) {
      console.error('[memory] context load failed', err);
      set({ error: 'Failed to fetch context', loading: false });
    }
  },
  search: async (storyId: string, limit = 10) => {
    const { query } = get();
    if (!query.trim()) {
      set({ results: [] });
      return;
    }
    set({ loading: true, error: undefined });
    try {
      const response = await searchMemoriesApi({ storyId, query, limit });
      set({ results: response.results, loading: false });
    } catch (err) {
      console.error('[memory] search failed', err);
      set({ error: 'Search failed', loading: false });
    }
  },
  addMemory: async (storyId: string, content: string, category?: string) => {
    if (!content.trim()) return;
    set({ loading: true, error: undefined });
    try {
      await addMemoryApi({ storyId, content, category });
      // Refresh context after adding
      await get().refreshContext(storyId);
      set({ loading: false });
    } catch (err) {
      console.error('[memory] add failed', err);
      set({ error: 'Could not add memory', loading: false });
    }
  },
  importLorebook: async (storyId: string) => {
    set({ importing: true, error: undefined, lastImported: null });
    try {
      const entries = await db.lorebookEntries.where('storyId').equals(storyId).toArray();
      for (const entry of entries) {
        await addMemoryApi({
          storyId,
          content: `${entry.name}: ${entry.description}`,
          category: entry.category,
        });
      }
      await get().refreshContext(storyId);
      set({ importing: false, lastImported: entries.length });
      return entries.length;
    } catch (err) {
      console.error('[memory] lorebook import failed', err);
      set({ error: 'Lorebook import failed', importing: false, lastImported: null });
      return 0;
    }
  },
}));
