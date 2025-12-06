import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMemoryStore } from "../store/useMemoryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LorebookImportSummary } from "./LorebookImportSummary";
import { MemoryCategoryCloud } from "./MemoryCategoryCloud";
import { ContextViewer } from "./ContextViewer";
import { useAIStore } from "@/features/ai/stores/useAIStore";

type Props = {
  storyId: string;
};

export function MemoryPanel({ storyId }: Props) {
  const {
    query,
    results,
    context,
    loading,
    importing,
    lastImported,
    error,
    isConnected,
    setQuery,
    search,
    refreshContext,
    addMemory,
    importLorebook,
    deleteMemory,
    checkHealth,
    setCurrentStory,
    extractFromText,
  } = useMemoryStore();
  const { lastInjectedContext, lastExtractedEntities, settings, isInitialized, initialize: initializeAI } = useAIStore();
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [extractionText, setExtractionText] = useState("");
  const [showStats, setShowStats] = useState(false);

  // Check health and set current story on mount
  useEffect(() => {
    checkHealth();
    setCurrentStory(storyId);
  }, [checkHealth, setCurrentStory, storyId]);

  useEffect(() => {
    if (!isInitialized) {
      initializeAI();
    }
  }, [isInitialized, initializeAI]);

  useEffect(() => {
    refreshContext(storyId);
  }, [refreshContext, storyId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await search(storyId);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMemory(draft, category || undefined);
    setDraft("");
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractionText.trim()) return;

    // Optimistic UI update or loading state is handled by store 'loading'
    try {
      console.log("Requesting extraction for:", extractionText);

      // Use the selected default model from settings, or let backend use its default
      const modelId = settings?.defaultModel?.id;
      const result = await extractFromText(extractionText, modelId);
      console.log("Extraction API result:", result);

      if (result.extracted_count > 0) {
        setExtractionText("");

        // Update AI store so ContextViewer shows the new entities
        const formattedEntities = result.memories.map(m => `${m.category}: ${m.content}`);
        useAIStore.setState({ lastExtractedEntities: formattedEntities });
      } else {
        console.warn("Extraction returned 0 entities.");
        // Optional: show error state in UI or just keep text
      }
    } catch (e) {
      console.error("Extraction error:", e);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Story Memory</CardTitle>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                title={isConnected ? 'Sidecar connected' : 'Sidecar disconnected'}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Recent context and search across story memories
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats((prev) => !prev)}
            >
              {showStats ? "Hide stats" : "Show stats"}
            </Button>
          </div>

          <form className="space-y-2" onSubmit={handleSearch}>
            <label className="text-sm text-muted-foreground">Search memories</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. dragon, castle, protagonist"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={loading}>
                Search
              </Button>
            </div>
          </form>

          <ContextViewer
            injectedContext={lastInjectedContext}
            extractedEntities={lastExtractedEntities}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Recent context</span>
                <Badge variant="secondary">{context.length}</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshContext(storyId)}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
            <ScrollArea className="h-32 rounded border p-2">
              {context.length === 0 ? (
                <p className="text-sm text-muted-foreground">No memories yet.</p>
              ) : (
                <ul className="space-y-2">
                  {context.map((item) => (
                    <li key={item.memory_id} className="text-sm flex items-start justify-between gap-2 group">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.category || "note"}
                        </Badge>
                        <span className="text-left">{item.content}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteMemory(item.memory_id)}
                        title="Delete memory"
                      >
                        <span className="text-xs">×</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Search results</p>
              <Badge variant="secondary">{results.length}</Badge>
            </div>
            <ScrollArea className="h-36 rounded border p-2">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">Run a search to see matches.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((item) => (
                    <li key={item.memory_id} className="text-sm flex items-start justify-between gap-2 group">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.category || "note"}
                        </Badge>
                        <span className="text-left">{item.content}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteMemory(item.memory_id)}
                        title="Delete memory"
                      >
                        <span className="text-xs">×</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <form className="space-y-2" onSubmit={handleAddMemory}>
            <div className="flex gap-2">
              <Input
                placeholder="Category (optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Button type="submit" disabled={loading || !draft.trim()}>
                Add
              </Button>
            </div>
            <Textarea
              placeholder="Add a new fact, character detail, or plot point"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
          </form>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => importLorebook(storyId)}
            >
              {importing ? "Importing..." : "Import lorebook entries"}
            </Button>
            {lastImported !== null && <LorebookImportSummary count={lastImported} />}
          </div>

          <div className="space-y-2 border rounded p-2">
            <p className="text-sm font-medium">Extract Entities from Text</p>
            <form className="space-y-2" onSubmit={handleExtract}>
              <Textarea
                itemID="extraction-input"
                placeholder="Paste text here to automatically extract characters, locations, etc."
                value={extractionText}
                onChange={(e) => setExtractionText(e.target.value)}
                rows={3}
              />
              <Button type="submit" disabled={loading || !extractionText.trim()}>
                Extract Entities
              </Button>
            </form>
          </div>

          {showStats && (
            <div className="text-xs text-muted-foreground space-y-2 border rounded p-2">
              <div>Recent items: {context.length}</div>
              <div>Last search matches: {results.length}</div>
              <div>Last imported entries: {lastImported ?? 0}</div>
              <MemoryCategoryCloud entries={[...context, ...results]} />
            </div>
          )}

          {/* Entity Display Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Entities</span>
              <Badge variant="secondary">
                {(() => {
                  const allMemories = [...context, ...results];
                  const categories = new Set(allMemories.map(m => m.category).filter(Boolean));
                  return categories.size;
                })()}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {(() => {
                const allMemories = [...context, ...results];
                const entityCategories = ['character', 'location', 'item', 'faction', 'event'];
                const entities: { category: string; name: string }[] = [];

                allMemories.forEach(memory => {
                  const category = memory.category?.toLowerCase() || 'note';
                  if (entityCategories.includes(category)) {
                    // Extract entity name from content (first few words or before colon)
                    const colonIndex = memory.content.indexOf(':');
                    const name = colonIndex > 0
                      ? memory.content.substring(0, colonIndex).trim()
                      : memory.content.split(' ').slice(0, 3).join(' ');
                    if (!entities.find(e => e.name === name && e.category === category)) {
                      entities.push({ category, name });
                    }
                  }
                });

                if (entities.length === 0) {
                  return (
                    <span className="text-xs text-muted-foreground">
                      No entities yet. Add memories with categories like "character", "location", "item".
                    </span>
                  );
                }

                const categoryColors: Record<string, string> = {
                  character: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
                  location: 'bg-green-500/20 text-green-700 dark:text-green-300',
                  item: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                  faction: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
                  event: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
                };

                return entities.slice(0, 12).map((entity, idx) => (
                  <Badge
                    key={`${entity.category}-${entity.name}-${idx}`}
                    variant="outline"
                    className={`text-xs ${categoryColors[entity.category] || ''}`}
                  >
                    <span className="capitalize mr-1 opacity-60">{entity.category[0]}:</span>
                    {entity.name.length > 20 ? entity.name.substring(0, 20) + '...' : entity.name}
                  </Badge>
                ));
              })()}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">⚠ {error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
