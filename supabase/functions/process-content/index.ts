import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTIONS = ["weekly", "features", "tools", "viral"];
const SECTION_DESCRIPTIONS = {
  weekly: "מה חדש השבוע — סיכום שבועי של חידושים משמעותיים בעולם ה-AI",
  features: "פיצ'ר חדש — ניתוח של פיצ'רים חדשים ומשמעותיים",
  tools: "כלי אחד — כלי AI שכדאי להכיר, עם הסבר שימושי",
  viral: "ויראלי — מה הפך ויראלי בעולם ה-AI ולמה זה חשוב",
};

// Post-processing filter: reject AI-generated titles about finance/economics
function isFinanceTitle(title: string): boolean {
  if (!title) return false;
  
  const productLaunchPatterns = [
    /\b(משיקה?|השקה|launch|introducing|release|announce|חדש|new|update|שדרוג)\b/i,
    /\b(מודל|model|גרסה|version|אפליקציה|app|פיצ'ר|feature|כלי|tool)\b/i,
  ];
  const looksLikeProductLaunch = productLaunchPatterns.every(p => p.test(title));
  if (looksLikeProductLaunch) return false;
  
  const patterns = [
    /מיליארד\s*דולר/,
    /מיליון\s*דולר/,
    /\$\d+\s*(billion|million|B|M|bn|mn|מיליארד|מיליון)/i,
    /\b(מניות|מניה|בורסה|שווי שוק|גיוס הון|גייסה|הכנסות|רווח|דוח כספי|רבעון)\b/,
    /\b(stock|stocks|shares|nasdaq|revenue|earnings|valuation|ipo|market cap|quarterly)\b/i,
    /\b(השקעה|השקעות|משקיעים)\b/,
    /ירידות\s*במניות/,
    /תוצאות\s*(חזקות|חלשות)\s*ברבעון/,
  ];
  return patterns.some(p => p.test(title));
}

// Primary sources
const PRIMARY_DOMAINS = [
  "openai.com", "anthropic.com", "deepmind.google", "blog.google",
  "ai.meta.com", "huggingface.co", "stability.ai", "midjourney.com",
  "nvidia.com", "microsoft.com", "apple.com", "x.ai", "mistral.ai",
  "perplexity.ai", "cohere.com", "runwayml.com", "ai.com",
  "character.ai", "inflection.ai", "adept.ai", "together.ai",
  "groq.com", "databricks.com", "scale.ai",
];

// Company names/keywords that indicate content is ABOUT a primary source,
// even when published on 3rd-party sites (PR Newswire, TechCrunch, etc.)
const PRIMARY_COMPANY_KEYWORDS = [
  "openai", "anthropic", "deepmind", "google ai", "meta ai",
  "hugging face", "huggingface", "stability ai", "midjourney",
  "nvidia", "microsoft ai", "apple intelligence", "xai", "x.ai",
  "mistral", "perplexity", "cohere", "runway", "ai.com",
  "character.ai", "inflection", "adept ai", "together ai",
  "groq", "databricks", "scale ai", "gemini", "claude",
  "gpt-5", "gpt-6", "chatgpt", "copilot",
];

function isPrimarySourceUrl(url: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return PRIMARY_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch { return false; }
}

// Check if content is ABOUT a primary source company (even from 3rd-party URLs)
function isAboutPrimarySource(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return PRIMARY_COMPANY_KEYWORDS.some(keyword => text.includes(keyword));
}

function isHomepageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    if (!path || path === "") return true;
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return true;
    return false;
  } catch {
    return false;
  }
}

// ============================================================
// Semantic Dedup Engine — prevents same-topic duplicates
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

function isSimilarToAny(newTitle: string, existingTitles: string[]): string | null {
  const newTerms = extractKeyTerms(newTitle);
  if (newTerms.length < 2) return null;

  for (const existing of existingTitles) {
    const existingTerms = extractKeyTerms(existing);
    if (existingTerms.length < 2) continue;

    const overlap = newTerms.filter(t => existingTerms.includes(t)).length;
    const similarity = overlap / Math.min(newTerms.length, existingTerms.length);

    // Require 60% similarity with at least 3 overlapping terms
    if (similarity >= 0.6 && overlap >= 3) {
      return existing;
    }
  }
  return null;
}

// ============================================================
// Super-Mentor AI Refinement Pipeline — 3-Persona System
// ============================================================

