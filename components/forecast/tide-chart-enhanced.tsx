"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  TideChart,
  type TideChartProps,
  type TidePoint,
} from "./tide-chart-recharts";
import {
  TideDiagnosticsPanel,
  TideDiagnosticsHeader,
} from "./tide-diagnostics-panel";
import {
  TideWarningBanner,
  TideWarningBannerCompact,
} from "./tide-warning-banner";
import { TideVerifiedBadge } from "./tide-verified-badge";
import { TideNextExtreme, TideNextExtremeRow } from "./tide-next-extreme";
import { TideHourlyTable, TideHourlyTableCompact } from "./tide-hourly-table";
import type {
  TideDiagnostics,
  TideWarning,
  TideHourlyPoint,
} from "@/types/tide-diagnostics";
import { generateWarnings } from "@/types/tide-diagnostics";
import type { EnhancedForecastEntity } from "@/types/forecast";

/**
 * Parse height from string like "5.2 ft" or "3.1"
 */
function parseHeight(value?: string | null): number | undefined {
  if (!value) return undefined;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number.parseFloat(match[0]) : undefined;
}

/**
 * Convert forecasts to TidePoint array for hourly table generation
 */
function forecastsToTidePoints(
  forecasts?: EnhancedForecastEntity[]
): TidePoint[] {
  if (!Array.isArray(forecasts)) return [];

  return forecasts
    .map((forecast) => {
      // Prefer forecast_at (canonical timestamptz)
      let date: Date | undefined;
      if (forecast?.forecast_at) {
        date = new Date(forecast.forecast_at);
      } else if (forecast?.forecast_date && forecast.forecast_time) {
        // Legacy fallback: construct from date + time
        const dateStr = forecast.forecast_date.includes("T")
          ? forecast.forecast_date.split("T")[0]
          : forecast.forecast_date;
        const timeStr = (forecast.forecast_time ?? "").trim();

        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
          date = new Date(`${dateStr}T${timeStr.padStart(5, "0")}:00`);
        } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeStr)) {
          date = new Date(`${dateStr}T${timeStr}`);
        } else {
          date = new Date(`${dateStr}T${timeStr}`);
        }
      } else {
        return undefined;
      }

      if (!date || Number.isNaN(date.getTime())) {
        return undefined;
      }

      const heightFt =
        parseHeight(forecast.tide_height) ??
        parseHeight(forecast.next_tide_height);
      if (!Number.isFinite(heightFt)) {
        return undefined;
      }

      const type = forecast.tide_status ?? forecast.next_tide_type ?? "";
      const isHigh = typeof type === "string" && /high/i.test(type);
      const isLow = typeof type === "string" && /low/i.test(type);

      return {
        t: date,
        h: heightFt!,
        isHigh,
        isLow,
      } satisfies TidePoint;
    })
    .filter(Boolean)
    .map((p) => p as TidePoint) as TidePoint[];
}

export interface TideChartEnhancedProps extends TideChartProps {
  /** Diagnostics data for transparency panel */
  diagnostics?: TideDiagnostics;
  /** Show the diagnostics panel */
  showDiagnostics?: boolean;
  /** Show the next high/low summary */
  showNextExtreme?: boolean;
  /** Show the hourly tide table */
  showHourlyTable?: boolean;
  /** Show warnings when data quality is compromised */
  showWarnings?: boolean;
  /** Show verification badge */
  showVerifiedBadge?: boolean;
  /** Use compact layout for mobile */
  compactLayout?: boolean;
  /** Additional CSS classes for the container */
  containerClassName?: string;
}

/**
 * Generate hourly data points from TidePoint array for the table
 */
