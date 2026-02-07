import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, ExternalLink, Rss } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { toast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  twitter: "X/Twitter",
  website: "אתר",
  google_alerts_rss: "Google Alerts RSS",
};

const SourcesManager = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "", type: "website" });

  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: () => adminApi.getSources(),
  });

  const toggleMutation = useMutation({
    mutationFn: (sourceId: string) => adminApi.manageSources("toggle", sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => adminApi.manageSources("delete", sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast({ title: "המקור נמחק" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: (source: { name: string; url: string; type: string }) =>
      adminApi.manageSources("add", undefined, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setNewSource({ name: "", url: "", type: "website" });
      setShowAddForm(false);
      toast({ title: "מקור חדש נוסף" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedSources = {
    twitter: sources?.filter((s: any) => s.type === "twitter") || [],
    website: sources?.filter((s: any) => s.type === "website") || [],
    google_alerts_rss: sources?.filter((s: any) => s.type === "google_alerts_rss") || [],
  };

  return (
    <div className="space-y-6">
      {/* Add source button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף מקור
        </Button>
      </div>

      {/* Add source form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="שם המקור"
                value={newSource.name}
                onChange={(e) => setNewSource((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="URL"
                value={newSource.url}
                onChange={(e) => setNewSource((p) => ({ ...p, url: e.target.value }))}
              />
              <Select value={newSource.type} onValueChange={(v) => setNewSource((p) => ({ ...p, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">X/Twitter</SelectItem>
                  <SelectItem value="website">אתר</SelectItem>
                  <SelectItem value="google_alerts_rss">Google Alerts RSS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                ביטול
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate(newSource)}
                disabled={!newSource.name || !newSource.url || addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                הוסף
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source groups */}
      {Object.entries(groupedSources).map(([type, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              {type === "google_alerts_rss" && <Rss className="h-4 w-4" />}
              {TYPE_LABELS[type] || type} ({items.length})
            </h3>
            <div className="space-y-2">
              {items.map((source: any) => (
                <Card key={source.id} className={!source.active ? "opacity-60" : ""}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Switch
                        checked={source.active}
                        onCheckedChange={() => toggleMutation.mutate(source.id)}
                        disabled={toggleMutation.isPending}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium block truncate">{source.name}</span>
                        <span className="text-xs text-muted-foreground block truncate">{source.url}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={source.active ? "default" : "outline"} className="text-[10px]">
                        {source.active ? "פעיל" : "מושבת"}
                      </Badge>
                      {source.url && (
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("למחוק את המקור?")) {
                            deleteMutation.mutate(source.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SourcesManager;
