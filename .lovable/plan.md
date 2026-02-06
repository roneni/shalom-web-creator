

# מערכת שליפת תוכן אוטומטית + דשבורד אישור

## מה נבנה

מערכת שלמה שעושה את הדברים הבאים:
1. שומרת רשימת מקורות (חשבונות X ואתרים) במסד נתונים
2. שולפת תוכן מהמקורות האלה באמצעות APIs
3. מעבדת את התוכן עם AI — מסננת, מתרגמת, מתמצתת ומשכתבת בסגנון שלך
4. מציגה לך הצעות תוכן בדשבורד ניהולי
5. מה שאתה מאשר — עולה לאתר ומחליף את ה-mock data

---

## מבנה טכני

### שלב 1: הפעלת Backend (Lovable Cloud)

הפעלת Supabase backend עם מסד נתונים לשמירת:
- **טבלת `sources`** — מקורות תוכן (URL, סוג, שם, פעיל/לא)
- **טבלת `content_suggestions`** — הצעות תוכן שנשלפו ועובדו (ממתינות לאישור)
- **טבלת `published_posts`** — פוסטים שאושרו ועולים לאתר
- **טבלת `topics`** — נושאי AI שאתה רוצה להתמקד בהם (ישלחו בשלב הבא)

מבנה טבלאות:

```text
sources
├── id (uuid)
├── type ('twitter' | 'website')
├── url (text)
├── name (text)
├── active (boolean)
└── created_at (timestamp)

content_suggestions
├── id (uuid)
├── source_id (uuid -> sources)
├── source_url (text) - הלינק המקורי
├── original_title (text) - כותרת מקורית
├── original_content (text) - תוכן מקורי
├── suggested_title (text) - כותרת מעובדת בעברית
├── suggested_excerpt (text) - תקציר מעובד
├── suggested_content (text) - תוכן מעובד
├── suggested_section (text) - מדור מוצע
├── suggested_tag (text) - תגית מוצעת
├── status ('pending' | 'approved' | 'rejected')
├── fetched_at (timestamp)
└── reviewed_at (timestamp)

published_posts
├── id (uuid)
├── suggestion_id (uuid -> content_suggestions)
├── slug (text)
├── title (text)
├── excerpt (text)
├── content (text)
├── section (text)
├── tag (text)
├── date (date)
├── published (boolean)
└── created_at (timestamp)
```

### שלב 2: חיבור Firecrawl + Perplexity

- **Firecrawl** — לשליפת תוכן מאתרים (scrape) ומחשבונות X
- **Perplexity** — לעיבוד AI: תרגום, תמצות, שכתוב בסגנון שלך, וסיווג למדור הנכון

### שלב 3: Edge Functions

3 פונקציות backend:

1. **`fetch-content`** — שולפת תוכן חדש מכל המקורות הפעילים
   - עוברת על כל מקור בטבלת sources
   - משתמשת ב-Firecrawl לשליפה
   - שומרת את התוכן הגולמי ב-content_suggestions

2. **`process-content`** — מעבדת תוכן גולמי עם AI
   - לוקחת הצעות שעדיין לא עובדו
   - שולחת ל-Perplexity עם הנחיות: תמצת, תרגם לעברית, כתוב בסגנון תמציתי ומקצועי, סווג למדור
   - מעדכנת את השדות suggested_* בטבלה

3. **`manage-posts`** — ניהול אישור ופרסום
   - מקבלת פעולת approve/reject מהדשבורד
   - כשמאושר — יוצרת רשומה ב-published_posts
   - הפוסט מופיע באתר

### שלב 4: דשבורד ניהולי

עמוד `/admin` (מוגן בסיסמה פשוטה) שמכיל:

- **רשימת הצעות תוכן** — כרטיסים עם:
  - כותרת מוצעת
  - תקציר
  - מדור מוצע
  - מקור מקורי (לינק)
  - כפתורי: אשר / דחה / ערוך
- **פילטר לפי סטטוס**: ממתין / מאושר / נדחה
- **פילטר לפי מדור**: weekly / features / tools / viral
- **כפתור "שלוף תוכן חדש"** — מפעיל את fetch-content + process-content
- **ניהול מקורות** — הוספה/הסרה של מקורות

### שלב 5: חיבור האתר למסד נתונים

- החלפת mockData.ts בשאילתות ממסד הנתונים
- הפוסטים באתר יגיעו מטבלת published_posts
- הדפים הקיימים (דף בית, מדורים, פוסט בודד) ימשכו נתונים מהדאטהבייס
- fallback ל-mock data אם אין עדיין תוכן מאושר

---

## מקורות שיוזנו למערכת

### חשבונות X/Twitter
HadasAdler, kerenshahar5, taltimes2, DavidOndrej1, OsaurusAI, JackWoth98, JulianGoldieSEO, HeyAbhishek, thetripathi58, learn2vibe, bigaiguy, lazukars, hasantoxr, MS_BASE44, OpenAI

### אתרים
il.chat, openai.com, labs.google, anthropic.com, deepmind.google, microsoft.com/ai, ai.meta.com, x.ai, mistral.ai, cohere.com, perplexity.ai, stability.ai, huggingface.co, midjourney.com, character.ai, runwayml.com

---

## סדר עבודה

| שלב | מה נבנה | תלויות |
|-----|---------|--------|
| 1 | הפעלת Lovable Cloud + מסד נתונים | - |
| 2 | חיבור Firecrawl ו-Perplexity | שלב 1 |
| 3 | Edge function לשליפת תוכן | שלב 2 |
| 4 | Edge function לעיבוד AI | שלב 2 |
| 5 | דשבורד ניהולי (עמוד admin) | שלב 1 |
| 6 | חיבור הדשבורד ל-edge functions | שלבים 3-5 |
| 7 | החלפת mock data בנתונים מהדאטהבייס | שלב 1 |
| 8 | הוספת נושאי AI (שלב הבא שלך) | שלב 1 |

---

## הערות חשובות

- **שליפה מ-X/Twitter**: Firecrawl יכול לשלוף תוכן מפרופילי X, אבל יש מגבלות. אם לא יעבוד מספיק טוב, נוכל להוסיף RSS feeds או כלים אחרים
- **סגנון כתיבה**: ה-prompt ל-Perplexity יכלול הנחיות מפורטות לכתיבה בסגנון שלך — תמציתי, מקצועי, לא שיווקי, לא העתק-הדבק
- **נושאי AI**: ברגע שתשלח את הנושאים, נוסיף אותם לטבלת topics ונשתמש בהם כפילטר בעיבוד התוכן
- **אבטחה**: הדשבורד יהיה מוגן כדי שרק אתה תוכל לגשת אליו

