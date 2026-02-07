import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import HotNowCard from "@/components/home/HotNowCard";
import SectionCards from "@/components/home/SectionCards";
import { useLatestPost } from "@/hooks/usePosts";

const Index = () => {
  const { data: hotPost } = useLatestPost();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <HotNowCard />
        <SectionCards excludePostSlug={hotPost?.slug} />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
