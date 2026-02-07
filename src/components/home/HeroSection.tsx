import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Terminator red-eye ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Outer diffuse red wash */}
        <div className="absolute top-[30%] left-[12%] w-[420px] h-[420px] rounded-full bg-signal/[0.03] blur-[160px]" />
        {/* Core eye glow — small, bright, pulsing */}
        <div className="absolute top-[38%] left-[18%] w-20 h-20 rounded-full bg-signal/[0.12] blur-[40px] animate-eye-pulse" />
        {/* Inner iris pinpoint */}
        <div className="absolute top-[39.5%] left-[19%] w-6 h-6 rounded-full bg-signal/[0.25] blur-[12px] animate-eye-pulse" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Not centered — editorial alignment (flows to start in RTL) */}
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-snug mb-6">
            כל מה שחשוב ב-
            <span className="gradient-text">AI</span>
            <br />
            מסונן, מזוקק, בעברית
            <span
              className="inline-block w-[3px] h-[0.7em] bg-signal ms-2 align-baseline animate-cursor-blink"
              aria-hidden="true"
            />
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-12 leading-relaxed">
            עדכונים שבועיים, כלים חדשים, פיצ'רים שוברי דרך ותוכן ויראלי — הכל במקום אחד, בלי רעש.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/weekly">
              <Button size="lg" className="gradient-bg hover:opacity-90 transition-opacity text-base px-8 font-semibold">
                גלו מה חדש השבוע
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/newsletter">
              <Button size="default" variant="outline" className="text-sm px-6 border-border text-muted-foreground hover:text-foreground hover:bg-secondary">
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
