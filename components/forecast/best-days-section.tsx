"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  trackBestConditionsViewed,
  trackBestConditionsClick,
} from "@/lib/analytics/engagement-tracking";
import type { DaySummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses, scoreLabel } from "@/lib/utils/score-color-utils";
import { formatWaveRange } from "@/lib/utils/wave-formatters";

import { ScoreBadge } from "./score-badge";
import { ScoreLoginLink } from "./score-login-link";
import { AnimatedScoreGauge } from "./animated-score-gauge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { QuiverSticker } from "@/components/zine";
import { useOptionalAuth } from "@/context/auth-context";
import {
  Sun,
  Wind,
  CloudSun,
  Cloud,
  Sunrise,
  Clock,
  Waves,
} from "lucide-react";

/** Format a YYYY-MM-DD dateString to "Feb 6" style, timezone-safe */
function formatDateStringUTC(dateString: string): string {
  return new Date(dateString + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Props for the BestDaysSection component
 */
interface BestDaysSectionProps {
  /** Array of day summaries from RegionalForecastSummary */
  days: DaySummary[];
  /** The best day for surfing in the region */
  bestDay: DaySummary;
  /** Region name for display text (e.g., "San Diego") */
  regionName: string;
  /** Optional className for customization */
  className?: string;
  /** Region slug for the score login return path */
  regionSlug?: string;
  /** Whether score values are available to this viewer */
  showScores?: boolean;
  /** Resolve score visibility from the client auth context. */
  authAwareScores?: boolean;
}

/**
 * Props for individual BestDayCard component
 */
interface BestDayCardProps {
  day: DaySummary;
  isHero?: boolean;
  className?: string;
  /** Stagger index for animation delay */
  index?: number;
  /** Click handler for analytics tracking */
  onClick?: () => void;
  showScores: boolean;
}

/**
 * Get wind condition icon and label
 */
function getWindInfo(
  windConditions: DaySummary["windConditions"]
): { icon: React.ReactNode; label: string } {
  switch (windConditions) {
    case "offshore":
      return {
        icon: <Wind className="h-4 w-4 text-green-600 dark:text-green-400" />,
        label: "Offshore",
      };
    case "light":
      return {
        icon: <CloudSun className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
        label: "Light",
      };
    case "onshore":
      return {
        icon: <Cloud className="h-4 w-4 text-gray-600 dark:text-gray-400" />,
        label: "Onshore",
      };
    default:
      return {
        icon: <Wind className="h-4 w-4 text-muted-foreground" />,
        label: "Variable",
      };
  }
}

/**
 * Get time slot display info
 */
function getTimeSlotInfo(
  timeSlot: DaySummary["bestTimeSlot"]
): { icon: React.ReactNode; label: string } {
  switch (timeSlot) {
    case "dawn-patrol":
      return {
        icon: <Sunrise className="h-4 w-4 text-orange-500" />,
        label: "Dawn Patrol",
      };
    case "morning":
      return {
        icon: <Sun className="h-4 w-4 text-yellow-500" />,
        label: "Morning",
      };
    case "midday":
      return {
        icon: <Sun className="h-4 w-4 text-yellow-600" />,
        label: "Midday",
      };
    case "afternoon":
      return {
        icon: <CloudSun className="h-4 w-4 text-orange-400" />,
        label: "Afternoon",
      };
    case "evening":
      return {
        icon: <Clock className="h-4 w-4 text-purple-500" />,
        label: "Evening",
      };
    default:
      return {
        icon: <Clock className="h-4 w-4 text-muted-foreground" />,
        label: "Anytime",
      };
  }
}

/**
 * Condition stat item with animation
 */
function ConditionStat({
  icon,
  label,
  value,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay?: number;
}) {

  return (
    <div
      className={cn(
        "flex items-center gap-2 opacity-0 animate-fade-in-up",
        "rounded-md border-2 border-[#11100D] bg-[#FBF6E8] p-3"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {icon}
      <div>
        <p
          className={cn(
            "text-sm",
            "font-mono uppercase tracking-[0.1em] text-[#11100D]/58"
          )}
        >
          {label}
        </p>
        <p className={cn("font-semibold", "text-[#11100D]")}>
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Individual day card component
 */
function BestDayCard({
  day,
  isHero = false,
  className,
  index = 0,
  onClick,
  showScores,
}: BestDayCardProps) {
  const scoreColors = getScoreColorClasses(day.score);
  const windInfo = getWindInfo(day.windConditions);
  const timeSlotInfo = getTimeSlotInfo(day.bestTimeSlot);
  const isEpic = scoreLabel(day.score) === "EPIC";

  if (isHero) {
    return (
      <button
        type="button"
        className={cn(
          "group relative block w-full overflow-hidden border-2 border-[#11100D] bg-[#F0E5CC] p-5 text-left shadow-[4px_5px_0_rgba(17,16,13,0.2)] transition-transform hover:-translate-y-1",
          className
        ) + " focus-ring"}
        onClick={onClick}
        aria-label={`Best day this week: ${day.dayOfWeek}`}
        data-testid="zine-best-day-card"
      >
        <QuiverSticker
          sticker="spotSwellMatch"
          className="absolute -right-5 -top-5 w-24 rotate-12 opacity-85 drop-shadow-md"
        />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
          {showScores && (
            <AnimatedScoreGauge
              score={day.score}
              size="xl"
              showLabel
              showAction={false}
              enableGlow={isEpic}
            />
          )}

          <div className="flex-1 space-y-5">
            <div>
              <p className="label-black mb-3">Best Day This Week</p>
              <h3 className="font-display text-3xl font-black uppercase leading-tight text-[#11100D]">
                {day.dayOfWeek}, {formatDateStringUTC(day.dateString)}
              </h3>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
                <AnimatedCounter
                  value={day.beachesWithGoodConditions}
                  duration={600}
                />{" "}
                beaches with good conditions
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ConditionStat
                icon={<Waves className="h-5 w-5 text-[#8A5E00]" />}
                label="Waves"
                value={formatWaveRange(day.waveRange)}
                delay={200}
              />
              <ConditionStat
                icon={windInfo.icon}
                label="Wind"
                value={windInfo.label}
                delay={300}
              />
              <ConditionStat
                icon={timeSlotInfo.icon}
                label="Best Time"
                value={timeSlotInfo.label}
                delay={400}
              />
              <ConditionStat
                icon={<Wind className="h-5 w-5 text-[#11100D]/70" />}
                label="Direction"
                value={day.dominantWindDirection}
                delay={500}
              />
            </div>
          </div>
        </div>
      </button>
    );
  }



  return (
      <ScrollReveal variant="fadeUp" delay={index * 100}>
        <button
          type="button"
          className={cn(
            "group block min-h-44 w-full border-2 border-[#11100D] bg-[#FBF6E8] p-4 text-left transition-transform hover:-translate-y-1",
            className
          ) + " focus-ring"}
          onClick={onClick}
          aria-label={`Surf day: ${day.dayOfWeek}`}
        >
          <div className="flex items-start gap-3">
            {showScores && (
              <div className="transition-transform duration-200 group-hover:scale-110">
                <ScoreBadge
                  score={day.score}
                  className={scoreColors.paperBadge}
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h4 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                {day.dayOfWeek}
              </h4>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/55">
                {formatDateStringUTC(day.dateString)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#11100D]/68">
                <span className="flex items-center gap-1">
                  <Waves className="h-3 w-3 text-[#8A5E00]" />
                  {formatWaveRange(day.waveRange)}
                </span>
                <span className="flex items-center gap-1">
                  {windInfo.icon}
                  {windInfo.label}
                </span>
              </div>
            </div>
          </div>
        </button>
      </ScrollReveal>
    );

  // Compact card for secondary days with hover effects

}

/**
 * BestDaysSection Component
 *
 * Displays ranked surf days for a regional forecast with a hero card
 * for the best day and a grid of secondary good days.
 * Features ocean gradient backgrounds, animated gauges, and scroll reveals.
 *
 * @example
 * ```tsx
 * <BestDaysSection
 *   days={regionalSummary.days}
 *   bestDay={regionalSummary.bestDay}
 *   regionName="San Diego"
 *   regionSlug="san-diego"
 * />
 * ```
 */
export function BestDaysSection({
  days,
  bestDay,
  regionName,
  className,
  regionSlug,
  showScores = true,
  authAwareScores = false,
}: BestDaysSectionProps) {
  const auth = useOptionalAuth();
  const resolvedShowScores = authAwareScores
    ? Boolean(auth?.user && !auth.isLoading)
    : showScores;
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  // Track when section enters viewport (fire once)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || days.length === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          trackBestConditionsViewed(days.length, false);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [days.length]);

  // Sort days by score, excluding bestDay, and take top 4
  const otherTopDays = days
    .filter((d) => d.dateString !== bestDay.dateString)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);


  return (
    <section ref={sectionRef} className={cn("space-y-6", className)}>
      {/* Section Header */}
      <ScrollReveal variant="fadeUp">
        <div className="space-y-1">
          <h2
            className={cn(
              "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
            )}
          >
            Best Days to Surf {regionName} This Week
          </h2>
          <p className={cn("text-[#11100D]/66")}>
            Based on wave height, wind conditions, and swell quality
          </p>
          {!resolvedShowScores && regionSlug && (
            <ScoreLoginLink regionSlug={regionSlug} />
          )}
        </div>
      </ScrollReveal>

      {/* Hero Best Day Card */}
      <ScrollReveal variant="scale" delay={100}>
        <BestDayCard
          day={bestDay}
          isHero
          showScores={resolvedShowScores}
          // regionName passed as beachName - these are region-level day cards, not beach-specific
          onClick={() => trackBestConditionsClick(regionName, 1, bestDay.score)}
        />
      </ScrollReveal>

      {/* Other Good Days Grid */}
      {otherTopDays.length > 0 && (
        <div className="space-y-3">
          <ScrollReveal variant="fadeUp" delay={200}>
            <h3
              className={cn(
                "font-display text-xl font-black uppercase text-[#11100D]"
              )}
            >
              Other Good Days
            </h3>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherTopDays.map((day, index) => (
              <BestDayCard
                key={day.dateString}
                day={day}
                index={index}
                      showScores={resolvedShowScores}
                // regionName passed as beachName - these are region-level day cards, not beach-specific
                onClick={() => trackBestConditionsClick(regionName, index + 2, day.score)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
