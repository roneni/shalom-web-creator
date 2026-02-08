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

// ============================================================
// AI Curator — Signal Scoring for trending items
// ============================================================
async function aiCuratorFilter(
  items: Array<{ url: string; title: string; content: string; isPrimary: boolean; category: string }>,
  LOVABLE_API_KEY: string
): Promise<Array<{ url: string; title: string; content: string; isPrimary: boolean; category: string; signal_score: number; reject: boolean; reject_reason?: string }>> {
  if (!LOVABLE_API_KEY || items.length === 0) {
    return items.map(item => ({ ...item, signal_score: 85, reject: false }));
  }

  const itemsList = items.map((item, i) => 
    `[${i}] Title: ${item.title.substring(0, 200)}\nURL: ${item.url}\nCategory: ${item.category}${item.isPrimary ? " ⭐PRIMARY" : ""}\nContent: ${item.content.substring(0, 600)}`
  ).join("\n\n---\n\n");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are 'The AI Curator' — an elite content filter for trending/viral AI content.
Score each item 0-100 using Signal Test + Value Test.
95-100: Paradigm shift, massive viral moment. 80-94: Significant trending update. <80: Reject.
IMPORTANT: Items marked ⭐PRIMARY are from major AI companies — be generous with these (score 85+) unless clearly financial/marketing.
AUTO-REJECT: marketing fluff, generic tutorials, financial speculation, old news, self-promotion.
Return JSON array only: [{"index": 0, "score": 92, "reject": false}, {"index": 1, "score": 45, "reject": true, "reason": "marketing fluff"}]`,
          },
          { role: "user", content: `Evaluate these ${items.length} trending items:\n\n${itemsList}` },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn(`AI Curator trending filter failed: ${response.status}`);
      return items.map(item => ({ ...item, signal_score: 85, reject: false }));
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || "";
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return items.map(item => ({ ...item, signal_score: 85, reject: false }));
    }

    const scores = JSON.parse(jsonMatch[0]);
    return items.map((item, i) => {
      const score = scores.find((s: any) => s.index === i);
      return {
        ...item,
        signal_score: score?.score || 85,
        reject: score?.reject || false,
        reject_reason: score?.reason,
      };
    });
  } catch (err) {
    console.error("AI Curator trending filter error:", err);
    return items.map(item => ({ ...item, signal_score: 85, reject: false }));
  }
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

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
    let aiRejectedCount = 0;
    const errors: string[] = [];
    const searchResults: string[] = [];

    const allQueries = buildTrendingQueries();
    const shuffled = allQueries.sort(() => Math.random() - 0.5);
    const selectedQueries = shuffled.slice(0, 6);

    // Collect all items first, then batch-filter with AI Curator
    const collectedItems: Array<{ url: string; title: string; content: string; isPrimary: boolean; category: string }> = [];

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
          if (isSimilarToAny(title, titleList)) { dedupedCount++; continue; }

          collectedItems.push({
            url: normalizeUrl(url),
            title,
            content: content.substring(0, 10000),
            isPrimary: isPrimarySource(url),
            category,
          });
          accepted++;
          // Mark as seen early to prevent cross-query duplicates
          markSeen(url, title);
        }

        console.log(`  → ${results.length} results, ${accepted} passed filters`);
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Trending search error:`, err);
        errors.push(`Trending: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // AI Curator batch filter
    if (collectedItems.length > 0 && LOVABLE_API_KEY) {
      console.log(`AI Curator: evaluating ${collectedItems.length} trending items...`);
      const evaluated = await aiCuratorFilter(collectedItems, LOVABLE_API_KEY);

      for (const item of evaluated) {
        if (item.reject) {
          aiRejectedCount++;
          console.log(`  ❌ Rejected (${item.signal_score}): ${item.title.substring(0, 50)} — ${item.reject_reason || "below threshold"}`);
          await supabase.from("content_suggestions").insert({
            source_url: item.url,
            original_title: `${item.isPrimary ? "⭐ " : ""}${item.title.substring(0, 500)}`,
            original_content: item.content.substring(0, 10000),
            status: "rejected",
            suggested_title: `[נדחה ע"י AI Curator] ${item.reject_reason || "ציון נמוך"}`,
            signal_score: item.signal_score,
            reviewed_at: new Date().toISOString(),
          });
          continue;
        }

        const { error: insertError } = await supabase.from("content_suggestions").insert({
          source_url: item.url,
          original_title: `${item.isPrimary ? "⭐ " : ""}${item.title.substring(0, 500)}`,
          original_content: item.content.substring(0, 10000),
          status: "pending",
          signal_score: item.signal_score,
        });

        if (!insertError) {
          fetchedCount++;
          if (item.isPrimary) primaryCount++;
          searchResults.push(`${item.isPrimary ? "⭐ " : ""}[${item.category}] ${item.title.substring(0, 60)}`);
        }
      }
    } else {
      // No AI key — insert all collected items
      for (const item of collectedItems) {
        const { error: insertError } = await supabase.from("content_suggestions").insert({
          source_url: item.url,
          original_title: `${item.isPrimary ? "⭐ " : ""}${item.title.substring(0, 500)}`,
          original_content: item.content.substring(0, 10000),
          status: "pending",
        });
        if (!insertError) {
          fetchedCount++;
          if (item.isPrimary) primaryCount++;
          searchResults.push(`${item.isPrimary ? "⭐ " : ""}[${item.category}] ${item.title.substring(0, 60)}`);
        }
      }
    }

    // Auto-trigger AI processing
    let approvedCount = 0;
    let totalProcessed = 0;

    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} trending items (${primaryCount} primary, ${dedupedCount} deduped, ${aiRejectedCount} AI-rejected), triggering AI processing...`);
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
        message: `Trending: ${fetchedCount} found (${primaryCount} primary), ${dedupedCount} deduped, ${aiRejectedCount} AI-rejected, ${approvedCount} approved`,
        fetched: fetchedCount,
        primary: primaryCount,
        deduped: dedupedCount,
        ai_rejected: aiRejectedCount,
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
