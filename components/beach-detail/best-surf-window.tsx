"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { findNextBestWindow } from "@/lib/utils/morning-intel-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { data } from "@/lib/data/client";
import { DEFAULT_TIMEZONE, getLocalDateString } from "@/lib/utils/timezone-utils";
import {
  Clock,
  Waves,
  Wind,
  TrendingUp,
  AlertCircle,
  Share2,
  ChevronRight,
} from "lucide-react";

interface BestSurfWindowProps {
  beachId: string;
  beachName: string;
  beachTimezone?: string | null;
  forecasts?: EnhancedForecastEntity[];
}

type WindowForecast = {
  forecast_time: string;
  forecast_date: string;
  wind_speed: number | null;
  wind_direction: number | null;
  wave_period: number | null;
  swell_1_period: number | null;
  tide_height: number | null;
};

export function BestSurfWindow({
  beachId,
  beachName,
  beachTimezone,
  forecasts,
}: BestSurfWindowProps) {
  const pathname = usePathname();

  // Format time helper
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

  const forecastDate = useMemo(() => {
    const timezone = beachTimezone || DEFAULT_TIMEZONE;
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

  const mappedForecasts: WindowForecast[] = useMemo(() => {
    const rows = (forecasts || []).filter((f) => f.forecast_date === forecastDate);
    return rows.map((f) => ({
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
  }, [forecasts, forecastDate]);

  // Calculate best window from forecasts (used when no intel or when intel window passed)
  const bestWindowFromForecasts = useMemo(() => {
    if (!mappedForecasts || mappedForecasts.length === 0) {
      return null;
    }
    const computed = findNextBestWindow(mappedForecasts, new Date());

    return computed;
  }, [mappedForecasts]);

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
                  🌊 Best Time to Surf Today
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on forecast data
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
                    Best Window Today
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
          </CardContent>
        </Card>
      );
    }

    // No intel and no good forecast window
    return (
      <Card className="rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              Surf intel not available yet
            </p>
            <p className="text-xs text-yellow-700">
              Intel is generated daily for select beaches. Check the detailed
              forecast below for conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if window has passed, is current, or upcoming
  const getWindowStatus = () => {
    if (!intel.best_window_start || !intel.best_window_end) {
      return { status: "unknown", message: "" };
    }

    const now = new Date();
    const today = forecastDate;

    const startTime = new Date(`${today}T${intel.best_window_start}`);
    const endTime = new Date(`${today}T${intel.best_window_end}`);

    if (now < startTime) {
      // Window hasn't started yet
      const hoursUntil = Math.round(
        (startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      const minsUntil = Math.round(
        (startTime.getTime() - now.getTime()) / (1000 * 60)
      );

      if (hoursUntil >= 1) {
        return {
          status: "upcoming",
          message: `Starts in ${hoursUntil} hour${hoursUntil > 1 ? "s" : ""}`,
        };
      } else {
        return {
          status: "upcoming",
          message: `Starts in ${minsUntil} minutes`,
        };
      }
    } else if (now >= startTime && now <= endTime) {
      // Currently in the window
      const minsRemaining = Math.round(
        (endTime.getTime() - now.getTime()) / (1000 * 60)
      );
      return {
        status: "current",
        message:
          minsRemaining > 60
            ? `${Math.floor(minsRemaining / 60)}h ${
                minsRemaining % 60
              }m remaining`
            : `${minsRemaining} mins remaining`,
      };
    } else {
      // Window has passed
      return {
        status: "passed",
        message: "Window has passed",
      };
    }
  };

  const windowStatus = getWindowStatus();
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
              🌊 Best Time to Surf Today
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Updated at {generatedTime}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Share functionality - use native share if available
              if (navigator.share) {
                // eslint-disable-next-line no-restricted-properties -- Web Share API requires full URL with origin
                const shareUrl = `${window.location.origin}${pathname}`;
                navigator.share({
                  title: `Surf Intel for ${beachName}`,
                  text: `Best surf window: ${formatTime(intel.best_window_start)} - ${formatTime(intel.best_window_end)}`,
                  url: shareUrl,
                }).catch(() => {
                  // User cancelled or share failed silently
                });
              }
            }}
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
                  ? "🏄 SURF NOW!"
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
                (intel.raw_intel_data as any)?.bestWindow ||
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

        {/* Show next best window if primary has passed */}
        {windowStatus.status === "passed" && nextWindow && (
          <div className="bg-gradient-to-br from-green-50/80 to-blue-50/50 rounded-xl p-4 border border-green-200/60">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">
                ⏭️ Next Best Window Today
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
              📍 Current Conditions
            </h4>
            <p className="text-sm text-gray-700">
              Right now: {intel.surf_min_ft}-{intel.surf_max_ft} ft,{" "}
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
              <Waves className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Surf
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.surf_min_ft}-{intel.surf_max_ft} ft
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
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
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
                  Score: {intel.conditions_score}/100
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

        {/* Next tide info */}
        {intel.next_tide_type && intel.next_tide_time && (
          <p className="text-xs text-muted-foreground text-center">
            Next {intel.next_tide_type}: {intel.next_tide_height_ft?.toFixed(1)}
            ft @ {intel.next_tide_time}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
