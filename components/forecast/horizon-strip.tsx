"use client";

import { useCallback, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
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
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";
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
  /**
   * Index from which cards render as gated (blurred, lock overlay). Clicks on
   * gated cards fire `onGatedClick` instead of `onSelectDate`.
   *
   * When set, visible cards 0..gateIndex-1 behave normally; cards gateIndex..N
   * are rendered blurred to create a loss-aversion signal for anonymous users
   * ("there's a 12-day outlook I could see if I signed up"). Pass `undefined`
   * (or don't pass) to disable gating entirely.
   */
  publicGateFromIndex?: number;
  /** Invoked when a gated (blurred) card is clicked. Typically opens auth. */
  onGatedClick?: () => void;
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
  index,
  gated = false,
}: {
  day: DaySummary;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  gated?: boolean;
}) {
  const colors = TIER_COLORS[day.tier];
  const waveRange = formatWaveRange(day.minHeight, day.maxHeight);

  return (
    <button
      type="button"
      onClick={onClick}
      // NOTE: do NOT set aria-disabled here. The gated card is still
      // fully clickable — tapping it opens the signup auth modal — so
      // declaring it "disabled" to screen readers would be semantically
      // wrong and misleading (user hears "disabled, dimmed" then the
      // button actually works). The aria-label below already announces
      // "locked — sign up to unlock", which is the correct affordance.
      className={cn(
        // Base layout
        "relative snap-start overflow-hidden",
        "w-full h-[88px] rounded-xl border-2",
        "flex flex-col items-center justify-between p-2",
        // Tier colors
        colors.bg,
        colors.border,
        colors.text,
        // Transitions
        "transition-all duration-200 ease-out",
        // Entry animation
        "animate-container-fade-slide-up motion-reduce:animate-none",
        // Selected state
        isSelected && !gated && [
          "ring-2 ring-offset-2 ring-ocean-blue",
          "scale-105 shadow-lg z-10",
        ],
        // Hover state (when not selected)
        !isSelected && !gated && [
          "hover:scale-102 hover:shadow-md",
          "active:scale-100",
        ],
        // Focus state
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
      aria-label={
        gated
          ? `${day.dayName}, ${day.date}: locked — sign up to unlock`
          : `${day.dayName}, ${day.date}: ${waveRange}, ${getTierLabel(day.tier)}${isSelected ? ' (selected)' : ''}`
      }
      aria-pressed={!gated && isSelected}
    >
      {/* Wave texture at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[20px] opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 20%22><path d=%22M0 10 Q25 0 50 10 T100 10%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22/></svg>')`,
          backgroundSize: '100px 20px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'bottom',
        }}
        aria-hidden="true"
      />

      {/* Inner card contents — blur the data itself (tier badge, wave range,
          date) when gated so users can see there's a forecast, but can't read
          the value. Keep the day name legible so the strip still feels like
          a calendar. */}
      <div
        className={cn(
          "contents",
          gated && "[&>*]:opacity-100"
        )}
      >
        {/* Tier indicator — hidden when gated so we don't leak the quality signal */}
        {!gated && <TierBadge tier={day.tier} />}

        {/* Day name (always crisp so the calendar still reads) */}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            day.isToday && "underline decoration-2 underline-offset-2"
          )}
        >
          {day.dayName}
        </span>

        {/* Wave height — blurred when gated */}
        <div
          className={cn(
            "flex flex-col items-center -mt-0.5 transition-[filter] duration-200",
            gated && "blur-[4px] select-none"
          )}
          aria-hidden={gated || undefined}
        >
          <span className="text-lg font-bold leading-tight">
            {waveRange}
          </span>
          {day.period && (
            <span className="text-[11px] opacity-90 leading-tight">
              {formatSwellPeriod(day.period)}
            </span>
          )}
        </div>

        {/* Date — blurred when gated */}
        <span
          className={cn(
            "text-[11px] opacity-90 transition-[filter] duration-200",
            gated && "blur-[3px] select-none"
          )}
          aria-hidden={gated || undefined}
        >
          {day.date}
        </span>
      </div>

      {/* Lock overlay for gated cards */}
      {gated && (
        <span
          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-white/90"
          aria-hidden="true"
        >
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}
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
  publicGateFromIndex,
  onGatedClick,
}: HorizonStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasTrackedGateView = useRef(false);

  const gateActive =
    typeof publicGateFromIndex === "number" &&
    publicGateFromIndex < days.length;

  // Scroll selected card into view on mount and when selection changes.
  // Do NOT scroll to a gated card — selectedDate may refer to a gated future
  // day that no data is actually rendered for; scrolling past the free window
  // would defeat the loss-aversion hint.
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const selectedIndex = days.findIndex((d) => d.fullDate === selectedDate);
    if (selectedIndex === -1) return;
    if (gateActive && selectedIndex >= (publicGateFromIndex as number)) return;

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
  }, [selectedDate, days, gateActive, publicGateFromIndex]);

  // Fire a single signup_cta_view when the gated strip is mounted (dedup is
  // session-per-source, so navigating between beaches re-tracks per beach
  // because source includes beachSlug).
  useEffect(() => {
    if (!gateActive || hasTrackedGateView.current) return;
    hasTrackedGateView.current = true;
    trackSignupCtaView({
      source: beachSlug
        ? `horizon-strip-gated-days-${beachSlug}`
        : "horizon-strip-gated-days",
      cta_copy_variant: "horizon_blur_v1",
      gated_from_index: publicGateFromIndex,
      total_days: days.length,
    });
  }, [gateActive, beachSlug, publicGateFromIndex, days.length]);

  const handleDayClick = useCallback(
    (day: DaySummary, index: number) => {
      const isGated =
        typeof publicGateFromIndex === "number" &&
        index >= publicGateFromIndex;

      if (isGated) {
        trackSignupCtaClick({
          source: beachSlug
            ? `horizon-strip-gated-days-${beachSlug}`
            : "horizon-strip-gated-days",
          cta_copy_variant: "horizon_blur_v1",
          gated_day: day.fullDate,
          gated_day_index: index,
        });
        onGatedClick?.();
        return;
      }

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
    [onSelectDate, beachSlug, publicGateFromIndex, onGatedClick]
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
        {days.map((day, index) => {
          const isGated =
            typeof publicGateFromIndex === "number" &&
            index >= publicGateFromIndex;
          return (
            <div key={day.fullDate} data-day-card className="flex-shrink-0 w-[88px] sm:flex-1 sm:min-w-0">
              <DayCard
                day={day}
                isSelected={day.fullDate === selectedDate}
                onClick={() => handleDayClick(day, index)}
                index={index}
                gated={isGated}
              />
            </div>
          );
        })}

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