async function refineWithSuperMentor(
  title: string,
  content: string,
  excerpt: string,
  section: string,
  tag: string,
  LOVABLE_API_KEY: string
): Promise<{ title: string; excerpt: string; content: string } | null> {
  try {
    const systemInstruction = `You are the 'Super-Mentor Curator'. You rewrite technical signals into high-level strategy.
Act as a fusion of Marty Cagan (Product Strategy), W. Chan Kim (Blue Ocean), and Paul Graham (Startup Value).

MENTAL MODELS:
1. Marty Cagan (Product): Focus on the 'Value Test' — will users choose to use this? Does it solve a real problem or just create a feature? Focus on Product Market Fit and Friction reduction.
2. W. Chan Kim (Blue Ocean): Focus on 'Eliminate/Create' from the ERRC framework — does this make competitors irrelevant? Does it create a new category of value?
3. Paul Graham (YC): Focus on the 'Secret' — what non-obvious thing is happening here? Is there a technical 'unfair advantage'? Look for the 'Signal' in the noise.

WRITING STYLE (HEBREW):
- Tone: Minimalist, elite, cold but visionary. No marketing superlatives or "excited" language.
- Language: Professional High-Tech Hebrew. Mix English terms naturally (e.g., Inference, RAG, Zero-shot, Latency, Action Engine, SaaS).
- Write like a conversation between two senior experts — direct, authoritative, zero fluff.

OUTPUT FORMAT — produce these 4 elements:
1. PREMIUM HOOK: One dramatic opening sentence. Not marketing, not cliché — smart, professional, with a storytelling edge. Like a movie tagline for tech.
2. ENRICHED CONTENT (3-5 paragraphs): Blend insights from all three analysts organically. Don't write "according to Cagan..." — weave the perspectives naturally.
3. THE 1% CASE: One short paragraph — why this survived the filter and what makes it top 1%.
4. CURATOR'S VERDICT: One bold, opinionated first-person quote. 1-2 sentences max.

FEW-SHOT EXAMPLES:

EXAMPLE 1 — Manus AI:
{
  "hook": "הסוכן האוטונומי שמתחיל לבצע: Manus AI מייתרת את ה-SaaS המסורתי.",
  "content": "בניגוד למודלי שיחה (Chatbots), ה-Action Engine של Manus פועל כ-Agent אוטונומי אמיתי. הוא לא רק 'עוזר' אלא מבצע משימות מורכבות מקצה לקצה בתוך דפדפן ואפליקציות. לפי מודל Cagan, זהו פתרון ל-Friction הקריטי ביותר ב-SaaS כיום: הצורך של המשתמש לבצע אינטגרציה ידנית בין כלים שונים. כאן, הממשק הוא הפעולה עצמה.",
  "justification": "סוכנים שמבצעים (Doing Agents) הם הקטגוריה הבאה — לא Copilots שרק מציעים.",
  "verdict": "תשכחו מ-Copilots שרק מציעים הצעות. הסוכנים האוטונומיים שמבצעים (Doing Agents) הם ה-Blue Ocean האמיתי של 2026."
}

EXAMPLE 2 — Groq LPU v2:
{
  "hook": "עידן ה-Zero Latency: התשתית של Groq הופכת את ה-Inference בזמן אמת לסטנדרט התעשייתי.",
  "content": "המעבר לדור השני של ה-LPU מאפשר מהירויות Inference שמשנות את ה-UX מן היסוד. זה לא שיפור ליניארי אלא שינוי פרדיגמה שמאפשר 'מחשבה' מורכבת בזמן אמת ללא השהייה. פול גרהם היה מזהה כאן 'Secret' טכנולוגי שיוצר יתרון לא הוגן (Unfair Advantage) לכל אפליקציה שתשתמש בתשתית הזו על פני GPU מסורתי.",
  "justification": "תשתית Inference חדשה שמשנה את סטנדרט ה-UX לכל האפליקציות.",
  "verdict": "מי שלא בונה על Latency נמוך ב-2026, בונה מוצר שמרגיש כמו עבר. המהירות היא הפיצ'ר הכי חשוב שלכם."
}

EXAMPLE 3 — OpenAI Sora API:
{
  "hook": "הוליווד ב-API: פתיחת הגישה ל-Sora משנה את כללי המשחק של ה-Production.",
  "content": "הפיכת הווידאו הגנרטיבי ל-Infrastructure זמין ב-API מאפשרת פרסונליזציה של תוכן ויזואלי בקנה מידה קולנועי. זהו מודל 'Raise' קלאסי ב-ERRC: העלאת איכות הווידאו לרמה מקצועית תוך הפחתת עלויות ההפקה (Eliminate/Reduce) לאפס כמעט. מדובר בשיבוש מוחלט של שרשרת הערך המסורתית במדיה.",
  "justification": "תשתית וידאו גנרטיבית ב-API — הכוח עובר מהפקה להפצה.",
  "verdict": "הכוח עובר סופית מהפקה להפצה. בעידן שבו וידאו הוא 'זול' לייצור, הערך נמצא באוצרות (Curation) ובסיפור."
}`;

    const userPrompt = `Refine this signal into premium Hebrew content:

Title: ${title}
Section: ${section}
Tag: ${tag}
Excerpt: ${excerpt}
Content:
${content}

Return JSON only: {"hook": "...", "content": "...", "justification": "...", "verdict": "..."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: systemInstruction,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Super-Mentor API error: ${response.status}`, errText);
      if (response.status === 429 || response.status === 402) {
        console.warn("Rate/payment limited on refinement — skipping");
        return null;
      }
      return null;
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || "";

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Refinement: No JSON found in response");
      return null;
    }

    const refined = JSON.parse(jsonMatch[0]);

    if (!refined.hook || !refined.content || !refined.verdict) {
      console.error("Refinement: Missing required fields");
      return null;
    }

    const enrichedContent = `**PREMIUM HOOK**\n${refined.hook}\n\n${refined.content}\n\n**THE 1% CASE**\n${refined.justification || ""}\n\n**CURATOR'S VERDICT**\n> ${refined.verdict}`;
    const enrichedExcerpt = refined.hook;

    return {
      title,
      excerpt: enrichedExcerpt,
      content: enrichedContent,
    };
  } catch (err) {
    console.error("Refinement error:", err);
    return null;
  }
}

