import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NewsletterCTA = () => {
  return (
    <section className="container mx-auto px-4 py-24">
      <div className="rounded-2xl bg-card border border-border p-8 md:p-14 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          ניוזלטר
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          עדכונים ישירות למייל — בקרוב.
        </p>
        <Link to="/newsletter">
          <Button size="lg" className="gradient-bg hover:opacity-90 transition-opacity px-8">
            לעמוד הניוזלטר
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default NewsletterCTA;
