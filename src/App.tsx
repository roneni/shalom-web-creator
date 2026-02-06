import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SectionPage from "./pages/SectionPage";
import PostPage from "./pages/PostPage";
import NewsletterPage from "./pages/NewsletterPage";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/weekly" element={<SectionPage sectionId="weekly" />} />
          <Route path="/features" element={<SectionPage sectionId="features" />} />
          <Route path="/tools" element={<SectionPage sectionId="tools" />} />
          <Route path="/viral" element={<SectionPage sectionId="viral" />} />
          <Route path="/post/:slug" element={<PostPage />} />
          <Route path="/newsletter" element={<NewsletterPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
