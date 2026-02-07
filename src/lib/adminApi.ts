import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

export const adminApi = {
  async fetchContent() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/fetch-content`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch content");
    }
    return response.json();
  },

  async searchContent() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/search-content`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to search content");
    }
    return response.json();
  },

  async trendingSearch() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/trending-search`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to search trending content");
    }
    return response.json();
  },

  async fetchTwitterLikes() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/fetch-twitter-likes`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to fetch Twitter likes");
    }
    return response.json();
  },

  async processContent() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/process-content`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to process content");
    }
    return response.json();
  },

  async managePosts(action: string, suggestionId: string, updates?: Record<string, string>) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/manage-posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, suggestionId, updates }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to manage post");
    }
    return response.json();
  },

  async getSuggestions(status?: string, section?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/admin-data`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "get-suggestions", status, section }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to get suggestions");
    }
    const result = await response.json();
    return result.data;
  },

  async getSources() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/admin-data`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "get-sources" }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to get sources");
    }
    const result = await response.json();
    return result.data;
  },

  async processOnly() {
    let totalProcessed = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await this.processContent();
      totalProcessed += result.processed || 0;
      hasMore = (result.processed || 0) >= 5;
    }
    return { processed: totalProcessed };
  },

  async manageSources(action: string, sourceId?: string, source?: { name: string; url: string; type: string; active?: boolean }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/manage-sources`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, sourceId, source }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to manage source");
    }
    return response.json();
  },
};
