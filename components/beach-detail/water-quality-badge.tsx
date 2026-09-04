"use client";

import { useState } from "react";
import type { CountyStatusMetadata } from "@/lib/services/water-quality/current-status";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Droplets,
} from "lucide-react";

// ------------------------------------------------
// Types
// ------------------------------------------------

export interface WaterQuality extends CountyStatusMetadata {
  beach_id: string;
  status: "good" | "advisory" | "closure" | "unknown";
  latest_enterococcus: number | null;
  latest_fecal_coliform: number | null;
  latest_sample_date: string | null;
  exceedance_count_30d: number;
  total_samples_30d: number;
  status_reason: string | null;
  status_changed_at: string | null;
}

interface WaterQualityBadgeProps {
  waterQuality: WaterQuality | null;
  /** 2-letter state code (e.g. "CA", "HI") for source attribution */
  beachState?: string | null;
}

// ------------------------------------------------
// Status config
// ------------------------------------------------

const STATUS_CONFIG = {
  good: {
    label: "Water Quality: Good",
    icon: CheckCircle2,
    iconColor: "text-green-600 dark:text-emerald-400",
    headerBg: "bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-green-100/50 dark:from-emerald-500/10 dark:to-green-500/10 dark:border-emerald-500/20",
    cardBg: "bg-gradient-to-br from-white/80 to-green-50/60 border-green-200/50 dark:from-card dark:to-card dark:border-emerald-500/20",
    textColor: "text-green-800 dark:text-emerald-300",
    badgeBg: "bg-white/60 dark:bg-emerald-500/15",
  },
  advisory: {
    label: "Water Advisory",
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400",
    headerBg: "bg-gradient-to-r from-amber-50/80 to-yellow-50/80 border-amber-100/50 dark:from-amber-500/10 dark:to-yellow-500/10 dark:border-amber-500/20",
    cardBg: "bg-gradient-to-br from-white/80 to-amber-50/60 border-amber-200/50 dark:from-card dark:to-card dark:border-amber-500/20",
    textColor: "text-amber-800 dark:text-amber-300",
    badgeBg: "bg-white/60 dark:bg-amber-500/15",
  },
  closure: {
    label: "Water Quality Alert",
    icon: ShieldAlert,
    iconColor: "text-red-600 dark:text-red-400",
    headerBg: "bg-gradient-to-r from-red-50/80 to-rose-50/80 border-red-100/50 dark:from-red-500/10 dark:to-rose-500/10 dark:border-red-500/20",
    cardBg: "bg-gradient-to-br from-white/80 to-red-50/60 border-red-200/50 dark:from-card dark:to-card dark:border-red-500/20",
    textColor: "text-red-800 dark:text-red-300",
    badgeBg: "bg-white/60 dark:bg-red-500/15",
  },
} as const;

// ------------------------------------------------
// Component
// ------------------------------------------------

export function WaterQualityBadge({ waterQuality, beachState }: WaterQualityBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  // Render nothing for null data or unknown status
  if (!waterQuality || (waterQuality.status === "unknown" && !waterQuality.county_advisory_status)) {
    return null;
  }

  const config = waterQuality.county_advisory_status === "clear" || waterQuality.county_advisory_status === "unavailable"
    ? { ...STATUS_CONFIG.advisory, label: waterQuality.county_advisory_status === "clear" ? "No current county advisory" : "County status unavailable", icon: Droplets,
        iconColor: "text-muted-foreground", textColor: "text-foreground",
        headerBg: "bg-muted/30", cardBg: "bg-card", badgeBg: "bg-muted/50" }
    : STATUS_CONFIG[waterQuality.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = config.icon;

  const formattedSampleDate = waterQuality.latest_sample_date
    ? new Date(waterQuality.latest_sample_date).toLocaleDateString()
    : null;

  return (
    <Card
      className={`noise-texture overflow-hidden rounded-2xl backdrop-blur-sm shadow-lg ${config.cardBg}`}
    >
      <CardHeader
        className={`pb-3 border-b ${config.headerBg}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-heading text-gray-800 dark:text-foreground">
            <Droplets className={`h-5 w-5 ${config.iconColor}`} />
            Water Quality
          </CardTitle>
          {/* Clickable status badge + toggle */}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors hover:opacity-80 ${config.textColor} ${config.badgeBg}` + " focus-ring"}
            aria-expanded={expanded}
            aria-label={`${config.label}. Click to ${expanded ? "collapse" : "expand"} details.`}
          >
            <StatusIcon className={`h-4 w-4 ${config.iconColor}`} />
            <span>{config.label}</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 opacity-60" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            )}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-3 text-sm text-muted-foreground">
          {waterQuality.county_advisory_status && (
            <div>
              <a href="https://www.sdbeachinfo.com/" target="_blank" rel="noopener noreferrer" className="underline">
                County of San Diego: current advisory status
              </a>
              <p>{waterQuality.county_checked_at ? `Checked ${new Date(waterQuality.county_checked_at).toLocaleString()}. No advisory does not guarantee safe water.` : "Current county status could not be verified. Check the county before entering the water."}</p>
            </div>
          )}
          {/* Sample date */}
          {!waterQuality.county_advisory_status && formattedSampleDate && (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Latest sample: </span>
              {formattedSampleDate}
              <span className="ml-2 text-xs text-muted-foreground/70">
                (Historical laboratory data; see sample date)
              </span>
            </div>
          )}

          {/* Enterococcus reading */}
          {!waterQuality.county_advisory_status && waterQuality.latest_enterococcus != null && (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Enterococcus: </span>
              {waterQuality.latest_enterococcus} CFU/100mL
            </div>
          )}

          {/* Fecal coliform reading */}
          {!waterQuality.county_advisory_status && waterQuality.latest_fecal_coliform != null && (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Fecal Coliform: </span>
              {waterQuality.latest_fecal_coliform} CFU/100mL
            </div>
          )}

          {/* 30-day exceedance summary */}
          {!waterQuality.county_advisory_status && waterQuality.total_samples_30d > 0 && (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">30-day exceedances: </span>
              {waterQuality.exceedance_count_30d} of{" "}
              {waterQuality.total_samples_30d} samples exceeded EPA limits
            </div>
          )}

          {/* Status reason */}
          {!waterQuality.county_advisory_status && waterQuality.status_reason && (
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Reason: </span>
              {waterQuality.status_reason}
            </div>
          )}

          {/* Source attribution */}
          {!waterQuality.county_advisory_status && <div className="pt-1 border-t border-gray-100 dark:border-white/10">
            {beachState === "HI" ? (
              <a
                href="https://health.hawaii.gov/cwb/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ocean-blue hover:underline"
              >
                Source: Hawaii DOH Clean Water Branch
              </a>
            ) : (
              <a
                href="https://mywaterquality.ca.gov/safe-to-swim/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ocean-blue hover:underline"
              >
                Source: CA Safe to Swim (CEDEN)
              </a>
            )}
          </div>}
        </CardContent>
      )}
    </Card>
  );
}
