import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// URL Normalization
// ============================================================
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "source", "queryly", "mc_cid", "mc_eid", "fbclid", "gclid"];
    trackingParams.forEach(p => u.searchParams.delete(p));
    u.hash = "";
    let normalized = u.toString().replace(/\/$/, "");
    normalized = normalized.replace(/\/\/www\./, "//");
    return normalized;
  } catch {
    return url.replace(/\/$/, "");
  }
}

// ============================================================
// Semantic Dedup Engine
// ============================================================
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "for", "to", "of", "in", "on",
  "at", "by", "with", "and", "or", "its", "it", "that", "this", "as", "new",
  "has", "have", "had", "can", "could", "will", "would", "may", "now", "also",
  "about", "from", "how", "what", "when", "where", "who", "which", "more",
  "most", "than", "into", "over", "up", "out", "just", "been", "being",
  "between", "after", "before", "says", "said",
  "של", "את", "על", "עם", "לא", "גם", "או", "כי", "אם", "מה", "זה", "היא",
  "הוא", "אל", "כל", "עוד", "יותר", "בין", "אחרי", "לפני",
]);

function extractKeyTerms(title: string): string[] {
  const cleaned = title.toLowerCase()
    .replace(/[⭐\[\](){}:;,."'!?—–\-\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function isSimilarToAny(newTitle: string, existingTitles: string[]): boolean {
  const newTerms = extractKeyTerms(newTitle);
  if (newTerms.length < 2) return false;
  for (const existing of existingTitles) {
    const existingTerms = extractKeyTerms(existing);
    if (existingTerms.length < 2) continue;
    const overlap = newTerms.filter(t => existingTerms.includes(t)).length;
    const similarity = overlap / Math.min(newTerms.length, existingTerms.length);
    if (similarity >= 0.6 && overlap >= 3) return true;
  }
  return false;
}

// Primary sources
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

function buildTrendingQueries(): { query: string; category: string }[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();

  return [
    { query: `"AI" viral OR trending OR breakout today ${currentYear}`, category: "viral" },
    { query: `"AI" controversy OR backlash OR concern ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `"AI" breakthrough OR "first ever" OR unprecedented ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `site:openai.com OR site:anthropic.com announcement OR launch ${currentMonth} ${currentYear}`, category: "primary" },
    { query: `site:blog.google OR site:deepmind.google AI new ${currentMonth} ${currentYear}`, category: "primary" },
    { query: `site:ai.meta.com OR site:huggingface.co release OR launch ${currentMonth} ${currentYear}`, category: "primary" },
    { query: `"ChatGPT" OR "Claude" OR "Gemini" new feature update ${currentMonth} ${currentYear}`, category: "features" },
    { query: `"AI agent" OR "autonomous agent" launch OR release this week`, category: "tools" },
    { query: `"AI tool" OR "AI app" launch viral popular ${currentMonth} ${currentYear}`, category: "tools" },
    { query: `"AI" regulation OR ban OR lawsuit ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `"AI" "security flaw" OR vulnerability OR exploit ${currentMonth} ${currentYear}`, category: "viral" },
    { query: `"AI" site:techcrunch.com OR site:theverge.com OR site:arstechnica.com breaking ${currentMonth} ${currentYear}`, category: "news" },
    { query: `"open source" AI model release ${currentMonth} ${currentYear}`, category: "tools" },
  ];
}

async function validateAdminAuth(req: Request): Promise<{ ok: boolean; userId: string; error?: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("x-cron");
  const bearerToken = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (bearerToken === serviceRoleKey || cronHeader === "true") {
    return { ok: true, userId: "system" };
  }
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, userId: "", error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getClaims(bearerToken);
  if (error || !data?.claims) {
    return { ok: false, userId: "", error: new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const userId = data.claims.sub as string;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
  if (!roleData) {
    return { ok: false, userId: "", error: new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { ok: true, userId };
}

async function checkRateLimit(supabase: any, functionName: string, userId: string, maxCalls: number, windowMinutes: number): Promise<boolean> {
  await supabase.from("admin_rate_limits").delete().lt("called_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count } = await supabase.from("admin_rate_limits").select("*", { count: "exact", head: true }).eq("function_name", functionName).eq("user_id", userId).gte("called_at", windowStart);
  if ((count || 0) >= maxCalls) return false;
  await supabase.from("admin_rate_limits").insert({ function_name: functionName, user_id: userId });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateAdminAuth(req);
    if (!auth.ok) return auth.error!;

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

    if (auth.userId !== "system") {
      const allowed = await checkRateLimit(supabase, "trending-search", auth.userId, 10, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Collect existing URLs + titles for dedup
    const { data: existingRows } = await supabase
      .from("content_suggestions")
      .select("source_url, original_title, suggested_title")
      .not("source_url", "is", null);

    const urlSet = new Set<string>();
    const titleList: string[] = [];
    for (const row of (existingRows || [])) {
      if (row.source_url) {
        urlSet.add(row.source_url);
        urlSet.add(normalizeUrl(row.source_url));
      }
      const t = (row.suggested_title || row.original_title || "").toLowerCase().trim();
      if (t.length > 10 && !t.startsWith("[נדחה")) titleList.push(t);
    }

    const isNewUrl = (url: string): boolean => {
      const normalized = normalizeUrl(url);
      return !urlSet.has(url) && !urlSet.has(normalized);
    };
    const markSeen = (url: string, title: string) => {
      urlSet.add(url);
      urlSet.add(normalizeUrl(url));
      if (title && title.length > 10) titleList.push(title.toLowerCase().trim());
    };

    let fetchedCount = 0;
    let primaryCount = 0;
    let dedupedCount = 0;
    const errors: string[] = [];
    const searchResults: string[] = [];

    const allQueries = buildTrendingQueries();
    const shuffled = allQueries.sort(() => Math.random() - 0.5);
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
            tbs: category === "viral" ? "qdr:w" : undefined,
            scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          }),
        });

        const searchData = await searchResponse.json();
        if (!searchResponse.ok || !searchData.success) {
          errors.push(`Trending [${category}]: ${searchData.error || "Failed"}`);
          continue;
        }

        const results = searchData.data || [];
        let accepted = 0;

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

          if (/reddit\.com|twitter\.com|x\.com\/\w+\/status|youtube\.com|linkedin\.com|facebook\.com|wikipedia\.org/i.test(url)) continue;
          if (isIndexPage(url)) continue;
          if (!isNewUrl(url)) continue;

          const title = result.title || result.metadata?.title || "";
          const content = result.markdown || result.description || "";

          if (content.length < 150) continue;
          if (/^(AI News|Artificial Intelligence|Technology|Latest|Home|Blog)\s*[\|–—:]/i.test(title)) continue;
          if (isFinanceContent(title)) continue;

          // Semantic dedup on title
          if (isSimilarToAny(title, titleList)) {
            console.log(`  Dedup: "${title.substring(0, 50)}"`);
            dedupedCount++;
            continue;
          }

          const isPrimary = isPrimarySource(url);
          const normalizedUrl = normalizeUrl(url);

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: normalizedUrl,
              original_title: `${isPrimary ? "⭐ " : ""}${title.substring(0, 500)}`,
              original_content: content.substring(0, 10000),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            if (isPrimary) primaryCount++;
            accepted++;
            markSeen(normalizedUrl, title);
            searchResults.push(`${isPrimary ? "⭐ " : ""}[${category}] ${title.substring(0, 60)}`);
          }
        }

        console.log(`  → ${results.length} results, ${accepted} accepted`);
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Trending search error:`, err);
        errors.push(`Trending: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // Auto-trigger AI processing
    let approvedCount = 0;
    let totalProcessed = 0;

    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} trending items (${primaryCount} primary, ${dedupedCount} deduped), triggering AI processing...`);
      try {
        const processUrl = `${supabaseUrl}/functions/v1/process-content`;
        let hasMore = true;
        while (hasMore) {
          const processResponse = await fetch(processUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
          });
          if (processResponse.ok) {
            const processResult = await processResponse.json();
            totalProcessed += processResult.processed || 0;
            hasMore = (processResult.processed || 0) >= 5;
          } else { hasMore = false; }
        }

        const { count } = await supabase
          .from("content_suggestions")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .not("suggested_title", "is", null)
          .not("suggested_content", "is", null);

        approvedCount = count || 0;
      } catch (processErr) {
        errors.push(`Auto-process: ${processErr instanceof Error ? processErr.message : "Error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Trending: ${fetchedCount} found (${primaryCount} primary), ${dedupedCount} deduped, ${approvedCount} approved`,
        fetched: fetchedCount,
        primary: primaryCount,
        deduped: dedupedCount,
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
