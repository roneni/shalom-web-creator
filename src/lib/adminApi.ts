import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const adminApi = {
  async fetchContent(password: string) {
    const response = await fetch(`${FUNCTIONS_URL}/fetch-content`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch content");
    }
    return response.json();
  },

  async searchContent(password: string) {
    const response = await fetch(`${FUNCTIONS_URL}/search-content`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to search content");
    }
    return response.json();
  },

  async trendingSearch(password: string) {
    const response = await fetch(`${FUNCTIONS_URL}/trending-search`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to search trending content");
    }
    return response.json();
  },

  async processContent(password: string) {
    const response = await fetch(`${FUNCTIONS_URL}/process-content`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to process content");
    }
    return response.json();
  },

  async managePosts(password: string, action: string, suggestionId: string, updates?: Record<string, string>) {
    const response = await fetch(`${FUNCTIONS_URL}/manage-posts`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action, suggestionId, updates }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to manage post");
    }
    return response.json();
  },

  async getSuggestions(status?: string, section?: string) {
    let query = supabase
      .from("content_suggestions")
      .select("*, sources(name, type)")
      .order("fetched_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (section) {
      query = query.eq("suggested_section", section);
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;
    return data;
  },

  async getSources() {
    const { data, error } = await supabase
      .from("sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async processOnly(password: string) {
    let totalProcessed = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await this.processContent(password);
      totalProcessed += result.processed || 0;
      hasMore = (result.processed || 0) >= 5;
    }
    return { processed: totalProcessed };
  },

  async manageSources(password: string, action: string, sourceId?: string, source?: { name: string; url: string; type: string; active?: boolean }) {
    const response = await fetch(`${FUNCTIONS_URL}/manage-sources`, {
      method: "POST",
      headers: {
        "x-admin-password": password,
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action, sourceId, source }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to manage source");
    }
    return response.json();
  },
};
