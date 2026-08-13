/**
 * Regional Forecast Card Component
 *
 * Summary card for the forecast hub page showing a region's overview.
 * Displays best day, wave range, conditions quality, and beach count.
 * Enhanced with sparklines, animations, and ocean gradient effects.
 *
 * @module components/forecast/regional-forecast-card
 */

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves, ArrowRight } from "lucide-react";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { RegionalForecastSummary } from "@/lib/utils/regional-forecast-utils";
import { getQualityConfig } from "@/lib/utils/score-color-utils";
import { formatWaveRange } from "@/lib/utils/wave-formatters";
import { WaveSparkline, createSparklineData } from "./wave-sparkline";
import { AnimatedCounter } from "@/components/ui/animated-counter";

// ============================================================================
// Types
// ============================================================================

export interface RegionalForecastCardProps {
  /** The forecast region to display */
  region: ForecastRegion;
  /** Optional summary data - if not provided, show loading/skeleton */
  summary?: RegionalForecastSummary;
  /** Override link destination */
  href?: string;
  /** Additional CSS classes */
  className?: string;
}


// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Quality score badge using Badge UI component with outline styling
 * Different from the shared ScoreBadge which is a circular badge
 */
function QualityScoreBadge({ score }: { score: number }) {
  const config = getQualityConfig(score);

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-sm font-semibold tabular-nums transition-transform duration-200",
        config.badgeClass
      )}
    >
      {score}
    </Badge>
  );
}

/**
 * Individual stat display with optional animation
 */
function Stat({
  label,
  value,
  animated = false,
  className,
}: {
  label: string;
  value: string | number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium">
        {animated && typeof value === "number" ? (
          <AnimatedCounter value={value} duration={600} />
        ) : (
          value
        )}
      </p>
    </div>
  );
}


/**
 * Skeleton loading state
 */
function RegionalForecastCardSkeleton({
  region,
  className,
}: {
  region: ForecastRegion;
  className?: string;
}) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{region.name}</CardTitle>
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>

        {/* Sparkline skeleton */}
        <div className="mt-4">
          <Skeleton className="h-8 w-full rounded" />
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Skeleton className="h-4 w-28" />
      </CardFooter>
    </Card>
  );
}

/**
 * No-data state when summary exists but has no forecast days
 */
function RegionalForecastCardNoData({
  region,
  summary,
  href,
  className,
}: {
  region: ForecastRegion;
  summary: RegionalForecastSummary;
  href?: string;
  className?: string;
}) {
  const cardHref = href || `/forecast/${region.slug}`;

  return (
    <Link href={cardHref} className={cn("block group", className)}>
      <Card className="h-full transition-shadow duration-200 hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {region.name}
            </CardTitle>
            <Badge variant="outline" className="text-sm text-muted-foreground">—</Badge>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Best Day" value="—" />
            <Stat label="Waves" value="—" />
            <Stat label="Conditions" value="No data" className="text-muted-foreground" />
            <Stat label="Beaches" value={summary.stats.totalBeaches} animated />
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <span className="flex items-center gap-1 text-sm text-primary group-hover:underline">
            View Full Forecast
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * RegionalForecastCard
 *
 * Displays a summary of forecast conditions for a region.
 * The entire card is clickable and links to the full forecast page.
 * Enhanced with wave sparkline, animated counters, and hover effects.
 *
 * @example
 * ```tsx
 * <RegionalForecastCard
 *   region={FORECAST_REGIONS['southern-california']}
 *   summary={forecastSummary}
 * />
 * ```
 */
export function RegionalForecastCard({
  region,
  summary,
  href,
  className,
}: RegionalForecastCardProps) {
  const cardHref = href || `/forecast/${region.slug}`;

  // Show skeleton state when summary data is not yet loaded
  if (!summary) {
    return <RegionalForecastCardSkeleton region={region} className={className} />;
  }

  // Show no-data state when summary exists but has no forecast days
  if (summary.days.length === 0) {
    return <RegionalForecastCardNoData region={region} summary={summary} href={href} className={className} />;
  }

  const quality = getQualityConfig(summary.bestDay.score);
  const hasIncomingSwell = summary.upcomingSwells.length > 0;
  const topBeachToday = summary.beachConditions[0];

  // Create sparkline data from days
  const sparklineData = createSparklineData(summary.days);

  return (
    <Link
      href={cardHref}
      className={cn("block group", className)}
    >
      <Card className={cn(
        "h-full transition-[background-color,background-image,box-shadow] duration-200",
        "hover:shadow-lg",
        "hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-blue-50/30"
      )}>
        {/* Header with region name and score */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {region.name}
            </CardTitle>
            <div className="transition-transform duration-200 group-hover:scale-110">
              <QualityScoreBadge score={summary.bestDay.score} />
            </div>
          </div>
        </CardHeader>

        {/* Summary stats grid */}
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Best Day"
              value={summary.bestDay.dayOfWeek}
            />
            <Stat
              label="Waves"
              value={formatWaveRange(summary.bestDay.waveRange, "integer")}
            />
            <Stat
              label="Conditions"
              value={quality.label}
              className={quality.textClass}
            />
            <Stat
              label="Beaches"
              value={summary.stats.totalBeaches}
              animated
            />
          </div>

          {/* Wave Sparkline - 7 day trend */}
          {sparklineData.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">7-Day Trend</span>
                <WaveSparkline
                  data={sparklineData}
                  width={100}
                  height={28}
                  showPeak
                />
              </div>
            </div>
          )}

          {/* Incoming swell indicator with pulse animation */}
          {hasIncomingSwell && (
            <div className={cn(
              "mt-4 flex items-center gap-2 text-sm text-blue-600",
              "animate-pulse-glow-blue rounded-md px-2 py-1 -mx-2"
            )}>
              <Waves className="w-4 h-4 text-blue-500" />
              <span>{summary.upcomingSwells[0].size} swell incoming</span>
            </div>
          )}

          {/* Top beach preview */}
          {topBeachToday && !hasIncomingSwell && (
            <div className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium">Today:</span> {topBeachToday.beachName}
              {topBeachToday.currentScore > 0 && (
                <span className="ml-1 text-xs">({topBeachToday.currentScore}/100)</span>
              )}
            </div>
          )}
        </CardContent>

        {/* CTA footer */}
        <CardFooter className="pt-0">
          <span className="flex items-center gap-1 text-sm text-primary group-hover:underline">
            View Full Forecast
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

/**
 * Grid container for multiple regional forecast cards
 */
export function RegionalForecastCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
