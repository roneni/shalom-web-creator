import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { sections } from "@/data/mockData";
import { useLatestPostBySection } from "@/hooks/usePosts";

const SectionCardItem = ({ section }: { section: (typeof sections)[0] }) => {
  const { data: latestPost } = useLatestPostBySection(section.id);

  return (
    <div className="group rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:glow-sm">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{section.icon}</span>
          <h3 className="text-lg font-bold">{section.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {section.description}
        </p>

        {latestPost && (
          <Link
            to={`/post/${latestPost.slug}`}
            className="block rounded-lg bg-secondary/50 p-4 mb-4 hover:bg-secondary transition-colors"
          >
            <p className="text-xs text-muted-foreground mb-1">{latestPost.date}</p>
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

const SectionCards = () => {
  return (
    <section className="container mx-auto px-4 py-20">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
        המדורים
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <SectionCardItem key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
};

export default SectionCards;
