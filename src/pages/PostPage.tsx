import { useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PostCard from "@/components/sections/PostCard";
import { getPostBySlug, getRelatedPosts, getSectionById } from "@/data/mockData";

const PostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

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
  const relatedPosts = getRelatedPosts(post.slug, post.section, 2);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 md:pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              to={section?.path || "/"}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {section?.icon} {post.sectionName}
            </Link>
            <span className="text-xs font-medium px-2.5 py-1.5 rounded-full bg-secondary text-muted-foreground">
              {post.tag}
            </span>
            <span className="text-sm text-muted-foreground">{post.date}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-8">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 pb-10 border-b border-border">
            {post.excerpt}
          </p>

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            {post.content.split("\n\n").map((paragraph, i) => (
              <p
                key={i}
                className="text-foreground/90 leading-relaxed mb-6 text-base md:text-lg"
                dangerouslySetInnerHTML={{
                  __html: paragraph
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-bold">$1</strong>')
                    .replace(/\n- /g, '<br/>• ')
                    .replace(/\n/g, '<br/>'),
                }}
              />
            ))}
          </div>

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

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="container mx-auto px-4 max-w-3xl mt-16">
            <h2 className="text-xl font-bold mb-6">
              עוד מ<span className="gradient-text">{post.sectionName}</span>
            </h2>
            <div className="space-y-5">
              {relatedPosts.map((relPost) => (
                <PostCard key={relPost.id} post={relPost} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PostPage;
