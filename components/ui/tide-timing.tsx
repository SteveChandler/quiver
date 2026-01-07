"use client";

import { cn } from "@/lib/utils";
import { formatTimeInBeachTimezone } from "@/lib/utils/date-utils";
import { Clock, ArrowUp, ArrowDown, Timer } from "lucide-react";

interface TideTimingProps {
  nextTideTime: string;
  nextTideType: string;
  nextTideHeight?: string;
  className?: string;
  variant?: "compact" | "detailed";
  showFullSchedule?: boolean;
  /** ISO 8601 UTC timestamp for timezone-aware formatting (preferred over nextTideTime) */
  nextTideAt?: string | null;
  /** Beach timezone (preferred; computed server-side when available) */
  beachTimezone?: string | null;
}

interface TideScheduleProps {
  tides?: Array<{
    time: number;
    height: number;
    name: string;
    type?: "H" | "L";
  }>;
  className?: string;
  /** Beach timezone (preferred; computed server-side when available) */
  beachTimezone?: string | null;
}

export function TideTiming({
  nextTideTime,
  nextTideType,
  nextTideHeight,
  className,
  variant = "compact",
  nextTideAt,
  beachTimezone,
}: TideTimingProps) {
  const isHighTide = nextTideType.toLowerCase().includes("high");
  const isLowTide = nextTideType.toLowerCase().includes("low");

  const getTideIcon = () => {
    if (isHighTide) return ArrowUp;
    if (isLowTide) return ArrowDown;
    return Timer;
  };

  const getTideColor = () => {
    if (isHighTide) return "text-blue-600";
    if (isLowTide) return "text-gray-600";
    return "text-gray-500";
  };

  const getTideBgColor = () => {
    if (isHighTide) return "bg-blue-50";
    if (isLowTide) return "bg-gray-50";
    return "bg-gray-50";
  };

  /**
   * Format tide time with timezone awareness.
   * If nextTideAt (ISO timestamp) and beach coordinates are available,
   * use timezone-aware formatting to display time in beach's local timezone.
   * Otherwise, fall back to the pre-formatted nextTideTime string.
   */
  const getFormattedTideTime = (): string => {
    // Prefer timezone-aware formatting using ISO timestamp + timezone
    if (nextTideAt && beachTimezone) {
      return formatTimeInBeachTimezone(nextTideAt, beachTimezone);
    }

    // Fall back to parsing the pre-formatted time string
    return formatTideTime(nextTideTime);
  };

  const formatTideTime = (timeStr: string) => {
    if (timeStr === "Unknown" || !timeStr) return "Unknown";

    // If it's already formatted time, return as-is
    if (timeStr.includes(":")) return timeStr;

    // Try to parse as timestamp
    const timestamp = parseInt(timeStr);
    if (!isNaN(timestamp)) {
      return new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    return timeStr;
  };

  const Icon = getTideIcon();

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Icon className={cn("h-4 w-4", getTideColor())} />
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            {isHighTide ? "High" : isLowTide ? "Low" : "Next"}
          </span>
          <span className="text-sm text-muted-foreground">
            {getFormattedTideTime()}
          </span>
          {nextTideHeight && (
            <span className="text-xs text-muted-foreground">
              ({nextTideHeight})
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-gray-200",
        getTideBgColor(),
        className
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200">
        <Icon className={cn("h-5 w-5", getTideColor())} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            Next {isHighTide ? "High Tide" : isLowTide ? "Low Tide" : "Tide"}
          </span>
          <span className="text-sm font-mono text-muted-foreground">
            {getFormattedTideTime()}
          </span>
        </div>
        {nextTideHeight && (
          <p className="text-sm text-muted-foreground">
            Height: {nextTideHeight}
          </p>
        )}
      </div>
    </div>
  );
}

export function TideSchedule({
  tides,
  className,
  beachTimezone,
}: TideScheduleProps) {
  if (!tides || tides.length === 0) {
    return null;
  }

  /**
   * Format tide time with optional timezone awareness.
   * Uses beach coordinates to determine timezone if available.
   */
  const formatTideTime = (timestamp: number): string => {
    // If beach timezone is provided, use timezone-aware formatting
    if (beachTimezone) {
      const isoTimestamp = new Date(timestamp * 1000).toISOString();
      return formatTimeInBeachTimezone(isoTimestamp, beachTimezone);
    }

    // Fallback to browser timezone
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Only calculate on client side to avoid hydration mismatches
  const today = typeof window !== "undefined" ? new Date() : new Date(0);
  const todaysTides = tides.filter((tide) => {
    const tideDate = new Date(tide.time * 1000);
    return tideDate.toDateString() === today.toDateString();
  });

  const isToday = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toDateString() === today.toDateString();
  };

  const getTimeUntil = (timestamp: number) => {
    // Only calculate on client side to avoid hydration mismatches
    if (typeof window === "undefined") {
      return "Loading...";
    }

    const now = Date.now();
    const tideTime = timestamp * 1000;
    const diff = tideTime - now;

    if (diff < 0) return "Past";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
      return `${minutes}m`;
    } else if (hours < 24) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${Math.floor(hours / 24)}d`;
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Today&apos;s Tides</span>
      </div>

      <div className="space-y-2">
        {todaysTides.slice(0, 4).map((tide, index) => {
          const isHigh =
            tide.name.toLowerCase().includes("high") || tide.type === "H";
          const timeUntil = getTimeUntil(tide.time);
          const isPast = timeUntil === "Past";

          return (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg text-sm",
                isHigh
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-gray-50 border border-gray-200",
                isPast && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                {isHigh ? (
                  <ArrowUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-gray-600" />
                )}
                <span className="font-medium">{isHigh ? "High" : "Low"}</span>
                <span className="text-muted-foreground">
                  {Math.round(tide.height * 10) / 10}ft
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">{formatTideTime(tide.time)}</span>
                {!isPast && (
                  <span className="text-xs text-muted-foreground">
                    in {timeUntil}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {todaysTides.length > 4 && (
        <div className="text-xs text-muted-foreground text-center">
          +{todaysTides.length - 4} more tides today
        </div>
      )}
    </div>
  );
}
