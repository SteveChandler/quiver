/**
 * Swell Event Card Components
 *
 * Displays incoming swell events with timeline, direction, and intensity information.
 * Enhanced with mini wave visualizations and animated effects.
 *
 * @module components/forecast/swell-event-card
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Waves } from "lucide-react";
import type { SwellEvent } from "@/lib/utils/regional-forecast-utils";
import { formatCompactDate, formatShortDate } from "@/lib/utils/date-time";
import { getWaveSizeLabel } from "@/lib/utils/wave-formatters";
import { formatWaveHeightRangeString } from "@/lib/utils/wave-formatters";
import { SwellWaveChart } from "./swell-wave-chart";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatSwellPeriod } from "@/lib/formatters/surf-data";

// ============================================================================
// Types
// ============================================================================

export interface SwellEventCardProps {
  /** The swell event to display */
  event: SwellEvent;
  /** Compact mode for use in lists */
  compact?: boolean;
  /** Visual treatment for page-specific surfaces */
  variant?: "default" | "zine";
  /** Additional CSS classes */
  className?: string;
}

export interface SwellEventListProps {
  /** Array of swell events to display */
  events: SwellEvent[];
  /** Section title */
  title?: string | null;
  /** Visual treatment for page-specific surfaces */
  variant?: "default" | "zine";
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
  { bg: string; border: string; text: string; badge: string; icon: string; peakBg: string; glow?: string }
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
    glow: "shadow-emerald-200",
  },
  "double-overhead": {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-100 text-purple-700",
    icon: "text-purple-500",
    peakBg: "bg-purple-900",
    glow: "shadow-purple-200",
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
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const targetUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  const diff = targetUtc - todayUtc;
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
 * Animated timeline visualization for swell event duration
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
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const totalDuration = endDate.getTime() - startDate.getTime();
  const peakPosition =
    totalDuration > 0
      ? ((peakDate.getTime() - startDate.getTime()) / totalDuration) * 100
      : 50;

  // Calculate current progress (how much of the swell has passed)
  const now = new Date().getTime();
  const progress = totalDuration > 0
    ? Math.max(0, Math.min(100, ((now - startDate.getTime()) / totalDuration) * 100))
    : 0;

  // Animate progress bar on scroll into view
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (reducedMotion) {
      setAnimatedProgress(progress);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate to current progress
            const startTime = performance.now();
            const duration = 800;

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const t = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - t, 3);
              setAnimatedProgress(progress * eased);

              if (t < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
            observer.unobserve(element);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [progress, reducedMotion]);

  return (
    <div ref={elementRef} className="w-full mt-3">
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
        {/* Progress bar (animated) */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
            styles.badge
          )}
          style={{ width: `${animatedProgress}%` }}
        />

        {/* Full duration indicator (dimmed) */}
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full opacity-30", styles.badge)}
          style={{ width: "100%" }}
        />

        {/* Peak indicator with pulse effect */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm",
            styles.peakBg,
            animatedProgress >= peakPosition && "animate-pulse"
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
 * and key metrics. Features mini wave chart and animated timeline.
 */
export function SwellEventCard({
  event,
  compact = false,
  variant = "default",
  className,
}: SwellEventCardProps) {
  const styles = getSizeStyles(event.size);
  const sizeLabel = getWaveSizeLabel(event.size);
  const timingLabel = getTimingLabel(event.startDate);
  // Use the shared formatter for consistent wave height range display (e.g., "4-6ft" not "6-6ft")
  const heightRange = formatWaveHeightRangeString(event.heightRange[0], event.heightRange[1]);
  const isLargeSwell = event.size === "overhead" || event.size === "double-overhead";
  const isZine = variant === "zine";
  const primaryTextClass = isZine ? "text-[#11100D]" : styles.text;
  const mutedTextClass = isZine ? "text-[#11100D]/62" : "text-muted-foreground";
  const iconClass = isZine ? "text-[#0B3A75]" : styles.icon;
  const badgeClass = isZine
    ? "border-2 border-[#11100D] bg-[#F78E42] text-[#11100D]"
    : styles.badge;
  const timelineStyles = isZine
    ? {
        ...styles,
        badge: "bg-[#F78E42] text-[#11100D]",
        peakBg: "bg-[#0B3A75]",
      }
    : styles;

  if (compact) {
    return (
      <div
        className={cn(
          "p-3 transition-[box-shadow,transform] duration-200",
          isZine
            ? "torn torn-tb border-2 border-[#11100D] bg-[#F4EBD8] shadow-[2px_2px_0_rgba(17,16,13,0.35)] hover:-translate-y-0.5"
            : cn("rounded-lg border hover:shadow-md", styles.bg, styles.border),
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon and label */}
          <div className="flex items-center gap-2 min-w-0">
            <Waves className={iconClass} />
            <div className="min-w-0">
              <p className={cn("font-medium text-sm truncate", primaryTextClass)}>
                {sizeLabel}
              </p>
              <p className={cn("text-xs", mutedTextClass)}>{timingLabel}</p>
            </div>
          </div>

          {/* Right: Key metrics */}
          <div className="flex items-center gap-3 text-sm shrink-0">
            <div className="flex items-center gap-1">
              <DirectionArrow direction={event.direction} className={iconClass} />
              <span className={primaryTextClass}>{event.direction}</span>
            </div>
            <span className={cn("font-semibold", primaryTextClass)}>{heightRange}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 p-4 transition-[box-shadow,transform] duration-200",
        isZine
          ? "torn torn-tb border-[#11100D] bg-[#F4EBD8] shadow-[3px_3px_0_rgba(17,16,13,0.35)] hover:-translate-y-0.5"
          : cn("rounded-xl hover:shadow-lg", styles.bg, styles.border, isLargeSwell && styles.glow),
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Waves className={cn("w-6 h-6", iconClass)} />
          <div>
            <h3 className={cn("font-semibold text-lg", primaryTextClass)}>
              {sizeLabel}
            </h3>
            <p className={cn("text-sm", mutedTextClass)}>{timingLabel}</p>
          </div>
        </div>

        {/* Size badge with glow for large swells */}
        <span
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-shadow",
            badgeClass,
            isLargeSwell && "shadow-lg"
          )}
        >
          {event.size.replace("-", " ")}
        </span>
      </div>

      {/* Mini Wave Chart */}
      <div className="flex justify-center mb-4">
        <SwellWaveChart
          height={event.heightRange[1]}
          period={event.period}
          direction={event.direction}
          width={120}
          chartHeight={48}
          colorClass={iconClass}
        />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Height */}
        <div className="text-center">
          <p className={cn("text-xs uppercase tracking-wide mb-0.5", mutedTextClass)}>
            Height
          </p>
          <p className={cn("font-bold text-lg", primaryTextClass)}>{heightRange}</p>
        </div>

        {/* Period */}
        <div className="text-center">
          <p className={cn("text-xs uppercase tracking-wide mb-0.5", mutedTextClass)}>
            Period
          </p>
          <p className={cn("font-bold text-lg", primaryTextClass)}>
            {formatSwellPeriod(event.period)}
          </p>
        </div>

        {/* Direction */}
        <div className="text-center">
          <p className={cn("text-xs uppercase tracking-wide mb-0.5", mutedTextClass)}>
            Direction
          </p>
          <div className="flex items-center justify-center gap-1">
            <DirectionArrow direction={event.direction} className={iconClass} />
            <span className={cn("font-bold text-lg", primaryTextClass)}>
              {event.direction}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className={cn("text-sm opacity-80 mb-2", primaryTextClass)}>
        {event.description}
      </p>

      {/* Animated Timeline */}
      <SwellTimeline
        startDate={event.startDate}
        peakDate={event.peakDate}
        endDate={event.endDate}
        styles={timelineStyles}
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
  variant = "default",
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
      {title && (
        <h2
          className={cn(
            "mb-4",
            variant === "zine"
              ? "font-heading text-xl font-black uppercase tracking-normal text-[#11100D]"
              : "text-lg font-semibold"
          )}
        >
          {title}
        </h2>
      )}
      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <SwellEventCard
            key={`${event.startDate.toISOString()}-${event.direction}-${index}`}
            event={event}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
