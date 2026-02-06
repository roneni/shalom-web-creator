import { Filter, Zap, Globe } from "lucide-react";

const reasons = [
  {
    icon: Filter,
    title: "מסונן",
    description: "לא כל חדשות ה-AI מעניינות. אנחנו בוחרים רק את מה ששווה את הזמן שלכם.",
  },
  {
    icon: Zap,
    title: "מזוקק",
    description: "תוכן קצר, חד וממוקד. בלי מילים מיותרות, בלי fluff. ישר לעניין.",
  },
  {
    icon: Globe,
    title: "בעברית",
    description: "כי תוכן טוב על AI מגיע לכם בשפה שלכם. ברור, נגיש ומקצועי.",
  },
];

const WhyFollow = () => {
  return (
    <section className="container mx-auto px-4 py-20">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
        למה <span className="gradient-text">לעקוב</span>?
      </h2>
      <p className="text-center text-muted-foreground mb-12 max-w-md mx-auto">
        שלוש סיבות טובות להישאר מעודכנים
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reasons.map((reason) => (
          <div
            key={reason.title}
            className="text-center p-8 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl gradient-bg mb-5">
              <reason.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-3">{reason.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{reason.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WhyFollow;
