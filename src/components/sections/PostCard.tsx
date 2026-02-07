import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Post } from "@/data/mockData";
import TopicBadge from "@/components/ui/TopicBadge";
import ShareButtons from "@/components/ui/ShareButtons";

interface PostCardProps {
  post: Post;
}

const PostCard = ({ post }: PostCardProps) => {
  return (
    <Link to={`/post/${post.slug}`} className="group block">
      <article className="rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:glow-sm p-6">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {post.tag}
          </span>
          <TopicBadge tag={post.tag} />
          <span className="text-xs text-muted-foreground">{post.date}</span>
        </div>
        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors leading-snug">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <span>קראו עוד</span>
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          </div>
          <div className="flex items-center gap-3">
            <ShareButtons
              title={post.title}
              excerpt={post.excerpt}
              slug={post.slug}
              sourceUrl={post.sourceUrl}
            />
            {post.sourceUrl && (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                מקור
              </a>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

export default PostCard;
