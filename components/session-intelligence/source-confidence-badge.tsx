import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SurfWindowConfidence,
  SurfWindowSourceFlags,
} from "@/types/session-intelligence";

export interface SourceConfidenceBadgeProps {
  confidence: SurfWindowConfidence;
  sources: SurfWindowSourceFlags;
  className?: string;
}

const SOURCE_LABELS: Array<{
  key: keyof SurfWindowSourceFlags;
  label: string;
}> = [
  { key: "buoy", label: "buoy" },
  { key: "forecastModel", label: "model" },
  { key: "tide", label: "tide" },
  { key: "cam", label: "cam" },
  { key: "userReport", label: "user report" },
  { key: "localSpotIntel", label: "spot intel" },
];

export function getSurfWindowSourceLabels(
  sources: SurfWindowSourceFlags
): string[] {
  return SOURCE_LABELS.filter(({ key }) => sources[key]).map(({ label }) => label);
}

function confidenceLabel(confidence: SurfWindowConfidence): string {
  return confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1);
}

function badgeText(
  confidence: SurfWindowConfidence,
  sources: SurfWindowSourceFlags
): string {
  const labels = getSurfWindowSourceLabels(sources);

  if (confidence.level === "low") return "Low - sparse data";
  if (labels.length === 1 && labels[0] === "model") return "Model only";
  if (labels.length === 0) return `${confidenceLabel(confidence)} - sparse data`;

  return `${confidenceLabel(confidence)} - ${labels.slice(0, 2).join(" + ")}`;
}

function badgeTone(confidence: SurfWindowConfidence): string {
  if (confidence.level === "high") {
    return "border-[#00D4AA]/35 bg-[#00D4AA]/10 text-[#BFF7EC]";
  }
  if (confidence.level === "medium") {
    return "border-[#FDB84B]/35 bg-[#FDB84B]/10 text-[#FFE1A0]";
  }
  return "border-[#F78E42]/35 bg-[#F78E42]/10 text-[#FFD2B7]";
}

function ConfidenceIcon({ level }: { level: SurfWindowConfidence["level"] }) {
  if (level === "high") return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  if (level === "medium") return <Activity className="h-3.5 w-3.5" aria-hidden="true" />;
  return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function SourceConfidenceBadge({
  confidence,
  sources,
  className,
}: SourceConfidenceBadgeProps) {
  const labels = getSurfWindowSourceLabels(sources);
  const text = badgeText(confidence, sources);
  const ariaSources = labels.length > 0 ? labels.join(", ") : "sparse data";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-[12px_4px_14px_6px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase shadow-[2px_3px_0_rgba(0,0,0,0.22)]",
        badgeTone(confidence),
        className
      )}
      aria-label={`${confidenceLabel(confidence)} confidence, sources: ${ariaSources}`}
    >
      <ConfidenceIcon level={confidence.level} />
      <span>{text}</span>
    </Badge>
  );
}
