"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DaySummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { formatWaveRange } from "@/lib/utils/wave-formatters";
import { formatFullDate } from "@/lib/utils/time-formatters";
import { ScoreBadge } from "./score-badge";
import {
  Sun,
  Wind,
  CloudSun,
  Cloud,
  Sunrise,
  Clock,
  Waves,
  Trophy,
} from "lucide-react";

/**
 * Props for the BestDaysSection component
 */
export interface BestDaysSectionProps {
  /** Array of day summaries from RegionalForecastSummary */
  days: DaySummary[];
  /** The best day for surfing in the region */
  bestDay: DaySummary;
  /** Region name for display text (e.g., "San Diego") */
  regionName: string;
  /** Optional className for customization */
  className?: string;
}

/**
 * Props for individual BestDayCard component
 */
interface BestDayCardProps {
  day: DaySummary;
  isHero?: boolean;
  className?: string;
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
 * Individual day card component
 */
function BestDayCard({ day, isHero = false, className }: BestDayCardProps) {
  const scoreColors = getScoreColorClasses(day.score);
  const windInfo = getWindInfo(day.windConditions);
  const timeSlotInfo = getTimeSlotInfo(day.bestTimeSlot);

  if (isHero) {
    return (
      <Card
        className={cn(
          "relative overflow-hidden border-2",
          scoreColors.border,
          className
        )}
      >
        {/* Best Day Label */}
        <div className="absolute top-3 right-3">
          <Badge
            variant="default"
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Trophy className="h-3 w-3 mr-1" />
            Best Day This Week
          </Badge>
        </div>

        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Score Badge - Large with Label */}
            <ScoreBadge score={day.score} size="lg" showLabel />

            {/* Day Info */}
            <div className="flex-1 space-y-4">
              {/* Date */}
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {formatFullDate(day.date)}
                </h3>
                <p className="text-muted-foreground">
                  {day.beachesWithGoodConditions} beaches with good conditions
                </p>
              </div>

              {/* Conditions Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Wave Height */}
                <div className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Waves</p>
                    <p className="font-semibold text-foreground">
                      {formatWaveRange(day.waveRange)}
                    </p>
                  </div>
                </div>

                {/* Wind */}
                <div className="flex items-center gap-2">
                  {windInfo.icon}
                  <div>
                    <p className="text-sm text-muted-foreground">Wind</p>
                    <p className="font-semibold text-foreground">
                      {windInfo.label}
                    </p>
                  </div>
                </div>

                {/* Best Time */}
                <div className="flex items-center gap-2">
                  {timeSlotInfo.icon}
                  <div>
                    <p className="text-sm text-muted-foreground">Best Time</p>
                    <p className="font-semibold text-foreground">
                      {timeSlotInfo.label}
                    </p>
                  </div>
                </div>

                {/* Wind Direction */}
                <div className="flex items-center gap-2">
                  <Wind className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Direction</p>
                    <p className="font-semibold text-foreground">
                      {day.dominantWindDirection}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact card for secondary days
  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md hover:border-border/80",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Score Badge - Small */}
          <ScoreBadge score={day.score} />

          {/* Day Info */}
          <div className="flex-1 min-w-0">
            {/* Date */}
            <h4 className="font-semibold text-foreground truncate">
              {day.dayOfWeek}
            </h4>
            <p className="text-xs text-muted-foreground">
              {day.date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>

            {/* Quick Stats */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Waves className="h-3 w-3" />
                {formatWaveRange(day.waveRange)}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {windInfo.icon}
                {windInfo.label}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * BestDaysSection Component
 *
 * Displays ranked surf days for a regional forecast with a hero card
 * for the best day and a grid of secondary good days.
 *
 * @example
 * ```tsx
 * <BestDaysSection
 *   days={regionalSummary.days}
 *   bestDay={regionalSummary.bestDay}
 *   regionName="San Diego"
 * />
 * ```
 */
export function BestDaysSection({
  days,
  bestDay,
  regionName,
  className,
}: BestDaysSectionProps) {
  // Sort days by score, excluding bestDay, and take top 4
  const otherTopDays = days
    .filter((d) => d.dateString !== bestDay.dateString)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <section className={cn("space-y-6", className)}>
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">
          Best Days to Surf {regionName} This Week
        </h2>
        <p className="text-muted-foreground">
          Based on wave height, wind conditions, and swell quality
        </p>
      </div>

      {/* Hero Best Day Card */}
      <BestDayCard day={bestDay} isHero />

      {/* Other Good Days Grid */}
      {otherTopDays.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Other Good Days
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherTopDays.map((day) => (
              <BestDayCard key={day.dateString} day={day} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
