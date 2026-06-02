import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ForecastAccuracyConfidence } from "@/actions/ml/forecast-accuracy-actions";

interface AccuracySourceConfidenceBadgeProps {
  confidence: ForecastAccuracyConfidence;
  className?: string;
}

function badgeTone(level: ForecastAccuracyConfidence["level"]): string {
  if (level === "high") {
    return "border-[#00D4AA]/50 bg-[#00D4AA]/12 text-[#BFF7EC]";
  }
  if (level === "medium") {
    return "border-[#FDB84B]/50 bg-[#FDB84B]/12 text-[#FFE1A0]";
  }
  return "border-[#F78E42]/50 bg-[#F78E42]/12 text-[#FFD2B7]";
}

function ConfidenceIcon({ level }: { level: ForecastAccuracyConfidence["level"] }) {
  if (level === "high") return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  if (level === "medium") return <Activity className="h-3.5 w-3.5" aria-hidden="true" />;
  return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function AccuracySourceConfidenceBadge({
  confidence,
  className,
}: AccuracySourceConfidenceBadgeProps) {
  const sources =
    confidence.sources.length > 0 ? confidence.sources.join(", ") : "sparse data";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase shadow-[2px_3px_0_rgba(0,0,0,0.22)]",
        badgeTone(confidence.level),
        className
      )}
      aria-label={`${confidence.label}, sources: ${sources}`}
      title={confidence.reason}
    >
      <ConfidenceIcon level={confidence.level} />
      {confidence.label}
    </span>
  );
}
