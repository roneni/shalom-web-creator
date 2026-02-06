import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, LogOut, Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { adminApi } from "@/lib/adminApi";
import { toast } from "@/hooks/use-toast";
import AdminLogin from "@/components/admin/AdminLogin";
import ContentSuggestions from "@/components/admin/ContentSuggestions";
import SourcesManager from "@/components/admin/SourcesManager";

const AdminPage = () => {
  const { isLoggedIn, password, login, logout } = useAdmin();
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);

  if (!isLoggedIn) {
    return <AdminLogin onLogin={login} />;
  }

  const handleFetchAndProcess = async () => {
    setIsFetching(true);
    try {
      toast({ title: "🔄 שולף תוכן ממקורות..." });
      const fetchResult = await adminApi.fetchContent(password);
      toast({
        title: `נשלפו ${fetchResult.fetched} פריטים חדשים`,
        description: fetchResult.errors?.length
          ? `${fetchResult.errors.length} שגיאות`
          : undefined,
      });

      // Process ALL pending unprocessed suggestions (loop until done)
      let totalProcessed = 0;
      let hasMore = true;
      toast({ title: "🤖 מעבד תוכן עם AI..." });

      while (hasMore) {
        const processResult = await adminApi.processContent(password);
        totalProcessed += processResult.processed || 0;

        if (processResult.errors?.length) {
          console.warn("Process errors:", processResult.errors);
        }

        // If processed less than batch size (5), we're done
        hasMore = (processResult.processed || 0) >= 5;
      }

      // Refresh the suggestions list
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });

      if (totalProcessed > 0) {
        toast({ title: `✅ עובדו ${totalProcessed} הצעות — מוכנות לאישור` });
      } else if (fetchResult.fetched === 0) {
        toast({ title: "אין תוכן חדש לעיבוד" });
      }
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">דשבורד ניהולי</h1>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFetchAndProcess}
              disabled={isFetching}
              size="sm"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              שלוף תוכן חדש
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="suggestions">
          <TabsList className="mb-6">
            <TabsTrigger value="suggestions">הצעות תוכן</TabsTrigger>
            <TabsTrigger value="sources">מקורות</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions">
            <ContentSuggestions password={password} />
          </TabsContent>

          <TabsContent value="sources">
            <SourcesManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
