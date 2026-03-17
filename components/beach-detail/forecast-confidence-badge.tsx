"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastConfidenceBadgeProps {
  className?: string;
}

export function ForecastConfidenceBadge({ className }: ForecastConfidenceBadgeProps) {
  // v1: Static badge. Future: derive from forecast data quality signals.
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 rounded-full px-2.5 py-0.5 border border-emerald-800/30",
        className
      )}
    >
      <Activity className="h-3 w-3" />
      <span>ML-enhanced forecast</span>
    </div>
  );
}
