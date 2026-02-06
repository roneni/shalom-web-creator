import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Pencil, ExternalLink, Loader2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { toast } from "@/hooks/use-toast";

interface ContentSuggestionsProps {
  password: string;
}

const SECTION_LABELS: Record<string, string> = {
  weekly: "מה חדש השבוע",
  features: "פיצ'ר חדש",
  tools: "כלי אחד",
  viral: "ויראלי",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  approved: "מאושר",
  rejected: "נדחה",
};

const ContentSuggestions = ({ password }: ContentSuggestionsProps) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    section: "",
    tag: "",
  });

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggestions", statusFilter, sectionFilter],
    queryFn: () =>
      adminApi.getSuggestions(
        statusFilter || undefined,
        sectionFilter !== "all" ? sectionFilter : undefined
      ),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates?: Record<string, string> }) =>
      adminApi.managePosts(password, "approve", id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      toast({ title: "הפוסט אושר ופורסם" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.managePosts(password, "reject", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      toast({ title: "ההצעה נדחתה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, string> }) =>
      adminApi.managePosts(password, "update", id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      setEditingId(null);
      toast({ title: "ההצעה עודכנה" });
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (suggestion: any) => {
    setEditForm({
      title: suggestion.suggested_title || suggestion.original_title || "",
      excerpt: suggestion.suggested_excerpt || "",
      content: suggestion.suggested_content || "",
      section: suggestion.suggested_section || "weekly",
      tag: suggestion.suggested_tag || "",
    });
    setEditingId(suggestion.id);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">ממתין</SelectItem>
            <SelectItem value="approved">מאושר</SelectItem>
            <SelectItem value="rejected">נדחה</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="מדור" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המדורים</SelectItem>
            <SelectItem value="weekly">מה חדש השבוע</SelectItem>
            <SelectItem value="features">פיצ'ר חדש</SelectItem>
            <SelectItem value="tools">כלי אחד</SelectItem>
            <SelectItem value="viral">ויראלי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Suggestions List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין הצעות תוכן {statusFilter ? `בסטטוס "${STATUS_LABELS[statusFilter]}"` : ""}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion: any) => (
            <Card key={suggestion.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight mb-2">
                      {suggestion.suggested_title || suggestion.original_title || "ללא כותרת"}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.suggested_section && (
                        <Badge variant="secondary" className="text-xs">
                          {SECTION_LABELS[suggestion.suggested_section] || suggestion.suggested_section}
                        </Badge>
                      )}
                      {suggestion.suggested_tag && (
                        <Badge variant="outline" className="text-xs">
                          {suggestion.suggested_tag}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          suggestion.status === "approved"
                            ? "default"
                            : suggestion.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {STATUS_LABELS[suggestion.status]}
                      </Badge>
                    </div>
                  </div>
                  {suggestion.source_url && (
                    <a
                      href={suggestion.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {suggestion.suggested_excerpt && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {suggestion.suggested_excerpt}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(suggestion as any).sources?.name || "מקור לא ידוע"} •{" "}
                    {new Date(suggestion.fetched_at).toLocaleDateString("he-IL")}
                  </span>

                  {suggestion.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(suggestion)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => rejectMutation.mutate(suggestion.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: suggestion.id })}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        אשר
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת הצעה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">כותרת</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תקציר</label>
              <Textarea
                value={editForm.excerpt}
                onChange={(e) => setEditForm((f) => ({ ...f, excerpt: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תוכן</label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">מדור</label>
                <Select
                  value={editForm.section}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, section: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">מה חדש השבוע</SelectItem>
                    <SelectItem value="features">פיצ'ר חדש</SelectItem>
                    <SelectItem value="tools">כלי אחד</SelectItem>
                    <SelectItem value="viral">ויראלי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">תגית</label>
                <Input
                  value={editForm.tag}
                  onChange={(e) => setEditForm((f) => ({ ...f, tag: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingId(null)}>
                ביטול
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (editingId) {
                    updateMutation.mutate({ id: editingId, updates: editForm });
                  }
                }}
                disabled={updateMutation.isPending}
              >
                שמור שינויים
              </Button>
              <Button
                onClick={() => {
                  if (editingId) {
                    approveMutation.mutate({ id: editingId, updates: editForm });
                    setEditingId(null);
                  }
                }}
                disabled={approveMutation.isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                אשר ופרסם
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentSuggestions;