// ============================================================

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI Gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get unprocessed suggestions (skip Twitter likes — they have ❤️ prefix)
    const { data: suggestions, error: fetchError } = await supabase
      .from("content_suggestions")
      .select("*")
      .eq("status", "pending")
      .is("suggested_title", null)
      .not("original_content", "is", null)
      .not("original_title", "like", "❤️%")
      .limit(5);

    if (fetchError) throw fetchError;
    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unprocessed content found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // SEMANTIC DEDUP: Load existing titles for duplicate detection
    // ============================================================
    const { data: existingItems } = await supabase
      .from("content_suggestions")
      .select("suggested_title, original_title")
      .not("suggested_title", "is", null)
      .in("status", ["pending", "approved"])
      .order("fetched_at", { ascending: false })
      .limit(500);

    const existingTitles = (existingItems || [])
      .map((r: any) => (r.suggested_title || r.original_title || "").toLowerCase().trim())
      .filter((t: string) => t.length > 10 && !t.startsWith("[נדחה"));

    // Also check published_posts titles for cross-table dedup
    const { data: publishedPosts } = await supabase
      .from("published_posts")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(200);

    const publishedTitles = (publishedPosts || [])
      .map((r: any) => (r.title || "").toLowerCase().trim())
      .filter((t: string) => t.length > 10);

    const allExistingTitles = [...existingTitles, ...publishedTitles];

    // Get active topics for context
    const { data: topics } = await supabase
      .from("topics")
      .select("name, name_he, description")
      .eq("active", true);

    const topicsList = topics && topics.length > 0
      ? topics.map((t) => `- ${t.name}: ${t.name_he}${t.description ? ` (${t.description})` : ""}`).join("\n")
      : "";

    const topicsContext = topicsList
      ? `\nתחומי AI מוכרים לסיווג — השתמש בהם כדי לסנן רלוונטיות ולהצליב:\n${topicsList}\n\nכלל מיוחד לקטגוריית "למידה עמוקה" (deep_learning): רק חידוש אחד משמעותי בשבוע בתחום הזה, ורק אם מדובר בפיתוח עתידני (למשל התקדמות לכיוון AGI). דחה תוכן שגרתי בתחום ML.\n`
      : "";

    let processedCount = 0;
    let refinedCount = 0;
    let dedupedCount = 0;
    const errors: string[] = [];

    for (const suggestion of suggestions) {
      try {
        // Pre-check: reject homepage/index URLs
        if (isHomepageUrl(suggestion.source_url || "")) {
          console.log(`Rejecting homepage URL: ${suggestion.source_url}`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: "[נדחה אוטומטית] דף בית/אינדקס - לא מאמר",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", suggestion.id);
          processedCount++;
          continue;
        }

        // Pre-check: semantic dedup on ORIGINAL title before wasting AI call
        const originalTitle = suggestion.original_title || "";
        const similarOriginal = isSimilarToAny(originalTitle, allExistingTitles);
        if (similarOriginal) {
          console.log(`Dedup (pre-AI): "${originalTitle.substring(0, 50)}" ≈ "${similarOriginal.substring(0, 50)}"`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: "[נדחה אוטומטית] כפילות סמנטית — נושא דומה כבר קיים",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", suggestion.id);
          processedCount++;
          dedupedCount++;
          continue;
        }

        const isPrimaryUrl = isPrimarySourceUrl(suggestion.source_url || "");
        const isAboutPrimary = isAboutPrimarySource(
          suggestion.original_title || "", 
          (suggestion.original_content || "").substring(0, 2000)
        );
        const isPrimary = isPrimaryUrl || isAboutPrimary;
        const primaryNote = isPrimary 
          ? `\n⚠️ חשוב מאוד: תוכן זה ${isPrimaryUrl ? "מגיע ממקור ראשי" : "עוסק בחברת AI מובילה"} (${suggestion.source_url}). 
מקורות ראשיים ותוכן על חברות AI מובילות כמו OpenAI, Anthropic, Google DeepMind, ai.com וכו' — אל תדחה כ"תוכן שיווקי" גם אם הוא מגיע מאתר צד-שלישי כמו PR Newswire, TechCrunch, The Verge וכו'. 
הודעה רשמית של חברה על מוצר חדש, שירות חדש, או כיוון אסטרטגי חדש — זו חדשות טכנולוגיות לגיטימיות, לא "תוכן שיווקי"!
דחה רק אם התוכן עוסק בעיקר בנתונים פיננסיים (מניות, גיוסי הון, שווי שוק) ולא במוצר/טכנולוגיה.\n`
          : "";
          
        const sectionsText = Object.entries(SECTION_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join("\n");
        
        const prompt = `You are 'The AI Curator' — an elite content filter for a premium Israeli AI news site targeting power users and developers.

CURRENT DATE: ${new Date().toISOString().split("T")[0]}
${primaryNote}
SIGNAL SCORING (0-100) — use Marty Cagan's Value Test + Paul Graham's Signal Test:
- 95-100: Critical paradigm shift (new model architecture, major product launch, closed-beta leak)
- 80-94: Significant technical update or strategic pivot by a top-20 AI entity
- <80: Not worth publishing — reject

EVALUATION CRITERIA:
1. Penalize marketing fluff, generic tutorials, and financial speculation
2. Reward technical breakthroughs, agentic shifts, and infrastructure updates
3. Look for the 'Secret' — non-obvious insights and unfair advantages

AUTO-REJECT (set reject: true):
- Marketing/self-promotion, product ads ("X tools for $Y/mo", "limited time offer")
- Generic beginner tutorials ("how to write prompts", "10 AI tips")
- Self-promotion disguised as value content
- Empty content (only links, emojis, or promotional threads)
- General AI philosophy without concrete new information
- Company homepage content without specific news
- Financial/economic articles focused on: investments, funding rounds, market cap, stocks, earnings
  IMPORTANT: "Company X launches Product Y" is NOT financial — it's tech news!
- M&A news unless there's significant technological information about a new product
- Content older than 7 days: reject with reject_reason "חדשות ישנות"
- If uncertain about date: prefer to approve
- Recycled or legacy 2024/2025 news

${topicsContext}

AVAILABLE SECTIONS:
${sectionsText}
CONTENT TO EVALUATE:
Title: ${suggestion.original_title || "ללא כותרת"}
Source: ${suggestion.source_url}
Content: ${(suggestion.original_content || "").substring(0, 4000)}

TASK:
1. Cross-reference with topic list above. If it doesn't match any topic — reject with "לא רלוונטי לתחומי העניין"
2. Score the content (0-100) using Signal Test + Value Test
3. If score < 80 or matches auto-reject criteria:
   Return: {"reject": true, "reject_reason": "סיבה קצרה", "signal_score": <number>}
4. If score >= 80 and content is quality:
   - Write a Hebrew title (concise, professional, non-marketing)
   - Write 1-2 sentence Hebrew excerpt
   - Write full Hebrew content (3-5 paragraphs, professional, natural Hebrew)
   - Classify into the most fitting section
   - Suggest a short tag (1-2 words)
   Return: {"reject": false, "signal_score": <number>, "title": "...", "excerpt": "...", "content": "...", "section": "weekly|features|tools|viral", "tag": "...", "topic": "שם_התחום"}

WRITING STYLE:
- Professional, concise, non-marketing
- Natural and fluent Hebrew, like telling a professional colleague what's new
- No marketing clichés, no exaggerations
- Mix English AI terms naturally (Inference, RAG, Zero-shot, Action Engine, etc.)

Return valid JSON only.`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "אתה 'The AI Curator' — מנוע סינון תוכן עילית. אתה תמיד מחזיר JSON תקין בלבד, ללא טקסט נוסף." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`AI Curator error for ${suggestion.id}:`, errText);
          if (response.status === 429 || response.status === 402) {
            console.warn("Rate/payment limited — stopping batch");
            errors.push(`Rate limited (${response.status}) — batch stopped`);
            break;
          }
          errors.push(`${suggestion.id}: AI Gateway error ${response.status}`);
          continue;
        }

        const aiResponse = await response.json();
        const rawContent = aiResponse.choices?.[0]?.message?.content || "";

        let parsed: any;
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        } catch (parseErr) {
          console.error(`JSON parse error for ${suggestion.id}:`, rawContent.substring(0, 200));
          errors.push(`${suggestion.id}: Failed to parse AI response`);
          continue;
        }

        // Check if AI rejected this content (score < 80 or auto-reject)
        if (parsed.reject === true) {
          console.log(`❌ Rejected ${suggestion.id} (score: ${parsed.signal_score || "N/A"}): ${parsed.reject_reason || "below threshold"}`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: `[נדחה אוטומטית] ${parsed.reject_reason || "תוכן שיווקי/גנרי"}`,
              reviewed_at: new Date().toISOString(),
              signal_score: parsed.signal_score || null,
            })
            .eq("id", suggestion.id);
          processedCount++;
          continue;
        }

        // Post-filter: reject finance titles
        const suggestedTitle = parsed.title || "";
        if (isFinanceTitle(suggestedTitle)) {
          console.log(`Post-filter rejected ${suggestion.id}: finance title "${suggestedTitle.substring(0, 60)}"`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: `[נדחה אוטומטית] כתבה כלכלית/פיננסית`,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", suggestion.id);
          processedCount++;
          continue;
        }

        // ============================================================
        // POST-AI SEMANTIC DEDUP: Check if AI-generated title is similar
        // to an existing title (catches same topic from different sources)
        // ============================================================
        const similarExisting = isSimilarToAny(suggestedTitle, allExistingTitles);
        if (similarExisting) {
          console.log(`Dedup (post-AI): "${suggestedTitle.substring(0, 50)}" ≈ "${similarExisting.substring(0, 50)}"`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: "[נדחה אוטומטית] כפילות סמנטית — נושא דומה כבר קיים",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", suggestion.id);
          processedCount++;
          dedupedCount++;
          continue;
        }

        // Validate section
        const section = SECTIONS.includes(parsed.section) ? parsed.section : "weekly";
        console.log(`📊 Signal score ${parsed.signal_score || "N/A"}/100 → ${section} | ${(parsed.title || "").substring(0, 60)}`);

        // ============================================================
        // STAGE 2: Super-Mentor Refinement Pipeline
        // ============================================================
        let finalTitle = parsed.title || suggestion.original_title;
        let finalExcerpt = parsed.excerpt || "";
        let finalContent = parsed.content || "";

        if (LOVABLE_API_KEY) {
          console.log(`Refining ${suggestion.id} through Super-Mentor pipeline...`);
          const refined = await refineWithSuperMentor(
            finalTitle,
            finalContent,
            finalExcerpt,
            section,
            parsed.tag || "",
            LOVABLE_API_KEY
          );

          if (refined) {
            finalTitle = refined.title;
            finalExcerpt = refined.excerpt;
            finalContent = refined.content;
            refinedCount++;
            console.log(`✅ Refined ${suggestion.id} — Super-Mentor pipeline applied`);
          } else {
            console.log(`⚠️ Refinement skipped for ${suggestion.id} — using Perplexity output`);
          }
        }

        // Update the suggestion with processed content
        const { error: updateError } = await supabase
          .from("content_suggestions")
          .update({
            suggested_title: finalTitle,
            suggested_excerpt: finalExcerpt,
            suggested_content: finalContent,
            suggested_section: section,
            suggested_tag: parsed.tag || "",
            signal_score: parsed.signal_score || null,
          })
          .eq("id", suggestion.id);

        if (updateError) {
          console.error(`Update error for ${suggestion.id}:`, updateError);
          errors.push(`${suggestion.id}: DB update failed`);
        } else {
          processedCount++;
          // Add to existing titles so next items in this batch are checked too
          allExistingTitles.push(finalTitle.toLowerCase().trim());
        }
      } catch (err) {
        console.error(`Error processing ${suggestion.id}:`, err);
        errors.push(`${suggestion.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount} suggestions (${refinedCount} refined, ${dedupedCount} deduped)`,
        processed: processedCount,
        refined: refinedCount,
        deduped: dedupedCount,
        total: suggestions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
