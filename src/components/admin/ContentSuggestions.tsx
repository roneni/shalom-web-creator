import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Check, X, Pencil, ExternalLink, Loader2, CheckSquare, AlertCircle } from "lucide-react";
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

/** Build a meaningful display title from suggestion data */
function getDisplayTitle(suggestion: any): string {
  // Best case: AI-generated title (skip auto-reject markers)
  if (suggestion.suggested_title && !suggestion.suggested_title.startsWith("[נדחה")) {
    return suggestion.suggested_title;
  }

  // For tweets: always prefer tweet text over handle-only title
  if (suggestion.original_content) {
    const isTweet = suggestion.source_url?.includes("x.com/") || suggestion.source_url?.includes("twitter.com/");
    if (isTweet) {
      const text = suggestion.original_content
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 5) {
        return text.length > 100 ? text.substring(0, 100) + "…" : text;
      }
    }
  }

  // For websites with content: extract first meaningful line
  if (suggestion.original_content && suggestion.original_title) {
    const title = suggestion.original_title;
    // If it looks like a generic site name or just a handle pattern (@name — date)
    const isGeneric = title.length < 40 && (
      /^@\w+\s*[—–-]/.test(title) ||
      (!title.includes(" ") || title.split(" ").length <= 3)
    );
    if (isGeneric) {
      const lines = suggestion.original_content.split("\n").filter((l: string) => l.trim().length > 10);
      const headline = lines.find((l: string) => l.startsWith("#"));
      if (headline) return headline.replace(/^#+\s*/, "").substring(0, 100);
      // Fallback: first meaningful line of content
      if (lines.length > 0) {
        const first = lines[0].trim();
        return first.length > 100 ? first.substring(0, 100) + "…" : first;
      }
    }
    return title;
  }

  return suggestion.original_title || "ללא כותרת";
}

/** Extract a readable source label from joined data or URL */
function getSourceLabel(suggestion: any): string {
  // Use joined source name if available
  if (suggestion.sources?.name) return suggestion.sources.name;
  
  // Twitter likes
  if (suggestion.original_title?.startsWith("❤️")) return "X (לייק)";
  
  // Derive from source_url
  const url = suggestion.source_url;
  if (!url) return "מקור לא ידוע";
  
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Map common domains to readable names
    const domainMap: Record<string, string> = {
      "openai.com": "OpenAI",
      "anthropic.com": "Anthropic",
      "deepmind.google": "DeepMind",
      "ai.meta.com": "Meta AI",
      "mistral.ai": "Mistral AI",
      "huggingface.co": "Hugging Face",
      "cohere.com": "Cohere",
      "runwayml.com": "Runway",
      "stability.ai": "Stability AI",
      "x.ai": "xAI",
      "ai.com": "ai.com",
      "perplexity.ai": "Perplexity",
      "groq.com": "Groq",
      "scale.ai": "Scale AI",
      "blogs.microsoft.com": "Microsoft",
      "techcrunch.com": "TechCrunch",
      "theverge.com": "The Verge",
      "arstechnica.com": "Ars Technica",
      "theguardian.com": "The Guardian",
      "x.com": "X",
      "twitter.com": "X",
      "newatlas.com": "New Atlas",
      "scmagazine.com": "SC Magazine",
      "capacityglobal.com": "Capacity",
      "red.anthropic.com": "Anthropic",
    };
    
    for (const [domain, label] of Object.entries(domainMap)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return label;
    }
    
    // Fallback: clean domain name
    return hostname.split(".").slice(-2, -1)[0] || hostname;
  } catch {
    return "מקור לא ידוע";
  }
}


const ContentSuggestions = ({ password }: ContentSuggestionsProps) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        password,
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

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    let approved = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await adminApi.managePosts(password, "approve", id);
        approved++;
      } catch {
        failed++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    setSelectedIds(new Set());
    setIsBulkProcessing(false);
    toast({
      title: `אושרו ${approved} פוסטים`,
      description: failed > 0 ? `${failed} נכשלו (ייתכן שטרם עובדו)` : undefined,
    });
  };

  const bulkReject = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    let rejected = 0;
    for (const id of selectedIds) {
      try {
        await adminApi.managePosts(password, "reject", id);
        rejected++;
      } catch {
        // skip
      }
    }
    queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    setSelectedIds(new Set());
    setIsBulkProcessing(false);
    toast({ title: `נדחו ${rejected} הצעות` });
  };

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

  const pendingSuggestions = useMemo(
    () => (suggestions || []).filter((s: any) => s.status === "pending"),
    [suggestions]
  );

  const processedPendingIds = useMemo(
    () =>
      new Set<string>(
        pendingSuggestions
          .filter((s: any) => !!s.suggested_title && !!s.suggested_content)
          .map((s: any) => s.id as string)
      ),
    [pendingSuggestions]
  );

  const allProcessedSelected =
    processedPendingIds.size > 0 &&
    [...processedPendingIds].every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allProcessedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedPendingIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      {/* Bulk actions bar */}
      {statusFilter === "pending" && pendingSuggestions.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
          <Checkbox
            checked={allProcessedSelected}
            onCheckedChange={toggleSelectAll}
            id="select-all"
          />
          <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
            בחר הכל ({processedPendingIds.size} מעובדים)
          </label>

          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground mr-auto">
                {selectedIds.size} נבחרו
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30"
                onClick={bulkReject}
                disabled={isBulkProcessing}
              >
                <X className="h-3.5 w-3.5 ml-1" />
                דחה נבחרים
              </Button>
              <Button
                size="sm"
                onClick={bulkApprove}
                disabled={isBulkProcessing}
              >
                {isBulkProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                ) : (
                  <CheckSquare className="h-3.5 w-3.5 ml-1" />
                )}
                אשר נבחרים
              </Button>
            </>
          )}
        </div>
      )}

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
          {suggestions.map((suggestion: any) => {
            const isProcessed = !!suggestion.suggested_title && !!suggestion.suggested_content;
            const displayTitle = getDisplayTitle(suggestion);
            const isSelected = selectedIds.has(suggestion.id);
            const isPending = suggestion.status === "pending";
            const isUnprocessed = isPending && !isProcessed;

            return (
              <Card key={suggestion.id} className={`overflow-hidden transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : ""} ${isUnprocessed ? "opacity-70 border-dashed" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {isPending && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(suggestion.id)}
                        disabled={!isProcessed}
                        className="mt-1 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight mb-2">
                        {displayTitle}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {isUnprocessed && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 bg-amber-50">
                            <AlertCircle className="h-3 w-3 ml-1" />
                            ממתין לעיבוד AI
                          </Badge>
                        )}
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
                        {!isUnprocessed && (
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
                        )}
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
                      {getSourceLabel(suggestion)} •{" "}
                      {new Date(suggestion.fetched_at).toLocaleDateString("he-IL")}
                    </span>

                    {isPending && isProcessed && (
                      <div className="flex gap-2 items-center">
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

                    {isPending && isUnprocessed && (
                      <div className="flex gap-2 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => rejectMutation.mutate(suggestion.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-amber-600">
                          לחץ ״עבד הצעות״ בכותרת
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
