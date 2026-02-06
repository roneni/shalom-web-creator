import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/15 rounded-full blur-[128px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Title */}
          <h1
            className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight mb-6 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            כל מה שחשוב ב-
            <span className="gradient-text">AI</span>
            <br />
            מסונן, מזוקק, בעברית
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            עדכונים שבועיים, כלים חדשים, פיצ'רים שוברי דרך ותוכן ויראלי — הכל במקום אחד, בלי רעש.
          </p>

          {/* CTA */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Link to="/weekly">
              <Button size="lg" className="gradient-bg hover:opacity-90 transition-opacity text-base px-8 glow-sm">
                גלו מה חדש השבוע
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/newsletter">
              <Button size="lg" variant="outline" className="text-base px-8 border-border hover:bg-secondary">
                הרשמו לניוזלטר
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
