"use client";

import React, { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import {
  formatBeachDateTime,
  formatBeachTimeRange,
  formatBestAtLabel,
} from "@/lib/utils/date-utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/ui/kpi-tile";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { ShareSheet } from "@/components/share";
import { buildWaveShareUrl } from "@/lib/share/build-share-card-url";
import {
  Target,
  MapPin,
  Clock,
  Wind,
  Waves,
  Users,
  CheckCircle,
  Calendar,
  Ruler,
  ChevronRight,
  Share2,
  Bell,
  BellRing,
  Home,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { isNativeApp } from "@/lib/mobile/platform";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useMagicHour } from "@/hooks/use-magic-hour";
import type {
  PersonalizedForecastRecommendation,
  PersonalizedInsights,
} from "@/types/personalization";

/**
 * Reminder state for the card
 */
type ReminderState =
  | "idle"           // Initial state, can show reminder CTA
  | "needs_home"     // Needs home beach to be set first
  | "enabling"       // Enabling notifications
  | "enabled"        // Notifications enabled successfully
  | "error"          // Error enabling notifications
  | "denied";        // Push permission denied at browser/OS level

/**
 * Result from the onEnableReminder callback
 * Provides structured feedback for error recovery UI
 */
export type ReminderResult = {
  success: boolean;
  /** Error type for UI differentiation */
  errorType?: "denied" | "error" | "unsupported";
  /** Optional error message for display */
  errorMessage?: string;
};

/**
 * Props for PersonalizedForecastCard component
 */
interface PersonalizedForecastCardProps {
  /** Personalized forecast recommendation data */
  recommendation: PersonalizedForecastRecommendation | null;
  /** Personalized insights from session history */
  insights?: PersonalizedInsights | null;
  /** Loading state for insights */
  insightsLoading?: boolean;
  /** Loading state indicator */
  loading?: boolean;
  /** Error object if fetch failed */
  error?: Error | null;
  /** Callback when user clicks "Plan Session" */
  onPlanSession: () => void;
  /** Callback when user clicks "View Beach Details" */
  onViewBeach: (beachId: string) => void;
  /** Callback when user clicks "View Similar Sessions" */
  onViewSimilarSessions?: () => void;
  /** User's current home beach ID (null if not set) */
  homeBeachId?: string | null;
  /** Whether forecast alerts are already enabled */
  forecastAlertsEnabled?: boolean;
  /** Callback to enable reminder (sets home beach + notification flags)
   * Returns either a boolean (legacy) or ReminderResult for detailed error handling */
  onEnableReminder?: (beachId: string, beachName: string) => Promise<boolean | ReminderResult>;
}

/**
 * Loading skeleton for PersonalizedForecastCard
 * Matches the structure of the main component for smooth transitions
 */
function PersonalizedForecastCardSkeleton() {
  return (
    <Card className="w-full" data-testid="personalized-forecast-card-loading">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="animate-pulse space-y-2 flex-1">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Beach details skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="h-5 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>

        {/* Best window skeleton */}
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* KPI tiles skeleton */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>

        {/* Summary skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-3 w-full animate-pulse">
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Error state for PersonalizedForecastCard
 */
function PersonalizedForecastCardError({ error }: { error: Error }) {
  return (
    <Card
      className="w-full border-red-200"
      data-testid="personalized-forecast-card-error"
    >
      <CardContent className="p-6">
        <div className="text-center space-y-3">
          <div className="text-red-600 font-medium">
            Unable to Load Recommendation
          </div>
          <div className="text-sm text-gray-600">
            {error.message ||
              "An error occurred while fetching your personalized forecast."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format time from Date object to readable string in beach's timezone.
 * Uses shared date-utils for consistent timezone handling.
 */
function formatTime(date: Date, timezone: string): string {
  return formatBeachDateTime(date, timezone, "h:mm a");
}

/**
 * Format date range for display (detailed version with minutes) in beach's timezone.
 * Uses shared date-utils for consistent timezone handling.
 */
function formatTimeRange(start: Date, end: Date, timezone: string): string {
  // Simple approach: use formatBeachTimeRange which handles the full range
  // But we want just time without weekday here, so compose manually
  return `${formatTime(start, timezone)} - ${formatTime(end, timezone)}`;
}

/**
 * Format time compactly for headlines (e.g., "7am", "10am") in beach's timezone.
 * Omits minutes if on the hour for cleaner display.
 * Uses shared date-utils for consistent timezone handling.
 */
function formatTimeCompact(date: Date, timezone: string): string {
  const minutesStr = formatBeachDateTime(date, timezone, "m");
  const minutes = parseInt(minutesStr, 10);
  if (minutes === 0) {
    return formatBeachDateTime(date, timezone, "ha").toLowerCase(); // "7am"
  }
  // For non-zero minutes, compose manually
  const hourStr = formatBeachDateTime(date, timezone, "h:mm a");
  return hourStr.replace(/ /g, "").toLowerCase(); // "7:30am"
}

/**
 * Format time range compactly for headlines (e.g., "7-10am", "7am-1pm") in beach's timezone.
 * Uses shared am/pm suffix when both times are in same period.
 * Uses shared date-utils for consistent timezone handling.
 */
function formatTimeRangeCompact(start: Date, end: Date, timezone: string): string {
  // Get local hours in the beach timezone to determine AM/PM
  const startHourStr = formatBeachDateTime(start, timezone, "H");
  const endHourStr = formatBeachDateTime(end, timezone, "H");
  const startHour = parseInt(startHourStr, 10);
  const endHour = parseInt(endHourStr, 10);
  const startIsPM = startHour >= 12;
  const endIsPM = endHour >= 12;

  // If both in same period (AM or PM), share the suffix
  if (startIsPM === endIsPM) {
    const startMinutesStr = formatBeachDateTime(start, timezone, "m");
    const startMinutes = parseInt(startMinutesStr, 10);

    // Format start without am/pm - extract just hour (and minutes if needed)
    const startFullTime = formatBeachDateTime(start, timezone, "h:mm a");
    const startParts = startFullTime.split(" ");
    const startTimeOnly = startParts[0]; // "10:00" or "7:30"
    const startStr = startMinutes === 0
      ? startTimeOnly.split(":")[0] // Just hour: "10"
      : startTimeOnly; // With minutes: "7:30"

    // Format end with am/pm
    const endStr = formatTimeCompact(end, timezone);

    return `${startStr}-${endStr}`;
  }

  // Different periods, show both
  return `${formatTimeCompact(start, timezone)}-${formatTimeCompact(end, timezone)}`;
}

/**
 * Get confidence level indicator with color
 */
function getConfidenceIndicator(confidence: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (confidence >= 80) {
    return {
      label: "High",
      color: "text-green-600",
      bgColor: "bg-green-50",
    };
  }
  if (confidence >= 60) {
    return {
      label: "Good",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    };
  }
  if (confidence >= 40) {
    return {
      label: "Fair",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    };
  }
  return {
    label: "Low",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  };
}

/**
 * Window timing relative to today
 */
type WindowTiming = "today" | "tomorrow" | "later";

/**
 * Determine if the best window is today, tomorrow, or further out
 * Uses local dates for comparison (not UTC)
 */
function getWindowTiming(windowStart: Date): WindowTiming {
  const now = new Date();
  const windowDate = new Date(windowStart);

  // Get dates at midnight for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowDay = new Date(
    windowDate.getFullYear(),
    windowDate.getMonth(),
    windowDate.getDate()
  );

  // Calculate difference in days
  const diffTime = windowDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return "later";
}

/**
 * Get title text based on window timing, including specific time window in beach's timezone
 * @param timing - Whether the window is today, tomorrow, or later
 * @param start - Optional start time of the window
 * @param end - Optional end time of the window
 * @param timezone - Beach's IANA timezone for consistent display
 * @returns Title string with time (e.g., "Best Surf 7-10am")
 */
function getWindowTitle(
  timing: WindowTiming,
  start?: Date,
  end?: Date,
  timezone?: string
): string {
  // If we have valid dates and timezone, include the time range
  if (start && end && timezone) {
    const timeRange = formatTimeRangeCompact(start, end, timezone);

    switch (timing) {
      case "today":
        return `Best Surf ${timeRange}`;
      case "tomorrow":
        return `Best Tomorrow ${timeRange}`;
      case "later":
        return `Best ${formatBeachDateTime(start, timezone, "EEE")} ${timeRange}`;
    }
  }

  // Fallback without time (for edge cases)
  switch (timing) {
    case "today":
      return "Your Best Spot Today";
    case "tomorrow":
      return "Tomorrow Looks Better";
    case "later":
      return "Best Conditions Ahead";
  }
}

/**
 * PersonalizedForecastCard displays a personalized surf forecast recommendation
 * with optimal time window, conditions, and action buttons.
 *
 * Features:
 * - Loading skeleton state
 * - Error handling with clear messaging
 * - Personalized recommendation badge
 * - Best surf window with conditions
 * - KPI tiles for key metrics (Waves, Crowd, Match)
 * - Summary with personalization reasons
 * - Action buttons for session planning
 *
 * Memoized to prevent unnecessary re-renders when props haven't changed.
 */
export const PersonalizedForecastCard = React.memo(
  function PersonalizedForecastCard({
    recommendation,
    insights,
    insightsLoading = false,
    loading = false,
    error = null,
    onPlanSession,
    onViewBeach,
    onViewSimilarSessions,
    homeBeachId,
    forecastAlertsEnabled = false,
    onEnableReminder,
  }: PersonalizedForecastCardProps) {
    // Share sheet state - must be called before any early returns
    const [shareSheetOpen, setShareSheetOpen] = useState(false);
    const [shareImageUrl, setShareImageUrl] = useState("");

    // Reminder state
    const [reminderState, setReminderState] = useState<ReminderState>("idle");
    const [showHomeBeachPrompt, setShowHomeBeachPrompt] = useState(false);

    // Magic Hour for peak time display
    const { magicHour, isLoading: magicHourLoading } = useMagicHour(
      recommendation?.beach?.id ?? null
    );

    // Calculate window timing (today, tomorrow, or later)
    const windowTiming = recommendation
      ? getWindowTiming(recommendation.window.start)
      : "today";

    // Track first-win impression on mount
    const hasTrackedImpression = React.useRef(false);
    useEffect(() => {
      if (recommendation && !hasTrackedImpression.current) {
        hasTrackedImpression.current = true;
        const timing = getWindowTiming(recommendation.window.start);
        track("first_win_impression", {
          beach_id: recommendation.beach.id,
          beach_name: recommendation.beach.name,
          best_window_start: recommendation.window.start.toISOString(),
          best_window_end: recommendation.window.end.toISOString(),
          has_home_beach: !!homeBeachId,
          forecast_alerts_enabled: forecastAlertsEnabled,
          window_timing: timing,
        });

        // Track tomorrow framing specifically when shown
        if (timing !== "today") {
          track("first_win_tomorrow_shown", {
            beach_id: recommendation.beach.id,
            beach_name: recommendation.beach.name,
            window_timing: timing,
            best_window_start: recommendation.window.start.toISOString(),
          });
        }
      }
    }, [recommendation, homeBeachId, forecastAlertsEnabled]);

    // Determine if reminder CTA should be shown (not during error/denied states - they show inline UI)
    const showReminderCTA = onEnableReminder &&
      reminderState !== "enabled" &&
      reminderState !== "error" &&
      reminderState !== "denied" &&
      !forecastAlertsEnabled;

    // Helper to parse reminder result (handles both boolean and ReminderResult)
    const parseReminderResult = (result: boolean | ReminderResult): { success: boolean; errorType?: "denied" | "error" | "unsupported" } => {
      if (typeof result === "boolean") {
        return { success: result, errorType: result ? undefined : "error" };
      }
      return { success: result.success, errorType: result.errorType };
    };

    // Handle reminder CTA click
    const handleReminderClick = useCallback(async () => {
      if (!recommendation || !onEnableReminder) return;

      const beachId = recommendation.beach.id;
      const beachName = recommendation.beach.name;

      // Check if home beach needs to be set
      if (!homeBeachId) {
        setShowHomeBeachPrompt(true);
        setReminderState("needs_home");
        return;
      }

      // Enable notifications
      setReminderState("enabling");
      try {
        const result = await onEnableReminder(beachId, beachName);
        const { success, errorType } = parseReminderResult(result);

        if (success) {
          setReminderState("enabled");
          track("first_win_reminder_enabled", {
            beach_id: beachId,
            beach_name: beachName,
            set_home_beach: false,
          });
        } else if (errorType === "denied") {
          setReminderState("denied");
          track("first_win_reminder_declined", {
            beach_id: beachId,
            beach_name: beachName,
            dismissal_reason: "permission_denied",
          });
        } else {
          setReminderState("error");
          track("first_win_reminder_declined", {
            beach_id: beachId,
            beach_name: beachName,
            dismissal_reason: "enable_failed",
          });
        }
      } catch {
        setReminderState("error");
      }
    }, [recommendation, homeBeachId, onEnableReminder]);

    // Handle setting home beach + enabling reminders in one step
    const handleSetHomeAndEnable = useCallback(async () => {
      if (!recommendation || !onEnableReminder) return;

      const beachId = recommendation.beach.id;
      const beachName = recommendation.beach.name;

      setReminderState("enabling");
      setShowHomeBeachPrompt(false);

      try {
        const result = await onEnableReminder(beachId, beachName);
        const { success, errorType } = parseReminderResult(result);

        if (success) {
          setReminderState("enabled");
          track("first_win_reminder_enabled", {
            beach_id: beachId,
            beach_name: beachName,
            set_home_beach: true,
          });
        } else if (errorType === "denied") {
          setReminderState("denied");
        } else {
          setReminderState("error");
        }
      } catch {
        setReminderState("error");
      }
    }, [recommendation, onEnableReminder]);

    // Handle dismissing the home beach prompt
    const handleDismissHomePrompt = useCallback(() => {
      setShowHomeBeachPrompt(false);
      setReminderState("idle");
      if (recommendation) {
        track("first_win_reminder_declined", {
          beach_id: recommendation.beach.id,
          beach_name: recommendation.beach.name,
          dismissal_reason: "home_beach_declined",
        });
      }
    }, [recommendation]);

    // Handle retry after error
    const handleRetryReminder = useCallback(() => {
      if (recommendation) {
        track("first_win_reminder_retry", {
          beach_id: recommendation.beach.id,
          beach_name: recommendation.beach.name,
          previous_state: reminderState,
        });
      }
      // Reset state and trigger the reminder flow again
      setReminderState("idle");
      // Use setTimeout to ensure state update completes before re-triggering
      setTimeout(() => {
        handleReminderClick();
      }, 0);
    }, [recommendation, reminderState, handleReminderClick]);

    const handleShare = useCallback(() => {
      if (!recommendation) return;
      const { beach, window } = recommendation;
      const desc = `${beach.name} · ${window.tide} · ${window.wind}`;
      const url = buildWaveShareUrl({
        size: window.waveHeight,
        desc,
      });
      setShareImageUrl(url);
      setShareSheetOpen(true);
    }, [recommendation]);

    // Track plan session click
    const handlePlanSessionClick = useCallback(() => {
      if (recommendation) {
        track("first_win_plan_clicked", {
          beach_id: recommendation.beach.id,
          beach_name: recommendation.beach.name,
        });
      }
      onPlanSession();
    }, [recommendation, onPlanSession]);

    // Handle loading state
    if (loading) {
      return <PersonalizedForecastCardSkeleton />;
    }

    // Handle error state
    if (error) {
      return <PersonalizedForecastCardError error={error} />;
    }

    // Handle no data state - don't render anything
    if (!recommendation) {
      return null;
    }

    const { beach, window, score, breakdown, summary, reasons } =
      recommendation;
    const confidenceIndicator = getConfidenceIndicator(window.confidence);
    const waveSourceLabel =
      window.dataSource === "CDIP" || window.dataSource === "NOAA_BUOY"
        ? "Live"
        : "Forecast";

    // Calculate personalization boost (how much better than base score)
    const personalizationBoost =
      breakdown.onboardingPrefs + breakdown.learnedPrefs + breakdown.affinity;
    const boostLabel =
      personalizationBoost >= 20
        ? "Perfect"
        : personalizationBoost >= 10
        ? "Great"
        : personalizationBoost >= 5
        ? "Good"
        : "Standard";

    // If insights exist but matchPercent is 0, hide the entire "For You" tile
    // (avoids an empty/incorrect personalization container).
    const shouldHideForYouTile =
      !!insights && (insights.matchPercent ?? 0) === 0;

    return (
      <Card className="w-full" data-testid="personalized-forecast-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle
                className="text-xl sm:text-2xl flex items-center gap-2 flex-wrap"
                data-testid="personalized-forecast-title"
              >
                <Target className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="font-bold">
                  {getWindowTitle(windowTiming, window.start, window.end, window.timezone)}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{beach.name}</span>
                <span className="text-muted-foreground/60 mx-1">·</span>
                <Calendar className="h-4 w-4 shrink-0" />
                {formatBeachDateTime(window.start, window.timezone, "EEE, MMM d")}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Share forecast"
                data-testid="personalized-forecast-share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <PersonalizedBadge
                personalized={recommendation.personalized}
                score={score}
                breakdown={breakdown}
                displayMode="score"
                size="md"
                showDelta
                baseScore={breakdown?.base}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Beach Details Section */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  {beach.name}
                </h3>
                {beach.lat && beach.lon && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {beach.region || "California"}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewBeach(beach.id)}
              >
                Details
              </Button>
            </div>
          </div>

          {/* Best Window Section */}
          <div className="space-y-3" data-testid="best-window">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Best Window
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-600 font-medium mb-1">
                      Time
                    </div>
                    <div className="text-sm font-semibold text-blue-700">
                      {formatTimeRange(window.start, window.end, window.timezone)}
                    </div>
                    {/* Peak time from Magic Hour */}
                    {!magicHourLoading &&
                      magicHour?.found &&
                      magicHour.peakTime && (
                        <div
                          className="text-xs text-blue-500 mt-0.5"
                          data-testid="magic-hour-peak-time"
                        >
                          Peak at {formatTime(magicHour.peakTime, window.timezone)}
                        </div>
                      )}
                  </div>
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-cyan-600 font-medium mb-1">
                      Tide
                    </div>
                    <div className="text-sm font-semibold text-cyan-700">
                      {window.tide}
                    </div>
                  </div>
                  <Waves className="h-5 w-5 text-cyan-500" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-green-600 font-medium mb-1">
                      Wind
                    </div>
                    <div className="text-sm font-semibold text-green-700">
                      {window.wind}
                    </div>
                  </div>
                  <Wind className="h-5 w-5 text-green-500" />
                </div>
              </div>

              <div
                className={cn(
                  "p-3 rounded-lg border",
                  confidenceIndicator.bgColor
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={cn(
                        "text-xs font-medium mb-1",
                        confidenceIndicator.color
                      )}
                    >
                      Confidence
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        confidenceIndicator.color
                      )}
                    >
                      {window.confidence}% {confidenceIndicator.label}
                    </div>
                  </div>
                  <CheckCircle
                    className={cn("h-5 w-5", confidenceIndicator.color)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI Tiles Grid */}
          <div
            className={cn(
              "grid gap-3",
              shouldHideForYouTile ? "grid-cols-2" : "grid-cols-3"
            )}
          >
            <KpiTile
              value={window.waveHeight}
              label={
                <div className="space-y-0.5">
                  <div>Waves</div>
                  <div className="text-[10px] opacity-70">
                    {window.wavePeriod} · {waveSourceLabel}
                  </div>
                </div>
              }
              className="bg-blue-50"
              valueClassName="text-blue-600"
              labelClassName="text-blue-500"
            />

            {!shouldHideForYouTile && (
              <KpiTile
                value={
                  insights?.state === "ready" ? insights.label : boostLabel
                }
                label={
                  <div className="space-y-0.5">
                    <div>For You</div>
                    {insights && (
                      <div className="text-[10px] opacity-70">
                        {insights.matchPercent}% Match
                      </div>
                    )}
                  </div>
                }
                className={cn(
                  "bg-purple-50 transition-all",
                  onViewSimilarSessions &&
                    insights?.similarSessions.length &&
                    "cursor-pointer hover:bg-purple-100"
                )}
                valueClassName="text-purple-600 text-base"
                labelClassName="text-purple-500"
                testId="personalized-forecast-for-you-tile"
                onClick={
                  onViewSimilarSessions && insights?.similarSessions.length
                    ? onViewSimilarSessions
                    : undefined
                }
              />
            )}

            <KpiTile
              value={Math.round(score)}
              unit="%"
              label="Match"
              className="bg-green-50"
              valueClassName="text-green-600"
              labelClassName="text-green-500"
            />
          </div>

          {/* Board Tip Section */}
          {insights?.boardTip && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <Ruler className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-900 mb-0.5">
                    Board Recommendation
                  </p>
                  <p className="text-sm text-amber-800">{insights.boardTip}</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Section */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
            {/* Onboarding state: show first reason as helpful text */}
            {insights?.state === "onboarding" &&
            insights.reasonBullets.length > 0 ? (
              <div className="text-sm text-slate-700 leading-relaxed">
                <p className="font-medium mb-2">
                  Getting to know your preferences
                </p>
                <p>{insights.reasonBullets[0]}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">
                {summary}
              </p>
            )}

            {reasons && reasons.length > 0 && (
              <ul className="space-y-1.5">
                {reasons.map((reason, index) => (
                  <li
                    key={index}
                    className="text-xs text-slate-600 flex items-start gap-2"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* View Similar Sessions Link */}
            {insights?.similarSessions &&
              insights.similarSessions.length > 0 &&
              onViewSimilarSessions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewSimilarSessions}
                  className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-2"
                  data-testid="personalized-forecast-view-similar-sessions"
                >
                  <span className="text-sm">
                    View {insights.similarSessions.length} similar session
                    {insights.similarSessions.length !== 1 ? "s" : ""}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Home Beach Prompt - shown when user needs to set home beach first */}
          {showHomeBeachPrompt && (
            <div className="w-full p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <Home className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    Set {beach.name} as your home beach?
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    You&apos;ll get notified when conditions are good for surfing.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSetHomeAndEnable}
                      disabled={reminderState === "enabling"}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {reminderState === "enabling" ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Setting...
                        </>
                      ) : (
                        <>
                          <Home className="h-3 w-3 mr-1" />
                          Set & Notify Me
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDismissHomePrompt}
                      disabled={reminderState === "enabling"}
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reminder Enabled Success */}
          {reminderState === "enabled" && (
            <div className="w-full p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  You&apos;ll be notified when conditions look good!
                </p>
              </div>
            </div>
          )}

          {/* Reminder Error State - Generic error with retry */}
          {reminderState === "error" && (
            <div
              className="w-full p-3 rounded-lg bg-red-50 border border-red-200"
              data-testid="reminder-error-state"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 mb-1">
                    Couldn&apos;t enable reminders
                  </p>
                  <p className="text-xs text-red-700 mb-3">
                    Something went wrong. Please try again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryReminder}
                    className="border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800"
                    data-testid="reminder-retry-button"
                    aria-label="Retry enabling reminders"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reminder Denied State - Permission blocked with platform-specific instructions */}
          {reminderState === "denied" && (
            <div
              className="w-full p-3 rounded-lg bg-amber-50 border border-amber-200"
              data-testid="reminder-denied-state"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    Notifications are blocked
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    {isNativeApp() ? (
                      <>Go to <span className="font-medium">Settings &gt; Quiver</span> and enable notifications to get alerts.</>
                    ) : (
                      <>Click the <span className="font-medium">lock icon</span> in your address bar and allow notifications for this site.</>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryReminder}
                    className="border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                    data-testid="reminder-denied-retry-button"
                    aria-label="Try enabling reminders again after changing settings"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    I&apos;ve Enabled Notifications
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 w-full">
            <Button
              className="flex-1"
              onClick={handlePlanSessionClick}
              data-testid="plan-session-from-personalized"
            >
              Plan Session
            </Button>
            {showReminderCTA && !showHomeBeachPrompt ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReminderClick}
                disabled={reminderState === "enabling"}
                data-testid="remind-me-cta"
              >
                {reminderState === "enabling" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Remind Me
                  </>
                )}
              </Button>
            ) : reminderState !== "enabled" && reminderState !== "error" && reminderState !== "denied" ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onViewBeach(beach.id)}
              >
                View Forecast
              </Button>
            ) : null}
          </div>
        </CardFooter>

        {/* Share Sheet */}
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          type="wave"
          imageUrl={shareImageUrl}
          filename="quiver-forecast"
          title={`${window.waveHeight} at ${beach.name}`}
          text={`Check out the waves! ${window.waveHeight} at ${beach.name} - ${window.tide}, ${window.wind}`}
        />
      </Card>
    );
  }
);
