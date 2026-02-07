import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { sections } from "@/data/mockData";
import { useLatestPostBySection } from "@/hooks/usePosts";
import TopicBadge from "@/components/ui/TopicBadge";

const SectionCardItem = ({ section, excludePostSlug }: { section: (typeof sections)[0]; excludePostSlug?: string }) => {
  const { data: latestPost } = useLatestPostBySection(section.id);

  // Don't show the post if it's the same one displayed in HotNowCard
  const showPost = latestPost && latestPost.slug !== excludePostSlug;

  return (
    <div className="group rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{section.icon}</span>
          <h3 className="text-lg font-bold">{section.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {section.description}
        </p>

        {showPost && (
          <Link
            to={`/post/${latestPost.slug}`}
            className="block rounded-lg bg-secondary/50 p-4 mb-4 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-muted-foreground">{latestPost.date}</p>
              <TopicBadge tag={latestPost.tag} />
            </div>
            <h4 className="font-semibold text-sm leading-snug">{latestPost.title}</h4>
          </Link>
        )}

        <Link
          to={section.path}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          לכל המדור
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

const SectionCards = ({ excludePostSlug }: { excludePostSlug?: string }) => {
  return (
    <section className="container mx-auto px-4 py-20">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
        המדורים
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <SectionCardItem key={section.id} section={section} excludePostSlug={excludePostSlug} />
        ))}
      </div>
    </section>
  );
};

export default SectionCards;
