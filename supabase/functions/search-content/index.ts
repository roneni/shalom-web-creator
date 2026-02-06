import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known RSS feed URLs for AI blogs
const RSS_FEEDS: Record<string, string> = {
  "openai.com": "https://openai.com/blog/rss.xml",
  "deepmind.google": "https://deepmind.google/blog/rss.xml",
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

// Pre-filter: reject finance/economics/stock articles by title keywords
function isFinanceContent(title: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  const patterns = [
    /\b(stock|stocks|shares|nasdaq|s&p|dow jones|nyse|ipo|market cap)\b/i,
    /\b(מניות|מניה|בורסה|נאסד"ק|תל אביב 35|מדד)\b/,
    /\b(revenue|earnings|quarterly results|fiscal|valuation|投資)\b/i,
    /\b(הכנסות|רווח|הפסד|דוח כספי|שווי שוק|תחזית כלכלית)\b/,
    /\$\d+\s*(billion|million|B|M|bn|mn|מיליארד|מיליון)/i,
    /\b(invest|investment|investor|funding round|raised \$|funding)\b/i,
    /\b(השקעה|השקעות|משקיעים|גיוס הון|גייסה)\b/,
    /\b(dividend|hedge fund|venture capital|private equity)\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

// Check if a URL looks like an index/category page (not an article)
function isIndexPage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    
    // Root or single-segment category paths are likely index pages
    if (!path || path === "") return true;
    
    const segments = path.split("/").filter(Boolean);
    
    // Single-segment paths like /ai or /technology are usually category pages
    if (segments.length <= 1) return true;
    
    // Known category patterns
    const categoryPatterns = [
      /^\/category\//i,
      /^\/topics?\//i,
      /^\/tags?\//i,
      /^\/news\/?$/i,
      /^\/blog\/?$/i,
      /^\/technology\/?$/i,
      /^\/tech\/?$/i,
      /^\/artificial-intelligence\/?$/i,
      /\/ai\/?$/i,
    ];
    
    if (categoryPatterns.some((p) => p.test(path))) return true;
    
    // URLs ending with common non-article patterns
    if (path.endsWith("/about") || path.endsWith("/pricing") || 
        path.endsWith("/contact") || path.endsWith("/careers") ||
        path.endsWith("/products") || path.endsWith("/features")) return true;
    
    return false;
  } catch {
    return false;
  }
}

// Build search queries from topics — with date context for better results
function buildSearchQueries(topics: Array<{ name: string; name_he: string; description: string | null }>): string[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();
  const dateContext = `${currentMonth} ${currentYear}`;
  
  const queryMap: Record<string, string> = {
    text_generation: `"text generation" OR "language model" new release announcement ${dateContext}`,
    image_generation: `"AI image generation" OR "image model" new launch ${dateContext}`,
    video_generation: `"AI video generation" OR "video model" new release ${dateContext}`,
    audio_generation: `"AI audio" OR "AI music" OR "AI voice" new tool ${dateContext}`,
    "3d_generation": `"AI 3D" OR "3D generation" model new ${dateContext}`,
    chatbots: `"AI chatbot" OR "AI assistant" launch announcement ${dateContext}`,
    translation: `"AI translation" OR "machine translation" new model ${dateContext}`,
    semantic_search: `"AI search" OR "semantic search" new technology ${dateContext}`,
    speech: `"speech recognition" OR "text to speech" AI new ${dateContext}`,
    object_detection: `"computer vision" OR "object detection" AI breakthrough ${dateContext}`,
    nocode_ai: `"no-code AI" OR "AI platform" new launch ${dateContext}`,
    model_training: `"model training" OR "fine-tuning" AI tool ${dateContext}`,
    prompt_engineering: `"prompt engineering" new technique ${dateContext}`,
    robotics: `"AI robotics" OR "humanoid robot" new launch ${dateContext}`,
    rpa: `"AI automation" OR "intelligent automation" new ${dateContext}`,
    data_analytics: `"AI analytics" OR "predictive AI" new tool ${dateContext}`,
    business_ai: `"enterprise AI" OR "AI for business" new ${dateContext}`,
    education_ai: `"AI education" OR "AI tutoring" new ${dateContext}`,
    security_ai: `"AI cybersecurity" OR "AI security" new tool ${dateContext}`,
    gaming_ai: `"AI gaming" OR "game AI" new ${dateContext}`,
    agi: `"AGI" OR "artificial general intelligence" breakthrough ${dateContext}`,
    multimodal: `"multimodal AI" OR "multimodal model" new release ${dateContext}`,
    ai_agents: `"AI agent" OR "autonomous agent" new release ${dateContext}`,
    neurosymbolic: `"neurosymbolic AI" OR "symbolic AI" new research ${dateContext}`,
    bci: `"brain computer interface" OR "neural interface" AI new ${dateContext}`,
    cloud_ai: `"cloud AI" service new launch ${dateContext}`,
    edge_ai: `"edge AI" OR "on-device AI" new ${dateContext}`,
    open_source: `"open source AI" OR "open source model" new release ${dateContext}`,
    finetuning_platforms: `"fine-tuning" OR "model customization" AI platform ${dateContext}`,
    deep_learning: `"deep learning" breakthrough frontier ${dateContext}`,
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

    // Collect all existing URLs once to avoid repeated DB lookups
    const { data: existingUrls } = await supabase
      .from("content_suggestions")
      .select("source_url")
      .not("source_url", "is", null);
    
    const urlSet = new Set((existingUrls || []).map((r: { source_url: string | null }) => r.source_url));
    
    const isNewUrl = (url: string): boolean => {
      if (urlSet.has(url)) return false;
      // Also check without trailing slash and with/without www
      const normalized = url.replace(/\/$/, "");
      if (urlSet.has(normalized) || urlSet.has(normalized + "/")) return false;
      return true;
    };
    
    const markUrlSeen = (url: string) => {
      urlSet.add(url);
      urlSet.add(url.replace(/\/$/, ""));
    };

    // === PART 1: Static RSS Feeds (blogs) ===
    console.log("=== Fetching static RSS feeds ===");
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
        const recentItems = items.filter((item) => isRecent(item.pubDate, 7)).slice(0, 5);

        console.log(`RSS: ${domain} — ${items.length} total, ${recentItems.length} recent`);

        for (const item of recentItems) {
          if (!isNewUrl(item.link)) continue;

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
            markUrlSeen(item.link);
            searchResults.push(`RSS [${domain}]: ${item.title.substring(0, 60)}`);
          }
        }
      } catch (err) {
        console.error(`RSS error for ${domain}:`, err);
        errors.push(`RSS ${domain}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // === PART 1.5: Google Alerts RSS Feeds from DB ===
    console.log("=== Fetching Google Alerts RSS feeds ===");
    const { data: rssSources } = await supabase
      .from("sources")
      .select("id, name, url")
      .eq("type", "google_alerts_rss")
      .eq("active", true);

    if (rssSources && rssSources.length > 0) {
      for (const source of rssSources) {
        try {
          console.log(`Google Alert: Fetching "${source.name}"`);
          const rssResponse = await fetch(source.url, {
            headers: { "User-Agent": "Mozilla/5.0 AI News Bot" },
          });

          if (!rssResponse.ok) {
            console.log(`Google Alert: ${source.name} returned ${rssResponse.status}, skipping`);
            continue;
          }

          const xml = await rssResponse.text();
          const items = parseRSSItems(xml);
          // Google Alerts Atom feeds use <updated> — take last 7 days
          const recentItems = items.filter((item) => isRecent(item.pubDate, 7)).slice(0, 10);

          console.log(`Google Alert: ${source.name} — ${items.length} total, ${recentItems.length} recent`);

          let accepted = 0;
          for (const item of recentItems) {
            // Google Alerts links are redirect URLs — extract the real URL
            let articleUrl = item.link;
            try {
              const u = new URL(articleUrl);
              const realUrl = u.searchParams.get("url");
              if (realUrl) articleUrl = realUrl;
            } catch { /* keep original */ }

            if (!isNewUrl(articleUrl)) continue;
            if (isIndexPage(articleUrl)) continue;
            if (isFinanceContent(item.title)) {
              console.log(`  Skipped finance: "${item.title.substring(0, 60)}"`);
              continue;
            }

            // Clean HTML from Google Alerts descriptions
            const cleanDesc = (item.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const content = cleanDesc || item.title;
            if (content.length < 20) continue;

            const { error: insertError } = await supabase
              .from("content_suggestions")
              .insert({
                source_id: source.id,
                source_url: articleUrl,
                original_title: item.title.replace(/<[^>]+>/g, "").substring(0, 500),
                original_content: content.substring(0, 10000),
                status: "pending",
              });

            if (!insertError) {
              fetchedCount++;
              accepted++;
              markUrlSeen(articleUrl);
              searchResults.push(`Alert [${source.name}]: ${item.title.replace(/<[^>]+>/g, "").substring(0, 60)}`);
            }
          }
          console.log(`  → ${accepted} accepted from ${source.name}`);
        } catch (err) {
          console.error(`Google Alert error for ${source.name}:`, err);
          errors.push(`Alert ${source.name}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }

    // === PART 2: Active Topic Search via Firecrawl ===
    console.log("=== Active topic search ===");

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
          console.log(`Search: "${query.substring(0, 80)}..."`);
          const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              limit: 5,
              scrapeOptions: {
                formats: ["markdown"],
                onlyMainContent: true,
              },
            }),
          });

          const searchData = await searchResponse.json();
          if (!searchResponse.ok || !searchData.success) {
            console.error(`Search failed for query:`, searchData);
            errors.push(`Search: ${searchData.error || "Failed"}`);
            continue;
          }

          const results = searchData.data || [];
          let accepted = 0;
          
          for (const result of results) {
            const url = result.url;
            if (!url) continue;

            // Skip social media, forums, non-article pages
            if (url.includes("reddit.com") || url.includes("twitter.com") ||
                url.includes("x.com") || url.includes("youtube.com") ||
                url.includes("linkedin.com") || url.includes("facebook.com") ||
                url.includes("wikipedia.org")) {
              continue;
            }

            // Skip index/category pages
            if (isIndexPage(url)) {
              console.log(`  Skipped index page: ${url}`);
              continue;
            }

            // Dedup
            if (!isNewUrl(url)) continue;

            const title = result.title || result.metadata?.title || "";
            const content = result.markdown || result.description || "";

            // Require meaningful content
            if (content.length < 200) continue;
            
            // Skip pages with titles that look like category/index pages
            if (/^(AI News|Artificial Intelligence|Technology|Latest|Home|Blog)\s*[\|–—:]/i.test(title)) {
              console.log(`  Skipped generic title: "${title.substring(0, 60)}"`);
              continue;
            }
            
            // Skip finance/economics/stock articles
            if (isFinanceContent(title)) {
              console.log(`  Skipped finance content: "${title.substring(0, 60)}"`);
              continue;
            }

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
              accepted++;
              markUrlSeen(url);
              searchResults.push(`Search: ${title.substring(0, 60)}`);
            }
          }
          
          console.log(`  → ${results.length} results, ${accepted} accepted`);

          // Small delay between searches
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.error(`Search error:`, err);
          errors.push(`Search: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }

    // === PART 3: General AI news search (targeted at recent articles) ===
    console.log("=== General AI news search ===");
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const dateStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    
    const generalQueries = [
      `"AI" site:techcrunch.com OR site:theverge.com OR site:arstechnica.com ${dateStr}`,
      `"artificial intelligence" announcement launch site:venturebeat.com OR site:wired.com ${dateStr}`,
      `"AI model" OR "AI tool" release announcement this week ${dateStr}`,
    ];
    const generalQuery = generalQueries[Math.floor(Math.random() * generalQueries.length)];

    try {
      console.log(`General search: "${generalQuery.substring(0, 80)}..."`);
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
        let accepted = 0;

        for (const result of results) {
          const url = result.url;
          if (!url) continue;
          if (url.includes("reddit.com") || url.includes("twitter.com") ||
              url.includes("x.com") || url.includes("youtube.com")) continue;
          if (isIndexPage(url)) continue;
          if (!isNewUrl(url)) continue;

          const title = result.title || result.metadata?.title || "";
          const content = result.markdown || result.description || "";
          if (content.length < 200) continue;
          
          if (/^(AI News|Artificial Intelligence|Technology|Latest|Home|Blog)\s*[\|–—:]/i.test(title)) continue;
          if (isFinanceContent(title)) continue;

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
            accepted++;
            markUrlSeen(url);
            searchResults.push(`General: ${title.substring(0, 60)}`);
          }
        }
        console.log(`General search: ${results.length} results, ${accepted} accepted`);
      }
    } catch (err) {
      console.error("General search error:", err);
      errors.push(`General search: ${err instanceof Error ? err.message : "Error"}`);
    }

    // === PART 4: Auto-trigger processing if we found new content ===
    let approvedCount = 0;
    let totalProcessed = 0;
    
    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} new items, triggering AI processing...`);
      try {
        const processUrl = `${supabaseUrl}/functions/v1/process-content`;
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

        // Count how many actually survived AI filtering (pending with content)
        const { count } = await supabase
          .from("content_suggestions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .not("suggested_title", "is", null)
          .not("suggested_content", "is", null);
        
        approvedCount = count || 0;
        
        console.log(`AI processing complete: ${totalProcessed} processed, ${approvedCount} pending for review`);
      } catch (processErr) {
        console.error("Auto-process error:", processErr);
        errors.push(`Auto-process: ${processErr instanceof Error ? processErr.message : "Error"}`);
      }
    } else {
      console.log("No new items found this run");
    }

    return new Response(
      JSON.stringify({
        message: `Search found ${fetchedCount} items, ${approvedCount} approved for review`,
        fetched: fetchedCount,
        processed: totalProcessed,
        approved: approvedCount,
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
