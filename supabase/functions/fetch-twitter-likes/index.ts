import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AI-relevance filter — only keep tweets related to AI/tech
const AI_KEYWORDS = [
  // English
  "ai", "artificial intelligence", "machine learning", "deep learning", "neural",
  "llm", "gpt", "chatgpt", "openai", "anthropic", "claude", "gemini", "mistral",
  "transformer", "diffusion", "stable diffusion", "midjourney", "dall-e", "dalle",
  "copilot", "cursor", "replit", "langchain", "rag", "vector", "embedding",
  "agent", "agentic", "multimodal", "foundation model", "fine-tune", "finetune",
  "prompt", "inference", "training", "model", "benchmark", "rlhf", "alignment",
  "generative", "text-to", "speech-to", "image generation", "video generation",
  "hugging face", "huggingface", "runway", "sora", "kling", "suno", "udio",
  "elevenlabs", "perplexity", "cohere", "groq", "scale ai", "sakana",
  "meta ai", "deepmind", "xai", "grok", "character.ai",
  "robotics", "autonomous", "computer vision", "nlp", "natural language",
  "token", "context window", "reasoning", "chain of thought", "cot",
  "agi", "superintelligence", "singularity",
  "automation", "no-code", "low-code", "saas", "startup", "tech",
  // Hebrew
  "בינה מלאכותית", "למידת מכונה", "למידה עמוקה", "מודל שפה", "רשת נוירונית",
  "סוכן", "סוכנים", "אוטומציה", "טכנולוגיה", "רובוט",
];

function isAiRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "source", "fbclid", "gclid"];
    trackingParams.forEach(p => u.searchParams.delete(p));
    u.hash = "";
    let normalized = u.toString().replace(/\/$/, "");
    normalized = normalized.replace(/\/\/www\./, "//");
    return normalized;
  } catch {
    return url.replace(/\/$/, "");
  }
}

