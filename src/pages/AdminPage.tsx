import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";
import AdminLogin from "@/components/admin/AdminLogin";
import ContentSuggestions from "@/components/admin/ContentSuggestions";
import SourcesManager from "@/components/admin/SourcesManager";
import DiscoveryPanel from "@/components/admin/DiscoveryPanel";
import AdminActions from "@/components/admin/AdminActions";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const AdminPage = () => {
  const { isLoggedIn, isAdmin, loading, session, logout } = useAdmin();
  const [adminKey, setAdminKey] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    const handleClaimAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminKey.trim()) return;
      setIsClaiming(true);
      try {
        const response = await fetch(`${FUNCTIONS_URL}/admin-register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ setupKey: adminKey }),
        });
        if (!response.ok) {
          const err = await response.json();
          toast({ title: "שגיאה", description: err.error || "מפתח שגוי", variant: "destructive" });
        } else {
          toast({ title: "הצלחה", description: "הרשאות אדמין הוענקו בהצלחה" });
          window.location.reload();
        }
      } catch {
        toast({ title: "שגיאה", description: "Failed to claim admin role", variant: "destructive" });
      }
      setIsClaiming(false);
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" dir="rtl">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-primary" />
            <CardTitle className="text-xl">אימות הרשאות אדמין</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              הזן את מפתח ההגדרה כדי לקבל הרשאות ניהול
            </p>
            <form onSubmit={handleClaimAdmin} className="space-y-4">
              <Input
                type="password"
                placeholder="מפתח הגדרת אדמין"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="text-center"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={isClaiming}>
                {isClaiming && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                אמת הרשאות
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={logout}>
              <LogOut className="h-4 w-4 ml-2" />
              התנתק
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Super-Mentor Dashboard</h1>
          <AdminActions onLogout={logout} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="suggestions">
          <TabsList className="mb-6">
            <TabsTrigger value="suggestions">הצעות תוכן</TabsTrigger>
            <TabsTrigger value="discovery">Discovery Engine</TabsTrigger>
            <TabsTrigger value="sources">מקורות</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions">
            <ContentSuggestions />
          </TabsContent>

          <TabsContent value="discovery">
            <DiscoveryPanel />
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
