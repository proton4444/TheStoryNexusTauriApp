import { useEffect, useState } from "react";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MemoryResult,
  listMemories,
} from "@/services/memory/memoryService";
import { useStoryStore } from "@/features/stories/stores/useStoryStore";

const PAGE_SIZE = 50;

export default function MemoriesPage() {
  const { stories, fetchStories } = useStoryStore();

  const [memories, setMemories] = useState<MemoryResult[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingStoryId, setPendingStoryId] = useState<string>("all");
  const [pendingQuery, setPendingQuery] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<{ storyId: string; query: string }>({
    storyId: "all",
    query: "",
  });
  const [orphanStoryIds, setOrphanStoryIds] = useState<string[]>([]);

  // Ensure story list is loaded for the filter dropdown
  useEffect(() => {
    if (stories.length === 0) {
      fetchStories();
    }
  }, [stories.length, fetchStories]);

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const storyLabel = (id?: string) => {
    if (!id) return "Unknown";
    const story = stories.find((s) => s.id === id);
    return story?.title ?? `${id} (memory only)`;
  };

  const refresh = async (reset: boolean) => {
    setLoading(true);
    setError(null);
    const effectiveOffset = reset ? 0 : offset;

    try {
      const response = await listMemories({
        storyId: activeFilters.storyId === "all" ? undefined : activeFilters.storyId,
        query: activeFilters.query.trim() || undefined,
        limit: PAGE_SIZE,
        offset: effectiveOffset,
      });

      setMemories((prev) =>
        reset ? response.memories : [...prev, ...response.memories],
      );

      // Track story IDs that exist in memories but not in Dexie stories
      const knownIds = new Set(stories.map((s) => s.id));
      const orphanIds = response.memories
        .map((m) => m.story_id)
        .filter((sid): sid is string => !!sid && !knownIds.has(sid));
      setOrphanStoryIds((prev) => {
        const next = new Set([...prev, ...orphanIds]);
        return Array.from(next);
      });

      const nextOffset = effectiveOffset + response.memories.length;
      setOffset(nextOffset);
      const totalCount = response.total ?? (reset ? response.memories.length : nextOffset);
      setTotal(totalCount);
      setHasMore(response.memories.length === PAGE_SIZE && nextOffset < totalCount);
    } catch (err) {
      console.error("[memories] load failed", err);
      setError("Could not load memories from SQLite sidecar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const onApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setOffset(0);
    setHasMore(false);
    setActiveFilters({ storyId: pendingStoryId, query: pendingQuery });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Memories</h1>
            <Badge variant="outline">SQLite</Badge>
            <Badge variant="secondary">Total: {total}</Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            All memories captured by the Story Memory Panel, persisted to <code>memori.db</code>.
            Filter by story, search text, and inspect the raw records coming from the sidecar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onApplyFilters} className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Story</label>
              <Select value={pendingStoryId} onValueChange={setPendingStoryId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All stories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stories</SelectItem>
                  {stories.map((story) => (
                    <SelectItem key={story.id} value={story.id}>
                      {story.title}
                    </SelectItem>
                  ))}
                  {orphanStoryIds.map((id) => (
                    <SelectItem key={id} value={id}>
                      {id} (memory only)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[240px] space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Search</label>
              <Input
                placeholder="Search memory text..."
                value={pendingQuery}
                onChange={(e) => setPendingQuery(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="rounded-md border">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b">
              <span>
                Showing {memories.length} of {total} records
              </span>
              {loading && <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>}
            </div>
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Story</TableHead>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="w-[140px]">Session</TableHead>
                    <TableHead className="w-[170px]">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {loading ? "Loading memories..." : "No memories found for this filter."}
                      </TableCell>
                    </TableRow>
                  )}
                  {memories.map((memory) => (
                    <TableRow key={memory.memory_id}>
                      <TableCell className="text-sm font-medium">
                        {storyLabel(memory.story_id)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="capitalize">
                          {memory.category || "note"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm align-top">
                        <div className="max-w-[520px] whitespace-pre-wrap">
                          {memory.content}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {memory.session_id || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(memory.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" onClick={() => refresh(false)} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
