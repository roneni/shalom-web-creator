import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, LogOut, Loader2, Search, TrendingUp } from "lucide-react";
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
  const [isSearching, setIsSearching] = useState(false);
  const [isTrending, setIsTrending] = useState(false);

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

  const handleSearchContent = async () => {
    setIsSearching(true);
    try {
      toast({ title: "🔍 מחפש חדשות AI באינטרנט..." });
      const searchResult = await adminApi.searchContent(password);
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });

      if (searchResult.fetched > 0) {
        const approved = searchResult.approved || 0;
        const rejected = searchResult.fetched - approved;
        toast({
          title: `✅ נסרקו ${searchResult.fetched} פריטים`,
          description: approved > 0
            ? `${approved} הצעות חדשות מחכות לסקירה${rejected > 0 ? ` • ${rejected} נדחו ע״י AI` : ""}`
            : `כל ${searchResult.fetched} הפריטים נדחו ע״י AI`,
        });
      } else {
        toast({ title: "לא נמצא תוכן חדש בחיפוש" });
      }
    } catch (err) {
      toast({
        title: "שגיאת חיפוש",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleTrendingSearch = async () => {
    setIsTrending(true);
    try {
      toast({ title: "🔥 מחפש תוכן ויראלי וטרנדי..." });
      const result = await adminApi.trendingSearch(password);
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });

      if (result.fetched > 0) {
        const approved = result.approved || 0;
        toast({
          title: `🔥 נמצאו ${result.fetched} פריטים טרנדיים`,
          description: `${result.primary || 0} ממקורות ראשיים • ${approved} מחכות לסקירה`,
        });
      } else {
        toast({ title: "לא נמצא תוכן טרנדי חדש" });
      }
    } catch (err) {
      toast({
        title: "שגיאת חיפוש טרנדים",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTrending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">דשבורד ניהולי</h1>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTrendingSearch}
              disabled={isTrending || isSearching || isFetching}
              size="sm"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {isTrending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <TrendingUp className="h-4 w-4 ml-2" />
              )}
              טרנדים
            </Button>
            <Button
              onClick={handleSearchContent}
              disabled={isSearching || isFetching || isTrending}
              size="sm"
              variant="outline"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Search className="h-4 w-4 ml-2" />
              )}
              חפש חדשות AI
            </Button>
            <Button
              onClick={handleFetchAndProcess}
              disabled={isFetching || isSearching || isTrending}
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
            <SourcesManager password={password} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
