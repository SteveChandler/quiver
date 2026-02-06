"use client";

/**
 * Beach Conditions Grid Component
 *
 * Displays a responsive grid/table of beaches with current conditions.
 * Enhanced with animated counters and scroll reveal effects.
 *
 * @module components/forecast/beach-conditions-grid
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { formatWaveHeight } from "@/lib/utils/wave-formatters";
import { ScoreBadge } from "./score-badge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Waves, Calendar } from "lucide-react";

/**
 * Props for the BeachConditionsGrid component
 */
export interface BeachConditionsGridProps {
  /** Array of beach condition summaries */
  beaches: BeachConditionSummary[];
  /** Region slug for constructing beach links */
  regionSlug: string;
  /** Maximum number of beaches to display (default: 12) */
  maxBeaches?: number;
  /** Whether to show "View all beaches" link when beaches exceed maxBeaches */
  showViewAll?: boolean;
  /** Optional className for customization */
  className?: string;
}

/**
 * Trend indicator configuration with enhanced styling
 */
const trendConfig = {
  improving: {
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Improving",
    pulseClass: "animate-pulse",
  },
  steady: {
    icon: Minus,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    label: "Steady",
    pulseClass: "",
  },
  declining: {
    icon: TrendingDown,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Declining",
    pulseClass: "",
  },
} as const;

/**
 * Enhanced trend indicator component with subtle animation for improving conditions
 */
function TrendIndicator({ trend }: { trend: BeachConditionSummary["trend"] }) {
  const config = trendConfig[trend];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
        config.bgColor,
        config.color,
        trend === "improving" && "hover:scale-105"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", config.pulseClass)} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}

/**
 * Individual beach row for desktop table view with hover effects
 */
function BeachConditionRow({
  beach,
  index,
}: {
  beach: BeachConditionSummary;
  index: number;
}) {
  const scoreColors = getScoreColorClasses(beach.currentScore);

  return (
    <TableRow
      className={cn(
        "hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-transparent",
        "transition-all duration-200"
      )}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <TableCell className="font-medium">
        <Link
          href={`/beach/${beach.beachSlug}`}
          className="text-foreground hover:text-primary hover:underline transition-colors"
        >
          {beach.beachName}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{beach.bestDay}</span>
          {beach.bestDayScore > 0 && (
            <span
              className={cn(
                "text-xs",
                getScoreColorClasses(beach.bestDayScore).text
              )}
            >
              ({beach.bestDayScore})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Waves className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-foreground tabular-nums">
            <AnimatedCounter
              value={beach.currentWaveHeight}
              decimals={1}
              suffix="ft"
              duration={600}
            />
          </span>
        </div>
      </TableCell>
      <TableCell>
        <TrendIndicator trend={beach.trend} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="transition-transform duration-200 hover:scale-110">
            <ScoreBadge score={beach.currentScore} />
          </div>
          <span className={cn("text-xs font-medium", scoreColors.text)}>
            {scoreColors.label}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Individual beach card for mobile view with enhanced interactions
 */
function BeachConditionCard({
  beach,
  index,
}: {
  beach: BeachConditionSummary;
  index: number;
}) {
  const scoreColors = getScoreColorClasses(beach.currentScore);

  return (
    <ScrollReveal variant="fadeUp" delay={index * 75}>
      <Card className="transition-all duration-200 hover:shadow-md hover:border-border/80 group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Score Badge with hover scale */}
            <div className="transition-transform duration-200 group-hover:scale-110">
              <ScoreBadge score={beach.currentScore} />
            </div>

            {/* Beach Info */}
            <div className="flex-1 min-w-0">
              {/* Beach Name */}
              <Link
                href={`/beach/${beach.beachSlug}`}
                className="font-semibold text-foreground hover:text-primary hover:underline transition-colors line-clamp-1"
              >
                {beach.beachName}
              </Link>

              {/* Score Label */}
              <p className={cn("text-xs font-medium mt-0.5", scoreColors.text)}>
                {scoreColors.label} conditions
              </p>

              {/* Quick Stats with animated wave height */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Waves className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium text-foreground tabular-nums">
                    <AnimatedCounter
                      value={beach.currentWaveHeight}
                      decimals={1}
                      suffix="ft"
                      duration={600}
                    />
                  </span>
                </span>
                <TrendIndicator trend={beach.trend} />
              </div>

              {/* Best Day */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Best: <span className="font-medium">{beach.bestDay}</span>
                </span>
                {beach.bestDayScore > 0 && (
                  <span
                    className={cn(
                      "font-medium",
                      getScoreColorClasses(beach.bestDayScore).text
                    )}
                  >
                    ({beach.bestDayScore})
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}

/**
 * BeachConditionsGrid Component
 *
 * Displays a grid/table of beaches with their current conditions including
 * score, wave height, trend, and best day. Shows a responsive table on desktop
 * and cards on mobile. Enhanced with animations and micro-interactions.
 *
 * @example
 * ```tsx
 * <BeachConditionsGrid
 *   beaches={regionalSummary.beachConditions}
 *   regionSlug="san-diego"
 *   maxBeaches={12}
 *   showViewAll
 * />
 * ```
 */
export function BeachConditionsGrid({
  beaches,
  regionSlug,
  maxBeaches = 12,
  showViewAll = true,
  className,
}: BeachConditionsGridProps) {
  // Sort beaches by current score (highest first) and limit display
  const displayBeaches = beaches
    .slice()
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, maxBeaches);

  const hasMoreBeaches = beaches.length > maxBeaches;

  if (beaches.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <h2 className="text-2xl font-bold text-foreground">Beach Conditions</h2>
        <p className="text-muted-foreground">
          No beach condition data available for this region.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)}>
      {/* Section Header */}
      <ScrollReveal variant="fadeUp">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Beach Conditions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Current conditions ranked by surf quality
            </p>
          </div>
          {showViewAll && hasMoreBeaches && (
            <Link
              href={`/guides/surfing-${regionSlug}`}
              className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors whitespace-nowrap"
            >
              View all{" "}
              <AnimatedCounter value={beaches.length} duration={400} /> beaches
              &rarr;
            </Link>
          )}
        </div>
      </ScrollReveal>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <ScrollReveal variant="fadeIn" delay={100}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Beach</TableHead>
                <TableHead className="w-[20%]">Best Day</TableHead>
                <TableHead className="w-[15%]">Wave Height</TableHead>
                <TableHead className="w-[15%]">Trend</TableHead>
                <TableHead className="w-[20%]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayBeaches.map((beach, index) => (
                <BeachConditionRow
                  key={beach.beachId}
                  beach={beach}
                  index={index}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollReveal>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {displayBeaches.map((beach, index) => (
          <BeachConditionCard key={beach.beachId} beach={beach} index={index} />
        ))}
      </div>

      {/* View All Link for Mobile */}
      {showViewAll && hasMoreBeaches && (
        <ScrollReveal variant="fadeUp" delay={displayBeaches.length * 75 + 100}>
          <div className="md:hidden text-center pt-2">
            <Link
              href={`/guides/surfing-${regionSlug}`}
              className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              View all {beaches.length} beaches &rarr;
            </Link>
          </div>
        </ScrollReveal>
      )}
    </section>
  );
}
