"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DaySummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses, SCORE_THRESHOLDS } from "@/lib/utils/score-color-utils";
import { formatWaveRange } from "@/lib/utils/wave-formatters";

import { ScoreBadge } from "./score-badge";
import { AnimatedScoreGauge } from "./animated-score-gauge";
import { WaveBackground } from "@/components/ui/ocean-background";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
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
  /** Stagger index for animation delay */
  index?: number;
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
      className="flex items-center gap-2 opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {icon}
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * Individual day card component
 */
function BestDayCard({ day, isHero = false, className, index = 0 }: BestDayCardProps) {
  const scoreColors = getScoreColorClasses(day.score);
  const windInfo = getWindInfo(day.windConditions);
  const timeSlotInfo = getTimeSlotInfo(day.bestTimeSlot);
  const isEpic = day.score >= SCORE_THRESHOLDS.EPIC;

  if (isHero) {
    return (
      <Card
        className={cn(
          "relative overflow-hidden border-2",
          "bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50",
          scoreColors.border,
          className
        )}
      >
        {/* Wave background overlay */}
        <WaveBackground variant="light" />

        {/* Best Day Label with scale animation */}
        <div className="absolute top-3 right-3 z-10">
          <Badge
            variant="default"
            className={cn(
              "bg-orange-500 text-white hover:bg-orange-600",
              "transform transition-transform hover:scale-105",
              isEpic && "animate-pulse-glow"
            )}
          >
            <Trophy className="h-3 w-3 mr-1" />
            Best Day This Week
          </Badge>
        </div>

        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Animated Score Gauge - Large with Label */}
            <AnimatedScoreGauge
              score={day.score}
              size="xl"
              showLabel
              enableGlow={isEpic}
            />

            {/* Day Info */}
            <div className="flex-1 space-y-4">
              {/* Date */}
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {day.dayOfWeek}, {formatDateStringUTC(day.dateString)}
                </h3>
                <p className="text-muted-foreground">
                  <AnimatedCounter
                    value={day.beachesWithGoodConditions}
                    duration={600}
                  />{" "}
                  beaches with good conditions
                </p>
              </div>

              {/* Conditions Grid with staggered fade-in */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ConditionStat
                  icon={<Waves className="h-5 w-5 text-blue-500" />}
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
                  icon={<Wind className="h-5 w-5 text-muted-foreground" />}
                  label="Direction"
                  value={day.dominantWindDirection}
                  delay={500}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact card for secondary days with hover effects
  return (
    <ScrollReveal variant="fadeUp" delay={index * 100}>
      <Card
        className={cn(
          "transition-all duration-200",
          "hover:shadow-md hover:border-border/80",
          "hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/50",
          "group",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Score Badge with hover scale */}
            <div className="transition-transform duration-200 group-hover:scale-110">
              <ScoreBadge score={day.score} />
            </div>

            {/* Day Info */}
            <div className="flex-1 min-w-0">
              {/* Date */}
              <h4 className="font-semibold text-foreground truncate">
                {day.dayOfWeek}
              </h4>
              <p className="text-xs text-muted-foreground">
                {formatDateStringUTC(day.dateString)}
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
    </ScrollReveal>
  );
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
      <ScrollReveal variant="fadeUp">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">
            Best Days to Surf {regionName} This Week
          </h2>
          <p className="text-muted-foreground">
            Based on wave height, wind conditions, and swell quality
          </p>
        </div>
      </ScrollReveal>

      {/* Hero Best Day Card */}
      <ScrollReveal variant="scale" delay={100}>
        <BestDayCard day={bestDay} isHero />
      </ScrollReveal>

      {/* Other Good Days Grid */}
      {otherTopDays.length > 0 && (
        <div className="space-y-3">
          <ScrollReveal variant="fadeUp" delay={200}>
            <h3 className="text-lg font-semibold text-foreground">
              Other Good Days
            </h3>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherTopDays.map((day, index) => (
              <BestDayCard key={day.dateString} day={day} index={index} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
