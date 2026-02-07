import { ScanSearch, Sparkles, PenLine } from "lucide-react";

const steps = [
  {
    icon: ScanSearch,
    title: "סריקה",
    description: "כל שבוע אנחנו סורקים מאות מקורות — בלוגים, רשתות חברתיות, ריליסים רשמיים ומאמרים. רוב מה שמתפרסם הוא רעש.",
  },
  {
    icon: Sparkles,
    title: "סינון",
    description: "מה שעובר נבחן לעומק: מה באמת חדש כאן? למי זה רלוונטי? מה ההשלכה המעשית? ללא hype, ללא clickbait.",
  },
  {
    icon: PenLine,
    title: "כתיבה",
    description: "התוכן נכתב בעברית מקצועית, לא מתורגם. כל פריט עובר עריכה ובדיקת עובדות לפני פרסום.",
  },
];

const WhyFollow = () => {
  return (
    <section className="container mx-auto px-4 py-24">
      <h2 className="text-2xl md:text-3xl font-bold mb-12">
        איך התוכן נוצר
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="p-6 rounded-xl bg-card border border-border"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-signal/10 flex items-center justify-center mt-0.5">
                <step.icon className="h-5 w-5 text-signal" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WhyFollow;