function generateHourlyData(
  data: TidePoint[],
  windowHours: number = 18
): TideHourlyPoint[] {
  if (!data || data.length === 0) return [];

  const now = new Date();
  const hourlyPoints: TideHourlyPoint[] = [];

  // Find current hour (floored)
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);

  // Create a sorted array of the original data with timestamps
  const sortedData = data
    .map((p) => ({
      ...p,
      timestamp: p.t instanceof Date ? p.t.getTime() : new Date(p.t).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Generate hourly points
  for (let i = 0; i < windowHours; i++) {
    const hourTime = new Date(currentHour.getTime() + i * 60 * 60 * 1000);
    const hourTs = hourTime.getTime();

    // Interpolate height at this hour
    let height = 0;
    let beforePoint: (typeof sortedData)[0] | null = null;
    let afterPoint: (typeof sortedData)[0] | null = null;

    for (let j = 0; j < sortedData.length; j++) {
      if (sortedData[j].timestamp <= hourTs) {
        beforePoint = sortedData[j];
      }
      if (sortedData[j].timestamp >= hourTs && !afterPoint) {
        afterPoint = sortedData[j];
        break;
      }
    }

    if (beforePoint && afterPoint && beforePoint !== afterPoint) {
      const t =
        (hourTs - beforePoint.timestamp) /
        (afterPoint.timestamp - beforePoint.timestamp);
      height = beforePoint.h + (afterPoint.h - beforePoint.h) * t;
    } else if (beforePoint) {
      height = beforePoint.h;
    } else if (afterPoint) {
      height = afterPoint.h;
    }

    // Determine trend
    let trend: TideHourlyPoint["trend"] = "stable";
    if (hourlyPoints.length > 0) {
      const prevHeight = hourlyPoints[hourlyPoints.length - 1].height;
      const diff = height - prevHeight;
      if (Math.abs(diff) < 0.05) {
        trend = "stable";
      } else if (diff > 0) {
        trend = "rising";
      } else {
        trend = "falling";
      }
    }

    // Check if this is a high or low point
    let isHigh = false;
    let isLow = false;

    // Find the nearest original data point to see if it's marked as high/low
    for (const p of sortedData) {
      const timeDiff = Math.abs(p.timestamp - hourTs);
      if (timeDiff < 30 * 60 * 1000) {
        // Within 30 minutes
        if (p.isHigh) {
          isHigh = true;
          trend = "peak";
        }
        if (p.isLow) {
          isLow = true;
          trend = "trough";
        }
        break;
      }
    }

    // Check if current hour
    const isCurrent =
      i === 0 || (hourTs <= now.getTime() && hourTs + 3600000 > now.getTime());

    hourlyPoints.push({
      time: hourTime,
      height,
      trend,
      isHigh,
      isLow,
      isCurrent: i === 0,
    });
  }

  return hourlyPoints;
}

/**
 * TideChartEnhanced - Full-featured tide chart with diagnostics, table, and warnings
 *
 * Wraps the base TideChart and adds:
 * - Diagnostics panel (toggle with ?tide_debug=true)
 * - Next high/low summary
 * - Hourly tide table
 * - Data quality warnings
 * - Verification badge
 */
export function TideChartEnhanced({
  diagnostics,
  showDiagnostics: showDiagnosticsProp,
  showNextExtreme = true,
  showHourlyTable = true,
  showWarnings = true,
  showVerifiedBadge = true,
  compactLayout = false,
  containerClassName,
  className,
  ...chartProps
}: TideChartEnhancedProps) {
  const searchParams = useSearchParams();
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);

  // Check for debug mode via query param or prop
  const debugMode = searchParams?.get("tide_debug") === "true";
  const showDiagnosticsPanel =
    showDiagnosticsProp ?? debugMode ?? process.env.NODE_ENV === "development";

  // Generate warnings from diagnostics
  const warnings: TideWarning[] = React.useMemo(() => {
    if (!diagnostics || !showWarnings) return [];
    return generateWarnings(diagnostics);
  }, [diagnostics, showWarnings]);

  // Convert forecasts to TidePoint format if data is not provided
  const tidePointData = React.useMemo(() => {
    if (chartProps.data && chartProps.data.length > 0) {
      return chartProps.data;
    }
    if (chartProps.forecasts && chartProps.forecasts.length > 0) {
      return forecastsToTidePoints(chartProps.forecasts);
    }
    return [];
  }, [chartProps.data, chartProps.forecasts]);

  // Generate hourly table data
  const hourlyData = React.useMemo(() => {
    if (!showHourlyTable || tidePointData.length === 0) {
      return [];
    }
    return generateHourlyData(tidePointData, chartProps.windowHours);
  }, [showHourlyTable, tidePointData, chartProps.windowHours]);

  return (
    <div className={cn("space-y-4", containerClassName)}>
      {/* Warning Banner */}
      {warnings.length > 0 &&
        (compactLayout ? (
          <TideWarningBannerCompact warnings={warnings} />
        ) : (
          <TideWarningBanner warnings={warnings} />
        ))}

      {/* Header with badge (if no diagnostics panel) */}
      {showVerifiedBadge && diagnostics && !showDiagnosticsPanel && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Tides</span>
          <TideVerifiedBadge
            status={diagnostics.verificationStatus}
            tooltip={`Station: ${diagnostics.stationName} (${diagnostics.stationId})`}
            confidenceScore={diagnostics.confidenceScore}
          />
        </div>
      )}

      {/* Diagnostics Panel (collapsible) */}
      {showDiagnosticsPanel && diagnostics && (
        <TideDiagnosticsPanel
          diagnostics={diagnostics}
          isOpen={diagnosticsOpen}
          onToggle={() => setDiagnosticsOpen(!diagnosticsOpen)}
        />
      )}

      {/* The Chart */}
      <TideChart {...chartProps} className={className} />

      {/* Next High/Low Summary */}
      {showNextExtreme &&
        diagnostics &&
        (compactLayout ? (
          <TideNextExtremeRow
            nextHigh={diagnostics.nextHigh}
            nextLow={diagnostics.nextLow}
            minutesToHigh={diagnostics.minutesToNextHigh}
            minutesToLow={diagnostics.minutesToNextLow}
            now={new Date()}
            unit={diagnostics.units}
          />
        ) : (
          <TideNextExtreme
            nextHigh={diagnostics.nextHigh}
            nextLow={diagnostics.nextLow}
            minutesToHigh={diagnostics.minutesToNextHigh}
            minutesToLow={diagnostics.minutesToNextLow}
            now={new Date()}
            unit={diagnostics.units}
          />
        ))}

      {/* Hourly Tide Table */}
      {showHourlyTable &&
        hourlyData.length > 0 &&
        (compactLayout ? (
          <TideHourlyTableCompact
            data={hourlyData}
            now={new Date()}
            unit={chartProps.unit}
          />
        ) : (
          <TideHourlyTable
            data={hourlyData}
            now={new Date()}
            unit={chartProps.unit}
          />
        ))}
    </div>
  );
}

/**
 * Minimal version that just adds the diagnostics header
 */
export function TideChartWithDiagnosticsHeader({
  diagnostics,
  ...chartProps
}: Omit<
  TideChartEnhancedProps,
  | "showDiagnostics"
  | "showNextExtreme"
  | "showHourlyTable"
  | "showWarnings"
  | "showVerifiedBadge"
  | "compactLayout"
>) {
  return (
    <div className="space-y-2">
      {diagnostics && <TideDiagnosticsHeader diagnostics={diagnostics} />}
      <TideChart {...chartProps} />
    </div>
  );
}
