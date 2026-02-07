import { Link } from "react-router-dom";
import { ArrowLeft, Flame } from "lucide-react";
import ShareButtons from "@/components/ui/ShareButtons";
import { useLatestPost } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";
import TopicBadge from "@/components/ui/TopicBadge";

const HotNowCard = () => {
  const { data: post, isLoading } = useLatestPost();

  if (isLoading) {
    return (
      <section className="container mx-auto px-4 -mt-12 relative z-10">
        <div className="rounded-2xl bg-card p-6 md:p-10">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-8 w-3/4 mb-3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </section>
    );
  }

  if (!post) return null;

  return (
    <section className="container mx-auto px-4 -mt-12 relative z-10">
      <Link to={`/post/${post.slug}`} className="block group">
        <div className="bg-card rounded-2xl border border-border border-s-[3px] border-s-signal p-6 md:p-10">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Flame className="h-5 w-5 text-signal" />
            <span className="text-sm font-bold text-signal">הכי חם עכשיו</span>
            <TopicBadge tag={post.tag} />
            <span className="text-xs text-muted-foreground font-mono ms-auto">{post.date}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4 max-w-3xl">
            {post.excerpt}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <span>קראו עוד</span>
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </div>
            <ShareButtons
              title={post.title}
              excerpt={post.excerpt}
              slug={post.slug}
              sourceUrl={post.sourceUrl}
            />
          </div>
        </div>
      </Link>
    </section>
  );
};

export default HotNowCard;
