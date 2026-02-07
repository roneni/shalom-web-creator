import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { action, sourceId, source } = await req.json();

    if (action === "add") {
      if (!source?.name || !source?.type || !source?.url) {
        return new Response(
          JSON.stringify({ error: "name, type, and url are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sources")
        .insert({
          name: source.name,
          type: source.type,
          url: source.url,
          active: source.active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Source added", source: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle") {
      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: "sourceId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: current, error: fetchError } = await supabase
        .from("sources")
        .select("active")
        .eq("id", sourceId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("sources")
        .update({ active: !current.active })
        .eq("id", sourceId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ message: `Source ${current.active ? "disabled" : "enabled"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: "sourceId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("sources")
        .delete()
        .eq("id", sourceId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Source deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      if (!sourceId || !source) {
        return new Response(
          JSON.stringify({ error: "sourceId and source are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateFields: Record<string, unknown> = {};
      if (source.name !== undefined) updateFields.name = source.name;
      if (source.url !== undefined) updateFields.url = source.url;
      if (source.type !== undefined) updateFields.type = source.type;
      if (source.active !== undefined) updateFields.active = source.active;

      const { error } = await supabase
        .from("sources")
        .update(updateFields)
        .eq("id", sourceId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Source updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: add, toggle, delete, update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manage-sources error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
