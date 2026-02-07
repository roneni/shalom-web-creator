import { useState } from "react";
import { Share2 } from "lucide-react";

interface ShareButtonsProps {
  title: string;
  excerpt: string;
  slug: string;
  sourceUrl?: string;
}

const PLATFORMS = [
  { name: "X", icon: "𝕏", buildUrl: (text: string, url: string) => `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { name: "LinkedIn", icon: "in", buildUrl: (_text: string, url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { name: "WhatsApp", icon: "💬", buildUrl: (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` },
  { name: "Telegram", icon: "✈️", buildUrl: (text: string, url: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { name: "Facebook", icon: "f", buildUrl: (_text: string, url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { name: "Threads", icon: "@", buildUrl: (text: string, url: string) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}` },
  { name: "Reddit", icon: "r", buildUrl: (text: string, url: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
] as const;

const ShareButtons = ({ title, excerpt, slug, sourceUrl }: ShareButtonsProps) => {
  const [open, setOpen] = useState(false);

  const shareUrl = sourceUrl || `${window.location.origin}/post/${slug}`;
  const shareText = `${title}\n\n${excerpt}`;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        aria-label="שיתוף"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span>שתפו</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          {/* Dropdown */}
          <div className="absolute left-0 bottom-full mb-2 z-50 flex gap-1 p-2 rounded-lg bg-popover border border-border shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
            {PLATFORMS.map((platform) => (
              <a
                key={platform.name}
                href={platform.buildUrl(shareText, shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={platform.name}
                className="flex items-center justify-center h-8 w-8 rounded-md text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                {platform.icon}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ShareButtons;
