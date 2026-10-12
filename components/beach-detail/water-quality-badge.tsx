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
    iconColor: "text-ink",
    badgeStyle: "border-ink/20 bg-paper-shadow/40",
  },
  advisory: {
    label: "Water Advisory",
    icon: AlertTriangle,
    iconColor: "text-stamp-red",
    badgeStyle: "border-destructive/40 bg-destructive/10",
  },
  closure: {
    label: "Water Quality Alert",
    icon: ShieldAlert,
    iconColor: "text-stamp-red",
    badgeStyle: "border-destructive/40 bg-destructive/10",
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
        iconColor: "text-ink", badgeStyle: "border-ink/20 bg-paper-shadow/40" }
    : waterQuality.county_advisory_kind === "general" && waterQuality.status === "advisory"
      ? { ...STATUS_CONFIG.advisory, label: "Rain Advisory" }
      : STATUS_CONFIG[waterQuality.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = config.icon;

  const formattedSampleDate = waterQuality.latest_sample_date
    ? new Date(waterQuality.latest_sample_date).toLocaleDateString()
    : null;

  return (
    <Card
      className="noise-texture overflow-hidden rounded-md border-ink/20 bg-paper text-ink shadow-sm"
    >
      <CardHeader
        className="border-b border-ink/20 pb-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-heading text-ink">
            <Droplets className={`h-5 w-5 ${config.iconColor}`} />
            Water Quality
          </CardTitle>
          {/* Clickable status badge + toggle */}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium text-ink transition-colors hover:opacity-80 ${config.badgeStyle}`}
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
        <CardContent className="space-y-3 pt-4 text-sm text-ink">
          {waterQuality.county_advisory_status && (
            <div>
              <a href="https://www.sdbeachinfo.com/" target="_blank" rel="noopener noreferrer" className="underline">
                County of San Diego: current advisory status
              </a>
              {waterQuality.county_advisory_kind === "general" && waterQuality.status === "advisory" && (
                <p>The County has a general advisory in effect for runoff after rain. Avoid storm drains and river mouths, and check again in 72 hours.</p>
              )}
              <p>{waterQuality.county_checked_at ? `Checked ${new Date(waterQuality.county_checked_at).toLocaleString()}. No advisory does not guarantee safe water.` : "Current county status could not be verified. Check the county before entering the water."}</p>
            </div>
          )}
          {/* Sample date */}
          {!waterQuality.county_advisory_status && formattedSampleDate && (
            <div>
              <span className="font-medium text-ink">Latest sample: </span>
              {formattedSampleDate}
              <span className="ml-2 text-xs text-ink/70">
                (Historical laboratory data; see sample date)
              </span>
            </div>
          )}

          {/* Enterococcus reading */}
          {!waterQuality.county_advisory_status && waterQuality.latest_enterococcus != null && (
            <div>
              <span className="font-medium text-ink">Enterococcus: </span>
              {waterQuality.latest_enterococcus} CFU/100mL
            </div>
          )}

          {/* Fecal coliform reading */}
          {!waterQuality.county_advisory_status && waterQuality.latest_fecal_coliform != null && (
            <div>
              <span className="font-medium text-ink">Fecal Coliform: </span>
              {waterQuality.latest_fecal_coliform} CFU/100mL
            </div>
          )}

          {/* 30-day exceedance summary */}
          {!waterQuality.county_advisory_status && waterQuality.total_samples_30d > 0 && (
            <div>
              <span className="font-medium text-ink">30-day exceedances: </span>
              {waterQuality.exceedance_count_30d} of{" "}
              {waterQuality.total_samples_30d} samples exceeded EPA limits
            </div>
          )}

          {/* Status reason */}
          {!waterQuality.county_advisory_status && waterQuality.status_reason && (
            <div>
              <span className="font-medium text-ink">Reason: </span>
              {waterQuality.status_reason}
            </div>
          )}

          {/* Source attribution */}
          {!waterQuality.county_advisory_status && <div className="border-t border-ink/20 pt-1">
            {beachState === "HI" ? (
              <a
                href="https://health.hawaii.gov/cwb/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-kicker-ink hover:underline"
              >
                Source: Hawaii DOH Clean Water Branch
              </a>
            ) : (
              <a
                href="https://mywaterquality.ca.gov/safe-to-swim/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-kicker-ink hover:underline"
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
