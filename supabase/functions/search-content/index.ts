import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known RSS feed URLs for AI blogs
const RSS_FEEDS: Record<string, string> = {
  "openai.com": "https://openai.com/blog/rss.xml",
  "anthropic.com": "https://www.anthropic.com/rss.xml",
  "deepmind.google": "https://deepmind.google/blog/rss.xml",
  "ai.meta.com": "https://ai.meta.com/blog/rss.xml",
  "blog.google": "https://blog.google/technology/ai/rss/",
  "huggingface.co": "https://huggingface.co/blog/feed.xml",
};

// Simple RSS/XML parser — extracts items with title, link, pubDate
function parseRSSItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2] || "";

    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"/) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || block.match(/<published>([\s\S]*?)<\/published>/) || block.match(/<updated>([\s\S]*?)<\/updated>/);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);

    const title = (titleMatch?.[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const link = (linkMatch?.[1] || linkMatch?.[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const pubDate = (pubDateMatch?.[1] || "").trim();
    const description = (descMatch?.[1] || descMatch?.[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();

    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
  }

  return items;
}

// Check if a date is within the last N days
function isRecent(dateStr: string, days: number): boolean {
  if (!dateStr) return true; // If no date, assume recent
  try {
    const date = new Date(dateStr);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date >= cutoff;
  } catch {
    return true;
  }
}

// Build search queries from topics
function buildSearchQueries(topics: Array<{ name: string; name_he: string; description: string | null }>): string[] {
  const queryMap: Record<string, string> = {
    text_generation: "AI text generation new model release 2026",
    image_generation: "AI image generation new tool update",
    video_generation: "AI video generation new release",
    audio_generation: "AI audio generation music speech new",
    "3d_generation": "AI 3D generation model new",
    chatbots: "AI chatbot virtual assistant new release",
    translation: "AI translation breakthrough new model",
    semantic_search: "AI search semantic new technology",
    speech: "AI speech recognition text to speech new",
    object_detection: "computer vision AI new model",
    nocode_ai: "no-code AI platform new launch",
    model_training: "AI model training fine-tuning new tool",
    prompt_engineering: "prompt engineering AI new technique tool",
    robotics: "AI robotics new robot launch",
    rpa: "AI automation RPA workflow new",
    data_analytics: "AI analytics prediction new tool",
    business_ai: "AI business enterprise CRM new",
    education_ai: "AI education learning new tool",
    security_ai: "AI cybersecurity threat detection new",
    gaming_ai: "AI gaming NPC new technology",
    agi: "AGI artificial general intelligence breakthrough",
    multimodal: "multimodal AI new model release",
    ai_agents: "AI agents autonomous new release",
    neurosymbolic: "neurosymbolic AI new research",
    bci: "brain computer interface AI new",
    cloud_ai: "cloud AI service new launch AWS Azure GCP",
    edge_ai: "edge AI on-device model new",
    open_source: "open source AI model new release",
    finetuning_platforms: "AI fine-tuning platform new tool",
    deep_learning: "deep learning breakthrough AGI frontier",
  };

  return topics
    .filter((t) => queryMap[t.name])
    .map((t) => queryMap[t.name]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth: admin password, service role key, or cron trigger
    // Cron is allowed because this function only INSERTs pending suggestions (non-destructive)
    const adminPassword = req.headers.get("x-admin-password");
    const cronHeader = req.headers.get("x-cron");
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace("Bearer ", "");
    const expectedPassword = Deno.env.get("ADMIN_PASSWORD");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const isAdmin = adminPassword && adminPassword === expectedPassword;
    const isServiceRole = bearerToken && bearerToken === serviceRoleKey;
    const isCron = cronHeader === "true";

    if (!isAdmin && !isServiceRole && !isCron) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let fetchedCount = 0;
    const errors: string[] = [];
    const searchResults: string[] = [];

    // === PART 1: RSS Feeds ===
    console.log("=== Fetching RSS feeds ===");
    for (const [domain, feedUrl] of Object.entries(RSS_FEEDS)) {
      try {
        console.log(`RSS: Fetching ${domain}`);
        const rssResponse = await fetch(feedUrl, {
          headers: { "User-Agent": "Mozilla/5.0 AI News Bot" },
        });

        if (!rssResponse.ok) {
          console.log(`RSS: ${domain} returned ${rssResponse.status}, skipping`);
          continue;
        }

        const xml = await rssResponse.text();
        const items = parseRSSItems(xml);
        const recentItems = items.filter((item) => isRecent(item.pubDate, 7)).slice(0, 3);

        console.log(`RSS: ${domain} — ${items.length} total items, ${recentItems.length} recent`);

        for (const item of recentItems) {
          // Dedup by URL
          const { data: existing } = await supabase
            .from("content_suggestions")
            .select("id")
            .eq("source_url", item.link)
            .maybeSingle();

          if (existing) continue;

          const content = item.description || item.title;
          if (content.length < 20) continue;

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: item.link,
              original_title: item.title.substring(0, 500),
              original_content: content.substring(0, 10000),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            searchResults.push(`RSS [${domain}]: ${item.title.substring(0, 60)}`);
          }
        }
      } catch (err) {
        console.error(`RSS error for ${domain}:`, err);
        errors.push(`RSS ${domain}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // === PART 2: Active Topic Search via Firecrawl ===
    console.log("=== Active topic search ===");

    // Get active topics
    const { data: topics } = await supabase
      .from("topics")
      .select("name, name_he, description")
      .eq("active", true);

    if (topics && topics.length > 0) {
      const allQueries = buildSearchQueries(topics);

      // Pick 5 random topics to search this run (rotating)
      const shuffled = allQueries.sort(() => Math.random() - 0.5);
      const selectedQueries = shuffled.slice(0, 5);

      for (const query of selectedQueries) {
        try {
          console.log(`Search: "${query}"`);
          const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: query,
              limit: 5,
              scrapeOptions: {
                formats: ["markdown"],
                onlyMainContent: true,
              },
            }),
          });

          const searchData = await searchResponse.json();
          if (!searchResponse.ok || !searchData.success) {
            console.error(`Search error for "${query}":`, searchData);
            errors.push(`Search "${query.substring(0, 30)}": ${searchData.error || "Failed"}`);
            continue;
          }

          const results = searchData.data || [];
          console.log(`Search: "${query}" returned ${results.length} results`);

          for (const result of results) {
            const url = result.url;
            if (!url) continue;

            // Skip social media, forums, non-article pages
            if (url.includes("reddit.com") || url.includes("twitter.com") ||
                url.includes("x.com") || url.includes("youtube.com") ||
                url.includes("linkedin.com") || url.includes("facebook.com")) {
              continue;
            }

            // Dedup by URL
            const { data: existing } = await supabase
              .from("content_suggestions")
              .select("id")
              .eq("source_url", url)
              .maybeSingle();

            if (existing) continue;

            const title = result.title || result.metadata?.title || "";
            const content = result.markdown || result.description || "";

            if (content.length < 100) continue;

            const { error: insertError } = await supabase
              .from("content_suggestions")
              .insert({
                source_url: url,
                original_title: title.substring(0, 500),
                original_content: content.substring(0, 10000),
                status: "pending",
              });

            if (!insertError) {
              fetchedCount++;
              searchResults.push(`Search: ${title.substring(0, 60)}`);
            }
          }

          // Small delay between searches
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.error(`Search error for "${query}":`, err);
          errors.push(`Search "${query.substring(0, 30)}": ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }

    // === PART 3: General AI news search ===
    console.log("=== General AI news search ===");
    const generalQueries = [
      "artificial intelligence news today breaking",
      "AI product launch announcement this week",
      "new AI model release 2026",
    ];
    // Pick one random general query per run
    const generalQuery = generalQueries[Math.floor(Math.random() * generalQueries.length)];

    try {
      console.log(`General search: "${generalQuery}"`);
      const generalResponse = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: generalQuery,
          limit: 5,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        }),
      });

      const generalData = await generalResponse.json();
      if (generalResponse.ok && generalData.success) {
        const results = generalData.data || [];
        console.log(`General search returned ${results.length} results`);

        for (const result of results) {
          const url = result.url;
          if (!url) continue;
          if (url.includes("reddit.com") || url.includes("twitter.com") ||
              url.includes("x.com") || url.includes("youtube.com")) continue;

          const { data: existing } = await supabase
            .from("content_suggestions")
            .select("id")
            .eq("source_url", url)
            .maybeSingle();

          if (existing) continue;

          const title = result.title || result.metadata?.title || "";
          const content = result.markdown || result.description || "";
          if (content.length < 100) continue;

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: url,
              original_title: title.substring(0, 500),
              original_content: content.substring(0, 10000),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            searchResults.push(`General: ${title.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.error("General search error:", err);
      errors.push(`General search: ${err instanceof Error ? err.message : "Error"}`);
    }

    // === PART 4: Auto-trigger processing if we found new content ===
    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} new items, triggering AI processing...`);
      try {
        const processUrl = `${supabaseUrl}/functions/v1/process-content`;
        let totalProcessed = 0;
        let hasMore = true;

        while (hasMore) {
          const processResponse = await fetch(processUrl, {
            method: "POST",
            headers: {
              "x-admin-password": expectedPassword || "",
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
          });

          if (processResponse.ok) {
            const processResult = await processResponse.json();
            totalProcessed += processResult.processed || 0;
            hasMore = (processResult.processed || 0) >= 5;
          } else {
            hasMore = false;
          }
        }

        console.log(`AI processing complete: ${totalProcessed} items processed`);
      } catch (processErr) {
        console.error("Auto-process error:", processErr);
        errors.push(`Auto-process: ${processErr instanceof Error ? processErr.message : "Error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Active search found ${fetchedCount} new items`,
        fetched: fetchedCount,
        results: searchResults,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});