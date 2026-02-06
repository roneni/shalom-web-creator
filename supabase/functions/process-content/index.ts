import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTIONS = ["weekly", "features", "tools", "viral"];
const SECTION_DESCRIPTIONS = {
  weekly: "מה חדש השבוע — סיכום שבועי של חידושים משמעותיים בעולם ה-AI",
  features: "פיצ'ר חדש — ניתוח של פיצ'רים חדשים ומשמעותיים",
  tools: "כלי אחד — כלי AI שכדאי להכיר, עם הסבר שימושי",
  viral: "ויראלי — מה הפך ויראלי בעולם ה-AI ולמה זה חשוב",
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

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Perplexity not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get unprocessed suggestions (have original content but no suggested content)
    const { data: suggestions, error: fetchError } = await supabase
      .from("content_suggestions")
      .select("*")
      .eq("status", "pending")
      .is("suggested_title", null)
      .not("original_content", "is", null)
      .limit(5);

    if (fetchError) throw fetchError;
    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unprocessed content found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active topics for context
    const { data: topics } = await supabase
      .from("topics")
      .select("name, name_he")
      .eq("active", true);

    const topicsContext = topics && topics.length > 0
      ? `נושאים מועדפים: ${topics.map((t) => t.name_he || t.name).join(", ")}`
      : "";

    let processedCount = 0;
    const errors: string[] = [];

    for (const suggestion of suggestions) {
      try {
        const prompt = `אתה עורך תוכן מקצועי לאתר חדשות AI בעברית המיועד ל-power users ומפתחים.

הסגנון שלך:
- תמציתי ומקצועי, לא שיווקי ולא מכירתי
- לא העתק-הדבק מהמקור — שכתוב במילים שלך
- כתוב כאילו אתה מספר לחבר מקצוען מה חדש
- בלי סיסמאות שיווקיות, בלי "שינוי כללי המשחק", בלי הגזמות
- עברית טבעית ורהוטה

סינון חובה — דחה את התוכן (reject: true) אם הוא:
- תוכן שיווקי, קידום עצמי, או מכירת מוצר/שירות (כולל "X tools for $Y/mo", "limited time offer", וכו')
- מדריך גנרי למתחילים (כמו "how to write prompts", "10 AI tips for beginners")
- תוכן שיווקי מוסווה כתוכן ערך (self-promotion של הפרופיל שפרסם)
- תוכן ריק מתוכן (רק קישורים, רק אימוג'ים, או שרשור קידומי)
- פילוסופיה כללית על AI ללא מידע חדש קונקרטי
- חדשות ישנות (מוצרים/פיצ'רים שהושקו לפני יותר משבוע). התאריך היום הוא ${new Date().toISOString().split("T")[0]}. אם המידע מתייחס לאירוע שקרה לפני יותר משבוע — דחה עם reject_reason "חדשות ישנות"
- תוכן כללי של דף בית של חברה ללא חדשות ספציפיות (כגון "Welcome to OpenAI", "Google Labs homepage")

${topicsContext}

המדורים האפשריים:
${Object.entries(SECTION_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

התוכן המקורי:
כותרת: ${suggestion.original_title || "ללא כותרת"}
מקור: ${suggestion.source_url}
תוכן: ${(suggestion.original_content || "").substring(0, 4000)}

משימה:
1. קודם כל, בדוק אם התוכן שיווקי/גנרי/ריק — אם כן, החזר {"reject": true, "reject_reason": "..."}
2. אם התוכן רלוונטי ואיכותי:
   - כתוב כותרת בעברית (קצרה, ברורה, לא שיווקית, מתארת את הנושא הספציפי)
   - כתוב תקציר של 1-2 משפטים בעברית
   - כתוב תוכן מלא בעברית (3-5 פסקאות, תמציתי ומקצועי)
   - סווג למדור המתאים ביותר מהרשימה
   - הצע תגית קצרה (1-2 מילים)

החזר את התשובה בפורמט JSON בלבד:
אם נדחה: {"reject": true, "reject_reason": "סיבה קצרה"}
אם מאושר: {"reject": false, "title": "...", "excerpt": "...", "content": "...", "section": "weekly|features|tools|viral", "tag": "..."}`;

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

        // Extract JSON from response
        let parsed: any;
        try {
          // Try to find JSON in the response
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

        // Check if AI rejected this content as promotional/generic
        if (parsed.reject === true) {
          console.log(`AI rejected ${suggestion.id}: ${parsed.reject_reason || "promotional/generic"}`);
          const { error: rejectError } = await supabase
            .from("content_suggestions")
            .update({
              status: "rejected",
              suggested_title: `[נדחה אוטומטית] ${parsed.reject_reason || "תוכן שיווקי/גנרי"}`,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", suggestion.id);
          if (rejectError) {
            console.error(`Reject update error for ${suggestion.id}:`, rejectError);
          } else {
            processedCount++;
          }
          continue;
        }

        // Validate section
        const section = SECTIONS.includes(parsed.section) ? parsed.section : "weekly";

        // Update the suggestion with processed content
        const { error: updateError } = await supabase
          .from("content_suggestions")
          .update({
            suggested_title: parsed.title || suggestion.original_title,
            suggested_excerpt: parsed.excerpt || "",
            suggested_content: parsed.content || "",
            suggested_section: section,
            suggested_tag: parsed.tag || "",
          })
          .eq("id", suggestion.id);

        if (updateError) {
          console.error(`Update error for ${suggestion.id}:`, updateError);
          errors.push(`${suggestion.id}: DB update failed`);
        } else {
          processedCount++;
        }
      } catch (err) {
        console.error(`Error processing ${suggestion.id}:`, err);
        errors.push(`${suggestion.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount} suggestions`,
        processed: processedCount,
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
