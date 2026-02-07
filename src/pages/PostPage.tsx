import { useParams, Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import DOMPurify from "dompurify";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PostCard from "@/components/sections/PostCard";
import { getSectionById } from "@/data/mockData";
import { usePostBySlug, usePostsBySection } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";
import TopicBadge from "@/components/ui/TopicBadge";

// Sanitize and convert markdown-like content to safe HTML
function sanitizeContent(text: string): string {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-bold">$1</strong>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n/g, '<br/>');

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'br', 'em', 'a', 'ul', 'li', 'ol'],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//,
  });
}

const PostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = usePostBySlug(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 md:pt-32 pb-20">
          <div className="container mx-auto px-4 max-w-3xl">
            <Skeleton className="h-6 w-40 mb-6" />
            <Skeleton className="h-12 w-3/4 mb-8" />
            <Skeleton className="h-24 w-full mb-10" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 pb-20 text-center">
          <h1 className="text-3xl font-bold mb-4">הפוסט לא נמצא</h1>
          <Link to="/" className="text-primary hover:underline">
            חזרה לדף הבית
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const section = getSectionById(post.section);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 md:pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Link
              to={section?.path || "/"}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {section?.icon} {post.sectionName}
            </Link>
            <span className="text-xs font-medium px-2.5 py-1.5 rounded-full bg-secondary text-muted-foreground">
              {post.tag}
            </span>
            <TopicBadge tag={post.tag} />
            <span className="text-sm text-muted-foreground">{post.date}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black leading-snug mb-8">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 pb-10 border-b border-border">
            {post.excerpt}
          </p>

          {/* Content — supports Super-Mentor structured format */}
          <div className="prose prose-invert max-w-[42rem]">
            {post.content.split("\n\n").map((paragraph, i) => {
              const trimmed = paragraph.trim();

              // Super-Mentor: PREMIUM HOOK header
              if (trimmed === "**PREMIUM HOOK**") {
                return (
                  <div key={i} className="text-xs font-bold tracking-[0.2em] uppercase text-primary/60 mb-1 mt-2">
                    PREMIUM HOOK
                  </div>
                );
              }

              // Super-Mentor: THE 1% CASE header
              if (trimmed === "**THE 1% CASE**") {
                return (
                  <div key={i} className="text-xs font-bold tracking-[0.2em] uppercase text-primary/60 mt-10 mb-1">
                    THE 1% CASE
                  </div>
                );
              }

              // Super-Mentor: CURATOR'S VERDICT header
              if (trimmed === "**CURATOR'S VERDICT**") {
                return (
                  <div key={i} className="text-xs font-bold tracking-[0.2em] uppercase text-primary/60 mt-10 mb-1">
                    CURATOR&apos;S VERDICT
                  </div>
                );
              }

              // Super-Mentor: Verdict blockquote (starts with >)
              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote
                    key={i}
                    className="border-s-4 border-primary ps-4 pe-0 ms-0 my-4 text-lg md:text-xl font-medium italic text-foreground/80 leading-relaxed"
                  >
                    {trimmed.slice(2)}
                  </blockquote>
                );
              }

              // Hook paragraph (first content after PREMIUM HOOK) — render bold
              const isHookParagraph = i > 0 && post.content.split("\n\n")[i - 1]?.trim() === "**PREMIUM HOOK**";
              if (isHookParagraph) {
                return (
                  <p
                    key={i}
                    className="text-xl md:text-2xl font-bold text-foreground leading-snug mb-8"
                  >
                    {trimmed}
                  </p>
                );
              }

              // 1% Case paragraph — slightly different styling
              const isPrevOnePercent = i > 0 && post.content.split("\n\n")[i - 1]?.trim() === "**THE 1% CASE**";
              if (isPrevOnePercent) {
                return (
                  <div
                    key={i}
                    className="bg-muted/30 border border-border rounded-lg p-4 my-4 text-sm md:text-base text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeContent(trimmed),
                    }}
                  />
                );
              }

              // Regular paragraph
              return (
                <p
                  key={i}
                  className="text-foreground/90 leading-relaxed mb-6 text-base md:text-lg"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeContent(trimmed),
                  }}
                />
              );
            })}
          </div>

          {/* Source Link */}
          {post.sourceUrl && (
            <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                קראו את הכתבה המקורית
              </a>
            </div>
          )}

          {/* Back to section */}
          <div className="mt-14 pt-8 border-t border-border">
            <Link
              to={section?.path || "/"}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה ל{post.sectionName}
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PostPage;
