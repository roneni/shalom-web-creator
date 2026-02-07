import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, LogOut, Loader2, Search, TrendingUp, Cpu, Heart } from "lucide-react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingLikes, setIsFetchingLikes] = useState(false);

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

  const handleProcessOnly = async () => {
    setIsProcessing(true);
    try {
      toast({ title: "🤖 מעבד הצעות ממתינות עם AI..." });
      const result = await adminApi.processOnly(password);
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });

      if (result.processed > 0) {
        toast({ title: `✅ עובדו ${result.processed} הצעות — מוכנות לאישור` });
      } else {
        toast({ title: "אין הצעות חדשות לעיבוד" });
      }
    } catch (err) {
      toast({
        title: "שגיאת עיבוד",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchTwitterLikes = async () => {
    setIsFetchingLikes(true);
    try {
      toast({ title: "❤️ שולף לייקים וסימניות מטוויטר..." });
      const result = await adminApi.fetchTwitterLikes(password);
      
      if (result.fetched > 0) {
        toast({ title: `✅ נשלפו ${result.fetched} ציוצים מלייקים וסימניות` });
        // Auto-process
        toast({ title: "🤖 מעבד עם AI..." });
        const processResult = await adminApi.processOnly(password);
        queryClient.invalidateQueries({ queryKey: ["suggestions"] });
        if (processResult.processed > 0) {
          toast({ title: `✅ עובדו ${processResult.processed} הצעות — מוכנות לאישור` });
        }
      } else {
        toast({ title: "אין ציוצים חדשים בלייקים/סימניות" });
      }

      if (result.errors?.length) {
        console.warn("Twitter likes errors:", result.errors);
        toast({
          title: "⚠️ שגיאות חלקיות",
          description: result.errors.join(" | ").substring(0, 200),
          variant: "destructive",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (err) {
      toast({
        title: "שגיאת שליפת לייקים",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsFetchingLikes(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">דשבורד ניהולי</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleFetchTwitterLikes}
              disabled={isFetchingLikes || isFetching || isSearching || isTrending || isProcessing}
              size="sm"
              variant="outline"
              className="border-pink-500/50 text-pink-600 hover:bg-pink-50"
            >
              {isFetchingLikes ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Heart className="h-4 w-4 ml-2" />
              )}
              לייקים
            </Button>
            <Button
              onClick={handleTrendingSearch}
              disabled={isTrending || isSearching || isFetching || isProcessing || isFetchingLikes}
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
              disabled={isSearching || isFetching || isTrending || isProcessing || isFetchingLikes}
              size="sm"
              variant="outline"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Search className="h-4 w-4 ml-2" />
              )}
              חפש חדשות
            </Button>
            <Button
              onClick={handleProcessOnly}
              disabled={isProcessing || isFetching || isSearching || isTrending || isFetchingLikes}
              size="sm"
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Cpu className="h-4 w-4 ml-2" />
              )}
              עבד הצעות
            </Button>
            <Button
              onClick={handleFetchAndProcess}
              disabled={isFetching || isSearching || isTrending || isProcessing || isFetchingLikes}
              size="sm"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              שלוף ועבד
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
