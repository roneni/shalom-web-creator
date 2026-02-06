import { Sparkles, Clock, Mail } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import EmailForm from "@/components/newsletter/EmailForm";

const NewsletterPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Glow background */}
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />

              <div className="relative z-10">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass glow-sm mb-8 animate-fade-in">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary">בקרוב</span>
                </div>

                {/* Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-bg mb-8 glow-md animate-pulse-glow">
                  <Mail className="h-9 w-9 text-primary-foreground" />
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-black mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  הניוזלטר של{" "}
                  <span className="gradient-text">AI Pulse</span>
                </h1>

                {/* Description */}
                <p
                  className="text-lg text-muted-foreground leading-relaxed mb-4 animate-fade-in"
                  style={{ animationDelay: "0.2s" }}
                >
                  סיכום שבועי של כל מה שחשוב בעולם ה-AI — ישירות לתיבת המייל שלכם.
                </p>
                <p
                  className="text-muted-foreground leading-relaxed mb-10 animate-fade-in"
                  style={{ animationDelay: "0.25s" }}
                >
                  אנחנו עובדים על זה עכשיו. השאירו אימייל ונעדכן אתכם ברגע שנצא לאוויר.
                </p>

                {/* What to expect */}
                <div
                  className="glass rounded-xl p-6 mb-10 text-right animate-fade-in"
                  style={{ animationDelay: "0.3s" }}
                >
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    מה תקבלו בניוזלטר?
                  </h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">✦</span>
                      סיכום שבועי של 5-7 העדכונים הכי חשובים
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">✦</span>
                      כלי AI אחד שכדאי להכיר — עם הסבר פרקטי
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">✦</span>
                      ניתוח ויראלי — מה קורה ולמה זה חשוב
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">✦</span>
                      טיפ מהיר שתוכלו ליישם מיד
                    </li>
                  </ul>
                </div>

                {/* Email Form */}
                <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
                  <EmailForm />
                  <p className="text-xs text-muted-foreground mt-4">
                    ללא ספאם. ביטול בקליק. פרטיות מלאה.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NewsletterPage;
