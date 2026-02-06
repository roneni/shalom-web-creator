import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u0590-\u05FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80) + "-" + Date.now().toString(36);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, suggestionId, updates } = await req.json();

    if (!action || !suggestionId) {
      return new Response(
        JSON.stringify({ error: "action and suggestionId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
      // Get the suggestion
      const { data: suggestion, error: fetchError } = await supabase
        .from("content_suggestions")
        .select("*")
        .eq("id", suggestionId)
        .single();

      if (fetchError || !suggestion) {
        return new Response(
          JSON.stringify({ error: "Suggestion not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const title = updates?.title || suggestion.suggested_title || suggestion.original_title || "ללא כותרת";
      const slug = generateSlug(title);

      // Create published post
      const { error: insertError } = await supabase.from("published_posts").insert({
        suggestion_id: suggestion.id,
        slug,
        title,
        excerpt: updates?.excerpt || suggestion.suggested_excerpt || "",
        content: updates?.content || suggestion.suggested_content || "",
        section: updates?.section || suggestion.suggested_section || "weekly",
        tag: updates?.tag || suggestion.suggested_tag || "",
        source_url: suggestion.source_url || null,
        published: true,
      });

      if (insertError) throw insertError;

      // Update suggestion status
      const { error: updateError } = await supabase
        .from("content_suggestions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", suggestionId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ message: "Post approved and published", slug }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reject") {
      const { error: updateError } = await supabase
        .from("content_suggestions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", suggestionId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ message: "Suggestion rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      // Update suggestion fields (for editing before approval)
      if (!updates) {
        return new Response(
          JSON.stringify({ error: "updates object is required for update action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateFields: Record<string, any> = {};
      if (updates.title) updateFields.suggested_title = updates.title;
      if (updates.excerpt) updateFields.suggested_excerpt = updates.excerpt;
      if (updates.content) updateFields.suggested_content = updates.content;
      if (updates.section) updateFields.suggested_section = updates.section;
      if (updates.tag) updateFields.suggested_tag = updates.tag;

      const { error: updateError } = await supabase
        .from("content_suggestions")
        .update(updateFields)
        .eq("id", suggestionId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ message: "Suggestion updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: approve, reject, update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-posts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
