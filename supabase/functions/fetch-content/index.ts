import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract Twitter username from URL like https://x.com/OpenAI
function extractTwitterUsername(url: string): string | null {
  const match = url.match(/(?:x\.com|twitter\.com)\/(@?(\w+))/i);
  return match ? match[2] : null;
}

// Pre-filter obvious promotional/spam tweets before sending to AI
const SPAM_PATTERNS = [
  /\$\d[\d,]*\+?\s*(IN|OFF|FOR)/i,           // "$55,000+ IN", "$59/MO"
  /\b(GET|GRAB|CLAIM)\s+(YOUR|THIS|IT)\b/i,   // "Get your", "Grab this"
  /\b\d+H?\s*LEFT\b/i,                        // "16H LEFT", "24H LEFT"
  /LIMITED\s+(TIME|OFFER|SPOT)/i,              // "Limited time"
  /\bFREE\s+(ACCESS|TRIAL|DOWNLOAD)\b/i,      // "Free access"
  /🚀.*\$\d/,                                  // Emoji + price pattern
  /\bDISCOUNT\b.*\b\d+%/i,                    // "Discount 50%"
  /\b(HURRY|ACT\s+NOW|DON'T\s+MISS)\b/i,     // Urgency language
  /\b(SIGN\s+UP|SUBSCRIBE|JOIN)\s+(NOW|TODAY|HERE)\b/i, // CTA
  /\/mo\b.*\btools?\b/i,                       // "$X/mo tools"
];

function isPromotionalContent(text: string): boolean {
  const matchCount = SPAM_PATTERNS.filter(p => p.test(text)).length;
  // If 2+ patterns match, it's very likely promotional
  return matchCount >= 2;
}

// Build a meaningful title from tweet text (not just @handle — date)
function buildTweetTitle(username: string, text: string): string {
  // Remove URLs and @mentions for a cleaner title
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

// Fetch tweets from Twitter API v2 using search/recent
async function fetchTweetsForUsers(
  usernames: string[],
  bearerToken: string
): Promise<Array<{ username: string; text: string; id: string; created_at: string; url: string }>> {
  const tweets: Array<{ username: string; text: string; id: string; created_at: string; url: string }> = [];

  // Build query in batches (max query length ~512 chars for free tier)
  // Each "from:username" is ~20 chars, so ~20 users per batch
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
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Twitter API error (${response.status}):`, errText);
      continue;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log("No tweets found for batch");
      continue;
    }

    // Build author_id -> username map
    const userMap: Record<string, string> = {};
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap[user.id] = user.username;
      }
    }

    for (const tweet of data.data) {
      const username = userMap[tweet.author_id] || "unknown";
      tweets.push({
        username,
        text: tweet.text,
        id: tweet.id,
        created_at: tweet.created_at,
        url: `https://x.com/${username}/status/${tweet.id}`,
      });
    }

    // Small delay between batches to respect rate limits
    if (i + batchSize < usernames.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return tweets;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin password
    const adminPassword = req.headers.get("x-admin-password");
    const expectedPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || adminPassword !== expectedPassword) {
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

    // Get active sources
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

    let fetchedCount = 0;
    const errors: string[] = [];

    // Separate Twitter and website sources
    const twitterSources = sources.filter((s) => s.type === "twitter");
    const websiteSources = sources.filter((s) => s.type !== "twitter");

    // --- Handle Twitter sources via API ---
    if (twitterSources.length > 0 && TWITTER_BEARER_TOKEN) {
      try {
        const usernames = twitterSources
          .map((s) => extractTwitterUsername(s.url))
          .filter(Boolean) as string[];

        console.log(`Fetching tweets for ${usernames.length} users: ${usernames.join(", ")}`);

        const tweets = await fetchTweetsForUsers(usernames, TWITTER_BEARER_TOKEN);
        console.log(`Got ${tweets.length} tweets`);

        for (const tweet of tweets) {
          // Find the matching source
          const source = twitterSources.find((s) => {
            const u = extractTwitterUsername(s.url);
            return u?.toLowerCase() === tweet.username.toLowerCase();
          });

          if (!source) continue;

          // Pre-filter: skip obvious promotional/spam tweets
          if (isPromotionalContent(tweet.text)) {
            console.log(`Skipping promotional tweet from @${tweet.username}: ${tweet.text.substring(0, 60)}...`);
            continue;
          }

          // Check if we already have this tweet (by source_url)
          const { data: existing } = await supabase
            .from("content_suggestions")
            .select("id")
            .eq("source_url", tweet.url)
            .maybeSingle();

          if (existing) continue; // Skip duplicates

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_id: source.id,
              source_url: tweet.url,
              original_title: buildTweetTitle(tweet.username, tweet.text),
              original_content: tweet.text,
              status: "pending",
            });

          if (insertError) {
            console.error(`Insert error for tweet ${tweet.id}:`, insertError);
            errors.push(`Tweet ${tweet.id}: DB insert failed`);
          } else {
            fetchedCount++;
          }
        }
      } catch (err) {
        console.error("Twitter fetch error:", err);
        errors.push(`Twitter: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else if (twitterSources.length > 0 && !TWITTER_BEARER_TOKEN) {
      errors.push("Twitter: TWITTER_BEARER_TOKEN not configured, skipping Twitter sources");
    }

    // --- Handle website sources via Firecrawl ---
    if (websiteSources.length > 0 && FIRECRAWL_API_KEY) {
      for (const source of websiteSources) {
        try {
          console.log(`Fetching from: ${source.name} (${source.url})`);

          const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: source.url,
              formats: ["markdown"],
              onlyMainContent: true,
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            console.error(`Firecrawl error for ${source.url}:`, data);
            errors.push(`${source.name}: ${data.error || "Scrape failed"}`);
            continue;
          }

          const scrapedContent = data.data || data;
          const title = scrapedContent.metadata?.title || source.name;
          const content = scrapedContent.markdown || "";

          if (content.length > 50) {
            const { error: insertError } = await supabase
              .from("content_suggestions")
              .insert({
                source_id: source.id,
                source_url: source.url,
                original_title: title.substring(0, 500),
                original_content: content.substring(0, 10000),
                status: "pending",
              });

            if (insertError) {
              console.error(`Insert error for ${source.name}:`, insertError);
              errors.push(`${source.name}: DB insert failed`);
            } else {
              fetchedCount++;
            }
          }
        } catch (err) {
          console.error(`Error processing ${source.name}:`, err);
          errors.push(`${source.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }
    } else if (websiteSources.length > 0 && !FIRECRAWL_API_KEY) {
      errors.push("Firecrawl: FIRECRAWL_API_KEY not configured, skipping website sources");
    }

    return new Response(
      JSON.stringify({
        message: `Fetched content from ${fetchedCount} sources`,
        fetched: fetchedCount,
        total: sources.length,
        twitterFetched: twitterSources.length,
        websiteFetched: websiteSources.length,
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
