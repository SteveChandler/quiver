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
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { getScoreCall } from "./score-band-call";
import { ScoreBadge } from "./score-badge";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { QuiverSticker } from "@/components/zine";
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
  /** Visual treatment variant */
  variant?: "default" | "zine";
  /** Whether personalized score values are available to this viewer */
  showScores?: boolean;
}

function ScoreLoginLink({ regionSlug }: { regionSlug: string }) {
  return (
    <Link
      href={`/auth/sign-in?redirectTo=/forecast/${regionSlug}`}
      className="inline-flex font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#11100D] underline decoration-[#B56A2B] decoration-2 underline-offset-4 transition-colors hover:text-[#B56A2B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#11100D]"
    >
      Log in to get your score
    </Link>
  );
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
function TrendIndicator({
  trend,
  variant = "default",
}: {
  trend: BeachConditionSummary["trend"];
  variant?: "default" | "zine";
}) {
  const config = trendConfig[trend];
  const Icon = config.icon;
  const isZine = variant === "zine";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-[color,background-color,border-color,transform] duration-200",
        isZine
          ? "border border-[#11100D]/25 bg-[#F0E5CC] text-[#11100D]"
          : [config.bgColor, config.color],
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
  regionSlug,
  showScores,
  variant = "default",
}: {
  beach: BeachConditionSummary;
  index: number;
  regionSlug: string;
  showScores: boolean;
  variant?: "default" | "zine";
}) {
  const scoreCall = getScoreCall(beach.currentScore);
  const isZine = variant === "zine";

  return (
    <TableRow
      className={cn(
        isZine
          ? "border-[#11100D]/20 hover:bg-[#F4EBD8]"
          : "hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-transparent",
        "transition-colors duration-200"
      )}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <TableCell className="font-medium">
        <Link
          href={buildBeachUrl({ slug: beach.beachSlug, city: beach.city, state: beach.state, country: beach.country })}
          className={cn(
            "transition-colors hover:underline",
            isZine ? "font-bold text-[#11100D] hover:text-[#B56A2B]" : "text-foreground hover:text-primary"
          )}
        >
          {beach.beachName}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Calendar className={cn("h-4 w-4", isZine ? "text-[#11100D]/58" : "text-muted-foreground")} />
          <span className={cn("text-sm", isZine && "text-[#11100D]/72")}>{beach.bestDay}</span>
          {showScores && beach.bestDayScore > 0 && (
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
        <div className={cn("flex items-center gap-1.5", isZine ? "text-[#11100D]/68" : "text-muted-foreground")}>
          <Waves className={cn("h-4 w-4", isZine ? "text-[#0B3A75]" : "text-blue-500")} />
          <span className={cn("font-medium tabular-nums", isZine ? "text-[#11100D]" : "text-foreground")}>
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
        <TrendIndicator trend={beach.trend} variant={variant} />
      </TableCell>
      <TableCell>
        {showScores ? (
          <div className="flex items-center gap-2">
            <div className="transition-transform duration-200 hover:scale-110">
              <ScoreBadge
                score={beach.currentScore}
                className={getScoreColorClasses(beach.currentScore).paperBadge}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-bold text-[#11100D]">
                {scoreCall.label}
              </span>
            </div>
          </div>
        ) : (
          <ScoreLoginLink regionSlug={regionSlug} />
        )}
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
  regionSlug,
  showScores,
  variant = "default",
}: {
  beach: BeachConditionSummary;
  index: number;
  regionSlug: string;
  showScores: boolean;
  variant?: "default" | "zine";
}) {
  const scoreCall = getScoreCall(beach.currentScore);
  const isZine = variant === "zine";

  return (
    <ScrollReveal variant="fadeUp" delay={index * 75}>
      <Card
        className={cn(
          "transition-[background-color,border-color,box-shadow,transform] duration-200 group",
          isZine
            ? "rounded-none border-2 border-[#11100D] bg-[#FBF6E8] shadow-[2px_3px_0_rgba(17,16,13,0.18)] hover:-translate-y-0.5"
            : "hover:shadow-md hover:border-border/80"
        )}
      >
        <CardContent className={cn("p-4", isZine && "relative z-10")}>
          <div className="flex items-start gap-3">
            {/* Score Badge with hover scale */}
            {showScores && (
              <div className="transition-transform duration-200 group-hover:scale-110">
                <ScoreBadge
                  score={beach.currentScore}
                  className={getScoreColorClasses(beach.currentScore).paperBadge}
                />
              </div>
            )}

            {/* Beach Info */}
            <div className="flex-1 min-w-0">
              {/* Beach Name */}
              <Link
                href={buildBeachUrl({ slug: beach.beachSlug, city: beach.city, state: beach.state, country: beach.country })}
                className={cn(
                  "font-semibold hover:underline transition-colors line-clamp-1",
                  isZine ? "text-[#11100D] hover:text-[#B56A2B]" : "text-foreground hover:text-primary"
                )}
              >
                {beach.beachName}
              </Link>

              {/* Score Label */}
              {showScores ? (
                <p className="mt-0.5 text-xs font-medium text-[#11100D]">
                  {scoreCall.label}
                </p>
              ) : (
                <div className="mt-1">
                  <ScoreLoginLink regionSlug={regionSlug} />
                </div>
              )}

              {/* Quick Stats with animated wave height */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <span className={cn("flex items-center gap-1", isZine ? "text-[#11100D]/68" : "text-muted-foreground")}>
                  <Waves className={cn("h-3.5 w-3.5", isZine ? "text-[#0B3A75]" : "text-blue-500")} />
                  <span className={cn("font-medium tabular-nums", isZine ? "text-[#11100D]" : "text-foreground")}>
                    <AnimatedCounter
                      value={beach.currentWaveHeight}
                      decimals={1}
                      suffix="ft"
                      duration={600}
                    />
                  </span>
                </span>
                <TrendIndicator trend={beach.trend} variant={variant} />
              </div>

              {/* Best Day */}
              <div className={cn("mt-2 flex items-center gap-1.5 text-xs", isZine ? "text-[#11100D]/68" : "text-muted-foreground")}>
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Best: <span className="font-medium">{beach.bestDay}</span>
                </span>
                {showScores && beach.bestDayScore > 0 && (
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
  variant = "default",
  showScores = true,
}: BeachConditionsGridProps) {
  // Sort beaches by current score (highest first) and limit display
  const displayBeaches = beaches
    .slice()
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, maxBeaches);

  const hasMoreBeaches = beaches.length > maxBeaches;
  const isZine = variant === "zine";

  if (beaches.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <h2
          className={cn(
            isZine
              ? "font-display text-3xl font-black uppercase text-[#11100D]"
              : "text-2xl font-bold text-foreground"
          )}
        >
          Beach Conditions
        </h2>
        <p className={cn(isZine ? "text-[#11100D]/66" : "text-muted-foreground")}>
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
          <div className="flex items-start gap-3">
            {isZine && (
              <QuiverSticker
                sticker="spotLocation"
                className="hidden w-14 -rotate-6 drop-shadow-sm sm:block"
              />
            )}
            <div>
            <h2
              className={cn(
                isZine
                  ? "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
                  : "text-2xl font-bold text-foreground"
              )}
            >
              Beach Conditions
            </h2>
            <p className={cn("text-sm mt-1", isZine ? "text-[#11100D]/66" : "text-muted-foreground")}>
              Current conditions ranked by surf quality
            </p>
            </div>
          </div>
          {showViewAll && hasMoreBeaches && (
            <Link
              href={`/guides/surfing-${regionSlug}`}
              className={cn(
                "text-sm font-medium hover:underline transition-colors whitespace-nowrap",
                isZine ? "text-[#B56A2B] hover:text-[#11100D]" : "text-primary hover:text-primary/80"
              )}
            >
              View all{" "}
              <AnimatedCounter value={beaches.length} duration={400} /> beaches
              &rarr;
            </Link>
          )}
        </div>
      </ScrollReveal>

      {/* Desktop Table View */}
      <div className={cn("hidden md:block", isZine && "border-2 border-[#11100D] bg-[#FBF6E8] p-2")}>
        <ScrollReveal variant="fadeIn" delay={100}>
          <Table>
            <TableHeader>
              <TableRow className="border-[#11100D]">
                <TableHead className="w-[30%] font-mono uppercase tracking-[0.1em] text-[#11100D]">Beach</TableHead>
                <TableHead className="w-[20%] font-mono uppercase tracking-[0.1em] text-[#11100D]">Best Day</TableHead>
                <TableHead className="w-[15%] font-mono uppercase tracking-[0.1em] text-[#11100D]">Wave Height</TableHead>
                <TableHead className="w-[15%] font-mono uppercase tracking-[0.1em] text-[#11100D]">Trend</TableHead>
                <TableHead className="w-[20%] font-mono uppercase tracking-[0.1em] text-[#11100D]">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayBeaches.map((beach, index) => (
                <BeachConditionRow
                  key={beach.beachId}
                  beach={beach}
                  index={index}
                  regionSlug={regionSlug}
                  showScores={showScores}
                  variant={variant}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollReveal>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {displayBeaches.map((beach, index) => (
          <BeachConditionCard
            key={beach.beachId}
            beach={beach}
            index={index}
            regionSlug={regionSlug}
            showScores={showScores}
            variant={variant}
          />
        ))}
      </div>

      {/* View All Link for Mobile */}
      {showViewAll && hasMoreBeaches && (
        <ScrollReveal variant="fadeUp" delay={displayBeaches.length * 75 + 100}>
          <div className="md:hidden text-center pt-2">
            <Link
              href={`/guides/surfing-${regionSlug}`}
              className={cn(
                "text-sm font-medium hover:underline transition-colors",
                isZine ? "text-[#B56A2B] hover:text-[#11100D]" : "text-primary hover:text-primary/80"
              )}
            >
              View all {beaches.length} beaches &rarr;
            </Link>
          </div>
        </ScrollReveal>
      )}
    </section>
  );
}
