"use client";

import {
  Waves,
  Wind,
  MapPin,
  Radio,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { SourceType } from "./types";

/**
 * Source badge configuration
 */
export const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  local: {
    label: "LOCAL",
    colorClass: "text-green-400 bg-green-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  cdip: {
    label: "CDIP",
    colorClass: "text-blue-400 bg-blue-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  ndbc: {
    label: "NOAA",
    colorClass: "text-cyan-400 bg-cyan-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  forecast: {
    label: "FCST",
    colorClass: "text-purple-400 bg-purple-400/10",
    icon: <MapPin className="h-3 w-3" />,
  },
  intel: {
    label: "USER",
    colorClass: "text-orange-400 bg-orange-400/10",
    icon: <Radio className="h-3 w-3" />,
  },
  wind: {
    label: "WIND",
    colorClass: "text-sky-400 bg-sky-400/10",
    icon: <Wind className="h-3 w-3" />,
  },
  tide: {
    label: "TIDE",
    colorClass: "text-teal-400 bg-teal-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  "daily-intel": {
    label: "DAILY",
    colorClass: "text-amber-400 bg-amber-400/10",
    icon: <Activity className="h-3 w-3" />,
  },
};

/**
 * Get trend icon component
 */
export function getTrendIcon(trend?: "up" | "down" | "stable") {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-3 w-3 text-green-400" />;
    case "down":
      return <TrendingDown className="h-3 w-3 text-red-400" />;
    default:
      return <Minus className="h-3 w-3 text-gray-400" />;
  }
}

/**
 * Get summary trend indicator
 */
export function getSummaryTrendIndicator(
  trend: "improving" | "stable" | "declining" | null
) {
  if (!trend) return null;

  switch (trend) {
    case "improving":
      return (
        <span className="flex items-center gap-0.5 text-green-400">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
      );
    case "declining":
      return (
        <span className="flex items-center gap-0.5 text-red-400">
          <TrendingDown className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-0.5 text-gray-400">
          <Minus className="h-3.5 w-3.5" />
        </span>
      );
  }
}
