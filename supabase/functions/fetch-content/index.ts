import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// URL Normalization — ensures consistent dedup across all sources
// ============================================================
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking query params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "source", "queryly", "mc_cid", "mc_eid", "fbclid", "gclid"];
    trackingParams.forEach(p => u.searchParams.delete(p));
    // Remove hash
    u.hash = "";
    // Remove trailing slash
    let normalized = u.toString().replace(/\/$/, "");
    // Remove www.
    normalized = normalized.replace(/\/\/www\./, "//");
    return normalized;
  } catch {
    return url.replace(/\/$/, "");
  }
}

// Extract Twitter username from URL
function extractTwitterUsername(url: string): string | null {
  const match = url.match(/(?:x\.com|twitter\.com)\/(@?(\w+))/i);
  return match ? match[2] : null;
}

// Pre-filter obvious promotional/spam tweets
const SPAM_PATTERNS = [
  /\$\d[\d,]*\+?\s*(IN|OFF|FOR)/i,
  /\b(GET|GRAB|CLAIM)\s+(YOUR|THIS|IT)\b/i,
  /\b\d+H?\s*LEFT\b/i,
  /LIMITED\s+(TIME|OFFER|SPOT)/i,
  /\bFREE\s+(ACCESS|TRIAL|DOWNLOAD)\b/i,
  /🚀.*\$\d/,
  /\bDISCOUNT\b.*\b\d+%/i,
  /\b(HURRY|ACT\s+NOW|DON'T\s+MISS)\b/i,
  /\b(SIGN\s+UP|SUBSCRIBE|JOIN)\s+(NOW|TODAY|HERE)\b/i,
  /\/mo\b.*\btools?\b/i,
];

function isPromotionalContent(text: string): boolean {
  const matchCount = SPAM_PATTERNS.filter(p => p.test(text)).length;
  return matchCount >= 2;
}

function buildTweetTitle(username: string, text: string): string {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 5) {
    const title = cleaned.length > 100 ? cleaned.substring(0, 100) + "…" : cleaned;
    return `@${username}: ${title}`;
  }
  return `@${username} — ציוץ`;
}

// Semantic dedup — same as in process-content
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

