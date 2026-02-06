import { useState } from "react";
import { Mail, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const EmailForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast({
        title: "שגיאה",
        description: "נא להזין כתובת אימייל תקינה",
        variant: "destructive",
      });
      return;
    }

    setStatus("loading");

    // Save to localStorage
    setTimeout(() => {
      const stored = JSON.parse(localStorage.getItem("newsletter_emails") || "[]");
      if (stored.includes(email)) {
        toast({
          title: "כבר נרשמת! 🎉",
          description: "האימייל הזה כבר ברשימה שלנו.",
        });
        setStatus("idle");
        return;
      }
      stored.push(email);
      localStorage.setItem("newsletter_emails", JSON.stringify(stored));

      setStatus("success");
      setEmail("");
      toast({
        title: "נרשמת בהצלחה! 🎉",
        description: "נעדכן אותך כשהניוזלטר יעלה לאוויר.",
      });

      setTimeout(() => setStatus("idle"), 3000);
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
      <div className="relative flex-1">
        <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pr-10 bg-secondary border-border focus:border-primary h-12 text-base"
          dir="ltr"
          disabled={status === "loading"}
        />
      </div>
      <Button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="gradient-bg hover:opacity-90 transition-opacity h-12 px-6 glow-sm min-w-[120px]"
      >
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "success" && <Check className="h-4 w-4" />}
        {status === "idle" && "הרשמה"}
        {status === "loading" && "שולח..."}
        {status === "success" && "נרשמת!"}
      </Button>
    </form>
  );
};

export default EmailForm;
