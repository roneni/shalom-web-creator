import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function validateAdminAuth(req: Request): Promise<{ ok: boolean; userId: string; error?: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (bearerToken === serviceRoleKey) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateAdminAuth(req);
    if (!auth.ok) return auth.error!;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, suggestionId, updates } = body;

    // Input validation
    if (typeof action !== "string" || typeof suggestionId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid input types" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject dangerous HTML patterns in content updates
    if (updates) {
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
      ];
      const fieldsToCheck = ["content", "title", "excerpt"];
      for (const field of fieldsToCheck) {
        if (updates[field] && dangerousPatterns.some(p => p.test(updates[field]))) {
          return new Response(
            JSON.stringify({ error: "Content contains potentially dangerous HTML" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!action || !suggestionId) {
      return new Response(
        JSON.stringify({ error: "action and suggestionId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
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
      const content = updates?.content || suggestion.suggested_content || "";
      const excerpt = updates?.excerpt || suggestion.suggested_excerpt || "";

      if (!content || content.trim().length < 10) {
        return new Response(
          JSON.stringify({ error: "Cannot publish a post without content. Please process or edit the suggestion first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const slug = generateSlug(title);
      const sourceUrl = suggestion.source_url || null;

      const { error: insertError } = await supabase.from("published_posts").insert({
        suggestion_id: suggestion.id,
        slug,
        title,
        excerpt,
        content,
        section: updates?.section || suggestion.suggested_section || "weekly",
        tag: updates?.tag || suggestion.suggested_tag || "",
        source_url: sourceUrl,
        published: true,
      });

      if (insertError) throw insertError;

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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