async function fetchTweetsForUsers(
  usernames: string[],
  bearerToken: string
): Promise<Array<{ username: string; text: string; id: string; created_at: string; url: string }>> {
  const tweets: Array<{ username: string; text: string; id: string; created_at: string; url: string }> = [];
  const batchSize = 15;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const query = batch.map((u) => `from:${u}`).join(" OR ");
    console.log(`Fetching tweets with query: ${query}`);
    const params = new URLSearchParams({
      query,
      max_results: "20",
      "tweet.fields": "created_at,author_id,text",
      expansions: "author_id",
      "user.fields": "username",
    });
    const response = await fetch(
      `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Twitter API error (${response.status}):`, errText);
      continue;
    }
    const data = await response.json();
    if (!data.data || data.data.length === 0) { console.log("No tweets found for batch"); continue; }
    const userMap: Record<string, string> = {};
    if (data.includes?.users) {
      for (const user of data.includes.users) { userMap[user.id] = user.username; }
    }
    for (const tweet of data.data) {
      const username = userMap[tweet.author_id] || "unknown";
      tweets.push({
        username, text: tweet.text, id: tweet.id, created_at: tweet.created_at,
        url: `https://x.com/${username}/status/${tweet.id}`,
      });
    }
    if (i + batchSize < usernames.length) { await new Promise((r) => setTimeout(r, 1000)); }
  }
  return tweets;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const TWITTER_BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sources, error: sourcesError } = await supabase
      .from("sources")
      .select("*")
      .eq("active", true);

    if (sourcesError) throw sourcesError;
    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active sources found", fetched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect ALL existing URLs + titles once for dedup
    const { data: existingRows } = await supabase
      .from("content_suggestions")
      .select("source_url, original_title")
      .not("source_url", "is", null);

    const urlSet = new Set<string>();
    const titleList: string[] = [];
    for (const row of (existingRows || [])) {
      if (row.source_url) {
        urlSet.add(row.source_url);
        urlSet.add(normalizeUrl(row.source_url));
      }
      if (row.original_title && row.original_title.length > 10) {
        titleList.push(row.original_title.toLowerCase().trim());
      }
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
    const errors: string[] = [];

    const twitterSources = sources.filter((s) => s.type === "twitter");
    const websiteSources = sources.filter((s) => s.type !== "twitter");

    // --- Twitter sources ---
    if (twitterSources.length > 0 && TWITTER_BEARER_TOKEN) {
      try {
        const usernames = twitterSources
          .map((s) => extractTwitterUsername(s.url))
          .filter(Boolean) as string[];
        console.log(`Fetching tweets for ${usernames.length} users`);
        const tweets = await fetchTweetsForUsers(usernames, TWITTER_BEARER_TOKEN);
        console.log(`Got ${tweets.length} tweets`);

        for (const tweet of tweets) {
          const source = twitterSources.find((s) => {
            const u = extractTwitterUsername(s.url);
            return u?.toLowerCase() === tweet.username.toLowerCase();
          });
          if (!source) continue;
          if (isPromotionalContent(tweet.text)) continue;
          if (!isNewUrl(tweet.url)) continue;

          const title = buildTweetTitle(tweet.username, tweet.text);
          if (isSimilarToAny(title, titleList)) {
            console.log(`Dedup tweet: "${title.substring(0, 50)}"`);
            continue;
          }

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_id: source.id,
              source_url: tweet.url,
              original_title: title,
              original_content: tweet.text,
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            markSeen(tweet.url, title);
          }
        }
      } catch (err) {
        console.error("Twitter fetch error:", err);
        errors.push(`Twitter: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // --- Website sources via Firecrawl ---
    if (websiteSources.length > 0 && FIRECRAWL_API_KEY) {
      for (const source of websiteSources) {
        try {
          console.log(`Fetching from: ${source.name} (${source.url})`);
          const indexResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: source.url, formats: ["links"], onlyMainContent: true }),
          });

          const indexData = await indexResponse.json();
          if (!indexResponse.ok || !indexData.success) {
            errors.push(`${source.name}: ${indexData.error || "Index scrape failed"}`);
            continue;
          }

          const allLinks: string[] = indexData.data?.links || [];
          const baseUrl = new URL(source.url);
          const baseDomain = baseUrl.hostname;

          const articleLinks = allLinks.filter((link: string) => {
            try {
              const u = new URL(link);
              if (u.hostname !== baseDomain && !u.hostname.endsWith(`.${baseDomain}`)) return false;
              const path = u.pathname.toLowerCase();
              if (path === "/" || path === source.url.replace(`https://${baseDomain}`, "")) return false;
              if (path.includes("/careers") || path.includes("/pricing") || path.includes("/about") ||
                  path.includes("/contact") || path.includes("/login") || path.includes("/signup") ||
                  path.includes("/terms") || path.includes("/privacy") || path.includes("/legal") ||
                  path.includes("/docs/") || path.includes("/api/")) return false;
              const segments = path.split("/").filter(Boolean);
              if (segments.length < 2) return false;
              return true;
            } catch { return false; }
          });

          const topArticles = articleLinks.slice(0, 3);
          console.log(`Found ${articleLinks.length} article links from ${source.name}, processing top ${topArticles.length}`);

          if (topArticles.length === 0) {
            // Fallback: Firecrawl search
            try {
              const domain = new URL(source.url).hostname;
              const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: `site:${domain} AI news announcement`,
                  limit: 3,
                  scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
                }),
              });
              const searchData = await searchResponse.json();
              if (searchResponse.ok && searchData.success && searchData.data) {
                for (const result of searchData.data) {
                  if (!result.url) continue;
                  const normalizedUrl = normalizeUrl(result.url);
                  if (!isNewUrl(result.url)) continue;
                  const title = result.title || source.name;
                  if (isSimilarToAny(title, titleList)) continue;
                  const content = result.markdown || result.description || "";
                  if (content.length > 100) {
                    const { error: insertError } = await supabase.from("content_suggestions").insert({
                      source_id: source.id, source_url: normalizedUrl,
                      original_title: title.substring(0, 500), original_content: content.substring(0, 10000), status: "pending",
                    });
                    if (!insertError) { fetchedCount++; markSeen(normalizedUrl, title); }
                  }
                }
              }
            } catch (searchErr) {
              console.error(`Search fallback error for ${source.name}:`, searchErr);
            }
            continue;
          }

          for (const articleUrl of topArticles) {
            const normalizedUrl = normalizeUrl(articleUrl);
            if (!isNewUrl(articleUrl)) {
              console.log(`Skipping already fetched: ${articleUrl}`);
              continue;
            }

            try {
              const articleResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ url: articleUrl, formats: ["markdown"], onlyMainContent: true }),
              });

              const articleData = await articleResponse.json();
              if (!articleResponse.ok || !articleData.success) continue;

              const scrapedContent = articleData.data || articleData;
              const title = scrapedContent.metadata?.title || source.name;
              const content = scrapedContent.markdown || "";

              if (content.length < 100) continue;

              // Semantic dedup on title
              if (isSimilarToAny(title, titleList)) {
                console.log(`Dedup article: "${title.substring(0, 50)}"`);
                continue;
              }

              const { error: insertError } = await supabase
                .from("content_suggestions")
                .insert({
                  source_id: source.id,
                  source_url: normalizedUrl,
                  original_title: title.substring(0, 500),
                  original_content: content.substring(0, 10000),
                  status: "pending",
                });

              if (!insertError) {
                fetchedCount++;
                markSeen(normalizedUrl, title);
                console.log(`✅ Fetched article: ${title.substring(0, 60)}`);
              }
            } catch (articleErr) {
              console.error(`Error scraping article ${articleUrl}:`, articleErr);
            }
          }
        } catch (err) {
          console.error(`Error processing ${source.name}:`, err);
          errors.push(`${source.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Fetched content from ${fetchedCount} sources`,
        fetched: fetchedCount,
        total: sources.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
