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

// Known RSS feed URLs for AI blogs
const RSS_FEEDS: Record<string, string> = {
  "openai.com": "https://openai.com/blog/rss.xml",
  "deepmind.google": "https://deepmind.google/blog/rss.xml",
  "blog.google": "https://blog.google/technology/ai/rss/",
  "huggingface.co": "https://huggingface.co/blog/feed.xml",
};

function parseRSSItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2] || "";
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"/) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || block.match(/<published>([\s\S]*?)<\/published>/) || block.match(/<updated>([\s\S]*?)<\/updated>/);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const title = (titleMatch?.[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const link = (linkMatch?.[1] || linkMatch?.[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const pubDate = (pubDateMatch?.[1] || "").trim();
    const description = (descMatch?.[1] || descMatch?.[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
    if (title && link) { items.push({ title, link, pubDate, description }); }
  }
  return items;
}

function isRecent(dateStr: string, days: number): boolean {
  if (!dateStr) return true;
  try {
    const date = new Date(dateStr);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date >= cutoff;
  } catch { return true; }
}

function isFinanceContent(title: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  const patterns = [
    /\b(stock|stocks|shares|nasdaq|s&p|dow jones|nyse|ipo|market cap)\b/i,
    /\b(מניות|מניה|בורסה|נאסד"ק|תל אביב 35|מדד)\b/,
    /\b(revenue|earnings|quarterly results|fiscal|valuation|投資)\b/i,
    /\b(הכנסות|רווח|הפסד|דוח כספי|שווי שוק|תחזית כלכלית)\b/,
    /\$\d+\s*(billion|million|B|M|bn|mn|מיליארד|מיליון)/i,
    /\b(invest|investment|investor|funding round|raised \$|funding)\b/i,
    /\b(השקעה|השקעות|משקיעים|גיוס הון|גייסה)\b/,
    /\b(dividend|hedge fund|venture capital|private equity)\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

function isIndexPage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    if (!path || path === "") return true;
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return true;
    const categoryPatterns = [
      /^\/category\//i, /^\/topics?\//i, /^\/tags?\//i,
      /^\/news\/?$/i, /^\/blog\/?$/i, /^\/technology\/?$/i, /^\/tech\/?$/i,
      /^\/artificial-intelligence\/?$/i, /\/ai\/?$/i,
    ];
    if (categoryPatterns.some((p) => p.test(path))) return true;
    if (path.endsWith("/about") || path.endsWith("/pricing") || 
        path.endsWith("/contact") || path.endsWith("/careers") ||
        path.endsWith("/products") || path.endsWith("/features")) return true;
    return false;
  } catch { return false; }
}

function buildSearchQueries(topics: Array<{ name: string; name_he: string; description: string | null }>): string[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();
  const dateContext = `${currentMonth} ${currentYear}`;
  
  const queryMap: Record<string, string> = {
    text_generation: `"text generation" OR "language model" new release announcement ${dateContext}`,
    image_generation: `"AI image generation" OR "image model" new launch ${dateContext}`,
    video_generation: `"AI video generation" OR "video model" new release ${dateContext}`,
    audio_generation: `"AI audio" OR "AI music" OR "AI voice" new tool ${dateContext}`,
    "3d_generation": `"AI 3D" OR "3D generation" model new ${dateContext}`,
    chatbots: `"AI chatbot" OR "AI assistant" launch announcement ${dateContext}`,
    translation: `"AI translation" OR "machine translation" new model ${dateContext}`,
    semantic_search: `"AI search" OR "semantic search" new technology ${dateContext}`,
    speech: `"speech recognition" OR "text to speech" AI new ${dateContext}`,
    object_detection: `"computer vision" OR "object detection" AI breakthrough ${dateContext}`,
    nocode_ai: `"no-code AI" OR "AI platform" new launch ${dateContext}`,
    model_training: `"model training" OR "fine-tuning" AI tool ${dateContext}`,
    prompt_engineering: `"prompt engineering" new technique ${dateContext}`,
    robotics: `"AI robotics" OR "humanoid robot" new launch ${dateContext}`,
    rpa: `"AI automation" OR "intelligent automation" new ${dateContext}`,
    data_analytics: `"AI analytics" OR "predictive AI" new tool ${dateContext}`,
    business_ai: `"enterprise AI" OR "AI for business" new ${dateContext}`,
    education_ai: `"AI education" OR "AI tutoring" new ${dateContext}`,
    security_ai: `"AI cybersecurity" OR "AI security" new tool ${dateContext}`,
    gaming_ai: `"AI gaming" OR "game AI" new ${dateContext}`,
    agi: `"AGI" OR "artificial general intelligence" breakthrough ${dateContext}`,
    multimodal: `"multimodal AI" OR "multimodal model" new release ${dateContext}`,
    ai_agents: `"AI agent" OR "autonomous agent" new release ${dateContext}`,
    neurosymbolic: `"neurosymbolic AI" OR "symbolic AI" new research ${dateContext}`,
    bci: `"brain computer interface" OR "neural interface" AI new ${dateContext}`,
    cloud_ai: `"cloud AI" service new launch ${dateContext}`,
    edge_ai: `"edge AI" OR "on-device AI" new ${dateContext}`,
    open_source: `"open source AI" OR "open source model" new release ${dateContext}`,
    finetuning_platforms: `"fine-tuning" OR "model customization" AI platform ${dateContext}`,
    deep_learning: `"deep learning" breakthrough frontier ${dateContext}`,
  };

  return topics
    .filter((t) => queryMap[t.name])
    .map((t) => queryMap[t.name]);
}

// ============================================================
// Discovery Mode: Build queries from filter tree selection
// ============================================================
interface EcosystemTarget {
  id: string;
  name: string;
  projects: string[];
}

// Ecosystem map matching the frontend tree
const ECOSYSTEM_MAP: Record<string, EcosystemTarget> = {
  openai: { id: "openai", name: "OpenAI", projects: ["GPT-5", "GPT-5.2", "o3", "ChatGPT"] },
  anthropic: { id: "anthropic", name: "Anthropic", projects: ["Claude 4", "Claude Opus", "Claude Sonnet"] },
  google_llm: { id: "google_llm", name: "Google DeepMind", projects: ["Gemini 3", "Gemini Ultra"] },
  meta_llm: { id: "meta_llm", name: "Meta AI", projects: ["Llama 4", "Code Llama"] },
  mistral: { id: "mistral", name: "Mistral AI", projects: ["Mistral Large", "Codestral", "Le Chat"] },
  xai: { id: "xai", name: "xAI", projects: ["Grok 3", "Grok Vision"] },
  characterai: { id: "characterai", name: "Character.AI", projects: ["Character Platform"] },
  inflection: { id: "inflection", name: "Inflection AI", projects: ["Pi"] },
  perplexity: { id: "perplexity", name: "Perplexity", projects: ["Perplexity Pro", "Perplexity Enterprise"] },
  cohere: { id: "cohere", name: "Cohere", projects: ["Command R+", "Embed v4", "Rerank"] },
  midjourney: { id: "midjourney", name: "Midjourney", projects: ["Midjourney v7", "Midjourney Editor"] },
  stability: { id: "stability", name: "Stability AI", projects: ["Stable Diffusion 4", "SDXL"] },
  ideogram: { id: "ideogram", name: "Ideogram", projects: ["Ideogram 3"] },
  flux: { id: "flux", name: "Black Forest Labs", projects: ["FLUX Pro", "FLUX 2"] },
  runway: { id: "runway", name: "Runway", projects: ["Gen-4", "Gen-3 Alpha"] },
  sora: { id: "sora", name: "OpenAI Sora", projects: ["Sora API", "Sora Turbo"] },
  pika: { id: "pika", name: "Pika Labs", projects: ["Pika 2.0"] },
  kling: { id: "kling", name: "Kuaishou", projects: ["Kling AI"] },
  veo: { id: "veo", name: "Google Veo", projects: ["Veo 3"] },
  adept: { id: "adept", name: "Adept AI", projects: ["ACT-2"] },
  devin: { id: "devin", name: "Cognition", projects: ["Devin 2"] },
  manus: { id: "manus", name: "Manus AI", projects: ["Manus Agent"] },
  openai_agents: { id: "openai_agents", name: "OpenAI Agents", projects: ["Operator", "Computer Use"] },
  anthropic_agents: { id: "anthropic_agents", name: "Anthropic Agents", projects: ["Claude Computer Use", "Claude MCP"] },
  figure: { id: "figure", name: "Figure AI", projects: ["Figure 02"] },
  tesla_bot: { id: "tesla_bot", name: "Tesla Bot", projects: ["Optimus Gen 3"] },
  boston: { id: "boston", name: "Boston Dynamics", projects: ["Atlas"] },
  together: { id: "together", name: "Together AI", projects: ["Together Inference", "Together Fine-tuning"] },
  databricks: { id: "databricks", name: "Databricks", projects: ["Mosaic ML", "DBRX"] },
  scale: { id: "scale", name: "Scale AI", projects: ["Scale Data Engine", "Scale Donovan"] },
  nvidia: { id: "nvidia", name: "NVIDIA", projects: ["H200", "B200", "CUDA", "NIM"] },
  groq: { id: "groq", name: "Groq", projects: ["LPU v2", "GroqCloud"] },
  cerebras: { id: "cerebras", name: "Cerebras", projects: ["CS-3", "Inference Cloud"] },
  apple_ai: { id: "apple_ai", name: "Apple Intelligence", projects: ["Apple Intelligence", "MLX"] },
  qualcomm: { id: "qualcomm", name: "Qualcomm", projects: ["Snapdragon X Elite", "AI Hub"] },
  huggingface: { id: "huggingface", name: "Hugging Face", projects: ["Transformers", "Hub", "Spaces"] },
  meta_open: { id: "meta_open", name: "Meta Open Source", projects: ["Llama 4", "NLLB"] },
  salesforce: { id: "salesforce", name: "Salesforce", projects: ["Einstein GPT", "Agentforce"] },
  microsoft_ai: { id: "microsoft_ai", name: "Microsoft AI", projects: ["Copilot", "Azure AI Studio"] },
  neuralink: { id: "neuralink", name: "Neuralink", projects: ["N1 Implant", "Telepathy"] },
};

const SUBFIELD_NAMES: Record<string, string> = {
  text_generation: "Text Generation",
  chatbots: "Chatbots & Assistants",
  translation: "Translation & Localization",
  semantic_search: "Search & RAG",
  image_generation: "Image Generation",
  video_generation: "Video Generation",
  "3d_generation": "3D Generation",
  object_detection: "Computer Vision",
  ai_agents: "AI Agents",
  rpa: "Process Automation",
  robotics: "Robotics",
  nocode_ai: "No-Code AI Platforms",
  model_training: "Model Training",
  cloud_ai: "Cloud AI Services",
  edge_ai: "Edge AI",
  open_source: "Open Source Models",
  finetuning_platforms: "Fine-tuning Platforms",
  business_ai: "Business AI",
  education_ai: "Education AI",
  security_ai: "Security AI",
  data_analytics: "Data & Analytics",
  gaming_ai: "Gaming AI",
  agi: "AGI Research",
  multimodal: "Multimodal AI",
  neurosymbolic: "Neurosymbolic AI",
  deep_learning: "Deep Learning",
  bci: "Brain-Computer Interfaces",
};

function buildDiscoveryQueries(subfields: string[], ecosystemIds: string[]): string[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dateContext = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const queries: string[] = [];

  // Ecosystem-level queries (most specific / highest priority)
  for (const ecoId of ecosystemIds) {
    const target = ECOSYSTEM_MAP[ecoId];
    if (!target) continue;
    const projectsStr = target.projects.slice(0, 3).map(p => `"${p}"`).join(" OR ");
    queries.push(`${target.name} ${projectsStr} launch OR release OR announcement ${dateContext}`);
  }

  // Subfield-level queries for subfields without ecosystem selection
  const coveredSubfields = new Set<string>();
  for (const ecoId of ecosystemIds) {
    // Find which subfield this ecosystem belongs to (not tracked here, just use subfield queries as fallback)
  }

  for (const subfieldId of subfields) {
    const name = SUBFIELD_NAMES[subfieldId] || subfieldId;
    queries.push(`"${name}" AI breakthrough OR release OR launch ${dateContext}`);
  }

  return queries;
}

// ============================================================
// AI Curator — Signal Scoring for pre-filtering
// ============================================================
async function aiCuratorFilter(
  items: Array<{ url: string; title: string; content: string }>,
  LOVABLE_API_KEY: string
): Promise<Array<{ url: string; title: string; content: string; signal_score: number; reject: boolean; reject_reason?: string }>> {
  if (!LOVABLE_API_KEY || items.length === 0) {
    return items.map(item => ({ ...item, signal_score: 85, reject: false }));
  }

  const itemsList = items.map((item, i) => 
    `[${i}] Title: ${item.title.substring(0, 200)}\nURL: ${item.url}\nContent: ${item.content.substring(0, 800)}`
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
            content: `You are 'The AI Curator' — an elite content filter for a premium AI news site.
Score each item 0-100 using Signal Test (Paul Graham) + Value Test (Marty Cagan).
95-100: Paradigm shift. 80-94: Significant update. <80: Reject.
AUTO-REJECT: marketing fluff, generic tutorials, financial speculation, old news, self-promotion.
Return JSON array only: [{"index": 0, "score": 92, "reject": false}, {"index": 1, "score": 45, "reject": true, "reason": "marketing fluff"}]`,
          },
          { role: "user", content: `Evaluate these ${items.length} items:\n\n${itemsList}` },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn(`AI Curator batch filter failed: ${response.status}`);
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
    console.error("AI Curator batch filter error:", err);
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
      const allowed = await checkRateLimit(supabase, "search-content", auth.userId, 10, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Parse body for discovery mode
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK */ }
    const isDiscoveryMode = body?.mode === "discovery";
    const discoverySubfields: string[] = body?.subfields || [];
    const discoveryEcosystem: string[] = body?.ecosystem || [];

    let fetchedCount = 0;
    let dedupedCount = 0;
    let aiRejectedCount = 0;
    const errors: string[] = [];
    const searchResults: string[] = [];

    // Collect ALL existing URLs + titles once for dedup
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

    // Helper: search and collect items
    async function searchAndCollect(query: string, label: string): Promise<Array<{ url: string; title: string; content: string }>> {
      const collected: Array<{ url: string; title: string; content: string }> = [];
      try {
        console.log(`${label}: "${query.substring(0, 80)}..."`);
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
        });

        const searchData = await searchResponse.json();
        if (!searchResponse.ok || !searchData.success) {
          errors.push(`${label}: ${searchData.error || "Failed"}`);
          return collected;
        }

        const results = searchData.data || [];
        for (const result of results) {
          const url = result.url;
          if (!url) continue;
          if (/reddit\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com|facebook\.com|wikipedia\.org/i.test(url)) continue;
          if (isIndexPage(url)) continue;
          if (!isNewUrl(url)) continue;

          const title = result.title || result.metadata?.title || "";
          const content = result.markdown || result.description || "";
          if (content.length < 200) continue;
          if (/^(AI News|Artificial Intelligence|Technology|Latest|Home|Blog)\s*[\|–—:]/i.test(title)) continue;
          if (isFinanceContent(title)) continue;
          if (isSimilarToAny(title, titleList)) { dedupedCount++; continue; }

          collected.push({ url: normalizeUrl(url), title, content: content.substring(0, 10000) });
        }
        console.log(`  → ${results.length} results, ${collected.length} passed filters`);
      } catch (err) {
        errors.push(`${label}: ${err instanceof Error ? err.message : "Error"}`);
      }
      return collected;
    }

    // ============================================================
    // DISCOVERY MODE: Use filter tree selections
    // ============================================================
    if (isDiscoveryMode) {
      console.log(`=== Discovery Mode: ${discoverySubfields.length} subfields, ${discoveryEcosystem.length} ecosystem targets ===`);
      const discoveryQueries = buildDiscoveryQueries(discoverySubfields, discoveryEcosystem);
      const shuffled = discoveryQueries.sort(() => Math.random() - 0.5);
      const selectedQueries = shuffled.slice(0, 6); // Cap at 6 to stay within timeout

      // Run queries in parallel batches of 3 for speed
      const allItems: Array<{ url: string; title: string; content: string }> = [];
      for (let i = 0; i < selectedQueries.length; i += 3) {
        const batch = selectedQueries.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(query => searchAndCollect(query, "Discovery"))
        );
        for (const items of batchResults) {
          allItems.push(...items);
        }
      }

      // AI Curator batch filter
      if (allItems.length > 0 && LOVABLE_API_KEY) {
        console.log(`AI Curator: evaluating ${allItems.length} discovery items...`);
        const evaluated = await aiCuratorFilter(allItems, LOVABLE_API_KEY);

        for (const item of evaluated) {
          if (item.reject) {
            aiRejectedCount++;
            console.log(`  ❌ Rejected (${item.signal_score}): ${item.title.substring(0, 50)} — ${item.reject_reason || "below threshold"}`);
            // Still insert as rejected for tracking
            await supabase.from("content_suggestions").insert({
              source_url: item.url,
              original_title: item.title.substring(0, 500),
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
            original_title: item.title.substring(0, 500),
            original_content: item.content.substring(0, 10000),
            status: "pending",
            signal_score: item.signal_score,
          });

          if (!insertError) {
            fetchedCount++;
            markSeen(item.url, item.title);
            searchResults.push(`🎯 Discovery: ${item.title.substring(0, 60)}`);
          }
        }
      } else {
        // No AI key — insert all
        for (const item of allItems) {
          const { error: insertError } = await supabase.from("content_suggestions").insert({
            source_url: item.url,
            original_title: item.title.substring(0, 500),
            original_content: item.content.substring(0, 10000),
            status: "pending",
          });
          if (!insertError) {
            fetchedCount++;
            markSeen(item.url, item.title);
            searchResults.push(`Discovery: ${item.title.substring(0, 60)}`);
          }
        }
      }
    } else {
      // ============================================================
      // STANDARD MODE: RSS + Topics + General search
      // ============================================================

      // === PART 1: Static RSS Feeds ===
      console.log("=== Fetching static RSS feeds ===");
      for (const [domain, feedUrl] of Object.entries(RSS_FEEDS)) {
        try {
          console.log(`RSS: Fetching ${domain}`);
          const rssResponse = await fetch(feedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 AI News Bot" },
          });
          if (!rssResponse.ok) { console.log(`RSS: ${domain} returned ${rssResponse.status}`); continue; }

          const xml = await rssResponse.text();
          const items = parseRSSItems(xml);
          const recentItems = items.filter((item) => isRecent(item.pubDate, 7)).slice(0, 5);

          for (const item of recentItems) {
            if (!isNewUrl(item.link)) continue;
            if (isIndexPage(item.link)) continue;
            if (isFinanceContent(item.title)) continue;
            if (isSimilarToAny(item.title, titleList)) { dedupedCount++; continue; }

            const content = item.description || item.title;
            if (content.length < 20) continue;

            const normalizedLink = normalizeUrl(item.link);
            const { error: insertError } = await supabase.from("content_suggestions").insert({
              source_url: normalizedLink,
              original_title: item.title.substring(0, 500),
              original_content: content.substring(0, 10000),
              status: "pending",
            });

            if (!insertError) {
              fetchedCount++;
              markSeen(normalizedLink, item.title);
              searchResults.push(`RSS [${domain}]: ${item.title.substring(0, 60)}`);
            }
          }
        } catch (err) {
          errors.push(`RSS ${domain}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }

      // === PART 1.5: Google Alerts RSS ===
      console.log("=== Fetching Google Alerts RSS feeds ===");
      const { data: rssSources } = await supabase
        .from("sources")
        .select("id, name, url")
        .eq("type", "google_alerts_rss")
        .eq("active", true);

      if (rssSources && rssSources.length > 0) {
        for (const source of rssSources) {
          try {
            const rssResponse = await fetch(source.url, {
              headers: { "User-Agent": "Mozilla/5.0 AI News Bot" },
            });
            if (!rssResponse.ok) continue;

            const xml = await rssResponse.text();
            const items = parseRSSItems(xml);
            const recentItems = items.filter((item) => isRecent(item.pubDate, 7)).slice(0, 10);

            let accepted = 0;
            for (const item of recentItems) {
              let articleUrl = item.link;
              try {
                const u = new URL(articleUrl);
                const realUrl = u.searchParams.get("url");
                if (realUrl) articleUrl = realUrl;
              } catch { /* keep original */ }

              const normalizedUrl = normalizeUrl(articleUrl);
              if (!isNewUrl(articleUrl)) continue;
              if (isIndexPage(articleUrl)) continue;
              if (isFinanceContent(item.title)) continue;

              const cleanTitle = item.title.replace(/<[^>]+>/g, "");
              if (isSimilarToAny(cleanTitle, titleList)) { dedupedCount++; continue; }

              const cleanDesc = (item.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              const content = cleanDesc || cleanTitle;
              if (content.length < 20) continue;

              const { error: insertError } = await supabase.from("content_suggestions").insert({
                source_id: source.id,
                source_url: normalizedUrl,
                original_title: cleanTitle.substring(0, 500),
                original_content: content.substring(0, 10000),
                status: "pending",
              });

              if (!insertError) {
                fetchedCount++;
                accepted++;
                markSeen(normalizedUrl, cleanTitle);
                searchResults.push(`Alert [${source.name}]: ${cleanTitle.substring(0, 60)}`);
              }
            }
            console.log(`  → ${accepted} accepted from ${source.name}`);
          } catch (err) {
            errors.push(`Alert ${source.name}: ${err instanceof Error ? err.message : "Error"}`);
          }
        }
      }

      // === PART 2: Active Topic Search ===
      console.log("=== Active topic search ===");
      const { data: topics } = await supabase
        .from("topics")
        .select("name, name_he, description")
        .eq("active", true);

      if (topics && topics.length > 0) {
        const allQueries = buildSearchQueries(topics);
        const shuffled = allQueries.sort(() => Math.random() - 0.5);
        const selectedQueries = shuffled.slice(0, 5);

        const topicItems: Array<{ url: string; title: string; content: string }> = [];
        for (const query of selectedQueries) {
          const items = await searchAndCollect(query, "Search");
          topicItems.push(...items);
          await new Promise((r) => setTimeout(r, 500));
        }

        // AI Curator batch filter for topic search results
        if (topicItems.length > 0 && LOVABLE_API_KEY) {
          console.log(`AI Curator: evaluating ${topicItems.length} topic items...`);
          const evaluated = await aiCuratorFilter(topicItems, LOVABLE_API_KEY);
          for (const item of evaluated) {
            if (item.reject) {
              aiRejectedCount++;
              await supabase.from("content_suggestions").insert({
                source_url: item.url,
                original_title: item.title.substring(0, 500),
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
              original_title: item.title.substring(0, 500),
              original_content: item.content.substring(0, 10000),
              status: "pending",
              signal_score: item.signal_score,
            });
            if (!insertError) {
              fetchedCount++;
              markSeen(item.url, item.title);
              searchResults.push(`Search: ${item.title.substring(0, 60)}`);
            }
          }
        } else {
          for (const item of topicItems) {
            const { error: insertError } = await supabase.from("content_suggestions").insert({
              source_url: item.url,
              original_title: item.title.substring(0, 500),
              original_content: item.content.substring(0, 10000),
              status: "pending",
            });
            if (!insertError) {
              fetchedCount++;
              markSeen(item.url, item.title);
              searchResults.push(`Search: ${item.title.substring(0, 60)}`);
            }
          }
        }
      }

      // === PART 3: General AI news search ===
      console.log("=== General AI news search ===");
      const now = new Date();
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const dateStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      
      const generalQueries = [
        `"AI" site:techcrunch.com OR site:theverge.com OR site:arstechnica.com ${dateStr}`,
        `"artificial intelligence" announcement launch site:venturebeat.com OR site:wired.com ${dateStr}`,
        `"AI model" OR "AI tool" release announcement this week ${dateStr}`,
      ];
      const generalQuery = generalQueries[Math.floor(Math.random() * generalQueries.length)];
      const generalItems = await searchAndCollect(generalQuery, "General");
      
      for (const item of generalItems) {
        const { error: insertError } = await supabase.from("content_suggestions").insert({
          source_url: item.url,
          original_title: item.title.substring(0, 500),
          original_content: item.content.substring(0, 10000),
          status: "pending",
        });
        if (!insertError) {
          fetchedCount++;
          markSeen(item.url, item.title);
          searchResults.push(`General: ${item.title.substring(0, 60)}`);
        }
      }
    }

    // === Auto-trigger processing ===
    let approvedCount = 0;
    let totalProcessed = 0;
    
    if (fetchedCount > 0) {
      console.log(`Found ${fetchedCount} new items (${dedupedCount} deduped, ${aiRejectedCount} AI-rejected), triggering AI processing...`);
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
        message: `${isDiscoveryMode ? "Discovery" : "Search"}: ${fetchedCount} found, ${dedupedCount} deduped, ${aiRejectedCount} AI-rejected, ${approvedCount} approved`,
        fetched: fetchedCount,
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
    console.error("search-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
