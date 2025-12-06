import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

type Props = {
  backend: string | undefined;
  llmProvider: string | undefined;
  llmModel: string | undefined;
  onPersist?: (cfg: { backend: string; stubEmbeddings: boolean }) => Promise<void> | void;
};

export function SidecarSettings({ backend, llmProvider, llmModel, onPersist }: Props) {
  const [selectedBackend, setSelectedBackend] = useState("sqlite");
  const [stubEmbeddings, setStubEmbeddings] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (backend) {
      setSelectedBackend(backend);
    }
  }, [backend]);

  const handleApply = async () => {
    if (!onPersist) return;
    try {
      setLoading(true);
      await onPersist({ backend: selectedBackend, stubEmbeddings });
      toast.success("Sidecar settings updated. Restart sidecar to apply.");
    } catch (err) {
      toast.error("Failed to update sidecar settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Sidecar Settings</CardTitle>
        <div className="text-xs text-muted-foreground">
          Backend: {backend || "?"} | LLM: {llmProvider || "?"} ({llmModel || "?"})
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase">Backend</div>
            <Select value={selectedBackend} onValueChange={setSelectedBackend}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite (keyword)</SelectItem>
                <SelectItem value="memori">Memori (semantic)</SelectItem>
                <SelectItem value="stub">Stub</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stubEmbeddings}
              onChange={(e) => setStubEmbeddings(e.target.checked)}
            />
            Stub embeddings (disable semantic)
          </label>
          <Button size="sm" onClick={handleApply} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Switch to Memori + disable stub embeddings for semantic search/extraction. A sidecar restart is required.
        </p>
      </CardContent>
    </Card>
  );
}
