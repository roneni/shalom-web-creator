import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWITTER_BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN');
    const TWITTER_USER_ID = Deno.env.get('TWITTER_USER_ID');

    if (!TWITTER_BEARER_TOKEN) {
      return new Response(JSON.stringify({ error: 'TWITTER_BEARER_TOKEN not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!TWITTER_USER_ID) {
      return new Response(JSON.stringify({ error: 'TWITTER_USER_ID not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Minimal call: just get user info (no credits cost for likes)
    const userResponse = await fetch(
      `https://api.x.com/2/users/${TWITTER_USER_ID}?user.fields=name,username`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
      }
    );

    const userData = await userResponse.text();
    
    return new Response(JSON.stringify({
      status: userResponse.status,
      ok: userResponse.ok,
      data: JSON.parse(userData),
      message: userResponse.ok ? '✅ Twitter API credentials work!' : '❌ Auth failed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
