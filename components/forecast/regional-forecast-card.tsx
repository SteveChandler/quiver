/**
 * Regional Forecast Card Component
 *
 * Summary card for the forecast hub page showing a region's overview.
 * Displays best day, wave range, conditions quality, and beach count.
 *
 * @module components/forecast/regional-forecast-card
 */

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
        "text-sm font-semibold tabular-nums",
        config.badgeClass
      )}
    >
      {score}
    </Badge>
  );
}

/**
 * Individual stat display
 */
function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
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
      </CardContent>

      <CardFooter className="pt-0">
        <Skeleton className="h-4 w-28" />
      </CardFooter>
    </Card>
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

  const quality = getQualityConfig(summary.bestDay.score);
  const hasIncomingSwell = summary.upcomingSwells.length > 0;
  const topBeachToday = summary.beachConditions[0];

  return (
    <Link
      href={cardHref}
      className={cn("block group", className)}
    >
      <Card className="h-full transition-shadow hover:shadow-lg">
        {/* Header with region name and score */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {region.name}
            </CardTitle>
            <QualityScoreBadge score={summary.bestDay.score} />
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
            />
          </div>

          {/* Incoming swell indicator */}
          {hasIncomingSwell && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
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
