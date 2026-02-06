import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    for (const source of sources) {
      try {
        console.log(`Fetching from: ${source.name} (${source.url})`);

        let scrapedContent: any = null;

        if (source.type === "twitter") {
          // For Twitter/X, scrape the profile page
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
          if (response.ok && data.success) {
            scrapedContent = data.data || data;
          } else {
            console.error(`Firecrawl error for ${source.url}:`, data);
            errors.push(`${source.name}: ${data.error || "Scrape failed"}`);
            continue;
          }
        } else {
          // For websites, scrape main content
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
          if (response.ok && data.success) {
            scrapedContent = data.data || data;
          } else {
            console.error(`Firecrawl error for ${source.url}:`, data);
            errors.push(`${source.name}: ${data.error || "Scrape failed"}`);
            continue;
          }
        }

        if (scrapedContent) {
          const title = scrapedContent.metadata?.title || source.name;
          const content = scrapedContent.markdown || "";

          // Only save if there's meaningful content
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
        }
      } catch (err) {
        console.error(`Error processing ${source.name}:`, err);
        errors.push(`${source.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
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
