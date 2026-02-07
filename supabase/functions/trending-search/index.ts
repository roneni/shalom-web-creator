import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Primary sources get priority — content from these is preferred
const PRIMARY_SOURCES = [
  "openai.com", "anthropic.com", "deepmind.google", "blog.google",
  "ai.meta.com", "huggingface.co", "stability.ai", "midjourney.com",
  "nvidia.com", "microsoft.com", "apple.com", "x.ai",
];

function isPrimarySource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PRIMARY_SOURCES.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch { return false; }
}

// Finance filter (same as search-content)
function isFinanceContent(title: string): boolean {
  if (!title) return false;
  const patterns = [
    /\b(stock|stocks|shares|nasdaq|s&p|dow jones|nyse|ipo|market cap)\b/i,
    /\b(מניות|מניה|בורסה|שווי שוק|גיוס הון|הכנסות|רווח)\b/,
    /\$\d+\s*(billion|million|B|M|bn|mn|מיליארד|מיליון)/i,
    /\b(revenue|earnings|quarterly results|valuation|funding round|raised \$)\b/i,
    /\b(השקעה|השקעות|משקיעים|דוח כספי)\b/,
  ];
  return patterns.some(p => p.test(title));
}

// Index page filter
function isIndexPage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    if (!path) return true;
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return true;
    const categoryPatterns = [
      /^\/category\//i, /^\/topics?\//i, /^\/tags?\//i,
      /^\/news\/?$/i, /^\/blog\/?$/i, /^\/technology\/?$/i,
    ];
    return categoryPatterns.some(p => p.test(path));
  } catch { return false; }
}

