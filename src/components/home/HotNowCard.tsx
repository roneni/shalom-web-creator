import { Link } from "react-router-dom";
import { ArrowLeft, Flame } from "lucide-react";
import { getLatestPost } from "@/data/mockData";

const HotNowCard = () => {
  const post = getLatestPost();

  return (
    <section className="container mx-auto px-4 -mt-12 relative z-10">
      <Link
        to={`/post/${post.slug}`}
        className="block group"
      >
        <div className="relative rounded-2xl overflow-hidden gradient-border glow-md p-[1px]">
          <div className="bg-card rounded-2xl p-6 md:p-10">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-primary animate-pulse-glow" />
              <span className="text-sm font-bold text-primary">הכי חם עכשיו</span>
              <span className="text-xs text-muted-foreground mr-auto">{post.date}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
              {post.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4 max-w-3xl">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <span>קראו עוד</span>
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
};

export default HotNowCard;
