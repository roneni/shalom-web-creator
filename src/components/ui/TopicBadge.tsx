import { getTopicForTag } from "@/lib/topicUtils";

interface TopicBadgeProps {
  tag: string | undefined | null;
  className?: string;
}

const TopicBadge = ({ tag, className = "" }: TopicBadgeProps) => {
  const topic = getTopicForTag(tag);

  if (!topic) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-accent/50 text-accent-foreground ${className}`}
    >
      <span>{topic.emoji}</span>
      <span>{topic.name}</span>
    </span>
  );
};

export default TopicBadge;
