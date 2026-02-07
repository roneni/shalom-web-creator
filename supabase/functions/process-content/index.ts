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
    const refinementPrompt = `אתה פאנל של שלושה אנליסטים ברמה עולמית בתעשיית ה-AI. כל אחד מהם מנתח את הידיעה הבאה דרך העדשה המקצועית שלו:

🔬 **מרטי קייגן** (Marty Cagan — ערך מוצרי): מה הערך המוצרי האמיתי כאן? מה ה-ROI למשתמשים? האם זה פותר בעיה אמיתית או רק "פיצ'ר בשביל פיצ'ר"?

🌊 **וו. צ'אן קים** (W. Chan Kim — Blue Ocean): איך הכלי/טכנולוגיה הזו מבטלת חיכוך קיים בשוק? האם זה יוצר ערך חדש שלא היה קיים? מה ה-"אוקיינוס הכחול" כאן?

🚀 **פול גרהאם** (Paul Graham — YC Signal): מה הסיגנל הסטארטאפי המוקדם כאן? האם זה נראה כמו "המנצח הגדול הבא"? מה הדפוס שמזכיר הצלחות קודמות?

---
הידיעה לזיקוק:
כותרת: ${title}
מדור: ${section}
תגית: ${tag}
תקציר: ${excerpt}
תוכן:
${content}
---

המשימה שלך — צור גרסה מזוקקת ופרימיום של הידיעה:

1. **הוק קולנועי** (PREMIUM HOOK): משפט פתיחה אחד דרמטי, ציורי, שגורם לקורא להרגיש שהוא חייב להמשיך לקרוא. לא שיווקי ולא קלישאתי — אלא חכם, מקצועי, עם נימה של סיפור. דוגמאות לסגנון:
   - "כשכל העולם עוד מדבר על צ'אטבוטים, אנתרופיק כבר בנתה את CLI שלה מטיפוסי משגר לחדר המלחמה האוטונומי של Agent Teams."
   - "אם עד היום הייתם 'הידיים' על המקלדת, מהיום אתם המנכ"ל."

2. **תוכן מועשר** (3-5 פסקאות): שלב תובנות מכל שלושת האנליסטים באופן טבעי בתוך הטקסט. אל תכתוב "לפי מרטי קייגן..." — פשוט שלב את הזוויות בצורה אורגנית. הטון: מקצועי, ישיר, כמו שיחה בין שני מומחים. עברית טבעית ורהוטה.

3. **הצדקת ה-1%** (THE 1% CASE): פסקה אחת קצרה — למה הידיעה הזו שרדה את הפילטר ומה עושה אותה לאחוז העליון של מה שקורה ב-AI עכשיו.

4. **פסק דין האוצר** (CURATOR'S VERDICT): ציטוט אחד נועז ומקצועי, בגוף ראשון, שמסכם את החשיבות של הידיעה. 1-2 משפטים בלבד. דוגמה:
   - "ההשוואה השתנתה: ה-Execution הפך לקומודיטי. אם אתם עדיין שוכרים צוותים שלמים רק כדי להעביר פיקסלים למסך, אתם משחקים את המשחק הישן."

החזר JSON בלבד:
{
  "hook": "ההוק הקולנועי",
  "content": "התוכן המועשר עם תובנות 3 האנליסטים",
  "justification": "הצדקת ה-1%",
  "verdict": "פסק דין האוצר"
}`;

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
            content: "אתה מנוע זיקוק תוכן פרימיום. אתה כותב עברית ברמה הגבוהה ביותר — טבעית, רהוטה, מקצועית, כמעט אנושית לגמרי. אתה לא משתמש בקלישאות שיווקיות. אתה תמיד מחזיר JSON תקין בלבד.",
          },
          { role: "user", content: refinementPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Refinement API error: ${response.status}`, errText);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateAdminAuth(req);
    if (!auth.ok) return auth.error!;

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Perplexity not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
          
        const prompt = `אתה עורך תוכן מקצועי לאתר חדשות AI בעברית המיועד ל-power users ומפתחים.
${primaryNote}
הסגנון שלך:
- תמציתי ומקצועי, לא שיווקי ולא מכירתי
- לא העתק-הדבק מהמקור — שכתוב במילים שלך
- כתוב כאילו אתה מספר לחבר מקצוען מה חדש
- בלי סיסמאות שיווקיות, בלי "שינוי כללי המשחק", בלי הגזמות
- עברית טבעית ורהוטה

סינון חובה — דחה את התוכן (reject: true) אם הוא:
- תוכן שיווקי, קידום עצמי, או מכירת מוצר/שירות (כמו "X tools for $Y/mo", "limited time offer"). חשוב: הודעה רשמית מחברת AI על מוצר חדש שלה היא לא תוכן שיווקי — זו חדשות!
- מדריך גנרי למתחילים (כמו "how to write prompts", "10 AI tips for beginners")
- תוכן שיווקי מוסווה כתוכן ערך (self-promotion של הפרופיל שפרסם)
- תוכן ריק מתוכן (רק קישורים, רק אימוג'ים, או שרשור קידומי)
- פילוסופיה כללית על AI ללא מידע חדש קונקרטי
- תוכן כללי של דף בית של חברה ללא חדשות ספציפיות (כגון "Welcome to OpenAI", "Google Labs homepage")
- כתבות כלכליות/פיננסיות שעוסקות בעיקר ב: השקעות, גיוסי הון, שווי שוק, מניות, בורסה, דוחות כספיים, הכנסות חברות. חשוב: "חברה X משיקה מוצר Y" — זו לא כתבה כלכלית! כתבה כלכלית היא כזו שהמוקד שלה הוא כסף ומספרים פיננסיים.
- חדשות על מיזוגים, רכישות, או עסקאות עסקיות (M&A) אלא אם יש בהן מידע טכנולוגי משמעותי על מוצר חדש

חוק טריות — התאריך היום הוא ${new Date().toISOString().split("T")[0]}:
- תוכן שפורסם ב-7 הימים האחרונים: מותר בכל המדורים
- תוכן ישן יותר מ-7 ימים: דחה עם reject_reason "חדשות ישנות"
- אם אתה לא בטוח לגבי התאריך, העדף לאשר (אל תדחה בספק)

${topicsContext}

המדורים האפשריים:
${Object.entries(SECTION_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

התוכן המקורי:
כותרת: ${suggestion.original_title || "ללא כותרת"}
מקור: ${suggestion.source_url}
תוכן: ${(suggestion.original_content || "").substring(0, 4000)}

משימה:
1. קודם כל, הצלב את התוכן עם רשימת התחומים למעלה. אם הוא לא נופל באף תחום — דחה עם reject_reason "לא רלוונטי לתחומי העניין"
2. בדוק אם התוכן שיווקי/גנרי/ריק — אם כן, החזר {"reject": true, "reject_reason": "..."}
3. אם התוכן רלוונטי ואיכותי:
   - כתוב כותרת בעברית (קצרה, ברורה, לא שיווקית, מתארת את הנושא הספציפי)
   - כתוב תקציר של 1-2 משפטים בעברית
   - כתוב תוכן מלא בעברית (3-5 פסקאות, תמציתי ומקצועי)
   - סווג למדור המתאים ביותר מהרשימה
   - הצע תגית קצרה (1-2 מילים)
   - ציין את התחום הרלוונטי מהרשימה בשדה topic

החזר את התשובה בפורמט JSON בלבד:
אם נדחה: {"reject": true, "reject_reason": "סיבה קצרה"}
אם מאושר: {"reject": false, "title": "...", "excerpt": "...", "content": "...", "section": "weekly|features|tools|viral", "tag": "...", "topic": "שם_התחום"}`;

        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: "You are a professional Hebrew content editor. Always respond with valid JSON only, no extra text." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Perplexity error for ${suggestion.id}:`, errText);
          errors.push(`${suggestion.id}: Perplexity API error ${response.status}`);
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
          console.error(`JSON parse error for ${suggestion.id}:`, rawContent);
          errors.push(`${suggestion.id}: Failed to parse AI response`);
          continue;
        }

        // Check if AI rejected this content
        if (parsed.reject === true) {
          console.log(`AI rejected ${suggestion.id}: ${parsed.reject_reason || "promotional/generic"}`);
          await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: `[נדחה אוטומטית] ${parsed.reject_reason || "תוכן שיווקי/גנרי"}`,
              reviewed_at: new Date().toISOString(),
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
