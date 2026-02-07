

# שיפור קריאות, היררכיה וניקיון ויזואלי

שיפורים ממוקדים ב-6 תחומים, ללא שינוי זהות ויזואלית או הוספת פיצ'רים.

---

## 1. טיפוגרפיה בהירו — גודל וגובה שורה

**בעיה:** כותרת ה-Hero ב-`text-7xl` (4.5rem) גדולה מדי ויוצרת תחושה צפופה, במיוחד בעברית שבה התווים רחבים יותר. `leading-tight` לא מספק מספיק אוויר.

**שינויים:**
- `HeroSection.tsx` — כותרת h1: מ-`text-7xl` ל-`text-6xl` (3.75rem) בדסקטופ, שמירה על `text-4xl` במובייל
- גובה שורה: מ-`leading-tight` ל-`leading-snug` (1.375) — מוסיף אוויר בין השורות
- תת-כותרת: מ-`text-xl` ל-`text-lg` בדסקטופ, עם `leading-relaxed` (כבר קיים — נשאר)
- `PostPage.tsx` — כותרת פוסט: מ-`text-5xl` ל-`text-4xl` בדסקטופ, עם `leading-snug`

## 2. ניגודיות טקסט (WCAG AA)

**בעיה:** `--muted-foreground` מוגדר כ-`220 10% 55%` (כ-`hsl(220,10%,55%)`) — על רקע `hsl(230,25%,7%)` זה נותן יחס ניגודיות של כ-4.2:1. מספיק ל-AA עבור טקסט גדול אבל בעייתי עבור טקסט רגיל (דורש 4.5:1).

**שינויים ב-`index.css`:**
- `--muted-foreground`: מ-`220 10% 55%` ל-`220 10% 62%` — מעלה את הבהירות ל-62%, שמגיע ליחס של כ-5.5:1 (WCAG AA)
- `--foreground`: נשאר `220 20% 95%` — כבר מצוין (יחס ~15:1)
- `--secondary-foreground`: מ-`220 20% 90%` ל-`220 15% 88%` — ניקוי קל

## 3. הפחתת רעש דקורטיבי

**בעיה:** הירו מכיל שני blobs גדולים (`bg-primary/20`, `bg-accent/15`), glow effects על כפתורים וכרטיסים, ואנימציות `pulse-glow` ו-`animate-fade-in` שמוסיפים רעש ויזואלי ללא תרומה לתוכן.

**שינויים:**
- `HeroSection.tsx` — הפחתת אטימות ה-blobs מ-`/20` ל-`/8` ומ-`/15` ל-`/6`, והסרת `animate-fade-in` מכל האלמנטים (הטקסט יופיע ישר)
- `HotNowCard.tsx` — הסרת `glow-md` מהכרטיס, הסרת `animate-pulse-glow` מאיקון הלהבה
- `SectionCards.tsx` — הסרת `hover:glow-sm` מכרטיסי מדורים
- `PostCard.tsx` — הסרת `hover:glow-sm` מכרטיסי פוסטים
- `NewsletterCTA.tsx` — הפחתת אטימות ה-blobs מ-`/20` ל-`/8` ומ-`/15` ל-`/6`, הסרת `glow-sm` מהכפתור
- כפתורי CTA — הסרת `glow-sm` מכל הכפתורים (Hero, Newsletter, Navbar)

## 4. רוחב טקסט לקריאה נוחה

**בעיה:** בדף פוסט, `max-w-3xl` (48rem) הוא סביר, אבל תוכן הגוף עצמו יכול להיות מצומצם יותר לקריאה נוחה (המלצה: 60-75 תווים לשורה, כ-40rem לעברית).

**שינויים:**
- `PostPage.tsx` — עטיפת אזור ה-content (prose) ב-`max-w-[42rem]` (672px) — מצמצם שורות לאורך קריאה נוח
- שמירה על `max-w-3xl` (768px) עבור ה-article wrapper הכולל (מטא-דאטה, כותרת)

## 5. תמיכה מלאה ב-RTL וטיפוגרפיה עברית

**בעיה:** חלק מהכיוונים hardcoded ל-LTR (כגון `mr-auto`, `ml-2`, `pr-4`, `pl-0`). צריך להשתמש ב-logical properties של Tailwind (`ms-`, `me-`, `ps-`, `pe-`).

**שינויים:**
- `HotNowCard.tsx` — `mr-auto` ל-`ms-auto`
- `Navbar.tsx` — `mr-2` ל-`me-2`
- `PostPage.tsx` — blockquote: `border-r-4 pr-4 pl-0 mr-0` ל-`border-s-4 ps-4 pe-0 ms-0` (border-start לתמיכה ב-RTL)
- מובייל navbar: `ml-2` ל-`ms-2`

## 6. היררכיית CTA — חיזוק ראשי, הנמכת משני

**בעיה:** שני כפתורי ה-Hero באותו גודל ומשקל ויזואלי. הניוזלטר לא צריך את אותו המשקל כמו ה-CTA הראשי.

**שינויים:**
- `HeroSection.tsx` — כפתור ראשי (גלו מה חדש): נשאר `size="lg"`, מקבל `font-semibold`
- כפתור משני (ניוזלטר): מ-`size="lg"` ל-`size="default"`, עם `text-muted-foreground` במקום ברירת מחדל — ברור שהוא משני
- `Navbar.tsx` — כפתור ניוזלטר בנאב: מ-`gradient-bg` ל-`variant="ghost"` עם טקסט רגיל — מפחית תחרות ויזואלית עם הנאביגציה

---

## סיכום קבצים שישתנו

| קובץ | שינויים |
|---|---|
| `src/index.css` | ניגודיות muted-foreground, secondary-foreground |
| `src/components/home/HeroSection.tsx` | טיפוגרפיה, blobs, אנימציות, היררכיית CTA |
| `src/components/home/HotNowCard.tsx` | glow, pulse, RTL fix |
| `src/components/home/SectionCards.tsx` | glow |
| `src/components/home/NewsletterCTA.tsx` | blobs, glow |
| `src/components/sections/PostCard.tsx` | glow |
| `src/components/layout/Navbar.tsx` | RTL fix, כפתור ניוזלטר |
| `src/pages/PostPage.tsx` | רוחב קריאה, טיפוגרפיה, RTL blockquote |

לא מתווספים קבצים חדשים, לא מתווספים תלויות, לא משתנה פלטת הצבעים.

