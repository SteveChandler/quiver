"use client";

/**
 * Best Day Hero Component
 *
 * Hero card highlighting the best surf day this week, plus a
 * secondary grid of up to 4 other good days.
 *
 * @module components/forecast/conditions-overview/best-day-hero
 */

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
  offshore: { label: "Offshore", color: "text-[#0B6B3A]", icon: true },
  light: { label: "Light Wind", color: "text-[#0B3A75]", icon: false },
  onshore: { label: "Onshore", color: "text-[#C46A24]", icon: false },
};

export function BestDayHero({ bestDay, otherGoodDays, isUserSelected, isPersonalized }: BestDayHeroProps) {
  const wind = WIND_DISPLAY[bestDay.windConditions] ?? WIND_DISPLAY.onshore;

  return (
    <div className="space-y-4">
      <ScrollReveal variant="fadeUp">
        <div
          className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 shadow-[4px_4px_0_#11100D] sm:p-6"
        >
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 rotate-[-2deg] items-center justify-center rounded-full border-[3px] border-[#11100D] bg-[#0B3A75] shadow-[3px_3px_0_#11100D]">
              <div className="text-center">
                <div className="font-heading text-4xl font-black leading-none text-[#F4EBD8]">
                  {bestDay.score}
                </div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#F78E42]">
                  Score
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-center sm:text-left">
              <span
                className={cn(
                  "w-fit self-center rounded-full border-2 border-[#11100D] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] sm:self-start",
                  isUserSelected
                    ? "bg-[#8AB4F8] text-[#11100D]"
                    : "bg-[#F78E42] text-[#11100D]",
                )}
              >
                {isUserSelected ? "Selected Day" : "Best Day This Week"}
              </span>

              <h3 className="font-heading text-3xl font-black uppercase leading-tight text-[#11100D]">
                {bestDay.dayName}, {bestDay.date}
              </h3>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-[#11100D] sm:justify-start">
                <span className="inline-flex items-center gap-1">
                  <Waves className="h-4 w-4" />
                  {formatWaveRange(
                    [bestDay.minHeight, bestDay.maxHeight],
                    "integer"
                  )}
                </span>

                <span className={cn("inline-flex items-center gap-1", wind.color)}>
                  {wind.icon && <Wind className="h-4 w-4" />}
                  {wind.label}
                </span>

                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Best: {capitalize(bestDay.bestTimeSlot)}
                </span>

                {bestDay.period != null && (
                  <span className="text-[#0B3A75]">
                    {bestDay.period}s period
                  </span>
                )}

                {isPersonalized && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#0B3A75]">
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
                className="flex flex-col gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 shadow-[3px_3px_0_#11100D]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#0B3A75] font-heading text-sm font-black text-[#F4EBD8]">
                    {day.score}
                  </span>
                  <div className="text-sm font-black leading-tight text-[#11100D]">
                    {day.dayName}, {day.date}
                  </div>
                </div>

                <p className="text-xs font-semibold text-[#5F5646]">
                  {formatWaveRange([day.minHeight, day.maxHeight], "integer")}
                  {" - "}
                  <span
                    className={cn(
                      dayWind.color,
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
