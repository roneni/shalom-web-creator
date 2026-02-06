import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NewsletterCTA = () => {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="relative rounded-2xl overflow-hidden">
        {/* BG glow */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/3 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-accent/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative glass rounded-2xl p-8 md:p-14 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full gradient-bg mb-6">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            לא מפספסים <span className="gradient-text">כלום</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            הירשמו לניוזלטר וקבלו את העדכונים החשובים ישירות למייל — בקרוב.
          </p>
          <Link to="/newsletter">
            <Button size="lg" className="gradient-bg hover:opacity-90 transition-opacity px-8 glow-sm">
              לעמוד הניוזלטר
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NewsletterCTA;
