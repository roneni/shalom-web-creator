import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// OAuth 1.0a signature for user-context endpoints (likes, bookmarks)
async function generateOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Sort parameters and create signature base string
  const sortedParams = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
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

  params.oauth_signature = signatureB64;

  const authHeader = "OAuth " + Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(", ");

  return authHeader;
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

    const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID");
    const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET");
    const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    const TWITTER_USER_ID = Deno.env.get("TWITTER_USER_ID");

    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET || !TWITTER_USER_ID) {
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
    const errors: string[] = [];

    // --- Fetch Likes ---
    try {
      console.log("Fetching liked tweets...");
      const likesUrl = `https://api.x.com/2/users/${TWITTER_USER_ID}/liked_tweets`;
      const likesUrlWithParams = `${likesUrl}?tweet.fields=created_at,author_id,text,entities&expansions=author_id&user.fields=username&max_results=20`;

      const oauthHeader = await generateOAuth1Header(
        "GET",
        likesUrl, // Sign without query params
        TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET,
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

        for (const tweet of tweets) {
          const username = userMap[tweet.author_id] || "unknown";
          const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

          if (!isNewUrl(tweetUrl)) continue;

          // Extract any external URLs from tweet entities
          const externalUrls: string[] = [];
          if (tweet.entities?.urls) {
            for (const urlEntity of tweet.entities.urls) {
              const expanded = urlEntity.expanded_url || urlEntity.url;
              if (expanded && !expanded.includes("x.com/") && !expanded.includes("twitter.com/")) {
                externalUrls.push(expanded);
              }
            }
          }

          const text = tweet.text || "";
          const cleanText = text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
          const title = cleanText.length > 5
            ? `❤️ @${username}: ${cleanText.length > 100 ? cleanText.substring(0, 100) + "…" : cleanText}`
            : `❤️ @${username} — ציוץ`;

          const contentParts = [text];
          if (externalUrls.length > 0) {
            contentParts.push("\n\nלינקים מהציוץ:\n" + externalUrls.join("\n"));
          }

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: tweetUrl,
              original_title: title,
              original_content: contentParts.join(""),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            markSeen(tweetUrl);
            console.log(`✅ Liked tweet saved: ${title.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.error("Likes fetch error:", err);
      errors.push(`Likes: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // --- Fetch Bookmarks ---
    try {
      console.log("Fetching bookmarked tweets...");
      const bookmarksUrl = `https://api.x.com/2/users/${TWITTER_USER_ID}/bookmarks`;
      const bookmarksUrlWithParams = `${bookmarksUrl}?tweet.fields=created_at,author_id,text,entities&expansions=author_id&user.fields=username&max_results=20`;

      const oauthHeader = await generateOAuth1Header(
        "GET",
        bookmarksUrl,
        TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET,
      );

      const bookmarksResponse = await fetch(bookmarksUrlWithParams, {
        headers: { Authorization: oauthHeader },
      });

      if (!bookmarksResponse.ok) {
        const errText = await bookmarksResponse.text();
        console.error(`Bookmarks API error (${bookmarksResponse.status}):`, errText);
        errors.push(`Bookmarks: HTTP ${bookmarksResponse.status} - ${errText.substring(0, 200)}`);
      } else {
        const bookmarksData = await bookmarksResponse.json();
        const tweets = bookmarksData.data || [];
        console.log(`Got ${tweets.length} bookmarked tweets`);

        const userMap: Record<string, string> = {};
        if (bookmarksData.includes?.users) {
          for (const user of bookmarksData.includes.users) {
            userMap[user.id] = user.username;
          }
        }

        for (const tweet of tweets) {
          const username = userMap[tweet.author_id] || "unknown";
          const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

          if (!isNewUrl(tweetUrl)) continue;

          const externalUrls: string[] = [];
          if (tweet.entities?.urls) {
            for (const urlEntity of tweet.entities.urls) {
              const expanded = urlEntity.expanded_url || urlEntity.url;
              if (expanded && !expanded.includes("x.com/") && !expanded.includes("twitter.com/")) {
                externalUrls.push(expanded);
              }
            }
          }

          const text = tweet.text || "";
          const cleanText = text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
          const title = cleanText.length > 5
            ? `🔖 @${username}: ${cleanText.length > 100 ? cleanText.substring(0, 100) + "…" : cleanText}`
            : `🔖 @${username} — ציוץ`;

          const contentParts = [text];
          if (externalUrls.length > 0) {
            contentParts.push("\n\nלינקים מהציוץ:\n" + externalUrls.join("\n"));
          }

          const { error: insertError } = await supabase
            .from("content_suggestions")
            .insert({
              source_url: tweetUrl,
              original_title: title,
              original_content: contentParts.join(""),
              status: "pending",
            });

          if (!insertError) {
            fetchedCount++;
            markSeen(tweetUrl);
            console.log(`✅ Bookmarked tweet saved: ${title.substring(0, 60)}`);
          }
        }
      }
    } catch (err) {
      console.error("Bookmarks fetch error:", err);
      errors.push(`Bookmarks: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    return new Response(
      JSON.stringify({
        message: `Fetched ${fetchedCount} tweets from likes & bookmarks`,
        fetched: fetchedCount,
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
