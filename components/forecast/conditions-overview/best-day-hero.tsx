"use client";

/**
 * Best Day Hero Component
 *
 * Hero card highlighting the best surf day this week, plus a
 * secondary grid of up to 4 other good days.
 *
 * @module components/forecast/conditions-overview/best-day-hero
 */

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { ScoreBadge } from "@/components/forecast/score-badge";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { formatWaveRange } from "@/lib/utils/wave-formatters";
import { capitalize } from "@/lib/utils/text-utils";
import { cn } from "@/lib/utils";
import { Wind, Clock, Waves, Sparkles } from "lucide-react";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";

interface BestDayHeroProps {
  bestDay: EnrichedDaySummary;
  otherGoodDays: EnrichedDaySummary[];
  /** When true, the hero shows a user-selected date instead of the overall best */
  isUserSelected?: boolean;
  isPersonalized?: boolean;
}

const WIND_DISPLAY: Record<
  string,
  { label: string; color: string; icon: boolean }
> = {
  offshore: { label: "Offshore", color: "text-green-300", icon: true },
  light: { label: "Light Wind", color: "text-blue-200", icon: false },
  onshore: { label: "Onshore", color: "text-amber-300", icon: false },
};

export function BestDayHero({ bestDay, otherGoodDays, isUserSelected, isPersonalized }: BestDayHeroProps) {
  const wind = WIND_DISPLAY[bestDay.windConditions] ?? WIND_DISPLAY.onshore;

  return (
    <div className="space-y-4">
      {/* ---------- Hero Card ---------- */}
      <ScrollReveal variant="fadeUp">
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl",
            "bg-gradient-to-br from-blue-600 to-cyan-500",
            "p-6 text-white shadow-lg"
          )}
        >
          {/* Subtle wave pattern overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 30 Q50 0 100 30 T200 30\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'/%3E%3C/svg%3E")',
              backgroundRepeat: "repeat",
              backgroundSize: "200px 60px",
            }}
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Score gauge */}
            <AnimatedScoreGauge
              score={bestDay.score}
              size="xl"
              showLabel
              variant="hero"
              className="shrink-0"
            />

            {/* Info column */}
            <div className="flex flex-col gap-2 text-center sm:text-left">
              <Badge
                variant="secondary"
                className={cn(
                  "w-fit self-center sm:self-start",
                  isUserSelected
                    ? "bg-blue-400/90 text-blue-950 hover:bg-blue-400"
                    : "bg-amber-400/90 text-amber-950 hover:bg-amber-400"
                )}
              >
                {isUserSelected ? "Selected Day" : "Best Day This Week"}
              </Badge>

              <h3 className="text-2xl font-bold leading-tight">
                {bestDay.dayName}, {bestDay.date}
              </h3>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
                {/* Wave range */}
                <span className="inline-flex items-center gap-1">
                  <Waves className="h-4 w-4" />
                  {formatWaveRange(
                    [bestDay.minHeight, bestDay.maxHeight],
                    "integer"
                  )}
                </span>

                {/* Wind */}
                <span className={cn("inline-flex items-center gap-1", wind.color)}>
                  {wind.icon && <Wind className="h-4 w-4" />}
                  {wind.label}
                </span>

                {/* Best time slot */}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Best: {capitalize(bestDay.bestTimeSlot)}
                </span>

                {/* Swell period */}
                {bestDay.period != null && (
                  <span className="text-high">
                    {bestDay.period}s period
                  </span>
                )}

                {isPersonalized && (
                  <span className="inline-flex items-center gap-1 text-xs text-high">
                    <Sparkles className="h-3 w-3" />
                    Scored for you
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ---------- Other Good Days ---------- */}
      {otherGoodDays.length > 0 && (
        <ScrollReveal
          variant="fadeUp"
          stagger
          staggerDelay={80}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {otherGoodDays.slice(0, 4).map((day) => {
            const dayWind = WIND_DISPLAY[day.windConditions] ?? WIND_DISPLAY.onshore;
            return (
              <div
                key={day.fullDate}
                className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center gap-2">
                  <ScoreBadge score={day.score} size="sm" />
                  <div className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                    {day.dayName}, {day.date}
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatWaveRange([day.minHeight, day.maxHeight], "integer")}
                  {" - "}
                  <span
                    className={cn(
                      dayWind.color === "text-green-300" && "text-green-600 dark:text-green-400",
                      dayWind.color === "text-blue-200" && "text-blue-600 dark:text-blue-400",
                      dayWind.color === "text-amber-300" && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {dayWind.label}
                  </span>
                </p>
              </div>
            );
          })}
        </ScrollReveal>
      )}
    </div>
  );
}
