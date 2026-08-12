"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useMagicHour } from "@/hooks/use-magic-hour";
import { findNextBestWindow } from "@/lib/utils/morning-intel-utils";
import { getWindowStatus } from "@/lib/utils/window-status";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { data } from "@/lib/data/client";
import { resolveBeachTimezone, getLocalDateString } from "@/lib/utils/timezone-utils";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { UnifiedSurfCard } from "./unified-surf-card";
import { ShareSheet } from "@/components/share/share-sheet";
import { cn } from "@/lib/utils";
import {
  Clock,
  Waves,
  Wind,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Share2,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

/**
 * Format an ISO timestamp to a readable time string (e.g. "6:30 AM").
 * Defined once here and used by both sub-components and the main component.
 */
function formatISOTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatIntelWaveHeightLabel(
  minFt: number | null | undefined,
  maxFt: number | null | undefined
): string | null {
  if (minFt == null || maxFt == null) return null;
  return `${Math.round(minFt)}-${Math.round(maxFt)}ft`;
}

// ------------------------------------------------------------------
// Condition Intelligence types (Step 8 additions)
// ------------------------------------------------------------------

/**
 * A single surf window as produced by calculateMultipleWindows() (Step 4).
 * Each window has a time range, score, optional character and reasons.
 */
interface ConditionWindow {
  start: string;
  end: string;
  avgScore: number;
  peakScore?: number;
  character?: {
    label: string;
    category: string;
  };
  reasons?: string[];
}

/**
 * Board pick from the quiver, as returned by getConditionBoardPick() (Step 5).
 */
interface BoardPick {
  boardName: string;
  boardType: string;
  reason: string;
}

/**
 * Relative framing context, from calculateRelativeContext() (Step 6).
 */
interface RelativeContext {
  isBestOfWeek: boolean;
  trend: "improving" | "declining" | "stable";
  incomingSwell?: {
    date: string;
    description: string;
  } | null;
}

// ------------------------------------------------------------------
// Component props
// ------------------------------------------------------------------

interface BestSurfWindowProps {
  beachId: string;
  beachName: string;
  beachTimezone?: string | null;
  forecasts?: EnhancedForecastEntity[];
  surfCall?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;

  // ---- NEW optional props for Condition Intelligence ----

  /**
   * Multiple scored windows for today, ranked by avg score.
   * When provided, the primary (first) window is shown prominently;
   * secondary windows appear in a compact strip below.
   */
  windows?: ConditionWindow[];

  /**
   * Board recommendation from the user's quiver.
   * Shown on the primary window card when available.
   */
  boardPick?: BoardPick | null;

  /**
   * Relative framing context — best-of-week, trend, incoming swell.
   */
  relativeContext?: RelativeContext;
}

// ------------------------------------------------------------------
// Internal types (legacy path)
// ------------------------------------------------------------------

type WindowForecast = {
  forecast_at?: string;
  forecast_time: string;
  forecast_date: string;
  wind_speed: number | null;
  wind_direction: number | null;
  wave_period: number | null;
  swell_1_period: number | null;
  tide_height: number | null;
};

// ------------------------------------------------------------------
// Helper sub-components
// ------------------------------------------------------------------

/**
 * Sticker-style chip for relative context badges.
 * Max 2 shown at a time; slightly rotated for retro aesthetic.
 * Respects prefers-reduced-motion — rotation is motion-safe only.
 */
function ContextChip({
  children,
  variant = "neutral",
  rotate = 0,
  className,
}: {
  children: React.ReactNode;
  variant?: "gold" | "up" | "down" | "stable" | "swell" | "neutral";
  rotate?: number;
  className?: string;
}) {
  const variantClasses: Record<typeof variant, string> = {
    gold: "bg-amber-100/80 text-amber-800 border border-amber-300/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    up: "bg-emerald-100/80 text-emerald-800 border border-emerald-300/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    down: "bg-rose-100/80 text-rose-800 border border-rose-300/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40",
    stable: "bg-gray-100/80 text-gray-700 border border-gray-300/60 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600/40",
    swell: "bg-blue-100/80 text-blue-800 border border-blue-300/60 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    neutral: "bg-gray-100/60 text-gray-600 border border-gray-200/60 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700/40",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px_10px_8px_10px] px-2.5 py-1 text-xs font-medium",
        // Asymmetric border radius for sticker feel
        variantClasses[variant],
        // Cancel rotation for users who prefer reduced motion
        "motion-reduce:!transform-none",
        className
      )}
      style={rotate !== 0 ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {children}
    </span>
  );
}

