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
    checkHealth,
    setCurrentStory,
  } = useMemoryStore();
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [showStats, setShowStats] = useState(false);

  // Check health and set current story on mount
  useEffect(() => {
    checkHealth();
    setCurrentStory(storyId);
  }, [checkHealth, setCurrentStory, storyId]);

  useEffect(() => {
    refreshContext(storyId);
  }, [refreshContext, storyId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await search(storyId);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMemory(draft, category || undefined, storyId);
    setDraft("");
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
                    <li key={item.memory_id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.category || "note"}
                        </Badge>
                        <span className="text-left">{item.content}</span>
                      </div>
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
                    <li key={item.memory_id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.category || "note"}
                        </Badge>
                        <span className="text-left">{item.content}</span>
                      </div>
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

          {showStats && (
            <div className="text-xs text-muted-foreground space-y-2 border rounded p-2">
              <div>Recent items: {context.length}</div>
              <div>Last search matches: {results.length}</div>
              <div>Last imported entries: {lastImported ?? 0}</div>
              <MemoryCategoryCloud entries={[...context, ...results]} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">⚠ {error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
