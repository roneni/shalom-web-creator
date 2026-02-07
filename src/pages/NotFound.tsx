import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="font-mono text-sm text-signal mb-4 tracking-wider">ERROR 404</p>
        <h1 className="text-5xl md:text-7xl font-black mb-6">I'll be back.</h1>
        <p className="text-lg text-muted-foreground mb-10">הדף שחיפשת לא נמצא.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
