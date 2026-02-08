import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Loader2, Radar, Zap } from "lucide-react";
import { DISCOVERY_TREE, type Domain, type Subfield, type EcosystemTarget } from "@/data/discoveryTree";
import { adminApi } from "@/lib/adminApi";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// ============================================================
// Ecosystem Target Chip
// ============================================================
function EcosystemChip({
  target,
  isSelected,
  onToggle,
}: {
  target: EcosystemTarget;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(target.id)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
        isSelected
          ? "bg-primary/20 border-primary/50 text-primary-foreground"
          : "bg-muted/50 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {target.name}
      {isSelected && <span className="text-[10px] opacity-70">✓</span>}
    </button>
  );
}

// ============================================================
// Subfield Row
// ============================================================
function SubfieldRow({
  subfield,
  isSelected,
  selectedEcosystem,
  onToggle,
  onToggleEcosystem,
}: {
  subfield: Subfield;
  isSelected: boolean;
  selectedEcosystem: Set<string>;
  onToggle: (id: string) => void;
  onToggleEcosystem: (id: string) => void;
}) {
  const hasEcosystem = subfield.ecosystem && subfield.ecosystem.length > 0;
  const [showEcosystem, setShowEcosystem] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(subfield.id)}
          id={`sub-${subfield.id}`}
          className="shrink-0"
        />
        <label
          htmlFor={`sub-${subfield.id}`}
          className="flex-1 text-sm cursor-pointer"
        >
          <span className="font-medium">{subfield.name_he}</span>
          <span className="text-xs text-muted-foreground mr-2">
            {subfield.name}
          </span>
        </label>
        {hasEcosystem && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => setShowEcosystem(!showEcosystem)}
          >
            {showEcosystem ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Tier 3: Ecosystem Targets */}
      {hasEcosystem && showEcosystem && (
        <div className="pr-8 pb-2 flex flex-wrap gap-1.5">
          {subfield.ecosystem!.map((target) => (
            <EcosystemChip
              key={target.id}
              target={target}
              isSelected={selectedEcosystem.has(target.id)}
              onToggle={onToggleEcosystem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Domain Card
// ============================================================
function DomainCard({
  domain,
  isExpanded,
  selectedSubfields,
  selectedEcosystem,
  onToggleExpand,
  onToggleSubfield,
  onToggleEcosystem,
  onSelectAllSubfields,
}: {
  domain: Domain;
  isExpanded: boolean;
  selectedSubfields: Set<string>;
  selectedEcosystem: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSubfield: (id: string) => void;
  onToggleEcosystem: (id: string) => void;
  onSelectAllSubfields: (domainId: string) => void;
}) {
  const domainSubfieldIds = domain.subfields.map((s) => s.id);
  const selectedCount = domainSubfieldIds.filter((id) =>
    selectedSubfields.has(id)
  ).length;
  const allSelected = selectedCount === domainSubfieldIds.length;

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(domain.id)}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-card/60 border border-border/50 hover:border-primary/30 transition-all text-right">
          <span className="text-xl">{domain.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{domain.name_he}</p>
            <p className="text-xs text-muted-foreground">{domain.name}</p>
          </div>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {selectedCount}/{domainSubfieldIds.length}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 mr-2 space-y-0.5 border-r-2 border-primary/20 pr-3">
          <button
            onClick={() => onSelectAllSubfields(domain.id)}
            className="text-xs text-primary hover:underline mb-1 block"
          >
            {allSelected ? "הסר הכל" : "בחר הכל"}
          </button>
          {domain.subfields.map((subfield) => (
            <SubfieldRow
              key={subfield.id}
              subfield={subfield}
              isSelected={selectedSubfields.has(subfield.id)}
              selectedEcosystem={selectedEcosystem}
              onToggle={onToggleSubfield}
              onToggleEcosystem={onToggleEcosystem}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================
// Main Discovery Panel
// ============================================================
export default function DiscoveryPanel() {
  const queryClient = useQueryClient();
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [selectedSubfields, setSelectedSubfields] = useState<Set<string>>(new Set());
  const [selectedEcosystem, setSelectedEcosystem] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  const totalSelected = selectedSubfields.size + selectedEcosystem.size;

  const toggleExpand = (id: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubfield = (id: string) => {
    setSelectedSubfields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEcosystem = (id: string) => {
    setSelectedEcosystem((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSubfields = (domainId: string) => {
    const domain = DISCOVERY_TREE.find((d) => d.id === domainId);
    if (!domain) return;
    const ids = domain.subfields.map((s) => s.id);
    setSelectedSubfields((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    const allSubfields = DISCOVERY_TREE.flatMap((d) => d.subfields.map((s) => s.id));
    const allEcosystem = DISCOVERY_TREE.flatMap((d) =>
      d.subfields.flatMap((s) => (s.ecosystem || []).map((e) => e.id))
    );
    setSelectedSubfields(new Set(allSubfields));
    setSelectedEcosystem(new Set(allEcosystem));
  };

  const clearAll = () => {
    setSelectedSubfields(new Set());
    setSelectedEcosystem(new Set());
  };

  const handleDiscoveryScan = async () => {
    if (totalSelected === 0) {
      toast({ title: "בחר לפחות תחום אחד", variant: "destructive" });
      return;
    }

    setIsScanning(true);
    try {
      toast({ title: "🔬 מפעיל סריקת Discovery ממוקדת..." });
      const result = await adminApi.discoveryScan(
        Array.from(selectedSubfields),
        Array.from(selectedEcosystem)
      );
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });

      if (result.fetched > 0) {
        toast({
          title: `🎯 נמצאו ${result.fetched} פריטים`,
          description: `${result.approved || 0} הצעות מחכות לסקירה`,
        });
      } else {
        toast({ title: "לא נמצא תוכן חדש בתחומים הנבחרים" });
      }
    } catch (err) {
      toast({
        title: "שגיאת סריקה",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Summary of selected ecosystem targets
  const selectedEcosystemNames = useMemo(() => {
    return DISCOVERY_TREE
      .flatMap((d) => d.subfields)
      .flatMap((s) => s.ecosystem || [])
      .filter((e) => selectedEcosystem.has(e.id))
      .map((e) => e.name);
  }, [selectedEcosystem]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Discovery Engine</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
              נקה
            </Button>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
              בחר הכל
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          בחר דומיינים, תת-נושאים וחברות ספציפיות לסריקה ממוקדת
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Domain Cards */}
        {DISCOVERY_TREE.map((domain) => (
          <DomainCard
            key={domain.id}
            domain={domain}
            isExpanded={expandedDomains.has(domain.id)}
            selectedSubfields={selectedSubfields}
            selectedEcosystem={selectedEcosystem}
            onToggleExpand={toggleExpand}
            onToggleSubfield={toggleSubfield}
            onToggleEcosystem={toggleEcosystem}
            onSelectAllSubfields={selectAllSubfields}
          />
        ))}

        {/* Selection Summary & Action */}
        {totalSelected > 0 && (
          <div className="pt-3 border-t border-border/50 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {selectedEcosystemNames.slice(0, 8).map((name) => (
                <Badge key={name} className="text-xs bg-primary/10 text-primary border-primary/30">
                  <Zap className="h-2.5 w-2.5 ml-1" />
                  {name}
                </Badge>
              ))}
              {selectedEcosystemNames.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedEcosystemNames.length - 8} עוד
                </Badge>
              )}
            </div>
            <Button
              onClick={handleDiscoveryScan}
              disabled={isScanning}
              className="w-full"
              size="lg"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Radar className="h-4 w-4 ml-2" />
              )}
              הפעל סריקה ממוקדת
              <Badge variant="secondary" className="mr-2 text-xs">
                {selectedSubfields.size} תחומים • {selectedEcosystem.size} חברות
              </Badge>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