// OAuth 1.0a signature for user-context endpoints (likes)
async function generateOAuth1Header(
  method: string,
  fullUrl: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // Parse URL to separate base URL and query params
  const urlObj = new URL(fullUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Combine OAuth params + query params for signature
  const allParams: Record<string, string> = { ...oauthParams };
  urlObj.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });

  // Sort ALL parameters and create signature base string
  const sortedParams = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  oauthParams.oauth_signature = signatureB64;

  const authHeader = "OAuth " + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(", ");

  return authHeader;
}
// AI editorial filter — check if a batch of tweets fit the site's voice
async function filterByEditorialFit(
  tweets: { text: string; username: string }[],
  LOVABLE_API_KEY: string
): Promise<Set<number>> {
  const validIndices = new Set<number>();
  if (tweets.length === 0) return validIndices;

  const tweetList = tweets
    .map((t, i) => `[${i}] @${t.username}: ${t.text.substring(0, 300)}`)
    .join("\n\n");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `אתה פילטר עריכה לאתר חדשות AI ישראלי פרימיום. האתר מתמקד ב:
- חידושים טכנולוגיים משמעותיים (השקות מוצרים, מודלים חדשים, פריצות דרך)
- כלים שימושיים עם ערך מעשי למפתחים ו-power users
- מגמות ויראליות אמיתיות בעולם ה-AI
- ניתוחים אסטרטגיים ותובנות מקצועיות

דחה (לא מתאים):
- תוכן שיווקי, קידום עצמי, או מכירת מוצרים
- שיחות חברתיות, בדיחות, ממים, דעות אישיות
- פוסטים ללא תוכן ענייני (רק לינק בלי הקשר)
- תוכן פיננסי/כלכלי (מניות, גיוסי הון, שווי שוק)
- מדריכים גנריים ושטחיים
- תוכן שהוא בעיקר self-promotion

החזר JSON בלבד: {"approved": [0, 2, 5]} — מערך של אינדקסים מאושרים. אם אף אחד לא מתאים: {"approved": []}`,
          },
          { role: "user", content: `סנן את הציוצים הבאים:\n\n${tweetList}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error(`Editorial filter API error: ${response.status}`);
      // On failure, approve all (fail-open for likes)
      tweets.forEach((_, i) => validIndices.add(i));
      return validIndices;
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const approved = parsed.approved || [];
      for (const idx of approved) {
        if (typeof idx === "number" && idx >= 0 && idx < tweets.length) {
          validIndices.add(idx);
        }
      }
    } else {
      // Can't parse — fail-open
      tweets.forEach((_, i) => validIndices.add(i));
    }
  } catch (err) {
    console.error("Editorial filter error:", err);
    // Fail-open
    tweets.forEach((_, i) => validIndices.add(i));
  }

  return validIndices;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
    const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    const TWITTER_USER_ID = Deno.env.get("TWITTER_USER_ID");

    if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET || !TWITTER_USER_ID) {
      return new Response(
        JSON.stringify({ error: "Twitter credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing URLs for dedup
    const { data: existingRows } = await supabase
      .from("content_suggestions")
      .select("source_url")
      .not("source_url", "is", null);

    const urlSet = new Set<string>();
    for (const row of (existingRows || [])) {
      if (row.source_url) {
        urlSet.add(row.source_url);
        urlSet.add(normalizeUrl(row.source_url));
      }
    }

    const isNewUrl = (url: string): boolean => {
      const normalized = normalizeUrl(url);
      return !urlSet.has(url) && !urlSet.has(normalized);
    };

    const markSeen = (url: string) => {
      urlSet.add(url);
      urlSet.add(normalizeUrl(url));
    };

    let fetchedCount = 0;
    let skippedCount = 0;
    let editorialRejected = 0;
    const errors: string[] = [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // --- Fetch Likes ---
    try {
      console.log("Fetching liked tweets...");
      const likesUrl = `https://api.x.com/2/users/${TWITTER_USER_ID}/liked_tweets`;
      const likesUrlWithParams = `${likesUrl}?tweet.fields=created_at,author_id,text,entities&expansions=author_id&user.fields=username&max_results=20`;

      const oauthHeader = await generateOAuth1Header(
        "GET",
        likesUrlWithParams,
        TWITTER_CONSUMER_KEY,
        TWITTER_CONSUMER_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET,
      );

      const likesResponse = await fetch(likesUrlWithParams, {
        headers: { Authorization: oauthHeader },
      });

      if (!likesResponse.ok) {
        const errText = await likesResponse.text();
        console.error(`Likes API error (${likesResponse.status}):`, errText);
        errors.push(`Likes: HTTP ${likesResponse.status} - ${errText.substring(0, 200)}`);
      } else {
        const likesData = await likesResponse.json();
        const tweets = likesData.data || [];
        console.log(`Got ${tweets.length} liked tweets`);

        // Build user map
        const userMap: Record<string, string> = {};
        if (likesData.includes?.users) {
          for (const user of likesData.includes.users) {
            userMap[user.id] = user.username;
          }
        }

        // Phase 1: Collect candidates (keyword filter)
        const candidates: {
          username: string;
          tweetUrl: string;
          title: string;
          content: string;
          text: string;
        }[] = [];

        for (const tweet of tweets) {
          const username = userMap[tweet.author_id] || "unknown";
          const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

          if (!isNewUrl(tweetUrl)) continue;

          const tweetText = tweet.text || "";
          if (!isAiRelated(tweetText)) {
            console.log(`⏭️ Skipped non-AI like: ${tweetText.substring(0, 60)}`);
            skippedCount++;
            continue;
          }

          // Extract external URLs
          const externalUrls: string[] = [];
          if (tweet.entities?.urls) {
            for (const urlEntity of tweet.entities.urls) {
              const expanded = urlEntity.expanded_url || urlEntity.url;
              if (expanded && !expanded.includes("x.com/") && !expanded.includes("twitter.com/")) {
                externalUrls.push(expanded);
              }
            }
          }

          const cleanText = tweetText.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
          const title = cleanText.length > 5
            ? `❤️ @${username}: ${cleanText.length > 100 ? cleanText.substring(0, 100) + "…" : cleanText}`
            : `❤️ @${username} — ציוץ`;

          const contentParts = [tweetText];
          if (externalUrls.length > 0) {
            contentParts.push("\n\nלינקים מהציוץ:\n" + externalUrls.join("\n"));
          }

          candidates.push({
            username,
            tweetUrl,
            title,
            content: contentParts.join(""),
            text: tweetText,
          });
        }

        // Phase 2: AI editorial filter (batch)
        let approvedIndices: Set<number>;
        if (LOVABLE_API_KEY && candidates.length > 0) {
          console.log(`🧠 Running editorial filter on ${candidates.length} candidates...`);
          approvedIndices = await filterByEditorialFit(
            candidates.map(c => ({ text: c.text, username: c.username })),
            LOVABLE_API_KEY
          );
          editorialRejected = candidates.length - approvedIndices.size;
          console.log(`📋 Editorial: ${approvedIndices.size} approved, ${editorialRejected} rejected`);
        } else {
          // No AI key — approve all (fallback)
          approvedIndices = new Set(candidates.map((_, i) => i));
        }

        // Phase 3: Save approved candidates
        for (let i = 0; i < candidates.length; i++) {
          if (!approvedIndices.has(i)) {
            console.log(`🚫 Editorial rejected: ${candidates[i].title.substring(0, 60)}`);
            skippedCount++;
            continue;
          }

          const c = candidates[i];
          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: c.tweetUrl,
              original_title: c.title,
              original_content: c.content,
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            markSeen(c.tweetUrl);
            console.log(`✅ Liked tweet saved: ${c.title.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.error("Likes fetch error:", err);
      errors.push(`Likes: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // --- Bookmarks skipped ---
    // Bookmarks endpoint requires OAuth 2.0 User Context (PKCE flow)
    // which is not supported in this simple edge function setup.

    return new Response(
      JSON.stringify({
        message: `Fetched ${fetchedCount} tweets (${skippedCount} filtered out, ${editorialRejected} by editorial)`,
        fetched: fetchedCount,
        skipped: skippedCount,
        editorial_rejected: editorialRejected,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("fetch-twitter-likes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
