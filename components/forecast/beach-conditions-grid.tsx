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
import { ScoreLoginLink } from "./score-login-link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { QuiverSticker } from "@/components/zine";
import { useOptionalAuth } from "@/context/auth-context";
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
interface BeachConditionsGridProps {
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
  /** Whether score values are available to this viewer */
  showScores?: boolean;
  /** Resolve score visibility from the client auth context. */
  authAwareScores?: boolean;
}

/**
 * Trend indicator configuration with enhanced styling
 */
const trendConfig = {
  improving: {
    icon: TrendingUp,
    label: "Improving",
    pulseClass: "animate-pulse",
  },
  steady: {
    icon: Minus,
    label: "Steady",
    pulseClass: "",
  },
  declining: {
    icon: TrendingDown,
    label: "Declining",
    pulseClass: "",
  },
} as const;

/**
 * Enhanced trend indicator component with subtle animation for improving conditions
 */
function TrendIndicator({
  trend,
}: {
  trend: BeachConditionSummary["trend"];
}) {
  const config = trendConfig[trend];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-[color,background-color,border-color,transform] duration-200",
        "border border-[#11100D]/25 bg-[#F0E5CC] text-[#11100D]",
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
}: {
  beach: BeachConditionSummary;
  index: number;
  regionSlug: string;
  showScores: boolean;
}) {
  const scoreCall = getScoreCall(beach.currentScore);

  return (
    <TableRow
      className={cn(
        "border-[#11100D]/20 hover:bg-[#F4EBD8]",
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
            "font-bold text-[#11100D] hover:text-[#B56A2B]"
          )}
        >
          {beach.beachName}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Calendar className={cn("h-4 w-4", "text-[#11100D]/58")} />
          <span className={cn("text-sm", "text-[#11100D]/72")}>{beach.bestDay}</span>
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
        <div className={cn("flex items-center gap-1.5", "text-[#11100D]/68")}>
          <Waves className={cn("h-4 w-4", "text-[#8A5E00]")} />
          <span className={cn("font-medium tabular-nums", "text-[#11100D]")}>
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
}: {
  beach: BeachConditionSummary;
  index: number;
  regionSlug: string;
  showScores: boolean;
}) {
  const scoreCall = getScoreCall(beach.currentScore);

  return (
    <ScrollReveal variant="fadeUp" delay={index * 75}>
      <Card
        className={cn(
          "transition-[background-color,border-color,box-shadow,transform] duration-200 group",
          "rounded-none border-2 border-[#11100D] bg-[#FBF6E8] shadow-[2px_3px_0_rgba(17,16,13,0.18)] hover:-translate-y-0.5"
        )}
      >
        <CardContent className={cn("p-4", "relative z-10")}>
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
                  "text-[#11100D] hover:text-[#B56A2B]"
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
                <span className={cn("flex items-center gap-1", "text-[#11100D]/68")}>
                  <Waves className={cn("h-3.5 w-3.5", "text-[#8A5E00]")} />
                  <span className={cn("font-medium tabular-nums", "text-[#11100D]")}>
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
              <div className={cn("mt-2 flex items-center gap-1.5 text-xs", "text-[#11100D]/68")}>
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
  showScores = true,
  authAwareScores = false,
}: BeachConditionsGridProps) {
  const auth = useOptionalAuth();
  const resolvedShowScores = authAwareScores
    ? Boolean(auth?.user && !auth.isLoading)
    : showScores;
  // Sort beaches by current score (highest first) and limit display
  const displayBeaches = beaches
    .slice()
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, maxBeaches);

  const hasMoreBeaches = beaches.length > maxBeaches;
  // Built as a string rather than JSX text: SWC drops the leading whitespace of
  // a JSX text node that contains an HTML entity and a newline, so
  // `{n} beaches &rarr;` across two lines rendered "View all 35beaches →".
  const viewAllLabel = `View all ${beaches.length} beaches →`;

  if (beaches.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <h2
          className={cn(
            "font-display text-3xl font-black uppercase text-[#11100D]"
          )}
        >
          Beach Conditions
        </h2>
        <p className={cn("text-[#11100D]/66")}>
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
            {(
              <QuiverSticker
                sticker="spotLocation"
                className="hidden w-14 -rotate-6 drop-shadow-sm sm:block"
              />
            )}
            <div>
            <h2
              className={cn(
                "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              )}
            >
              Beach Conditions
            </h2>
            <p className={cn("text-sm mt-1", "text-[#11100D]/66")}>
              Current conditions ranked by surf quality
            </p>
            </div>
          </div>
          {showViewAll && hasMoreBeaches && (
            <Link
              href={`/guides/surfing-${regionSlug}`}
              className={cn(
                "text-sm font-medium hover:underline transition-colors whitespace-nowrap",
                "text-[#B56A2B] hover:text-[#11100D]"
              )}
            >
              {viewAllLabel}
            </Link>
          )}
        </div>
      </ScrollReveal>

      {/* Desktop Table View */}
      <div className={cn("hidden md:block", "border-2 border-[#11100D] bg-[#FBF6E8] p-2")}>
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
                  showScores={resolvedShowScores}
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
            showScores={resolvedShowScores}
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
                "text-[#B56A2B] hover:text-[#11100D]"
              )}
            >
              {viewAllLabel}
            </Link>
          </div>
        </ScrollReveal>
      )}
    </section>
  );
}
