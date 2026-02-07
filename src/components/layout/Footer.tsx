import { Link } from "react-router-dom";
import { sections } from "@/data/mockData";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="text-2xl font-black gradient-text">
              AI Pulse
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              התוכן הכי חשוב על בינה מלאכותית — מסונן, מזוקק ובעברית.
            </p>
          </div>

          {/* Sections */}
          <div>
            <h4 className="font-bold text-foreground mb-4">מדורים</h4>
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link
                    to={section.path}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {section.icon} {section.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-foreground mb-4">קישורים</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/newsletter"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  📧 ניוזלטר
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AI Pulse. כל הזכויות שמורות.
          </p>
          <p className="text-xs text-muted-foreground italic font-mono">
            The future is not set.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
