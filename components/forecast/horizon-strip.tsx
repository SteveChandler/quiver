"use client";

import { useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  type DaySummary,
  type ConditionTier,
  TIER_COLORS,
  formatWaveRange,
  getTierLabel,
} from "@/lib/utils/horizon-strip-utils";
import { HorizonStripSkeleton } from "./horizon-strip-skeleton";
import { track } from "@/lib/analytics";
import { formatSwellPeriod } from "@/lib/formatters/surf-data";

export interface HorizonStripProps {
  /** Array of day summaries to display */
  days: DaySummary[];
  /** Currently selected date (ISO format: YYYY-MM-DD) */
  selectedDate: string;
  /** Callback when a day is selected */
  onSelectDate: (date: string) => void;
  /** Whether data is still loading */
  isLoading?: boolean;
  /** Beach slug for analytics */
  beachSlug?: string;
}

/**
 * Tier badge styling - subtle indicator in the card
 */
function TierBadge({ tier }: { tier: ConditionTier }) {
  const colors = TIER_COLORS[tier];

  // Only show badge for notable conditions
  if (tier === 'marginal') return null;

  const label = tier === 'great' ? '★' : tier === 'good' ? '●' : '○';

  return (
    <span
      className={cn(
        "absolute top-1 right-1 w-4 h-4 rounded-full",
        "flex items-center justify-center text-[10px]",
        colors.badge,
        tier === 'great' && "text-amber-900",
        tier === 'good' && "text-emerald-900",
        tier === 'fair' && "text-blue-900"
      )}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/**
 * Single day card in the Horizon Strip
 */
function DayCard({
  day,
  isSelected,
  onClick,
}: {
  day: DaySummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = TIER_COLORS[day.tier];
  const waveRange = formatWaveRange(day.minHeight, day.maxHeight);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Base layout
        "relative snap-start",
        "w-full h-[88px] rounded-xl border-2",
        "flex flex-col items-center justify-between p-2",
        // Tier colors
        colors.bg,
        colors.border,
        colors.text,
        // Transitions
        "transition-all duration-200 ease-out",
        // Selected state
        isSelected && [
          "ring-2 ring-offset-2 ring-ocean-blue",
          "scale-105 shadow-lg z-10",
        ],
        // Hover state (when not selected)
        !isSelected && [
          "hover:scale-102 hover:shadow-md",
          "active:scale-100",
        ],
        // Focus state
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
      )}
      aria-label={`${day.dayName}, ${day.date}: ${waveRange}, ${getTierLabel(day.tier)}${isSelected ? ' (selected)' : ''}`}
      aria-pressed={isSelected}
    >
      {/* Tier indicator */}
      <TierBadge tier={day.tier} />

      {/* Day name */}
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          day.isToday && "underline decoration-2 underline-offset-2"
        )}
      >
        {day.dayName}
      </span>

      {/* Wave height */}
      <div className="flex flex-col items-center -mt-0.5">
        <span className="text-lg font-bold leading-tight">
          {waveRange}
        </span>
        {day.period && (
          <span className="text-[11px] opacity-90 leading-tight">
            {formatSwellPeriod(day.period)}
          </span>
        )}
      </div>

      {/* Date */}
      <span className="text-[11px] opacity-90">
        {day.date}
      </span>
    </button>
  );
}

/**
 * 12-Day Horizon Strip
 *
 * A horizontal scrollable strip showing surf condition forecasts for the next 12 days.
 * Each day is color-coded by condition quality (great/good/fair/marginal).
 * Clicking a day selects it for detailed view in the forecast tab.
 */
export function HorizonStrip({
  days,
  selectedDate,
  onSelectDate,
  isLoading = false,
  beachSlug,
}: HorizonStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll selected card into view on mount and when selection changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const selectedIndex = days.findIndex((d) => d.fullDate === selectedDate);
    if (selectedIndex === -1) return;

    // Find the selected card element
    const container = scrollContainerRef.current;
    const cards = container.querySelectorAll('[data-day-card]');
    const selectedCard = cards[selectedIndex] as HTMLElement | undefined;

    if (selectedCard) {
      // Scroll to center the selected card
      const containerWidth = container.offsetWidth;
      const cardLeft = selectedCard.offsetLeft;
      const cardWidth = selectedCard.offsetWidth;
      const scrollTo = cardLeft - (containerWidth / 2) + (cardWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTo),
        behavior: 'smooth',
      });
    }
  }, [selectedDate, days]);

  const handleDayClick = useCallback(
    (day: DaySummary) => {
      onSelectDate(day.fullDate);

      // Track analytics
      if (beachSlug) {
        track("horizon_strip_day_selected", {
          beach_slug: beachSlug,
          selected_date: day.fullDate,
          is_today: day.isToday,
          tier: day.tier,
          score: day.score,
        });
      }
    },
    [onSelectDate, beachSlug]
  );

  // Show skeleton while loading
  if (isLoading) {
    return <HorizonStripSkeleton />;
  }

  // Empty state
  if (days.length === 0) {
    return (
      <div className="py-4 px-4 text-center text-muted-foreground text-sm">
        No forecast data available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex gap-2 overflow-x-auto pb-3",
          "snap-x snap-mandatory scrollbar-hide",
          "-webkit-overflow-scrolling-touch",
          // Full bleed on mobile, contained on desktop
          "-mx-6 px-6"
        )}
        role="listbox"
        aria-label="Forecast days - select a day to view details"
      >
        {days.map((day) => (
          <div key={day.fullDate} data-day-card className="flex-shrink-0 w-[88px] sm:flex-1 sm:min-w-0">
            <DayCard
              day={day}
              isSelected={day.fullDate === selectedDate}
              onClick={() => handleDayClick(day)}
            />
          </div>
        ))}

        {/* Right spacer for mobile scroll */}
        <div className="shrink-0 w-3 sm:hidden" aria-hidden="true" />
      </div>

      {/* Right fade indicator (mobile only) */}
      {days.length > 4 && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-3",
            "w-8 pointer-events-none",
            "bg-gradient-to-l from-white to-transparent",
            "sm:hidden"
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
