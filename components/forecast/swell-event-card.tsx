/**
 * Swell Event Card Components
 *
 * Displays incoming swell events with timeline, direction, and intensity information.
 * Used in regional forecast pages to show upcoming swells.
 *
 * @module components/forecast/swell-event-card
 */

import { cn } from "@/lib/utils";
import { Waves } from "lucide-react";
import type { SwellEvent } from "@/lib/utils/regional-forecast-utils";
import { formatCompactDate, formatShortDate } from "@/lib/utils/time-formatters";
import { getWaveSizeLabel } from "@/lib/utils/wave-formatters";

// ============================================================================
// Types
// ============================================================================

export interface SwellEventCardProps {
  /** The swell event to display */
  event: SwellEvent;
  /** Compact mode for use in lists */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface SwellEventListProps {
  /** Array of swell events to display */
  events: SwellEvent[];
  /** Section title */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Color mapping for swell size categories
 * Progressive intensity from muted to vibrant as waves get bigger
 */
const SIZE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; badge: string; icon: string; peakBg: string }
> = {
  "knee-high": {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    badge: "bg-gray-100 text-gray-600",
    icon: "text-gray-400",
    peakBg: "bg-gray-700",
  },
  "waist-high": {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    badge: "bg-gray-100 text-gray-600",
    icon: "text-gray-400",
    peakBg: "bg-gray-700",
  },
  "chest-high": {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-700",
    icon: "text-blue-500",
    peakBg: "bg-blue-900",
  },
  "head-high": {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-700",
    icon: "text-blue-500",
    peakBg: "bg-blue-900",
  },
  overhead: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700",
    icon: "text-emerald-500",
    peakBg: "bg-emerald-900",
  },
  "double-overhead": {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-700",
    icon: "text-purple-500",
    peakBg: "bg-purple-900",
  },
};

/**
 * Get styles for a given wave size, with fallback
 */
function getSizeStyles(size: string) {
  return SIZE_STYLES[size] || SIZE_STYLES["chest-high"];
}


// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get direction arrow rotation based on swell direction
 */
function getDirectionRotation(direction: string): number {
  const directionMap: Record<string, number> = {
    N: 180,
    NNE: 202.5,
    NE: 225,
    ENE: 247.5,
    E: 270,
    ESE: 292.5,
    SE: 315,
    SSE: 337.5,
    S: 0,
    SSW: 22.5,
    SW: 45,
    WSW: 67.5,
    W: 90,
    WNW: 112.5,
    NW: 135,
    NNW: 157.5,
  };
  return directionMap[direction] || 0;
}

/**
 * Calculate days until an event
 */
function getDaysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const diff = targetDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get timing label (e.g., "Tomorrow", "In 3 days")
 */
function getTimingLabel(date: Date): string {
  const days = getDaysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "Ongoing";
  return `In ${days} days`;
}

// ============================================================================
// Sub-Components
// ============================================================================


/**
 * Direction arrow icon
 */
function DirectionArrow({
  direction,
  className,
}: {
  direction: string;
  className?: string;
}) {
  const rotation = getDirectionRotation(direction);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-4 h-4", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 2L4 14h6v8h4v-8h6L12 2z" />
    </svg>
  );
}

/**
 * Timeline visualization for swell event duration
 */
function SwellTimeline({
  startDate,
  peakDate,
  endDate,
  styles,
}: {
  startDate: Date;
  peakDate: Date;
  endDate: Date;
  styles: ReturnType<typeof getSizeStyles>;
}) {
  const totalDuration = endDate.getTime() - startDate.getTime();
  const peakPosition =
    totalDuration > 0
      ? ((peakDate.getTime() - startDate.getTime()) / totalDuration) * 100
      : 50;

  return (
    <div className="w-full mt-3">
      {/* Date labels */}
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{formatShortDate(startDate)}</span>
        <span className={cn("font-medium", styles.text)}>
          Peak: {formatShortDate(peakDate)}
        </span>
        <span>{formatShortDate(endDate)}</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        {/* Progress bar */}
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", styles.badge)}
          style={{ width: "100%" }}
        />

        {/* Peak indicator */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm",
            styles.peakBg
          )}
          style={{ left: `${peakPosition}%`, marginLeft: "-6px" }}
          aria-label={`Peak on ${formatCompactDate(peakDate)}`}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Components
// ============================================================================

/**
 * SwellEventCard
 *
 * Displays a single swell event with visual intensity, direction, timeline,
 * and key metrics. Color-coded by swell size for quick scanning.
 */
export function SwellEventCard({
  event,
  compact = false,
  className,
}: SwellEventCardProps) {
  const styles = getSizeStyles(event.size);
  const sizeLabel = getWaveSizeLabel(event.size);
  const timingLabel = getTimingLabel(event.startDate);
  const heightRange = `${event.heightRange[0].toFixed(0)}-${event.heightRange[1].toFixed(0)}ft`;

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg border p-3",
          styles.bg,
          styles.border,
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon and label */}
          <div className="flex items-center gap-2 min-w-0">
            <Waves className={styles.icon} />
            <div className="min-w-0">
              <p className={cn("font-medium text-sm truncate", styles.text)}>
                {sizeLabel}
              </p>
              <p className="text-xs text-muted-foreground">{timingLabel}</p>
            </div>
          </div>

          {/* Right: Key metrics */}
          <div className="flex items-center gap-3 text-sm shrink-0">
            <div className="flex items-center gap-1">
              <DirectionArrow direction={event.direction} className={styles.icon} />
              <span className={styles.text}>{event.direction}</span>
            </div>
            <span className={cn("font-semibold", styles.text)}>{heightRange}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4",
        styles.bg,
        styles.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Waves className={cn("w-6 h-6", styles.icon)} />
          <div>
            <h3 className={cn("font-semibold text-lg", styles.text)}>
              {sizeLabel}
            </h3>
            <p className="text-sm text-muted-foreground">{timingLabel}</p>
          </div>
        </div>

        {/* Size badge */}
        <span
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium capitalize",
            styles.badge
          )}
        >
          {event.size.replace("-", " ")}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Height */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
            Height
          </p>
          <p className={cn("font-bold text-lg", styles.text)}>{heightRange}</p>
        </div>

        {/* Period */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
            Period
          </p>
          <p className={cn("font-bold text-lg", styles.text)}>
            {event.period.toFixed(0)}s
          </p>
        </div>

        {/* Direction */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
            Direction
          </p>
          <div className="flex items-center justify-center gap-1">
            <DirectionArrow direction={event.direction} className={styles.icon} />
            <span className={cn("font-bold text-lg", styles.text)}>
              {event.direction}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className={cn("text-sm", styles.text, "opacity-80 mb-2")}>
        {event.description}
      </p>

      {/* Timeline */}
      <SwellTimeline
        startDate={event.startDate}
        peakDate={event.peakDate}
        endDate={event.endDate}
        styles={styles}
      />
    </div>
  );
}

/**
 * SwellEventList
 *
 * Displays multiple swell events sorted by start date.
 * Shows empty state when no swells are detected.
 */
export function SwellEventList({
  events,
  title = "Upcoming Swells",
  className,
}: SwellEventListProps) {
  if (events.length === 0) {
    return (
      <div
        className={cn(
          "text-center py-8 text-muted-foreground",
          className
        )}
      >
        <Waves className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No significant swells in the forecast</p>
      </div>
    );
  }

  // Sort events by start date
  const sortedEvents = [...events].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  return (
    <section className={className}>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <SwellEventCard
            key={`${event.startDate.toISOString()}-${event.direction}-${index}`}
            event={event}
          />
        ))}
      </div>
    </section>
  );
}
