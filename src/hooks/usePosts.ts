import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  posts as mockPosts,
  sections,
  type Post,
  type SectionId,
} from "@/data/mockData";

// Convert DB row to Post format
function dbToPost(row: any): Post {
  const section = sections.find((s) => s.id === row.section);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || "",
    content: row.content || "",
    date: row.date,
    section: row.section as SectionId,
    sectionName: section?.name || row.section,
    tag: row.tag || "",
    sourceUrl: row.source_url || undefined,
  };
}

export function usePublishedPosts() {
  return useQuery({
    queryKey: ["published-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_posts")
        .select("*")
        .eq("published", true)
        .order("date", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        return data.map(dbToPost);
      }
      // Fallback to mock data
      return mockPosts;
    },
  });
}

export function usePostsBySection(sectionId: SectionId) {
  return useQuery({
    queryKey: ["published-posts", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_posts")
        .select("*")
        .eq("published", true)
        .eq("section", sectionId)
        .order("date", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        return data.map(dbToPost);
      }
      // Fallback to mock data
      return mockPosts.filter((p) => p.section === sectionId);
    },
  });
}

export function usePostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["published-post", slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("published_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return dbToPost(data);
      }
      // Fallback to mock data
      return mockPosts.find((p) => p.slug === slug) || null;
    },
  });
}

export function useLatestPost() {
  return useQuery({
    queryKey: ["latest-post"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_posts")
        .select("*")
        .eq("published", true)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return dbToPost(data);
      }
      return mockPosts[0];
    },
  });
}

export function useLatestPostBySection(sectionId: SectionId) {
  return useQuery({
    queryKey: ["latest-post", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_posts")
        .select("*")
        .eq("published", true)
        .eq("section", sectionId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return dbToPost(data);
      }
      return mockPosts.find((p) => p.section === sectionId) || null;
    },
  });
}
