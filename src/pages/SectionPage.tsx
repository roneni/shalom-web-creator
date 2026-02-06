import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PostCard from "@/components/sections/PostCard";
import { getSectionById, type SectionId } from "@/data/mockData";
import { usePostsBySection } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionPageProps {
  sectionId: SectionId;
}

const SectionPage = ({ sectionId }: SectionPageProps) => {
  const section = getSectionById(sectionId);
  const { data: sectionPosts, isLoading } = usePostsBySection(sectionId);

  if (!section) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-4xl mb-4 block">{section.icon}</span>
            <h1 className="text-3xl md:text-5xl font-black mb-4">
              <span className="gradient-text">{section.name}</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {section.description}
            </p>
          </div>

          {/* Posts Grid */}
          <div className="max-w-3xl mx-auto space-y-5">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-card border border-border p-6">
                  <Skeleton className="h-5 w-20 mb-3" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))
            ) : (
              sectionPosts?.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>

          {/* Back */}
          <div className="text-center mt-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SectionPage;
