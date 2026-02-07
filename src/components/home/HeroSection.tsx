import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden">
      {/* Metallic endoskeleton ambient background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Base metallic gradient — dark chrome feel */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 70% at 15% 40%, hsla(220, 8%, 18%, 0.7) 0%, transparent 70%),
              radial-gradient(ellipse 50% 60% at 5% 50%, hsla(220, 6%, 14%, 0.5) 0%, transparent 60%),
              radial-gradient(ellipse 40% 40% at 25% 35%, hsla(0, 0%, 22%, 0.3) 0%, transparent 50%)
            `,
          }}
        />
        {/* Directional light streak — like light catching chrome */}
        <div
          className="absolute top-[20%] left-[8%] w-[2px] h-[35%] opacity-[0.06] rotate-[8deg]"
          style={{ background: 'linear-gradient(to bottom, transparent, hsla(220, 10%, 70%, 0.5), transparent)' }}
        />
        <div
          className="absolute top-[25%] left-[12%] w-[1px] h-[25%] opacity-[0.04] rotate-[5deg]"
          style={{ background: 'linear-gradient(to bottom, transparent, hsla(220, 10%, 60%, 0.4), transparent)' }}
        />

        {/* Red eye — outer haze */}
        <div className="absolute top-[36%] left-[16%] w-[200px] h-[200px] rounded-full bg-signal/[0.06] blur-[80px] animate-eye-pulse" />
        {/* Red eye — core glow */}
        <div className="absolute top-[40%] left-[18%] w-24 h-24 rounded-full bg-signal/[0.18] blur-[35px] animate-eye-pulse" />
        {/* Red eye — iris pinpoint */}
        <div className="absolute top-[42%] left-[19.5%] w-8 h-8 rounded-full bg-signal/[0.35] blur-[10px] animate-eye-pulse" />
        {/* Red eye — hot center */}
        <div className="absolute top-[43%] left-[20%] w-3 h-3 rounded-full bg-signal/[0.5] blur-[4px] animate-eye-pulse" />
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