// Build trending/viral queries based on Google Trends strategy
function buildTrendingQueries(): { query: string; category: string }[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();

  return [
    // Breaking/viral content — most time-sensitive
    { query: `"AI" viral OR trending OR breakout today ${currentYear}`, category: "viral" },
    { query: `"AI" controversy OR backlash OR concern ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `"AI" breakthrough OR "first ever" OR unprecedented ${currentMonth} ${currentYear}`, category: "viral" },

    // Major product launches — prefer primary sources
    { query: `site:openai.com OR site:anthropic.com announcement OR launch ${currentMonth} ${currentYear}`, category: "primary" },
    { query: `site:blog.google OR site:deepmind.google AI new ${currentMonth} ${currentYear}`, category: "primary" },
    { query: `site:ai.meta.com OR site:huggingface.co release OR launch ${currentMonth} ${currentYear}`, category: "primary" },

    // Trending AI topics — broader discovery
    { query: `"ChatGPT" OR "Claude" OR "Gemini" new feature update ${currentMonth} ${currentYear}`, category: "features" },
    { query: `"AI agent" OR "autonomous agent" launch OR release this week`, category: "tools" },
    { query: `"AI tool" OR "AI app" launch viral popular ${currentMonth} ${currentYear}`, category: "tools" },

    // Controversy & regulation — often goes viral
    { query: `"AI" regulation OR ban OR lawsuit ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `"AI" "security flaw" OR vulnerability OR exploit ${currentMonth} ${currentYear}`, category: "viral" },

    // Community buzz — Reddit/HN style discoveries
    { query: `"AI" site:techcrunch.com OR site:theverge.com OR site:arstechnica.com breaking ${currentMonth} ${currentYear}`, category: "news" },
    { query: `"open source" AI model release ${currentMonth} ${currentYear}`, category: "tools" },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: admin password, service role, or cron
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

    // Collect existing URLs for dedup
    const { data: existingUrls } = await supabase
      .from("content_suggestions")
      .select("source_url")
      .not("source_url", "is", null);

    const urlSet = new Set((existingUrls || []).map((r: { source_url: string | null }) => r.source_url));
    const isNewUrl = (url: string): boolean => {
      if (urlSet.has(url)) return false;
      const normalized = url.replace(/\/$/, "");
      return !urlSet.has(normalized) && !urlSet.has(normalized + "/");
    };
    const markUrlSeen = (url: string) => {
      urlSet.add(url);
      urlSet.add(url.replace(/\/$/, ""));
    };

    // Collect existing titles for semantic dedup
    const { data: existingTitles } = await supabase
      .from("content_suggestions")
      .select("original_title, suggested_title")
      .not("original_title", "is", null)
      .order("fetched_at", { ascending: false })
      .limit(200);

    const titleSet = (existingTitles || []).map((r: any) => 
      (r.suggested_title || r.original_title || "").toLowerCase().replace(/[⭐\[\]]/g, "").trim()
    ).filter((t: string) => t.length > 10);

    // Semantic dedup: extract key terms and check for similarity
    function extractKeyTerms(title: string): string[] {
      const cleaned = title.toLowerCase()
        .replace(/[⭐\[\](){}:;,."'!?—–\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "for", "to", "of", "in", "on", "at", "by", "with", "and", "or", "its", "it", "that", "this", "as", "new", "has", "have", "had", "can", "could", "will", "would", "may", "now", "also", "about", "from", "how", "what", "when", "where", "who", "which", "more", "most", "than", "into", "over", "up", "out", "just", "been", "being", "between", "after", "before", "says", "said",
        "של", "את", "על", "עם", "לא", "גם", "או", "כי", "אם", "מה", "זה", "היא", "הוא", "אל", "כל", "עוד", "יותר", "בין", "אחרי", "לפני"]);
      return cleaned.split(" ").filter(w => w.length > 2 && !stopWords.has(w));
    }

    function isSimilarTitle(newTitle: string): boolean {
      const newTerms = extractKeyTerms(newTitle);
      if (newTerms.length < 2) return false;
      
      for (const existing of titleSet) {
        const existingTerms = extractKeyTerms(existing);
        if (existingTerms.length < 2) continue;
        
        // Count overlapping terms
        const overlap = newTerms.filter(t => existingTerms.includes(t)).length;
        const similarity = overlap / Math.min(newTerms.length, existingTerms.length);
        
        if (similarity >= 0.6 && overlap >= 3) {
          console.log(`  Dedup: "${newTitle.substring(0, 50)}" similar to "${existing.substring(0, 50)}" (${(similarity * 100).toFixed(0)}%)`);
          return true;
        }
      }
      return false;
    }

    const markTitleSeen = (title: string) => {
      titleSet.push(title.toLowerCase().replace(/[⭐\[\]]/g, "").trim());
    };

    let fetchedCount = 0;
    let primaryCount = 0;
    const errors: string[] = [];
    const searchResults: string[] = [];

    // Build and shuffle trending queries, pick a subset
    const allQueries = buildTrendingQueries();
    const shuffled = allQueries.sort(() => Math.random() - 0.5);
    // Run 6 queries per invocation to balance coverage vs API usage
    const selectedQueries = shuffled.slice(0, 6);

    for (const { query, category } of selectedQueries) {
      try {
        console.log(`Trending [${category}]: "${query.substring(0, 80)}..."`);

        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 5,
            tbs: category === "viral" ? "qdr:w" : undefined, // Past week for viral
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
            },
          }),
        });

        const searchData = await searchResponse.json();
        if (!searchResponse.ok || !searchData.success) {
          console.error(`Search failed:`, searchData);
          errors.push(`Trending [${category}]: ${searchData.error || "Failed"}`);
          continue;
        }

        const results = searchData.data || [];
        let accepted = 0;

        // Sort results: primary sources first
        const sortedResults = [...results].sort((a: any, b: any) => {
          const aP = isPrimarySource(a.url || "");
          const bP = isPrimarySource(b.url || "");
          if (aP && !bP) return -1;
          if (!aP && bP) return 1;
          return 0;
        });

        for (const result of sortedResults) {
          const url = result.url;
          if (!url) continue;

          // Skip social media
          if (/reddit\.com|twitter\.com|x\.com\/\w+\/status|youtube\.com|linkedin\.com|facebook\.com|wikipedia\.org/i.test(url)) {
            continue;
          }

          if (isIndexPage(url)) continue;
          if (!isNewUrl(url)) continue;

          const title = result.title || result.metadata?.title || "";
          const content = result.markdown || result.description || "";

          if (content.length < 150) continue;
          if (/^(AI News|Artificial Intelligence|Technology|Latest|Home|Blog)\s*[\|–—:]/i.test(title)) continue;
          if (isFinanceContent(title)) {
            console.log(`  Skipped finance: "${title.substring(0, 60)}"`);
            continue;
          }

          // Semantic dedup: skip if similar title already exists
          if (isSimilarTitle(title)) {
            continue;
          }

          const isPrimary = isPrimarySource(url);

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: url,
              original_title: `${isPrimary ? "⭐ " : ""}${title.substring(0, 500)}`,
              original_content: content.substring(0, 10000),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            if (isPrimary) primaryCount++;
            accepted++;
            markUrlSeen(url);
            markTitleSeen(title);
            searchResults.push(`${isPrimary ? "⭐ " : ""}[${category}] ${title.substring(0, 60)}`);
          }
        }

        console.log(`  → ${results.length} results, ${accepted} accepted`);

        // Delay between searches
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Trending search error:`, err);
        errors.push(`Trending: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // Auto-trigger AI processing if we found content
    let approvedCount = 0;
    let totalProcessed = 0;

    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} trending items (${primaryCount} from primary sources), triggering AI processing...`);
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

        // Count approved suggestions
        const { count } = await supabase
          .from("content_suggestions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .not("suggested_title", "is", null)
          .not("suggested_content", "is", null);

        approvedCount = count || 0;
        console.log(`AI processing: ${totalProcessed} processed, ${approvedCount} pending review`);
      } catch (processErr) {
        console.error("Auto-process error:", processErr);
        errors.push(`Auto-process: ${processErr instanceof Error ? processErr.message : "Error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Trending search found ${fetchedCount} items (${primaryCount} primary), ${approvedCount} approved`,
        fetched: fetchedCount,
        primary: primaryCount,
        processed: totalProcessed,
        approved: approvedCount,
        results: searchResults,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("trending-search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