/**
 * Compact row showing a secondary surf window (time + character keyword).
 */
function SecondaryWindowChip({ window: w }: { window: ConditionWindow }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-100/50 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-900/10 px-3 py-2 text-xs">
      <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
      <span className="font-semibold text-blue-800 dark:text-blue-300">
        {formatISOTime(w.start)}–{formatISOTime(w.end)}
      </span>
      {w.character && (
        <span className="font-mono text-blue-600/70 dark:text-blue-400/70 truncate">
          {w.character.label}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

export function BestSurfWindow({
  beachId,
  beachName,
  beachTimezone,
  forecasts,
  surfCall,
  surfCallIsTomorrow,
  windows,
  boardPick,
  relativeContext,
}: BestSurfWindowProps) {
  const pathname = usePathname();
  const [shareOpen, setShareOpen] = useState(false);

  // Build UTM-tagged share URL once so it can be passed as a prop to ShareSheet
  const shareUrlWithUtm = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
    const url = new URL(`${base}${pathname}`);
    url.searchParams.set("utm_source", "quiver");
    url.searchParams.set("utm_medium", "share");
    url.searchParams.set("utm_campaign", "surf_intel_share");
    return url.toString();
  }, [pathname]);

  // Derive beach slug from the pathname (last path segment)
  const beachSlug = pathname?.split("/").pop() ?? "";

  // Format time helper (legacy HH:MM string format)
  const formatTime = (time: string | null) => {
    if (!time) return "";
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return time;
    }
  };

  // Format peak time from Date object
  const formatPeakTime = (peakTime: Date | null) => {
    if (!peakTime) return "";
    try {
      return peakTime.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };



  // Wind quality display helper
  const getWindQualityDisplay = (
    quality: "perfect" | "acceptable" | "cross" | "onshore" | null
  ) => {
    switch (quality) {
      case "perfect":
        return { label: "Offshore", color: "text-green-600", bg: "bg-green-100" };
      case "acceptable":
        return { label: "Light/Variable", color: "text-blue-600", bg: "bg-blue-100" };
      case "cross":
        return { label: "Cross-shore", color: "text-yellow-600", bg: "bg-yellow-100" };
      case "onshore":
        return { label: "Onshore", color: "text-orange-600", bg: "bg-orange-100" };
      default:
        return null;
    }
  };

  const forecastDate = useMemo(() => {
    const timezone = resolveBeachTimezone(beachTimezone);
    const localDate = getLocalDateString(new Date(), timezone);

    // Dev-only logging to catch timezone issues
    if (process.env.NODE_ENV === 'development') {
      console.log('[BestSurfWindow] Computing forecast_date:', {
        beachId,
        beachName,
        beachTimezone,
        effectiveTimezone: timezone,
        computedDate: localDate,
        utcNow: new Date().toISOString(),
      });
    }

    return localDate;
  }, [beachTimezone, beachId, beachName]);

  // Fetch latest intel via the client data gateway + API route
  const fetchIntel = useCallback(async () => {
    return await data.intel.getDaily(beachId, forecastDate);
  }, [beachId, forecastDate]);

  const { data: intel, loading, error } = useDataFetcher(fetchIntel);
  const fallbackWaveHeightLabel = useMemo(
    () => formatIntelWaveHeightLabel(intel?.surf_min_ft, intel?.surf_max_ft),
    [intel?.surf_min_ft, intel?.surf_max_ft]
  );
  const currentWaveHeightLabel =
    intel?.current_wave_height_label ?? fallbackWaveHeightLabel;
  const surfGridWaveHeightLabel =
    intel?.best_window_wave_height_label ??
    intel?.current_wave_height_label ??
    fallbackWaveHeightLabel;

  // Magic Hour: Interpolated peak time calculation
  const { magicHour, isLoading: magicHourLoading } = useMagicHour(beachId);

  const mappedForecasts: WindowForecast[] = useMemo(() => {
    const tz = resolveBeachTimezone(beachTimezone);
    const rows = (forecasts || []).filter((f) => extractForecastDate(f.forecast_at, tz) === forecastDate);
    return rows.map((f) => ({
      forecast_at: f.forecast_at,
      forecast_time: f.forecast_time,
      forecast_date: f.forecast_date,
      wind_speed:
        f.wind_speed == null ? null : Number.parseFloat(String(f.wind_speed)),
      wind_direction:
        f.wind_direction == null
          ? null
          : Number.parseFloat(String(f.wind_direction)),
      wave_period:
        f.wave_period == null ? null : Number.parseFloat(String(f.wave_period)),
      swell_1_period:
        f.swell_1_period == null
          ? null
          : Number.parseFloat(String(f.swell_1_period)),
      tide_height:
        f.tide_height == null ? null : Number.parseFloat(String(f.tide_height)),
    }));
  }, [forecasts, forecastDate, beachTimezone]);

  // Calculate best window from forecasts (used when no intel or when intel window passed)
  const bestWindowFromForecasts = useMemo(() => {
    if (!mappedForecasts || mappedForecasts.length === 0) {
      return null;
    }
    const computed = findNextBestWindow(
      mappedForecasts,
      new Date(),
      270,
      resolveBeachTimezone(beachTimezone)
    );
    return computed;
  }, [mappedForecasts, beachTimezone]);

  // ----------------------------------------------------------------
  // Condition Intelligence: Primary + secondary windows
  // ----------------------------------------------------------------
  const primaryWindow = windows && windows.length > 0 ? windows[0] : null;
  const secondaryWindows = windows && windows.length > 1 ? windows.slice(1) : [];

  // ----------------------------------------------------------------
  // Relative framing: which badges to show (max 2)
  // ----------------------------------------------------------------
  const contextBadges = useMemo(() => {
    if (!relativeContext) return [];

    const badges: Array<{
      key: string;
      variant: "gold" | "up" | "down" | "stable" | "swell" | "neutral";
      rotate: number;
      content: React.ReactNode;
    }> = [];

    // Best of week — highest priority
    if (relativeContext.isBestOfWeek) {
      badges.push({
        key: "best-week",
        variant: "gold",
        rotate: -1,
        content: (
          <>
            <Zap className="h-3 w-3" aria-hidden="true" />
            Best conditions this week
          </>
        ),
      });
    }

    // Incoming swell — exciting, build anticipation
    if (relativeContext.incomingSwell) {
      const swellDate = (() => {
        try {
          return new Date(relativeContext.incomingSwell.date).toLocaleDateString(
            [],
            { weekday: "short" }
          );
        } catch {
          return relativeContext.incomingSwell.date;
        }
      })();
      badges.push({
        key: "swell-incoming",
        variant: "swell",
        rotate: 1,
        content: (
          <>
            <Waves className="h-3 w-3" aria-hidden="true" />
            Swell incoming {swellDate}
          </>
        ),
      });
    } else {
      // Trend — only show if no swell badge (max 2 total, swell > trend in priority)
      if (badges.length < 2) {
        if (relativeContext.trend === "improving") {
          badges.push({
            key: "trend-up",
            variant: "up",
            rotate: 0,
            content: (
              <>
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                Conditions improving
              </>
            ),
          });
        } else if (relativeContext.trend === "declining") {
          badges.push({
            key: "trend-down",
            variant: "down",
            rotate: 0,
            content: (
              <>
                <TrendingDown className="h-3 w-3" aria-hidden="true" />
                Conditions declining
              </>
            ),
          });
        }
        // stable trend: don't add a badge — silence is fine here
      }
    }

    // Cap at 2
    return badges.slice(0, 2);
  }, [relativeContext]);

  // ----------------------------------------------------------------
  // When unified scorer data is available, render the unified card
  // (placed after all hooks to satisfy rules-of-hooks)
  // ----------------------------------------------------------------
  if (surfCall) {
    return (
      <UnifiedSurfCard
        surfCall={surfCall}
        beachTimezone={beachTimezone}
        beachName={beachName}
        beachSlug={pathname?.split("/").pop() || undefined}
        isTomorrow={surfCallIsTomorrow}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="rounded-3xl border-blue-100/60">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No intel available - show best window from forecasts if available
  if (error || !intel) {
    if (bestWindowFromForecasts && bestWindowFromForecasts.startTime) {
      return (
        <Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-xl font-bold text-blue-900">
                  Best Surf Window Today
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on tide, swell, wind, and spot fit
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-br from-green-50/80 to-blue-50/50 rounded-xl p-4 border border-green-200/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">
                    Most Favorable Window
                  </h4>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600 mb-1">
                {formatTime(bestWindowFromForecasts.startTime)} -{" "}
                {formatTime(bestWindowFromForecasts.endTime)}
              </p>
              <p className="text-sm text-gray-700">
                {bestWindowFromForecasts.description} •{" "}
                {bestWindowFromForecasts.conditions}
              </p>
            </div>

            {/* Primary Condition Intelligence window (if available) */}
            {primaryWindow && (
              <ConditionIntelligenceSection
                primaryWindow={primaryWindow}
                secondaryWindows={secondaryWindows}
                boardPick={boardPick}
              />
            )}

            {/* Relative context badges */}
            {contextBadges.length > 0 && (
              <RelativeContextBadges badges={contextBadges} />
            )}

            {/* Magic Hour: Interpolated Peak Time (fallback view) */}
            {magicHour?.found && (
              <MagicHourSection
                magicHour={magicHour}
                getWindQualityDisplay={getWindQualityDisplay}
              />
            )}

            {magicHourLoading && !magicHour && (
              <MagicHourLoadingState />
            )}
          </CardContent>
        </Card>
      );
    }

    // No intel and no good forecast window
    return (
      <Card className="rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-900 font-semibold mb-1">
              Surf intel not available yet
            </p>
            <p className="text-sm text-amber-800">
              Intel is generated daily for select beaches. Check the detailed
              forecast below for conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const windowStatus = getWindowStatus(
    intel.best_window_start,
    intel.best_window_end,
    forecastDate
  );
  const generatedTime = new Date(intel.generated_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // Use the calculated best window from forecasts when primary has passed
  const nextWindow =
    windowStatus.status === "passed" ? bestWindowFromForecasts : null;

  return (
    <Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-blue-900">
              Best Surf Window Today
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Updated at {generatedTime}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="h-8 w-8 p-0 flex-shrink-0"
            title="Share surf intel"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Optimal Window - Highlighted with status */}
        <div
          className={`rounded-2xl p-4 ${
            windowStatus.status === "current"
              ? "bg-green-100/50 border border-green-200"
              : windowStatus.status === "passed"
              ? "bg-gray-100/50 border border-gray-200"
              : "bg-blue-100/50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock
                className={`h-5 w-5 ${
                  windowStatus.status === "current"
                    ? "text-green-600"
                    : windowStatus.status === "passed"
                    ? "text-gray-600"
                    : "text-blue-600"
                }`}
              />
              <h4
                className={`font-semibold ${
                  windowStatus.status === "current"
                    ? "text-green-900"
                    : windowStatus.status === "passed"
                    ? "text-gray-900"
                    : "text-blue-900"
                }`}
              >
                {windowStatus.status === "current"
                  ? "SURF NOW!"
                  : windowStatus.status === "passed"
                  ? "Best Window (Passed)"
                  : "Optimal Window"}
              </h4>
            </div>
            {windowStatus.message && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  windowStatus.status === "current"
                    ? "bg-green-200 text-green-800"
                    : windowStatus.status === "passed"
                    ? "bg-gray-200 text-gray-700"
                    : "bg-blue-200 text-blue-800"
                }`}
              >
                {windowStatus.message}
              </span>
            )}
          </div>
          {intel.best_window_start &&
          intel.best_window_end &&
          intel.best_window_start !== intel.best_window_end ? (
            <p
              className={`text-2xl font-bold ${
                windowStatus.status === "current"
                  ? "text-green-600"
                  : windowStatus.status === "passed"
                  ? "text-gray-600"
                  : "text-blue-600"
              }`}
            >
              {formatTime(intel.best_window_start)} -{" "}
              {formatTime(intel.best_window_end)}
            </p>
          ) : (
            <p
              className={`text-lg font-medium ${
                windowStatus.status === "current"
                  ? "text-green-600"
                  : windowStatus.status === "passed"
                  ? "text-gray-600"
                  : "text-blue-600"
              }`}
            >
              {intel.best_window_description ||
                (intel.raw_intel_data as Record<string, unknown>)?.bestWindow as string ||
                "No optimal window found"}
            </p>
          )}
          {intel.best_window_description &&
            intel.best_window_start &&
            intel.best_window_end && (
              <p
                className={`text-sm mt-1 ${
                  windowStatus.status === "current"
                    ? "text-green-700"
                    : windowStatus.status === "passed"
                    ? "text-gray-600"
                    : "text-blue-700"
                }`}
              >
                {intel.best_window_description}
              </p>
            )}
        </div>

        {/* Condition Intelligence: multi-window + board pick */}
        {primaryWindow && (
          <ConditionIntelligenceSection
            primaryWindow={primaryWindow}
            secondaryWindows={secondaryWindows}
            boardPick={boardPick}
          />
        )}

        {/* Relative context badges */}
        {contextBadges.length > 0 && (
          <RelativeContextBadges badges={contextBadges} />
        )}

        {/* Magic Hour: Interpolated Peak Time */}
        {magicHour?.found && windowStatus.status !== "passed" && (
          <MagicHourSection
            magicHour={magicHour}
            getWindQualityDisplay={getWindQualityDisplay}
          />
        )}

        {/* Magic Hour Loading State */}
        {magicHourLoading && !magicHour && windowStatus.status !== "passed" && (
          <MagicHourLoadingState />
        )}

        {/* Show next favorable window if primary has passed */}
        {windowStatus.status === "passed" && nextWindow && (
          <div className="bg-gradient-to-br from-green-50/80 to-blue-50/50 rounded-xl p-4 border border-green-200/60">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">
                Next Favorable Window Today
              </h4>
            </div>
            {nextWindow.startTime && nextWindow.endTime ? (
              <>
                <p className="text-2xl font-bold text-green-600 mb-1">
                  {formatTime(nextWindow.startTime)} -{" "}
                  {formatTime(nextWindow.endTime)}
                </p>
                <p className="text-sm text-gray-700">
                  {nextWindow.description} • {nextWindow.conditions}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-700">{nextWindow.description}</p>
            )}
          </div>
        )}

        {/* Show current conditions if window has passed and no next window */}
        {windowStatus.status === "passed" && !nextWindow && (
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <h4 className="font-semibold text-blue-900 mb-2 text-sm">
              Current Conditions
            </h4>
            <p className="text-sm text-gray-700">
              Right now: {currentWaveHeightLabel ?? "unknown surf"},{" "}
              {intel.wind_speed_mph} mph {intel.wind_direction_text} (
              {intel.wind_quality}). Check tomorrow&apos;s forecast for next
              windows.
            </p>
          </div>
        )}

        {/* Conditions Grid - 2x2 on mobile, 4 cols on desktop */}
        <div className="grid grid-cols-2 gap-3">
          {/* Surf */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Waves className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-medium text-sky-500">
                Surf
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {surfGridWaveHeightLabel ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {intel.surf_description}
            </p>
          </div>

          {/* Wind */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Wind
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.wind_speed_mph} mph {intel.wind_direction_text}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {intel.wind_quality}
            </p>
          </div>

          {/* Tide */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-medium text-sky-500">
                Tide
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.tide_height_ft} ft @ {formatTime(intel.tide_time)}
            </p>
            {intel.tide_optimal_range && (
              <p className="text-xs text-muted-foreground truncate">
                Best: {intel.tide_optimal_range}
              </p>
            )}
          </div>

          {/* Confidence */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Confidence
              </span>
            </div>
            <p className="font-semibold text-gray-900">{intel.confidence}</p>
            {intel.conditions_score !== null &&
              intel.conditions_score !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Score: {intel.conditions_score}/10
                </p>
              )}
          </div>
        </div>

        {/* Recommendation - Why this window is best */}
        {intel.recommendation && (
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <p className="text-sm text-gray-700 leading-relaxed">
              {intel.recommendation}
            </p>
          </div>
        )}
      </CardContent>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        imageUrl={`/api/og/beach?slug=${beachSlug}`}
        type="wave"
        title={`Surf Intel for ${beachName}`}
        text={`Best surf window: ${formatTime(intel.best_window_start)} - ${formatTime(intel.best_window_end)}`}
        shareUrl={shareUrlWithUtm}
      />
    </Card>
  );
}

// ------------------------------------------------------------------
// Condition Intelligence sub-section
// ------------------------------------------------------------------

/**
 * Renders the multi-window intelligence block:
 * - Primary window with score, character label, reasons
 * - Board pick call-out
 * - Secondary windows in a compact strip
 */
function ConditionIntelligenceSection({
  primaryWindow,
  secondaryWindows,
  boardPick,
}: {
  primaryWindow: ConditionWindow;
  secondaryWindows: ConditionWindow[];
  boardPick?: BoardPick | null;
}) {
  const formatISOTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-2">
      {/* Primary window — prominent */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          background: "linear-gradient(135deg, rgba(247,142,66,0.06), rgba(74,112,217,0.08))",
          borderColor: "rgba(74,112,217,0.2)",
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">
              Best Window
            </h4>
          </div>
          {(primaryWindow.peakScore ?? primaryWindow.avgScore) > 0 && (
            <span className="shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {Math.round(primaryWindow.peakScore ?? primaryWindow.avgScore)}
            </span>
          )}
        </div>

        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
          {formatISOTime(primaryWindow.start)}–{formatISOTime(primaryWindow.end)}
        </p>

        {/* Character label — the "sticker" descriptor */}
        {primaryWindow.character && (
          <p className="font-mono text-sm text-blue-600/80 dark:text-blue-400/80 mb-2 leading-snug">
            {primaryWindow.character.label}
          </p>
        )}

        {/* Reasons — what's working */}
        {primaryWindow.reasons && primaryWindow.reasons.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="What's working">
            {primaryWindow.reasons.map((r) => (
              <li key={r}>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100/60 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {r}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Board pick — inline call-out */}
        {boardPick && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 truncate">
                Grab your {boardPick.boardName}
              </p>
              {boardPick.reason && (
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 truncate">
                  {boardPick.reason}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Secondary windows — compact strip */}
      {secondaryWindows.length > 0 && (
        <div
          className="space-y-1.5"
          role="list"
          aria-label="Additional surf windows today"
        >
          {secondaryWindows.map((w, i) => (
            <div key={`${w.start}-${i}`} role="listitem">
              <SecondaryWindowChip window={w} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Relative context badges section
// ------------------------------------------------------------------

function RelativeContextBadges({
  badges,
}: {
  badges: Array<{
    key: string;
    variant: "gold" | "up" | "down" | "stable" | "swell" | "neutral";
    rotate: number;
    content: React.ReactNode;
  }>;
}) {
  if (badges.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label="Condition context"
    >
      {badges.map((badge) => (
        <div key={badge.key} role="listitem">
          <ContextChip variant={badge.variant} rotate={badge.rotate}>
            {badge.content}
          </ContextChip>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Magic Hour sub-components (extracted to avoid repetition)
// ------------------------------------------------------------------

type WindQualityType = "perfect" | "acceptable" | "cross" | "onshore" | null;

function MagicHourSection({
  magicHour,
  getWindQualityDisplay,
}: {
  magicHour: NonNullable<ReturnType<typeof useMagicHour>["magicHour"]>;
  getWindQualityDisplay: (q: WindQualityType) => { label: string; color: string; bg: string } | null;
}) {
  const formatPeakTime = (peakTime: Date | null) => {
    if (!peakTime) return "";
    try {
      return peakTime.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/50 rounded-xl p-4 border border-purple-200/60">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-purple-900">Magic Hour</h4>
        </div>
        {magicHour.confidence > 0.8 && (
          <span className="text-xs font-medium px-2 py-1 rounded bg-purple-200 text-purple-800">
            High confidence
          </span>
        )}
      </div>

      {magicHour.windowStart && magicHour.windowEnd && (
        <div className="mb-2">
          <p className="text-sm text-purple-700 font-medium">Best Window</p>
          <p className="text-xl font-bold text-purple-600">
            {magicHour.windowStart} - {magicHour.windowEnd}
          </p>
        </div>
      )}

      {magicHour.peakTime && (
        <div className="mb-3">
          <p className="text-sm text-purple-700 font-medium">Peak Conditions</p>
          <p className="text-lg font-bold text-purple-600">
            {formatPeakTime(magicHour.peakTime)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {magicHour.windQuality && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${
              getWindQualityDisplay(magicHour.windQuality)?.bg
            } ${getWindQualityDisplay(magicHour.windQuality)?.color}`}
          >
            {getWindQualityDisplay(magicHour.windQuality)?.label} winds
          </span>
        )}
        {magicHour.swellMatch && (
          <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-600">
            Swell aligned
          </span>
        )}
        {magicHour.tideInRange && (
          <span className="text-xs font-medium px-2 py-1 rounded bg-teal-100 text-teal-600">
            Optimal tide
          </span>
        )}
      </div>
    </div>
  );
}

function MagicHourLoadingState() {
  return (
    <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100/50">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-400 motion-safe:animate-pulse" />
        <span className="text-sm text-purple-600">Calculating peak time...</span>
      </div>
    </div>
  );
}
