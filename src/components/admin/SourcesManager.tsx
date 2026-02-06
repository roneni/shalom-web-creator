import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

const SourcesManager = () => {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: () => adminApi.getSources(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const twitterSources = sources?.filter((s: any) => s.type === "twitter") || [];
  const websiteSources = sources?.filter((s: any) => s.type === "website") || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          חשבונות X/Twitter ({twitterSources.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {twitterSources.map((source: any) => (
            <Badge
              key={source.id}
              variant={source.active ? "secondary" : "outline"}
              className="text-xs py-1"
            >
              {source.name}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          אתרים ({websiteSources.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {websiteSources.map((source: any) => (
            <Card key={source.id} className="inline-block">
              <CardContent className="p-2 px-3 flex items-center gap-2">
                <span className="text-sm">{source.name}</span>
                <Badge variant={source.active ? "default" : "outline"} className="text-[10px]">
                  {source.active ? "פעיל" : "מושבת"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SourcesManager;
